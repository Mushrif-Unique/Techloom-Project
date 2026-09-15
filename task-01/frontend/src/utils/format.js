export const currency = import.meta.env.VITE_CURRENCY || 'USD';
export const money = (value) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(
    (value ?? 0) / 100,
  );
export const shortId = (id) => id?.slice(0, 8).toUpperCase();
export const dateTime = (value) =>
  new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
export function minorUnits(value) {
  if (!/^\d+(\.\d{1,2})?$/.test(value))
    throw new Error('Enter a valid price with at most two decimal places.');
  const [whole, fraction = ''] = value.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}
