const instances = new Map()

function themeColors() {
  const styles = getComputedStyle(document.documentElement)
  return {
    text: styles.getPropertyValue('--text').trim() || '#1f2328',
    muted: styles.getPropertyValue('--text-muted').trim() || '#656d76',
    border: styles.getPropertyValue('--border').trim() || '#e1e4e8',
    primary: styles.getPropertyValue('--primary').trim() || '#0969da',
  }
}

export const PALETTE = [
  '#0969da', '#1a7f37', '#9a6700', '#cf222e', '#8250df',
  '#bf3989', '#1b7c83', '#bc4c00', '#6639ba', '#2f81f7',
]

function applyThemeDefaults() {
  if (!window.Chart) return
  const c = themeColors()
  Chart.defaults.color = c.muted
  Chart.defaults.borderColor = c.border
  Chart.defaults.font.family = getComputedStyle(document.body).fontFamily
}

export function createChart(canvasEl, config) {
  if (!window.Chart) throw new Error('Chart.js not loaded')
  applyThemeDefaults()
  const prev = instances.get(canvasEl)
  if (prev) prev.destroy()
  const chart = new Chart(canvasEl, config)
  instances.set(canvasEl, chart)
  return chart
}

export function destroyAllCharts() {
  for (const c of instances.values()) c.destroy()
  instances.clear()
}

export function refreshChartsTheme() {
  applyThemeDefaults()
  for (const c of instances.values()) c.update()
}
