export function deliveryFee() {
  const raw = process.env.DELIVERY_FEE_NGN;
  if (!raw) return null;
  const fee = Number(raw);
  return Number.isSafeInteger(fee) && fee >= 0 && fee <= 1000000 ? fee : null;
}
