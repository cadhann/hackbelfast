export function friendlyFetchError(error) {
  if (error.name === 'AbortError') return 'request timed out';
  if (error instanceof TypeError) return 'network blocked or unreachable';
  return error.message || 'request failed';
}

export async function fetchJson(url, options = {}, timeoutMs = 30000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    try {
      return await res.json();
    } catch {
      throw new Error('non-JSON response');
    }
  } finally {
    clearTimeout(timeout);
  }
}
