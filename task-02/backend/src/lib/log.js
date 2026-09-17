export function log(event, fields = {}) {
  if (process.env.NODE_ENV !== 'test')
    console.info(JSON.stringify({ time: new Date().toISOString(), event, ...fields }));
}
