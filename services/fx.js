// Currency & Satoshi Exchange Rate Service
// Fetches live BTC/USD exchange rates with caching and multiple fallbacks

let cachedBtcUsd = 68500; // Baseline fallback rate
let lastFetchedAt = 0;
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

export async function fetchLiveBtcPrice() {
  const now = Date.now();
  if (now - lastFetchedAt < CACHE_TTL_MS && cachedBtcUsd > 0) {
    return cachedBtcUsd;
  }

  // 1. Try Coinbase API
  try {
    const res = await fetch('https://api.coinbase.com/v2/prices/BTC-USD/spot', { signal: AbortSignal.timeout(3500) });
    if (res.ok) {
      const data = await res.json();
      const price = parseFloat(data?.data?.amount);
      if (price && !isNaN(price)) {
        cachedBtcUsd = price;
        lastFetchedAt = now;
        return cachedBtcUsd;
      }
    }
  } catch (err) {
    // Silently fall through to secondary provider
  }

  // 2. Try Mempool.space API
  try {
    const res = await fetch('https://mempool.space/api/v1/prices', { signal: AbortSignal.timeout(3500) });
    if (res.ok) {
      const data = await res.json();
      const price = parseFloat(data?.USD);
      if (price && !isNaN(price)) {
        cachedBtcUsd = price;
        lastFetchedAt = now;
        return cachedBtcUsd;
      }
    }
  } catch (err) {
    // Silently fall through to tertiary provider
  }

  // 3. Try CoinGecko API
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd', { signal: AbortSignal.timeout(3500) });
    if (res.ok) {
      const data = await res.json();
      const price = parseFloat(data?.bitcoin?.usd);
      if (price && !isNaN(price)) {
        cachedBtcUsd = price;
        lastFetchedAt = now;
        return cachedBtcUsd;
      }
    }
  } catch (err) {
    // Keep using cached/baseline rate
  }

  return cachedBtcUsd;
}

export async function usdToSats(usdAmount) {
  const btcPrice = await fetchLiveBtcPrice();
  // 1 BTC = 100,000,000 Satoshis
  const sats = Math.round((usdAmount / btcPrice) * 100_000_000);
  return {
    usd: parseFloat(usdAmount.toFixed(2)),
    sats: Math.max(1, sats),
    btcPrice: Math.round(btcPrice)
  };
}

export function formatSats(sats) {
  return new Intl.NumberFormat('en-US').format(sats);
}
