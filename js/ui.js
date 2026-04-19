import { hasConfig } from './auth.js'
import { refreshChartsTheme } from './charts.js'

const THEME_KEY = 'azdo_theme'

export function initTheme() {
  const stored = localStorage.getItem(THEME_KEY)
  if (stored === 'light' || stored === 'dark') {
    document.documentElement.setAttribute('data-theme', stored)
  }
  const btn = document.getElementById('theme-toggle')
  if (btn) {
    btn.addEventListener('click', toggleTheme)
    updateThemeButton(btn)
  }
}

function currentTheme() {
  const attr = document.documentElement.getAttribute('data-theme')
  if (attr) return attr
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function toggleTheme() {
  const next = currentTheme() === 'dark' ? 'light' : 'dark'
  document.documentElement.setAttribute('data-theme', next)
  localStorage.setItem(THEME_KEY, next)
  const btn = document.getElementById('theme-toggle')
  if (btn) updateThemeButton(btn)
  refreshChartsTheme()
}

function updateThemeButton(btn) {
  btn.textContent = currentTheme() === 'dark' ? 'Modo claro' : 'Modo escuro'
}

export function renderTopbar(active) {
  const html = `
    <div class="brand">Developer Dashboard</div>
    <nav>
      <a href="dashboard.html" ${active === 'dashboard' ? 'class="active"' : ''}>Time</a>
      <a href="developer.html" ${active === 'developer' ? 'class="active"' : ''}>Desenvolvedor</a>
      <a href="config.html" ${active === 'config' ? 'class="active"' : ''}>Configuração</a>
    </nav>
    <button id="theme-toggle" class="theme-toggle">Modo escuro</button>
  `
  const el = document.querySelector('header.topbar')
  if (el) el.innerHTML = html
  initTheme()
}

export function requireConfigOrRedirect() {
  if (!hasConfig() && !location.pathname.endsWith('config.html')) {
    location.href = 'config.html'
    return false
  }
  return true
}

export function showError(containerId, message) {
  const el = document.getElementById(containerId)
  if (!el) return
  el.innerHTML = `<div class="alert danger">${escapeHtml(message)}</div>`
}

export function showLoading(containerId, text = 'Carregando...') {
  const el = document.getElementById(containerId)
  if (!el) return
  el.innerHTML = `<div class="card"><span class="spinner"></span> ${escapeHtml(text)}</div>`
}

export function clearContainer(containerId) {
  const el = document.getElementById(containerId)
  if (el) el.innerHTML = ''
}

export function escapeHtml(s) {
  if (s == null) return ''
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c])
}

export function daysAgoIso(days) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

export function startOfPeriod(days) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  d.setHours(0, 0, 0, 0)
  return d
}

export function formatDate(d) {
  const dt = typeof d === 'string' ? new Date(d) : d
  return dt.toLocaleDateString()
}

export function daysBetween(a, b) {
  const ms = (new Date(b)) - (new Date(a))
  return ms / (1000 * 60 * 60 * 24)
}

export function groupBy(arr, keyFn) {
  const map = new Map()
  for (const item of arr) {
    const k = keyFn(item)
    if (!map.has(k)) map.set(k, [])
    map.get(k).push(item)
  }
  return map
}

export function bucketByDay(items, dateFn, days) {
  const buckets = new Map()
  const start = startOfPeriod(days - 1)
  for (let i = 0; i < days; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    buckets.set(d.toISOString().slice(0, 10), 0)
  }
  for (const it of items) {
    const key = new Date(dateFn(it)).toISOString().slice(0, 10)
    if (buckets.has(key)) buckets.set(key, buckets.get(key) + 1)
  }
  return buckets
}

export function getQueryParam(name) {
  return new URLSearchParams(location.search).get(name)
}
