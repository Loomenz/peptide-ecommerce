// Lumen Peptides API Router
import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { fetchLiveBtcPrice, usdToSats } from '../services/fx.js';
import {
  createLightningInvoice,
  checkInvoiceStatus,
  settleSimulatedInvoice
} from '../services/lightning.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const router = Router();

// Load products
const productsPath = path.join(__dirname, '../data/products.json');
const ordersPath = path.join(__dirname, '../data/orders.json');

function getProducts() {
  const data = fs.readFileSync(productsPath, 'utf8');
  return JSON.parse(data);
}

function getOrders() {
  if (!fs.existsSync(ordersPath)) {
    fs.writeFileSync(ordersPath, '[]', 'utf8');
    return [];
  }
  const data = fs.readFileSync(ordersPath, 'utf8');
  try {
    return JSON.parse(data);
  } catch (e) {
    return [];
  }
}

function saveOrders(orders) {
  fs.writeFileSync(ordersPath, JSON.stringify(orders, null, 2), 'utf8');
}

/**
 * GET /api/products
 * Fetch all products, optional query: category, search
 */
router.get('/products', async (req, res) => {
  try {
    let products = getProducts();
    const { category, search } = req.query;

    if (category && category !== 'All') {
      products = products.filter(p => p.category.toLowerCase() === category.toLowerCase());
    }

    if (search) {
      const q = search.toLowerCase();
      products = products.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.subtitle.toLowerCase().includes(q) ||
        p.casNumber.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    }

    const btcPrice = await fetchLiveBtcPrice();

    // Attach estimated satoshi pricing for each variant
    const enriched = products.map(product => {
      const variantsWithSats = product.variants.map(v => {
        const sats = Math.round((v.priceUSD / btcPrice) * 100_000_000);
        return { ...v, priceSats: sats };
      });
      return { ...product, variants: variantsWithSats };
    });

    res.json({
      success: true,
      count: enriched.length,
      btcPrice,
      products: enriched
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/products/:id
 * Retrieve single peptide details & COA specifications
 */
router.get('/products/:id', async (req, res) => {
  try {
    const products = getProducts();
    const product = products.find(p => p.id === req.params.id || p.slug === req.params.id);

    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    const btcPrice = await fetchLiveBtcPrice();
    const variantsWithSats = product.variants.map(v => ({
      ...v,
      priceSats: Math.round((v.priceUSD / btcPrice) * 100_000_000)
    }));

    res.json({
      success: true,
      product: { ...product, variants: variantsWithSats },
      btcPrice
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/fx
 * Current BTC/USD exchange rate
 */
router.get('/fx', async (req, res) => {
  try {
    const btcPrice = await fetchLiveBtcPrice();
    res.json({
      success: true,
      btcPriceUSD: Math.round(btcPrice),
      satsPerDollar: Math.round(100_000_000 / btcPrice),
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/cart/calculate
 * Calculate cart totals, apply bulk volume discount tiers, compute Satoshis
 */
router.post('/cart/calculate', async (req, res) => {
  try {
    const { items } = req.body; // [{ productId, size, quantity }]
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.json({
        subtotalUSD: 0,
        discountUSD: 0,
        totalUSD: 0,
        totalSats: 0,
        items: []
      });
    }

    const products = getProducts();
    let subtotalUSD = 0;
    let totalQuantity = 0;

    const detailedItems = items.map(item => {
      const product = products.find(p => p.id === item.productId);
      if (!product) return null;
      const variant = product.variants.find(v => v.size === item.size) || product.variants[0];
      const unitPrice = variant.priceUSD;
      const qty = Math.max(1, parseInt(item.quantity, 10) || 1);
      const lineTotal = unitPrice * qty;

      subtotalUSD += lineTotal;
      totalQuantity += qty;

      return {
        productId: product.id,
        name: product.name,
        subtitle: product.subtitle,
        size: variant.size,
        sku: variant.sku,
        unitPriceUSD: unitPrice,
        quantity: qty,
        lineTotalUSD: parseFloat(lineTotal.toFixed(2))
      };
    }).filter(Boolean);

    // Multi-tier bulk discount logic
    // 3-4 vials: 5% off, 5-9 vials: 10% off, 10+ vials: 15% off
    let discountPercent = 0;
    if (totalQuantity >= 10) {
      discountPercent = 0.15;
    } else if (totalQuantity >= 5) {
      discountPercent = 0.10;
    } else if (totalQuantity >= 3) {
      discountPercent = 0.05;
    }

    const discountUSD = parseFloat((subtotalUSD * discountPercent).toFixed(2));
    const totalUSD = parseFloat((subtotalUSD - discountUSD).toFixed(2));
    const { sats: totalSats, btcPrice } = await usdToSats(totalUSD);

    res.json({
      success: true,
      totalQuantity,
      subtotalUSD: parseFloat(subtotalUSD.toFixed(2)),
      discountPercent: discountPercent * 100,
      discountUSD,
      totalUSD,
      totalSats,
      btcPrice,
      items: detailedItems
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/orders/checkout
 * Initiate checkout and generate Bitcoin Lightning BOLT11 Invoice
 */
router.post('/orders/checkout', async (req, res) => {
  try {
    const { items, customer } = req.body;
    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, error: 'Cart is empty' });
    }

    const products = getProducts();
    let subtotalUSD = 0;
    let totalQuantity = 0;

    const orderItems = items.map(item => {
      const product = products.find(p => p.id === item.productId);
      if (!product) return null;
      const variant = product.variants.find(v => v.size === item.size) || product.variants[0];
      const qty = Math.max(1, parseInt(item.quantity, 10) || 1);
      const lineTotal = variant.priceUSD * qty;
      subtotalUSD += lineTotal;
      totalQuantity += qty;

      return {
        productId: product.id,
        name: product.name,
        size: variant.size,
        sku: variant.sku,
        batchNumber: product.batch.batchNumber,
        unitPriceUSD: variant.priceUSD,
        quantity: qty,
        lineTotalUSD: parseFloat(lineTotal.toFixed(2))
      };
    }).filter(Boolean);

    // Apply tier discount
    let discountPercent = 0;
    if (totalQuantity >= 10) discountPercent = 0.15;
    else if (totalQuantity >= 5) discountPercent = 0.10;
    else if (totalQuantity >= 3) discountPercent = 0.05;

    const discountUSD = parseFloat((subtotalUSD * discountPercent).toFixed(2));
    const totalUSD = parseFloat((subtotalUSD - discountUSD).toFixed(2));
    const { sats: totalSats, btcPrice } = await usdToSats(totalUSD);

    const orderId = `LP-ORD-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    // Create Lightning BOLT11 Invoice
    const invoice = await createLightningInvoice({
      amountSats: totalSats,
      memo: `Lumen Peptides Order ${orderId}`,
      orderId
    });

    const newOrder = {
      orderId,
      status: 'pending_payment',
      createdAt: new Date().toISOString(),
      customer: {
        email: customer?.email || 'researcher@lab.org',
        institution: customer?.institution || 'Independent Research Facility',
        shippingAddress: customer?.shippingAddress || 'Confidential Lab Address'
      },
      items: orderItems,
      subtotalUSD,
      discountUSD,
      totalUSD,
      totalSats,
      btcPrice,
      payment: {
        method: 'bitcoin_lightning',
        invoiceId: invoice.invoiceId,
        bolt11: invoice.bolt11,
        paymentHash: invoice.paymentHash,
        settled: false,
        preimage: null,
        expiresAt: invoice.expiresAt
      },
      fulfillment: {
        coldChainPackaging: 'Dry Ice Solid Core Insulated Shiplock',
        stage: 'Awaiting Lightning Settlement',
        trackingNumber: null
      }
    };

    const orders = getOrders();
    orders.unshift(newOrder);
    saveOrders(orders);

    res.json({
      success: true,
      order: newOrder,
      invoice: {
        invoiceId: invoice.invoiceId,
        bolt11: invoice.bolt11,
        paymentHash: invoice.paymentHash,
        amountSats: totalSats,
        amountUSD: totalUSD,
        expiresAt: invoice.expiresAt
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/lightning/status/:invoiceId
 * Poll invoice status
 */
router.get('/lightning/status/:invoiceId', async (req, res) => {
  try {
    const status = await checkInvoiceStatus(req.params.invoiceId);

    // If settled, update the order in storage
    if (status.settled && status.orderId) {
      const orders = getOrders();
      const order = orders.find(o => o.orderId === status.orderId);
      if (order && order.status !== 'settled') {
        order.status = 'settled';
        order.payment.settled = true;
        order.payment.settledAt = status.settledAt;
        order.payment.preimage = status.preimage;
        order.fulfillment.stage = 'Batch Allocation & Cold-Chain Packing';
        order.fulfillment.trackingNumber = `COLD-FEDEX-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
        saveOrders(orders);
      }
    }

    res.json({ success: true, ...status });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/lightning/simulate-payment
 * Instant settlement simulation for demo/testing
 */
router.post('/lightning/simulate-payment', async (req, res) => {
  try {
    const { invoiceId } = req.body;
    if (!invoiceId) {
      return res.status(400).json({ success: false, error: 'invoiceId is required' });
    }

    const settlement = settleSimulatedInvoice(invoiceId);
    if (!settlement.success) {
      return res.status(404).json(settlement);
    }

    // Update order
    const orders = getOrders();
    const order = orders.find(o => o.orderId === settlement.orderId);
    if (order) {
      order.status = 'settled';
      order.payment.settled = true;
      order.payment.settledAt = settlement.settledAt;
      order.payment.preimage = settlement.preimage;
      order.fulfillment.stage = 'Batch Allocation & Cold-Chain Packing';
      order.fulfillment.trackingNumber = `COLD-FEDEX-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
      saveOrders(orders);
    }

    res.json({
      success: true,
      message: 'Lightning payment simulated and settled successfully',
      settlement
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/orders/:orderId
 * Retrieve order info
 */
router.get('/orders/:orderId', (req, res) => {
  try {
    const orders = getOrders();
    const order = orders.find(o => o.orderId.toLowerCase() === req.params.orderId.toLowerCase());
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }
    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
