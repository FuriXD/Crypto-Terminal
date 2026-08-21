let coins = [];
let selectedId = null;
let currentSort = 'market_cap_desc';
let portfolio = JSON.parse(localStorage.getItem('mktx_portfolio') || '{}');
// portfolio shape: { coinId: { quantity: number, avgBuyPrice: number } }

const tableBody = document.getElementById('tableBody');
const tickerTrack = document.getElementById('tickerTrack');
const commandInput = document.getElementById('commandInput');
const detailEmpty = document.getElementById('detailEmpty');
const detailContent = document.getElementById('detailContent');
const assetCount = document.getElementById('assetCount');
const clockEl = document.getElementById('clock');

function formatMoney(n) {
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
  if (n >= 1) return '$' + n.toFixed(2);
  return '$' + n.toFixed(6);
}

function formatMarketCap(n) {
  if (n >= 1e12) return '$' + (n / 1e12).toFixed(2) + 'T';
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(1) + 'B';
  return '$' + (n / 1e6).toFixed(0) + 'M';
}

function sparklineSVG(prices, isUp, w, h) {
  if (!prices || prices.length < 2) return '';
  w = w || 80; h = h || 26;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const points = prices.map((p, i) => {
    const x = (i / (prices.length - 1)) * w;
    const y = h - ((p - min) / range) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const color = isUp ? '#2ECC71' : '#E8514F';
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><polyline points="${points}" fill="none" stroke="${color}" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
}

function savePortfolio() {
  localStorage.setItem('mktx_portfolio', JSON.stringify(portfolio));
}

function buyAsset(coinId, quantity, price) {
  if (!portfolio[coinId]) {
    portfolio[coinId] = { quantity: 0, avgBuyPrice: 0 };
  }
  const pos = portfolio[coinId];
  const totalCostBefore = pos.quantity * pos.avgBuyPrice;
  const newQuantity = pos.quantity + quantity;
  const newAvgPrice = (totalCostBefore + quantity * price) / newQuantity;
  portfolio[coinId] = { quantity: newQuantity, avgBuyPrice: newAvgPrice };
  savePortfolio();
}

function sellAsset(coinId, quantity) {
  const pos = portfolio[coinId];
  if (!pos || pos.quantity < quantity) {
    return false;
  }
  pos.quantity -= quantity;
  if (pos.quantity <= 0.00000001) {
    delete portfolio[coinId];
  }
  savePortfolio();
  return true;
}

function renderPortfolio() {
  const portfolioBody = document.getElementById('portfolioBody');
  const portfolioSummary = document.getElementById('portfolioSummary');
  const ids = Object.keys(portfolio);

  if (ids.length === 0) {
    portfolioBody.innerHTML = '<div class="status" id="portfolioEmpty">NO OPEN POSITIONS — BUY AN ASSET FROM ITS DETAIL PANEL</div>';
    portfolioSummary.textContent = '$0.00 — 0 POSITIONS';
    return;
  }

  let totalValue = 0;
  let totalPnl = 0;

  const rows = ids.map(id => {
    const coin = coins.find(c => c.id === id);
    const pos = portfolio[id];
    if (!coin) return '';

    const currentValue = pos.quantity * coin.current_price;
    const costBasis = pos.quantity * pos.avgBuyPrice;
    const pnl = currentValue - costBasis;
    const pnlPct = costBasis > 0 ? (pnl / costBasis) * 100 : 0;
    const isUp = pnl >= 0;

    totalValue += currentValue;
    totalPnl += pnl;

    return `
      <div class="row">
        <div class="coin-cell">
          <span class="coin-name">${coin.name}</span>
          <span class="coin-symbol">${coin.symbol.toUpperCase()}</span>
        </div>
        <div class="num">${pos.quantity.toFixed(4)}</div>
        <div class="num">${formatMoney(pos.avgBuyPrice)}</div>
        <div class="num">${formatMoney(coin.current_price)}</div>
        <div class="num">${formatMoney(currentValue)}</div>
        <div class="num ${isUp ? 'val-up' : 'val-down'}">${isUp ? '+' : ''}${formatMoney(pnl)} (${isUp ? '+' : ''}${pnlPct.toFixed(2)}%)</div>
      </div>
    `;
  }).join('');

  portfolioBody.innerHTML = rows;
  const pnlSign = totalPnl >= 0 ? '+' : '';
  portfolioSummary.textContent = `${formatMoney(totalValue)} (${pnlSign}${formatMoney(totalPnl)}) — ${ids.length} POSITION${ids.length !== 1 ? 'S' : ''}`;
}

function updateClock() {
  const now = new Date();
  clockEl.textContent = now.toUTCString().split(' ')[4] + ' UTC';
}

function renderTicker(list) {
  const items = list.slice(0, 12).map(c => {
    const change = c.price_change_percentage_24h || 0;
    const isUp = change >= 0;
    return `<span class="ticker-item">${c.symbol.toUpperCase()} ${formatMoney(c.current_price)} <span class="${isUp ? 'up' : 'down'}">${isUp ? '+' : ''}${change.toFixed(2)}%</span></span>`;
  }).join('');
  tickerTrack.innerHTML = items + items;
}

function renderTable(list) {
  assetCount.textContent = list.length + ' ASSETS';

  if (list.length === 0) {
    tableBody.innerHTML = '<div class="status">NO MATCHES FOUND</div>';
    return;
  }

  tableBody.innerHTML = list.map(coin => {
    const change = coin.price_change_percentage_24h || 0;
    const isUp = change >= 0;
    const sparkPrices = coin.sparkline_in_7d ? coin.sparkline_in_7d.price : [];
    const isSelected = coin.id === selectedId;
    return `
      <div class="row ${isSelected ? 'selected' : ''}" data-id="${coin.id}">
        <div class="coin-cell">
          <img class="coin-icon" src="${coin.image}" alt="" />
          <span class="coin-name">${coin.name}</span>
          <span class="coin-symbol">${coin.symbol.toUpperCase()}</span>
        </div>
        <div class="num">${formatMoney(coin.current_price)}</div>
        <div class="num change ${isUp ? 'up' : 'down'}">${isUp ? '+' : ''}${change.toFixed(2)}%</div>
        <div class="num">${formatMoney(coin.high_24h)}</div>
        <div class="num">${formatMoney(coin.low_24h)}</div>
        <div class="num">${formatMarketCap(coin.market_cap)}</div>
        <div class="sparkline-cell">${sparklineSVG(sparkPrices, isUp)}</div>
      </div>
    `;
  }).join('');

  document.querySelectorAll('.row[data-id]').forEach(row => {
    row.addEventListener('click', () => {
      selectedId = row.dataset.id;
      renderTable(getFiltered());
      renderDetail(selectedId);
    });
  });
}

function renderDetail(id) {
  const coin = coins.find(c => c.id === id);
  if (!coin) return;

  detailEmpty.style.display = 'none';
  detailContent.style.display = 'block';

  const change = coin.price_change_percentage_24h || 0;
  const isUp = change >= 0;
  const sparkPrices = coin.sparkline_in_7d ? coin.sparkline_in_7d.price : [];

  detailContent.innerHTML = `
    <div class="detail-name">${coin.name}</div>
    <div class="detail-symbol">${coin.symbol.toUpperCase()} / USD</div>
    <div class="detail-price">${formatMoney(coin.current_price)}</div>
    <div class="change ${isUp ? 'up' : 'down'}">${isUp ? '+' : ''}${change.toFixed(2)}% (24H)</div>
    <div class="detail-chart">${sparklineSVG(sparkPrices, isUp, 240, 60)}</div>
    <div class="detail-stats">
      <div class="detail-stat-row"><span class="detail-stat-label">24H HIGH</span><span>${formatMoney(coin.high_24h)}</span></div>
      <div class="detail-stat-row"><span class="detail-stat-label">24H LOW</span><span>${formatMoney(coin.low_24h)}</span></div>
      <div class="detail-stat-row"><span class="detail-stat-label">ALL-TIME HIGH</span><span>${formatMoney(coin.ath)}</span></div>
      <div class="detail-stat-row"><span class="detail-stat-label">ALL-TIME LOW</span><span>${formatMoney(coin.atl)}</span></div>
      <div class="detail-stat-row"><span class="detail-stat-label">MARKET CAP</span><span>${formatMarketCap(coin.market_cap)}</span></div>
      <div class="detail-stat-row"><span class="detail-stat-label">24H VOLUME</span><span>${formatMarketCap(coin.total_volume)}</span></div>
    </div>
    <div class="trade-form">
      <div class="trade-label">SIMULATED TRADE (PAPER MONEY)</div>
      <div class="trade-input-row">
        <input type="number" id="tradeQty" placeholder="QUANTITY" min="0" step="any" />
      </div>
      <div class="trade-btns">
        <button class="trade-btn buy" id="buyBtn">BUY</button>
        <button class="trade-btn sell" id="sellBtn">SELL</button>
      </div>
      <div class="trade-msg" id="tradeMsg"></div>
    </div>
  `;

  document.getElementById('buyBtn').addEventListener('click', () => {
    const qtyInput = document.getElementById('tradeQty');
    const msgEl = document.getElementById('tradeMsg');
    const qty = parseFloat(qtyInput.value);

    if (!qty || qty <= 0) {
      msgEl.textContent = 'ENTER A VALID QUANTITY';
      msgEl.className = 'trade-msg err';
      return;
    }

    buyAsset(coin.id, qty, coin.current_price);
    msgEl.textContent = `BOUGHT ${qty} ${coin.symbol.toUpperCase()} @ ${formatMoney(coin.current_price)}`;
    msgEl.className = 'trade-msg';
    qtyInput.value = '';
    renderPortfolio();
  });

  document.getElementById('sellBtn').addEventListener('click', () => {
    const qtyInput = document.getElementById('tradeQty');
    const msgEl = document.getElementById('tradeMsg');
    const qty = parseFloat(qtyInput.value);

    if (!qty || qty <= 0) {
      msgEl.textContent = 'ENTER A VALID QUANTITY';
      msgEl.className = 'trade-msg err';
      return;
    }

    const success = sellAsset(coin.id, qty);
    if (!success) {
      msgEl.textContent = 'INSUFFICIENT POSITION SIZE';
      msgEl.className = 'trade-msg err';
      return;
    }

    msgEl.textContent = `SOLD ${qty} ${coin.symbol.toUpperCase()} @ ${formatMoney(coin.current_price)}`;
    msgEl.className = 'trade-msg';
    qtyInput.value = '';
    renderPortfolio();
  });
}

function getFiltered() {
  const query = commandInput.value.trim().toLowerCase();
  let filtered = coins.filter(c =>
    c.name.toLowerCase().includes(query) || c.symbol.toLowerCase().includes(query)
  );

  if (currentSort === 'market_cap_desc') {
    filtered.sort((a, b) => b.market_cap - a.market_cap);
  } else if (currentSort === 'price_change_desc') {
    filtered.sort((a, b) => (b.price_change_percentage_24h || -999) - (a.price_change_percentage_24h || -999));
  } else if (currentSort === 'price_change_asc') {
    filtered.sort((a, b) => (a.price_change_percentage_24h || 999) - (b.price_change_percentage_24h || 999));
  }

  return filtered;
}

function refreshView() {
  renderTable(getFiltered());
}

async function loadMarketData() {
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=20&page=1&sparkline=true&price_change_percentage=24h');
    if (!res.ok) {
      if (res.status === 429) throw new Error('rate_limited');
      throw new Error('fetch_failed');
    }
    coins = await res.json();
    renderTicker(coins);
    refreshView();
    renderPortfolio();
  } catch (err) {
    const msg = err.message === 'rate_limited'
      ? 'RATE LIMIT REACHED — WAIT AND PRESS F4 TO RETRY'
      : 'FEED UNAVAILABLE — CHECK CONNECTION';
    tableBody.innerHTML = `<div class="status error">${msg}</div>`;
    console.error(err);
  }
}

commandInput.addEventListener('input', refreshView);

document.querySelectorAll('.fkey').forEach(btn => {
  btn.addEventListener('click', () => {
    const action = btn.dataset.action;
    if (action === 'sort-cap') currentSort = 'market_cap_desc';
    if (action === 'sort-gain') currentSort = 'price_change_desc';
    if (action === 'sort-loss') currentSort = 'price_change_asc';
    if (action === 'refresh') { loadMarketData(); return; }
    if (action === 'focus-cmd') { commandInput.focus(); return; }
    if (action === 'clear') { commandInput.value = ''; }
    refreshView();
  });
});

updateClock();
setInterval(updateClock, 1000);
loadMarketData();
setInterval(loadMarketData, 60000);