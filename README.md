# 🔬 Lumen Peptides — E-Commerce Platform

> **High-purity bio-active peptide research catalog with native Bitcoin Lightning Network (BTC/LN) settlement and WebLN integration.**

![Node.js](https://img.shields.io/badge/Node.js-v20+-339933?style=flat&logo=nodedotjs&logoColor=white)
![Bitcoin Lightning](https://img.shields.io/badge/Bitcoin-Lightning_Network-F7931A?style=flat&logo=bitcoin&logoColor=white)
![WebLN](https://img.shields.io/badge/WebLN-Compatible-00D2D3?style=flat)
![HPLC Tested](https://img.shields.io/badge/HPLC_Purity-≥99.0%25-0284C7?style=flat)
![License](https://img.shields.io/badge/License-MIT-slate?style=flat)

---

## 🌟 Key Highlights

- **Clinical Biotech UI/UX**: Designed with a comforting, subtle blue color palette (`#0F172A`, `#1E3A8A`, `#0284C7`, `#38BDF8`), glassmorphism cards, responsive layouts, and accessible contrast ratios.
- **Native Bitcoin Lightning Checkout (BTC/LN)**:
  - **WebLN Support**: Automatic 1-click payment detection for browser extension wallets (Alby, CashApp, Mutiny, Strike, Zeus).
  - **BOLT11 QR & Deep-Links**: Real-time vector QR code generation and `lightning:<bolt11>` URI handler for mobile wallets (Phoenix, Breez, Blink).
  - **Dynamic Satoshi Pricing**: Real-time BTC/USD exchange rate conversion via Coinbase, Mempool.space, and CoinGecko with automated fallback.
  - **Cryptographic Preimage Proof**: Validates on-chain/off-chain settlement proof for every completed research order.
  - **Multi-Provider Architecture**: Built-in instant testnet simulator alongside production support for **LNBits** and **BTCPay Server Greenfield API**.
- **Interactive Peptide Reconstitution Calculator**:
  - Real-time syringe draw calibration for U-100, U-50, and U-30 insulin syringes.
  - Dynamic interactive SVG visual syringe with live-moving plunger and fluid fill level.
  - Multi-dose estimation and concentration tracking.
- **Analytical Certificates of Analysis (COA)**:
  - Interactive lab report modal with simulated high-resolution Reverse-Phase HPLC chromatogram graphs (retention times, solvent peaks, and area percentages).
  - Mass Spectrometry (MS) theoretical vs observed molecular weight verification.
- **Automated Bulk Volume Discounts**:
  - Automatic multi-tier research discounts:
    - 3–4 vials: **5% OFF**
    - 5–9 vials: **10% OFF**
    - 10+ vials: **15% OFF**
- **Full Order Lifecycle & Tracking**:
  - Live payment polling, batch allocation, sub-zero insulated shiplock tracking, and printable laboratory receipts.

---

## 🏗️ Architecture

```
peptide-ecommerce/
├── data/
│   ├── products.json        # 12+ scientifically accurate peptide profiles with HPLC & batch data
│   └── orders.json          # Persistent file-backed JSON database for orders & preimages
├── public/
│   ├── index.html           # Clinical UI/UX single-page application
│   ├── styles.css           # Subtle comforting blue design system, glassmorphism, responsive grid
│   └── app.js               # Reactive frontend logic, WebLN handler, syringe SVG engine, QR renderer
├── routes/
│   └── api.js               # REST API endpoints for catalog, FX rates, cart tiers, and orders
├── services/
│   ├── fx.js                # Live BTC/USD rate engine with multi-source caching & fallback
│   └── lightning.js         # Modular Lightning Gateway (Simulator, LNBits, BTCPay Server)
├── server.js                # Express entrypoint with static middleware & SPA routing
├── .env.example             # Lightning Network configuration keys
├── package.json
└── README.md
```

---

## ⚡ Bitcoin Lightning Network (BTC/LN) Workflows

### 1. WebLN (One-Click In-Browser Payment)
When a WebLN-enabled wallet (such as Alby) is detected on `window.webln`:
```javascript
await window.webln.enable();
const response = await window.webln.sendPayment(bolt11Invoice);
console.log('Payment Preimage:', response.preimage);
```

### 2. BOLT11 Invoice & QR Code
For non-extension or mobile users:
- The customer scans the generated vector QR code or clicks the deep link:
  `lightning:lnbc...`
- The client initiates polling every 2.5 seconds to `/api/lightning/status/:invoiceId`.

### 3. Dev/Testnet Instant Simulation
For demonstration and testing without spending mainnet sats:
- Click the **"Simulate Instant LN Settlement"** button in the checkout modal.
- The server will immediately trigger the simulated HTLC settlement, store the cryptographic payment preimage, and transition the order into the cold-chain packaging workflow.

---

## 🚀 Quickstart & Local Setup

### Prerequisites
- Node.js (v18.0.0 or higher)
- npm (v9.0.0 or higher)

### Installation
```bash
# Clone the repository
git clone https://github.com/Loomenz/peptide-ecommerce.git
cd peptide-ecommerce

# Install production dependencies
npm install

# Start the server
npm start
```

Open your browser and navigate to:
```
http://localhost:3000
```

---

## ⚙️ Environment Variables (`.env`)

To switch from the built-in simulator to a real Lightning node or provider, copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

```ini
PORT=3000
NODE_ENV=development

# Lightning Provider Mode: "mock", "lnbits", or "btcpay"
LN_PROVIDER=mock

# If using LNBits:
LNBITS_ENDPOINT=https://legend.lnbits.com
LNBITS_INVOICE_KEY=your_lnbits_read_invoice_key

# If using BTCPay Server:
BTCPAY_SERVER_URL=https://btcpay.yourdomain.com
BTCPAY_STORE_ID=your_store_id
BTCPAY_API_KEY=your_greenfield_api_key
```

---

## 📡 REST API Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/products` | Retrieve catalog with live Satoshi pricing (`?category=...`, `?search=...`) |
| `GET` | `/api/products/:id` | Retrieve single peptide with batch analytical HPLC data |
| `GET` | `/api/fx` | Live Bitcoin/USD exchange rate and sats-per-dollar ratio |
| `POST` | `/api/cart/calculate` | Compute subtotal, tier bulk discount, and total in USD and SATS |
| `POST` | `/api/orders/checkout` | Create order and issue Bitcoin Lightning BOLT11 invoice |
| `GET` | `/api/lightning/status/:id` | Poll payment status of a given invoice |
| `POST` | `/api/lightning/simulate-payment` | Settle invoice instantly in test mode |
| `GET` | `/api/orders/:orderId` | Query order fulfillment state and cold-chain tracking |

---

## 🧪 Included Peptide Research Catalog

1. **BPC-157** (5mg / 10mg) — *Body Protection Compound Pentadecapeptide (99.8% HPLC)*
2. **TB-500** (5mg / 10mg) — *Synthetic Thymosin Beta-4 Fragment (99.4% HPLC)*
3. **Tirzepatide** (10mg / 15mg) — *Dual GIP/GLP-1 Receptor Agonist (99.6% HPLC)*
4. **Semaglutide** (5mg / 10mg) — *Long-Acting GLP-1 Receptor Agonist (99.5% HPLC)*
5. **Retatrutide** (10mg / 20mg) — *Triple GIP/GLP-1/Glucagon Tri-Agonist (99.7% HPLC)*
6. **Epithalon** (10mg / 50mg) — *Telomerase Enzyme Activator Tetrapeptide (99.9% HPLC)*
7. **GHK-Cu** (50mg / 100mg) — *Copper Tripeptide-1 Chelate Complex (99.4% HPLC)*
8. **MOTS-c** (10mg) — *Mitochondrial-Derived Peptide (99.3% HPLC)*
9. **CJC-1295 + Ipamorelin Blend** (10mg) — *Dual GH Secretagogue Synergy (99.5% HPLC)*
10. **Semax** (30mg) — *Heptapeptide ACTH(4-10) Analog (99.6% HPLC)*
11. **Selank** (30mg) — *Synthetic Tuftsin Analog (99.7% HPLC)*
12. **Bacteriostatic Water USP** (30mL) — *Sterile Reconstitution Medium (0.9% Benzyl Alcohol)*

---

## ⚖️ Legal & Research Disclaimer

All compounds offered through this platform are synthesized exclusively for in vitro, laboratory, and scientific research purposes by qualified academic, industrial, and institutional researchers. These materials are not approved for human or animal consumption, medical treatment, or diagnostic applications.
