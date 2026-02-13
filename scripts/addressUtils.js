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

export function nibiToHex(nibiAddr) {
  if (!nibiAddr) return null;
  try {
    const bytes = bech32Decode(nibiAddr);
    return '0x' + bytes.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return nibiAddr; // Return original on error
  }
}
