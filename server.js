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

const HOP_BY_HOP = new Set([
  'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
  'te', 'trailers', 'transfer-encoding', 'upgrade', 'host', 'origin', 'referer',
])

function proxyToAzdo(req, res) {
  const targetPath = '/' + req.url.slice(AZDO_PREFIX.length)

  const headers = {}
  for (const [name, value] of Object.entries(req.headers)) {
    if (!HOP_BY_HOP.has(name.toLowerCase())) headers[name] = value
  }
  headers.host = AZDO_HOST

  const upstream = https.request({
    hostname: AZDO_HOST,
    port: 443,
    path: targetPath,
    method: req.method,
    headers,
  }, (ures) => {
    const outHeaders = {}
    for (const [name, value] of Object.entries(ures.headers)) {
      if (!HOP_BY_HOP.has(name.toLowerCase())) outHeaders[name] = value
    }
    res.writeHead(ures.statusCode || 502, outHeaders)
    ures.pipe(res)
  })

  upstream.on('error', (err) => {
    console.error(`[proxy] ${req.method} ${targetPath} -> ${err.message}`)
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' })
    }
    res.end(`Upstream proxy error: ${err.message}`)
  })

  req.pipe(upstream)
}

function safeResolve(requested) {
  const pathname = decodeURIComponent(requested.split('?')[0])
  const normalized = path.posix.normalize(pathname)
  if (normalized.includes('..')) return null
  const full = path.join(ROOT, normalized)
  if (!full.startsWith(ROOT)) return null
  return full
}

function serveStatic(req, res) {
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
      res.end(`Not Found: ${pathname}`)
      return
    }
    const ext = path.extname(full).toLowerCase()
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': stat.size,
      'Cache-Control': 'no-cache',
    })
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
