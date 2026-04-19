const PREFIX = 'azdo_cache:'
const TTL_MS = 15 * 60 * 1000

export function getCached(key) {
  const raw = localStorage.getItem(PREFIX + key)
  if (!raw) return null
  try {
    const { ts, data } = JSON.parse(raw)
    if (Date.now() - ts > TTL_MS) {
      localStorage.removeItem(PREFIX + key)
      return null
    }
    return data
  } catch {
    localStorage.removeItem(PREFIX + key)
    return null
  }
}

export function setCached(key, data) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({ ts: Date.now(), data }))
  } catch (e) {
    // Quota exceeded — best effort: clear our cache and retry once
    clearCache()
    try { localStorage.setItem(PREFIX + key, JSON.stringify({ ts: Date.now(), data })) } catch {}
  }
}

export function clearCache() {
  const toRemove = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k && k.startsWith(PREFIX)) toRemove.push(k)
  }
  toRemove.forEach(k => localStorage.removeItem(k))
}

export async function cached(key, loader) {
  const hit = getCached(key)
  if (hit !== null) return hit
  const data = await loader()
  setCached(key, data)
  return data
}
