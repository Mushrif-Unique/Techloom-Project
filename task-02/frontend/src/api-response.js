// A successful HTTP response can still be an HTML SPA fallback or the wrong API.
export function unwrapResponse(payload) {
  if (!payload || typeof payload !== 'object' || payload.success !== true || payload.data == null) {
    throw new Error('The store API returned an unexpected response. Please try again.');
  }
  return payload.data;
}

export function isCatalog(data) {
  return Boolean(
    data &&
    Array.isArray(data.items) &&
    Number.isInteger(data.total) &&
    data.total >= 0 &&
    Number.isInteger(data.page) &&
    data.page >= 1 &&
    Number.isInteger(data.pages) &&
    data.pages >= 0 &&
    data.items.every(
      (item) => item && typeof item.id === 'string' && typeof item.name === 'string',
    ),
  );
}
