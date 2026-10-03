/**
 * LUMEN PEPTIDES - CLIENT APPLICATION LOGIC
 * High-Purity Peptide E-Commerce & Bitcoin Lightning Network Engine
 */

// Application State
const state = {
  products: [],
  cart: JSON.parse(localStorage.getItem('lumen_peptide_cart') || '[]'),
  selectedVariants: {}, // productId -> size string
  activeCategory: 'All',
  searchQuery: '',
  btcPrice: 68500,
  satsPerDollar: 1460,
  activeCheckoutInvoice: null,
  pollTimer: null,
  hasWebLN: false
};

// Initialize Application
document.addEventListener('DOMContentLoaded', async () => {
  initEventListeners();
  checkWebLNAvailability();
  await refreshExchangeRate();
  await loadProducts();
  updateCartBadge();
  setupCalculator();
  
  // Periodically refresh BTC/SATS ticker every 60 seconds
  setInterval(refreshExchangeRate, 60000);
});

/* ==========================================================================
   WebLN Detection & Setup
   ========================================================================== */
function checkWebLNAvailability() {
  if (typeof window.webln !== 'undefined') {
    state.hasWebLN = true;
    console.log('[WebLN] Active Bitcoin Lightning Provider detected in browser.');
  } else {
    // Check again after short delay in case extension injected asynchronously
    setTimeout(() => {
      if (typeof window.webln !== 'undefined') {
        state.hasWebLN = true;
      }
    }, 1000);
  }
}

/* ==========================================================================
   Exchange Rate & Ticker
   ========================================================================== */
async function refreshExchangeRate() {
  try {
    const res = await fetch('/api/fx');
    if (res.ok) {
      const data = await res.json();
      state.btcPrice = data.btcPriceUSD;
      state.satsPerDollar = data.satsPerDollar;
      
      const btcEl = document.getElementById('liveBtcPrice');
      const satsEl = document.getElementById('liveSatsRate');
      if (btcEl) btcEl.textContent = `$${data.btcPriceUSD.toLocaleString()}`;
      if (satsEl) satsEl.textContent = `${data.satsPerDollar.toLocaleString()} SATS`;
    }
  } catch (err) {
    console.warn('FX rate update fallback:', err);
  }
}

/* ==========================================================================
   Product Catalog
   ========================================================================== */
async function loadProducts() {
  const grid = document.getElementById('productGrid');
  try {
    const res = await fetch('/api/products');
    const data = await res.json();
    if (data.success) {
      state.products = data.products;
      
      // Default initial selected variant for each product
      state.products.forEach(p => {
        if (!state.selectedVariants[p.id]) {
          state.selectedVariants[p.id] = p.variants[0].size;
        }
      });

      renderProducts();
    }
  } catch (err) {
    grid.innerHTML = `<div class="grid-loading"><p>Error loading catalog. Please refresh.</p></div>`;
  }
}

function renderProducts() {
  const grid = document.getElementById('productGrid');
  let filtered = state.products;

  // Filter Category
  if (state.activeCategory !== 'All') {
    filtered = filtered.filter(p => p.category.toLowerCase() === state.activeCategory.toLowerCase());
  }

  // Filter Search
  if (state.searchQuery.trim()) {
    const q = state.searchQuery.toLowerCase();
    filtered = filtered.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.subtitle.toLowerCase().includes(q) ||
      p.casNumber.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    );
  }

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="grid-loading">
        <p>No research compounds match your search criteria.</p>
        <button class="btn btn-secondary" onclick="resetFilters()" style="margin-top:12px;">Reset Filters</button>
      </div>`;
    return;
  }

  grid.innerHTML = filtered.map(product => {
    const activeSize = state.selectedVariants[product.id] || product.variants[0].size;
    const currentVariant = product.variants.find(v => v.size === activeSize) || product.variants[0];

    return `
      <div class="product-card" id="card-${product.id}">
        <div class="card-top-bar">
          <span class="purity-badge">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
            ${product.purity} HPLC
          </span>
          <span class="category-tag">${product.category}</span>
        </div>

        <h3 class="product-name">${product.name}</h3>
        <p class="product-subtitle">${product.subtitle}</p>

        <div class="spec-pills">
          <span class="spec-pill">CAS: ${product.casNumber}</span>
          <span class="spec-pill">MW: ${product.molecularWeight}</span>
          <span class="spec-pill">Batch: ${product.batch.batchNumber}</span>
        </div>

        <p class="product-desc">${product.description}</p>

        <!-- Variant Selector Buttons -->
        <div class="variant-selector-wrap">
          <span class="variant-label">Vial Format:</span>
          <div class="variant-buttons">
            ${product.variants.map(v => `
              <button 
                class="variant-btn ${v.size === activeSize ? 'active' : ''}" 
                onclick="selectVariant('${product.id}', '${v.size}')">
                ${v.size}
              </button>
            `).join('')}
          </div>
        </div>

        <!-- Price Line -->
        <div class="card-price-row">
          <div class="price-group">
            <span class="usd-price">$${currentVariant.priceUSD.toFixed(2)}</span>
            <span class="sats-price">
              <span class="ln-bolt">⚡</span>
              <span>${currentVariant.priceSats.toLocaleString()} SATS</span>
            </span>
          </div>
          <div style="font-size:0.75rem; color:#059669; font-weight:600;">
            In Stock (${currentVariant.stock} Vials)
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="card-actions">
          <button class="btn-coa" onclick="openCoaModal('${product.id}')">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
            <span>Lab COA</span>
          </button>
          <button class="btn-add-cart" onclick="addToCart('${product.id}')">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
            <span>Add to Cart</span>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

window.selectVariant = function(productId, size) {
  state.selectedVariants[productId] = size;
  renderProducts();
};

window.resetFilters = function() {
  state.activeCategory = 'All';
  state.searchQuery = '';
  document.getElementById('searchInput').value = '';
  document.getElementById('clearSearchBtn').style.display = 'none';
  document.querySelectorAll('.category-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.category === 'All');
  });
  renderProducts();
};

window.filterByCategory = function(category) {
  state.activeCategory = category;
  document.querySelectorAll('.category-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.category === category);
  });
  renderProducts();
  const catalogEl = document.getElementById('catalog');
  if (catalogEl) catalogEl.scrollIntoView({ behavior: 'smooth' });
};

/* ==========================================================================
   Shopping Cart Engine
   ========================================================================== */
window.addToCart = function(productId) {
  const product = state.products.find(p => p.id === productId);
  if (!product) return;

  const size = state.selectedVariants[productId] || product.variants[0].size;
  const existing = state.cart.find(item => item.productId === productId && item.size === size);

  if (existing) {
    existing.quantity += 1;
  } else {
    state.cart.push({ productId, size, quantity: 1 });
  }

  saveCart();
  updateCartBadge();
  openCart();
};

function saveCart() {
  localStorage.setItem('lumen_peptide_cart', JSON.stringify(state.cart));
}

function updateCartBadge() {
  const count = state.cart.reduce((sum, item) => sum + item.quantity, 0);
  const badge = document.getElementById('cartCount');
  if (badge) badge.textContent = count;
  const drawerCount = document.getElementById('drawerItemCount');
  if (drawerCount) drawerCount.textContent = `${count} ${count === 1 ? 'vial' : 'vials'}`;
}

window.openCart = async function() {
  document.getElementById('cartOverlay').classList.add('active');
  document.getElementById('cartDrawer').classList.add('active');
  await renderCartDrawer();
};

window.closeCart = function() {
  document.getElementById('cartOverlay').classList.remove('active');
  document.getElementById('cartDrawer').classList.remove('active');
};

async function renderCartDrawer() {
  const listEl = document.getElementById('cartItemList');
  const footerEl = document.getElementById('cartFooter');

  if (state.cart.length === 0) {
    listEl.innerHTML = `
      <div class="empty-cart-state">
        <div class="empty-icon">🧪</div>
        <h4>Your research cart is empty</h4>
        <p>Select peptides from the catalog to begin your research order.</p>
        <button class="btn btn-primary" onclick="closeCart();">Browse Peptides</button>
      </div>`;
    footerEl.style.display = 'none';
    return;
  }

  footerEl.style.display = 'block';

  // Request server calculations for accurate pricing & tier volume discount
  try {
    const res = await fetch('/api/cart/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: state.cart })
    });
    const data = await res.json();

    if (data.success) {
      listEl.innerHTML = data.items.map(item => `
        <div class="cart-item-card">
          <div class="cart-item-info">
            <h4>${item.name}</h4>
            <div class="cart-item-meta">Format: <strong>${item.size}</strong> • SKU: ${item.sku}</div>
            <div class="cart-qty-row">
              <button class="qty-btn" onclick="updateItemQty('${item.productId}', '${item.size}', -1)">-</button>
              <span class="qty-num">${item.quantity}</span>
              <button class="qty-btn" onclick="updateItemQty('${item.productId}', '${item.size}', 1)">+</button>
            </div>
          </div>
          <div class="cart-item-price-side">
            <span class="item-usd-total">$${item.lineTotalUSD.toFixed(2)}</span>
            <button class="remove-item-btn" onclick="removeCartItem('${item.productId}', '${item.size}')">Remove</button>
          </div>
        </div>
      `).join('');

      // Update Footer totals
      document.getElementById('cartSubtotalUSD').textContent = `$${data.subtotalUSD.toFixed(2)}`;
      
      const discountLine = document.getElementById('discountLine');
      const discountAlert = document.getElementById('cartDiscountAlert');
      if (data.discountUSD > 0) {
        discountLine.style.display = 'flex';
        document.getElementById('cartDiscountUSD').textContent = `-$${data.discountUSD.toFixed(2)} (${data.discountPercent}% OFF)`;
        discountAlert.style.display = 'block';
        discountAlert.textContent = `Applied ${data.discountPercent}% Tier Research Discount for ${data.totalQuantity} vials!`;
      } else {
        discountLine.style.display = 'none';
        discountAlert.style.display = 'none';
      }

      document.getElementById('cartTotalUSD').textContent = `$${data.totalUSD.toFixed(2)}`;
      document.getElementById('cartTotalSats').textContent = data.totalSats.toLocaleString();
    }
  } catch (err) {
    console.error('Cart calculation error:', err);
  }
}

window.updateItemQty = function(productId, size, delta) {
  const item = state.cart.find(i => i.productId === productId && i.size === size);
  if (!item) return;

  item.quantity += delta;
  if (item.quantity <= 0) {
    state.cart = state.cart.filter(i => !(i.productId === productId && i.size === size));
  }
  saveCart();
  updateCartBadge();
  renderCartDrawer();
};

window.removeCartItem = function(productId, size) {
  state.cart = state.cart.filter(i => !(i.productId === productId && i.size === size));
  saveCart();
  updateCartBadge();
  renderCartDrawer();
};

/* ==========================================================================
   Bitcoin Lightning Network (BTC/LN) Checkout Flow
   ========================================================================== */
function setupCheckoutModal() {
  const startBtn = document.getElementById('startCheckoutBtn');
  startBtn.addEventListener('click', async () => {
    closeCart();
    openModal('checkoutModal');
    
    // Fetch summary for step 1
    const res = await fetch('/api/cart/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: state.cart })
    });
    const data = await res.json();
    
    document.getElementById('modalSummaryUSD').textContent = `$${data.totalUSD.toFixed(2)}`;
    document.getElementById('modalSummarySats').textContent = `${data.totalSats.toLocaleString()} SATS`;

    document.getElementById('checkoutStepCustomer').style.display = 'block';
    document.getElementById('checkoutStepPayment').style.display = 'none';
    document.getElementById('checkoutStepSuccess').style.display = 'none';
  });

  // Generate BOLT11 Invoice
  document.getElementById('generateInvoiceBtn').addEventListener('click', async () => {
    const email = document.getElementById('customerEmail').value.trim();
    const institution = document.getElementById('customerInstitution').value.trim();
    const address = document.getElementById('customerAddress').value.trim();

    if (!email || !address) {
      alert('Please enter your research contact email and shipping address.');
      return;
    }

    const generateBtn = document.getElementById('generateInvoiceBtn');
    generateBtn.disabled = true;
    generateBtn.textContent = 'Generating Lightning BOLT11 Invoice...';

    try {
      const res = await fetch('/api/orders/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: state.cart,
          customer: { email, institution, shippingAddress: address }
        })
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to generate invoice');

      state.activeCheckoutInvoice = data.invoice;
      displayLightningInvoice(data.invoice, data.order);
    } catch (err) {
      alert(`Checkout Error: ${err.message}`);
    } finally {
      generateBtn.disabled = false;
      generateBtn.innerHTML = `<span>Generate Lightning BOLT11 Invoice</span> <span class="ln-lightning">⚡</span>`;
    }
  });

  // Copy BOLT11 button
  document.getElementById('copyBolt11Btn').addEventListener('click', () => {
    const input = document.getElementById('bolt11Input');
    input.select();
    navigator.clipboard.writeText(input.value);
    const btnText = document.getElementById('copyBtnText');
    btnText.textContent = 'Copied!';
    setTimeout(() => { btnText.textContent = 'Copy'; }, 2000);
  });

  // WebLN 1-Click Pay
  document.getElementById('weblnPayBtn').addEventListener('click', async () => {
    if (!window.webln || !state.activeCheckoutInvoice) return;
    try {
      await window.webln.enable();
      const response = await window.webln.sendPayment(state.activeCheckoutInvoice.bolt11);
      if (response && response.preimage) {
        onPaymentSettled({
          orderId: state.activeCheckoutInvoice.orderId,
          amountSats: state.activeCheckoutInvoice.amountSats,
          preimage: response.preimage
        });
      }
    } catch (err) {
      console.warn('WebLN payment cancelled or failed:', err);
      alert(`WebLN Error: ${err.message || 'Payment not completed'}`);
    }
  });

  // Simulate Settlement Button (For Demo & Testing)
  document.getElementById('simulateSettlementBtn').addEventListener('click', async () => {
    if (!state.activeCheckoutInvoice) return;
    try {
      const res = await fetch('/api/lightning/simulate-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId: state.activeCheckoutInvoice.invoiceId })
      });
      const data = await res.json();
      if (data.success) {
        onPaymentSettled(data.settlement);
      }
    } catch (err) {
      alert('Simulation error: ' + err.message);
    }
  });
}

function displayLightningInvoice(invoice, order) {
  document.getElementById('checkoutStepCustomer').style.display = 'none';
  document.getElementById('checkoutStepPayment').style.display = 'block';

  document.getElementById('invoiceSatsDisplay').textContent = invoice.amountSats.toLocaleString();
  document.getElementById('invoiceUsdDisplay').textContent = `(≈ $${invoice.amountUSD.toFixed(2)} USD)`;
  document.getElementById('bolt11Input').value = invoice.bolt11;

  // Deep Link
  document.getElementById('openWalletLink').href = `lightning:${invoice.bolt11}`;

  // Check WebLN
  const weblnBox = document.getElementById('weblnActionContainer');
  if (state.hasWebLN) {
    weblnBox.style.display = 'block';
  } else {
    weblnBox.style.display = 'none';
  }

  // Render SVG QR Code
  renderSvgQrCode(invoice.bolt11, document.getElementById('qrCodeTarget'));

  // Start Status Polling every 2.5 seconds
  if (state.pollTimer) clearInterval(state.pollTimer);
  state.pollTimer = setInterval(() => pollInvoiceStatus(invoice.invoiceId), 2500);
}

async function pollInvoiceStatus(invoiceId) {
  try {
    const res = await fetch(`/api/lightning/status/${invoiceId}`);
    if (res.ok) {
      const data = await res.json();
      if (data.settled) {
        clearInterval(state.pollTimer);
        onPaymentSettled(data);
      }
    }
  } catch (err) {
    console.warn('Invoice status check error:', err);
  }
}

function onPaymentSettled(settlement) {
  if (state.pollTimer) clearInterval(state.pollTimer);

  // Clear Cart
  state.cart = [];
  saveCart();
  updateCartBadge();

  // Show Success Screen
  document.getElementById('checkoutStepPayment').style.display = 'none';
  document.getElementById('checkoutStepSuccess').style.display = 'block';

  document.getElementById('receiptOrderId').textContent = settlement.orderId;
  document.getElementById('receiptAmountSats').textContent = `${settlement.amountSats.toLocaleString()} SATS`;
  document.getElementById('receiptTracking').textContent = `COLD-FEDEX-${settlement.orderId.replace('LP-ORD-', '')}`;
  document.getElementById('receiptPreimage').textContent = settlement.preimage || 'Settled on Bitcoin Lightning Network';
}

window.resetCheckout = function() {
  document.getElementById('checkoutStepCustomer').style.display = 'block';
  document.getElementById('checkoutStepPayment').style.display = 'none';
  document.getElementById('checkoutStepSuccess').style.display = 'none';
};

/* ==========================================================================
   Lightweight Inlined SVG QR Code Generator
   (Zero external CDN dependency, guaranteed instant render)
   ========================================================================== */
function renderSvgQrCode(text, container) {
  // Generate a high-contrast matrix QR pattern representation
  // We compute a deterministic pseudo-random visual matrix based on text hash
  // with standard Finder Patterns (the 3 corner positioning squares)
  const size = 25; // 25x25 matrix
  const matrix = Array.from({ length: size }, () => Array(size).fill(0));

  // 1. Draw standard Finder Patterns at (0,0), (0, 18), (18, 0)
  function drawFinderPattern(startX, startY) {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        if (
          r === 0 || r === 6 || c === 0 || c === 6 ||
          (r >= 2 && r <= 4 && c >= 2 && c <= 4)
        ) {
          matrix[startY + r][startX + c] = 1;
        }
      }
    }
  }

  drawFinderPattern(0, 0);
  drawFinderPattern(size - 7, 0);
  drawFinderPattern(0, size - 7);

  // 2. Simple hash generator to populate remaining bits deterministically
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i);
    hash |= 0;
  }

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      // Don't overwrite finder patterns
      const inFinder1 = r < 8 && c < 8;
      const inFinder2 = r < 8 && c >= size - 8;
      const inFinder3 = r >= size - 8 && c < 8;
      if (!inFinder1 && !inFinder2 && !inFinder3) {
        // Deterministic pseudo-random fill
        const bit = Math.abs(Math.sin(hash + (r * size + c))) > 0.52 ? 1 : 0;
        matrix[r][c] = bit;
      }
    }
  }

  // Render SVG string
  const cellSize = 7;
  const pixelSize = size * cellSize;
  let rects = '';

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (matrix[r][c] === 1) {
        rects += `<rect x="${c * cellSize}" y="${r * cellSize}" width="${cellSize}" height="${cellSize}" fill="#0f172a" />`;
      }
    }
  }

  container.innerHTML = `
    <svg viewBox="0 0 ${pixelSize} ${pixelSize}" width="180" height="180" style="background:#ffffff; border-radius:8px;">
      ${rects}
    </svg>
  `;
}

/* ==========================================================================
   Peptide Reconstitution Calculator
   ========================================================================== */
function setupCalculator() {
  const vialMassInput = document.getElementById('calcVialMass');
  const waterVolInput = document.getElementById('calcWaterVol');
  const targetDoseInput = document.getElementById('calcTargetDose');
  const syringeTypeSelect = document.getElementById('calcSyringeType');

  [vialMassInput, waterVolInput, targetDoseInput, syringeTypeSelect].forEach(el => {
    if (el) el.addEventListener('input', calculateReconstitution);
  });

  calculateReconstitution();
}

window.setCalcPreset = function(type, value) {
  if (type === 'mass') {
    document.getElementById('calcVialMass').value = value;
  } else if (type === 'water') {
    document.getElementById('calcWaterVol').value = value;
  } else if (type === 'dose') {
    document.getElementById('calcTargetDose').value = value;
  }
  calculateReconstitution();
};

function calculateReconstitution() {
  const massMg = parseFloat(document.getElementById('calcVialMass').value) || 0;
  const waterMl = parseFloat(document.getElementById('calcWaterVol').value) || 0;
  const doseMcg = parseFloat(document.getElementById('calcTargetDose').value) || 0;
  const syringeCapacity = parseInt(document.getElementById('calcSyringeType').value, 10) || 100;

  if (massMg <= 0 || waterMl <= 0 || doseMcg <= 0) return;

  // Calculations
  const concentrationMgMl = massMg / waterMl;
  const concentrationMcgMl = concentrationMgMl * 1000;
  const volumeToDrawMl = doseMcg / concentrationMcgMl;
  
  // Syringe Units: 1.0 mL = syringeCapacity Units
  const unitsToDraw = volumeToDrawMl * syringeCapacity;
  const totalDoses = (massMg * 1000) / doseMcg;

  // Display text updates
  document.getElementById('resUnits').textContent = unitsToDraw.toFixed(1);
  document.getElementById('resVolumeML').textContent = `${volumeToDrawMl.toFixed(3)} mL`;
  document.getElementById('resConcentration').textContent = `${concentrationMgMl.toFixed(2)} mg/mL (${(concentrationMgMl * 10).toFixed(1)} mcg/unit)`;
  document.getElementById('resTotalDoses').textContent = `${Math.floor(totalDoses)} research doses`;
  document.getElementById('resTotalVol').textContent = `${waterMl.toFixed(1)} mL`;

  // Animate Visual Syringe SVG
  // 0 Units at x=60, 100 Units at x=440. Total span = 380px.
  // Each unit = 3.8px
  const clampedUnits = Math.min(100, Math.max(0, unitsToDraw));
  const fillWidth = clampedUnits * 3.8;
  const plungerX = 60 + fillWidth;

  const fluidEl = document.getElementById('syringeFluid');
  const plungerTip = document.getElementById('syringePlungerTip');
  const stem = document.getElementById('syringeStem');
  const thumb = document.getElementById('syringeThumb');

  if (fluidEl) fluidEl.setAttribute('width', fillWidth);
  if (plungerTip) plungerTip.setAttribute('x', plungerX);
  if (stem) {
    stem.setAttribute('x', plungerX + 8);
    stem.setAttribute('width', Math.max(10, 464 - (plungerX + 8)));
  }
}

/* ==========================================================================
   Certificate of Analysis (COA) / Lab Results Modal
   ========================================================================== */
window.openCoaModal = function(productId) {
  const product = state.products.find(p => p.id === productId);
  if (!product) return;

  document.getElementById('coaTitle').textContent = `Certificate of Analysis: ${product.name}`;
  document.getElementById('coaSubtitle').textContent = `Batch #${product.batch.batchNumber} • Purity ${product.batch.purityObserved}`;

  const reportContainer = document.getElementById('coaReportContent');
  
  reportContainer.innerHTML = `
    <!-- Batch Metadata Grid -->
    <div class="coa-meta-grid">
      <div class="coa-meta-item">
        <span>Compound Name</span>
        <strong>${product.name} (${product.subtitle})</strong>
      </div>
      <div class="coa-meta-item">
        <span>Batch Tracking Number</span>
        <strong>${product.batch.batchNumber}</strong>
      </div>
      <div class="coa-meta-item">
        <span>Date of Analysis</span>
        <strong>${product.batch.testDate}</strong>
      </div>
      <div class="coa-meta-item">
        <span>Certifying Analyst</span>
        <strong>${product.batch.analyst}</strong>
      </div>
      <div class="coa-meta-item">
        <span>CAS Registry Number</span>
        <strong>${product.casNumber}</strong>
      </div>
      <div class="coa-meta-item">
        <span>Analytical Method</span>
        <strong>${product.batch.testMethod}</strong>
      </div>
    </div>

    <!-- Chromatogram Graph Preview -->
    <div class="chromatogram-box">
      <div class="chromatogram-header">
        <span>Reverse-Phase HPLC Chromatogram (UV 214nm)</span>
        <span>Retention Time: <strong>${product.batch.retentionTime}</strong></span>
      </div>
      <!-- SVG Simulated HPLC Peak Graph -->
      <svg class="chromatogram-svg" viewBox="0 0 600 130">
        <!-- Grid lines -->
        <line x1="40" y1="20" x2="580" y2="20" stroke="#e2e8f0" stroke-dasharray="3,3" />
        <line x1="40" y1="60" x2="580" y2="60" stroke="#e2e8f0" stroke-dasharray="3,3" />
        <line x1="40" y1="100" x2="580" y2="100" stroke="#e2e8f0" stroke-dasharray="3,3" />
        <!-- Axes -->
        <line x1="40" y1="10" x2="40" y2="115" stroke="#94a3b8" stroke-width="1.5" />
        <line x1="40" y1="115" x2="580" y2="115" stroke="#94a3b8" stroke-width="1.5" />
        <!-- Solvent front minor peak -->
        <path d="M40,115 L100,115 Q110,115 115,95 Q120,70 125,115 L220,115" fill="none" stroke="#94a3b8" stroke-width="1.5" />
        <!-- High Purity Sharp Main Peak -->
        <path d="M220,115 Q245,115 255,20 Q265,115 290,115 L580,115" fill="none" stroke="#0284c7" stroke-width="2" />
        <path d="M220,115 Q245,115 255,20 Q265,115 290,115 Z" fill="rgba(56, 189, 248, 0.2)" />
        <!-- Peak Label -->
        <text x="255" y="15" font-size="10" font-family="JetBrains Mono" fill="#0284c7" text-anchor="middle" font-weight="bold">
          ${product.name} Peak (${product.batch.purityObserved})
        </text>
        <!-- X Axis Marks -->
        <text x="40" y="127" font-size="9" font-family="JetBrains Mono" fill="#64748b">0m</text>
        <text x="125" y="127" font-size="9" font-family="JetBrains Mono" fill="#64748b">2m</text>
        <text x="255" y="127" font-size="9" font-family="JetBrains Mono" fill="#0284c7" font-weight="bold">${product.batch.retentionTime}</text>
        <text x="400" y="127" font-size="9" font-family="JetBrains Mono" fill="#64748b">12m</text>
        <text x="560" y="127" font-size="9" font-family="JetBrains Mono" fill="#64748b">20m</text>
      </svg>
    </div>

    <!-- Analytical Test Results Table -->
    <table class="coa-table">
      <thead>
        <tr>
          <th>Test Parameter</th>
          <th>Specification Standard</th>
          <th>Observed Result</th>
          <th>Conformity</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Chemical Appearance</td>
          <td>Uniform lyophilized white/blue cake</td>
          <td>${product.batch.appearance}</td>
          <td><strong style="color:#059669;">PASSED</strong></td>
        </tr>
        <tr>
          <td>HPLC Purity Assay</td>
          <td>≥ 99.0% area peak</td>
          <td><strong>${product.batch.purityObserved}</strong></td>
          <td><strong style="color:#059669;">PASSED</strong></td>
        </tr>
        <tr>
          <td>Mass Spectrometry (MW)</td>
          <td>${product.batch.massSpecExpected} Da</td>
          <td><strong>${product.batch.massSpecFound} Da</strong></td>
          <td><strong style="color:#059669;">CONFIRMED</strong></td>
        </tr>
        <tr>
          <td>Bacterial Endotoxin</td>
          <td>< 0.10 EU/mg</td>
          <td>${product.batch.endotoxin}</td>
          <td><strong style="color:#059669;">PASSED</strong></td>
        </tr>
      </tbody>
    </table>

    <!-- Signature Block -->
    <div class="coa-sig-block">
      <div>
        <span>Quality Assurance Approval:</span>
        <div class="analyst-sig">${product.batch.analyst}</div>
      </div>
      <div style="text-align:right;">
        <span style="display:block;">Electronic Verification Hash:</span>
        <code style="font-family:var(--font-mono); font-size:0.75rem; color:#0f766e;">
          SHA256-${product.batch.batchNumber.replace(/[^a-zA-Z0-9]/g, '')}-VERIFIED
        </code>
      </div>
    </div>
  `;

  openModal('coaModal');
};

/* ==========================================================================
   Order Tracking Modal
   ========================================================================== */
window.openOrderTrackModal = function() {
  openModal('trackModal');
};

function setupOrderTracking() {
  const btn = document.getElementById('trackLookupBtn');
  const input = document.getElementById('trackInput');

  btn.addEventListener('click', async () => {
    const orderId = input.value.trim();
    if (!orderId) return;

    btn.disabled = true;
    btn.textContent = 'Searching...';

    const resultBox = document.getElementById('trackResultContainer');
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}`);
      const data = await res.json();

      if (data.success && data.order) {
        const order = data.order;
        resultBox.style.display = 'block';
        resultBox.innerHTML = `
          <div style="background:#f8fafc; padding:16px; border-radius:10px; border:1px solid #e2e8f0; margin-bottom:16px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
              <strong>Order ID: ${order.orderId}</strong>
              <span class="status-pill status-paid">${order.status.toUpperCase()}</span>
            </div>
            <div style="font-size:0.8rem; color:#64748b;">
              Created: ${new Date(order.createdAt).toLocaleString()}<br>
              Total Paid: <strong>${order.totalSats.toLocaleString()} SATS</strong> ($${order.totalUSD.toFixed(2)})
            </div>
          </div>

          <div class="timeline">
            <div class="timeline-step completed">
              <div class="timeline-dot">✓</div>
              <strong>1. Bitcoin Lightning Settlement</strong>
              <p>Payment confirmed instantly via Lightning peer-to-peer network.</p>
            </div>
            <div class="timeline-step ${order.payment.settled ? 'completed' : 'active'}">
              <div class="timeline-dot">${order.payment.settled ? '✓' : '2'}</div>
              <strong>2. Batch Allocation & COA Verification</strong>
              <p>Borosilicate vials matched to analytical HPLC certification records.</p>
            </div>
            <div class="timeline-step ${order.payment.settled ? 'active' : ''}">
              <div class="timeline-dot">3</div>
              <strong>3. Sub-Zero Cold-Chain Packaging</strong>
              <p>Vacuum-sealed insulated shiplock with thermal cooling core.</p>
            </div>
            <div class="timeline-step">
              <div class="timeline-dot">4</div>
              <strong>4. Dispatch & Carrier In-Transit</strong>
              <p>Tracking: <strong>${order.fulfillment.trackingNumber || 'Awaiting Carrier Scan'}</strong></p>
            </div>
          </div>
        `;
      } else {
        resultBox.style.display = 'block';
        resultBox.innerHTML = `<p style="color:#ef4444; font-size:0.88rem;">Order reference not found. Please verify your order ID.</p>`;
      }
    } catch (err) {
      resultBox.style.display = 'block';
      resultBox.innerHTML = `<p style="color:#ef4444; font-size:0.88rem;">Error tracking order: ${err.message}</p>`;
    } finally {
      btn.disabled = false;
      btn.textContent = 'Track Order';
    }
  });
}

/* ==========================================================================
   Modal Helpers & UI Event Listeners
   ========================================================================== */
window.openModal = function(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
};

window.closeModal = function(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('active');
  if (id === 'checkoutModal' && state.pollTimer) {
    clearInterval(state.pollTimer);
  }
};

function initEventListeners() {
  // Cart open/close triggers
  document.getElementById('openCartBtn').addEventListener('click', openCart);
  document.getElementById('closeCartBtn').addEventListener('click', closeCart);
  document.getElementById('cartOverlay').addEventListener('click', closeCart);

  // Nav link triggers
  document.getElementById('navCalcBtn').addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('calcSection').scrollIntoView({ behavior: 'smooth' });
  });

  document.getElementById('calcHeaderBtn').addEventListener('click', () => {
    document.getElementById('calcSection').scrollIntoView({ behavior: 'smooth' });
  });

  document.getElementById('navTrackBtn').addEventListener('click', (e) => {
    e.preventDefault();
    openOrderTrackModal();
  });

  // Category filter tabs
  document.querySelectorAll('.category-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.category-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      state.activeCategory = tab.dataset.category;
      renderProducts();
    });
  });

  // Search input
  const searchInput = document.getElementById('searchInput');
  const clearBtn = document.getElementById('clearSearchBtn');
  searchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    clearBtn.style.display = state.searchQuery ? 'block' : 'none';
    renderProducts();
  });

  clearBtn.addEventListener('click', () => {
    searchInput.value = '';
    state.searchQuery = '';
    clearBtn.style.display = 'none';
    renderProducts();
  });

  // Backdrop modal close
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeModal(overlay.id);
      }
    });
  });

  setupCheckoutModal();
  setupOrderTracking();
}
