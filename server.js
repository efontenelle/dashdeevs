#!/usr/bin/env node
const http = require('http')
const https = require('https')
const fs = require('fs')
const path = require('path')

const PORT = Number(process.env.PORT) || 8080
const ROOT = __dirname
const AZDO_PREFIX = '/_azdo/'
const AZDO_HOST = 'dev.azure.com'

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
}

const ALLOWED_METHODS = new Set(['GET', 'POST', 'HEAD', 'OPTIONS', 'PUT', 'PATCH', 'DELETE'])

const FORWARD_REQ_HEADERS = new Set([
  'authorization', 'accept', 'accept-language', 'content-type',
  'content-length', 'user-agent', 'if-none-match', 'if-modified-since',
])

const STRIP_RES_HEADERS = new Set([
  'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
  'te', 'trailers', 'transfer-encoding', 'upgrade',
  'set-cookie', 'server', 'x-powered-by',
])

const VALID_PROXY_PATH = /^\/[A-Za-z0-9._~!$&'()*+,;=:@/%-]*(\?[A-Za-z0-9._~!$&'()*+,;=:@/?%-]*)?$/

const SECURITY_HEADERS = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
    "style-src 'self' 'unsafe-inline'",
    "connect-src 'self'",
    "img-src 'self' data:",
    "font-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; '),
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=(), payment=()',
}

function applySecurityHeaders(res) {
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, v)
}

function proxyToAzdo(req, res) {
  if (!ALLOWED_METHODS.has(req.method)) {
    res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8', 'Allow': [...ALLOWED_METHODS].join(', ') })
    res.end('Method Not Allowed')
    return
  }

  const targetPath = '/' + req.url.slice(AZDO_PREFIX.length)
  if (!VALID_PROXY_PATH.test(targetPath)) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Bad Request')
    return
  }

  const headers = { host: AZDO_HOST }
  for (const [name, value] of Object.entries(req.headers)) {
    if (FORWARD_REQ_HEADERS.has(name.toLowerCase())) headers[name] = value
  }

  const upstream = https.request({
    hostname: AZDO_HOST,
    port: 443,
    path: targetPath,
    method: req.method,
    headers,
  }, (ures) => {
    const outHeaders = {}
    for (const [name, value] of Object.entries(ures.headers)) {
      if (!STRIP_RES_HEADERS.has(name.toLowerCase())) outHeaders[name] = value
    }
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) outHeaders[k] = v
    res.writeHead(ures.statusCode || 502, outHeaders)
    ures.pipe(res)
  })

  upstream.on('error', (err) => {
    console.error(`[proxy] ${req.method} ${targetPath} -> ${err.message}`)
    if (!res.headersSent) {
      applySecurityHeaders(res)
      res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' })
    }
    res.end('Upstream proxy error')
  })

  req.pipe(upstream)
}

const DENY_FILES = new Set([
  'server.js', 'start.bat', 'start.sh', 'package.json', 'package-lock.json', '.gitignore', '.env',
])

function safeResolve(requested) {
  const pathname = requested.split('?')[0]
  let decoded
  try { decoded = decodeURIComponent(pathname) } catch { return null }
  if (decoded.indexOf('\0') !== -1) return null
  const full = path.resolve(ROOT, '.' + decoded)
  const rel = path.relative(ROOT, full)
  if (rel === '') return full
  if (rel.startsWith('..') || path.isAbsolute(rel)) return null
  const segments = rel.split(/[\\/]/)
  if (segments.some(s => s.startsWith('.'))) return null
  if (segments.length === 1 && DENY_FILES.has(segments[0].toLowerCase())) return null
  return full
}

function serveStatic(req, res) {
  applySecurityHeaders(res)

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8', 'Allow': 'GET, HEAD' })
    res.end('Method Not Allowed')
    return
  }

  let pathname = req.url.split('?')[0]
  if (pathname === '/') pathname = '/index.html'

  const full = safeResolve(pathname)
  if (!full) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Forbidden')
    return
  }

  fs.stat(full, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('Not Found')
      return
    }
    const ext = path.extname(full).toLowerCase()
    res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream')
    res.setHeader('Content-Length', stat.size)
    res.setHeader('Cache-Control', 'no-store')
    res.writeHead(200)
    if (req.method === 'HEAD') { res.end(); return }
    fs.createReadStream(full).pipe(res)
  })
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith(AZDO_PREFIX)) {
    proxyToAzdo(req, res)
  } else {
    serveStatic(req, res)
  }
})

server.listen(PORT, () => {
  console.log(`Servindo em http://localhost:${PORT}`)
  console.log(`Proxy Azure DevOps: /_azdo/* -> https://${AZDO_HOST}/*`)
  console.log('Ctrl+C para parar.')
})
