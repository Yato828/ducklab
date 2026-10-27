export const U64_MAX = 18_446_744_073_709_551_615n;
export function parseBaseUnits(value: string): bigint {
  if (!/^(0|[1-9]\d{0,19})$/.test(value)) throw new Error('Amount must be an unsigned integer in base units.');
  const result = BigInt(value);
  if (result > U64_MAX) throw new Error('Amount exceeds Solana u64.');
  return result;
}
export function splitPayment(amount: bigint, feeBps = 1000) {
  if (amount < 0n || amount > U64_MAX || !Number.isInteger(feeBps) || feeBps < 0 || feeBps > 10000) throw new Error('Invalid payment or commission.');
  const fee = amount * BigInt(feeBps) / 10000n;
  return { seller: amount - fee, fee };
}
export function decimalToBaseUnits(value: string, decimals: number): bigint {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18 || !/^\d+(\.\d+)?$/.test(value)) throw new Error('Invalid token amount or decimals.');
  const [whole, fraction = ''] = value.split('.');
  if (fraction.length > decimals) throw new Error('Amount has more precision than the token supports.');
  return parseBaseUnits((BigInt(whole) * 10n ** BigInt(decimals) + BigInt(fraction.padEnd(decimals, '0') || '0')).toString());
}
export function formatBaseUnits(value: bigint, decimals: number): string {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18 || value < 0n || value > U64_MAX) throw new Error('Invalid amount.');
  if (decimals === 0) return value.toString();
  const digits = value.toString().padStart(decimals + 1, '0');
  const fraction = digits.slice(-decimals).replace(/0+$/, '');
  return `${digits.slice(0, -decimals)}${fraction ? `.${fraction}` : ''}`;
}
