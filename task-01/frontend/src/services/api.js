const base = import.meta.env.VITE_API_URL?.replace(/\/$/, '');
if (!base) throw new Error('VITE_API_URL is required.');
let adminKey = '';
export function setAdminKey(value) {
  adminKey = value;
}
export async function api(path, { method = 'GET', body, key, signal } = {}) {
  let response;
  try {
    response = await fetch(`${base}${path}`, {
      method,
      signal,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(key ? { 'Idempotency-Key': key } : {}),
        ...(adminKey ? { 'X-Admin-Key': adminKey } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error(
      'Cannot reach the API. Check your connection and try again.',
    );
  }
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.success) {
    const error = new Error(
      result?.error?.message ?? 'The request could not be completed.',
    );
    error.code = result?.error?.code;
    throw error;
  }
  return result.data;
}
