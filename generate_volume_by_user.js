const fs = require('fs');

// Bech32 decoding to convert nibi addresses to 0x
const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
function bech32Decode(str) {
  const data = [];
  for (let i = str.indexOf('1') + 1; i < str.length - 6; i++) {
    data.push(CHARSET.indexOf(str[i]));
  }
  // Convert 5-bit groups to 8-bit bytes
  let acc = 0, bits = 0;
  const bytes = [];
  for (const val of data) {
    acc = (acc << 5) | val;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((acc >> bits) & 0xff);
    }
  }
  return bytes;
}

function nibiToHex(nibiAddr) {
  if (!nibiAddr) return null;
  try {
    const bytes = bech32Decode(nibiAddr);
    return '0x' + bytes.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return nibiAddr;
  }
}

const data = JSON.parse(fs.readFileSync('perp_trades.json', 'utf8'));
const trades = data.data?.perp?.tradeHistory || [];

const volumeByUser = {};

for (const t of trades) {
  const trader = t.trade?.trader;
  if (!trader) continue;

  if (!volumeByUser[trader]) {
    volumeByUser[trader] = {
      trader,
      totalVolume: 0,
      tradeCount: 0,
      realizedPnl: 0,
      openPositions: 0,
      closedPositions: 0,
      liquidations: 0
    };
  }

  const collateral = t.trade?.collateralAmount || 0;
  const leverage = t.trade?.leverage || 1;
  const notionalVolume = collateral * leverage;

  // Only count volume for position opens (avoid double-counting closes)
  if (t.tradeChangeType === 'position_opened') {
    volumeByUser[trader].totalVolume += notionalVolume;
  }
  volumeByUser[trader].tradeCount += 1;

  if (t.realizedPnlCollateral) {
    volumeByUser[trader].realizedPnl += t.realizedPnlCollateral;
  }

  if (t.tradeChangeType === 'position_opened') {
    volumeByUser[trader].openPositions += 1;
  } else if (t.tradeChangeType?.startsWith('position_closed')) {
    volumeByUser[trader].closedPositions += 1;
  } else if (t.tradeChangeType === 'position_liquidated') {
    volumeByUser[trader].liquidations += 1;
  }
}

const result = Object.values(volumeByUser)
  .map(u => ({
    ...u,
    address: nibiToHex(u.trader)
  }))
  .sort((a, b) => b.totalVolume - a.totalVolume);

fs.writeFileSync('trading_volume_by_user.json', JSON.stringify(result, null, 2));
console.log('Created trading_volume_by_user.json with', result.length, 'users');
console.log('Top 3 traders by volume:');
result.slice(0, 3).forEach((u, i) => {
  console.log(`${i+1}. ${u.address} Volume: $${(u.totalVolume / 1e6).toFixed(2)}`);
});
