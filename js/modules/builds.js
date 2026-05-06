import { listBuilds } from '../api.js'

export async function loadPRBuilds({ startDate, endDate } = {}) {
  try {
    const builds = await listBuilds({ minTime: startDate, maxTime: endDate })

    const start = startDate ? new Date(startDate) : null
    const end = endDate ? new Date(endDate) : null
    return builds.filter(b => {
      const t = new Date(b.queueTime || b.startTime)
      if (start && t < start) return false
      if (end && t > end) return false
      return true
    })
  } catch (e) {
    console.warn('Falha ao carregar builds:', e.message)
    return []
  }
}

function durationMinutes(build) {
  if (!build.startTime || !build.finishTime) return null
  const ms = new Date(build.finishTime) - new Date(build.startTime)
  return ms > 0 ? ms / 60000 : null
}

export function formatBuildDuration(minutes) {
  if (minutes == null) return '—'
  if (minutes < 1) return `${Math.round(minutes * 60)}s`
  if (minutes < 60) return `${Math.round(minutes)}min`
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

export function buildMetrics(builds) {
  const completed = builds.filter(b => b.status === 'completed' && b.result !== 'canceled')
  if (!completed.length) return { avgDurationMinutes: null, successRate: null, total: builds.length }

  const durations = completed.map(durationMinutes).filter(d => d != null)
  const avgDurationMinutes = durations.length
    ? durations.reduce((s, v) => s + v, 0) / durations.length
    : null

  const succeeded = completed.filter(b => b.result === 'succeeded' || b.result === 'partiallySucceeded').length
  const successRate = completed.length ? (succeeded / completed.length) * 100 : null

  return { avgDurationMinutes, successRate, total: builds.length }
}

export function buildsByPrNumber(builds) {
  const map = new Map()
  for (const b of builds) {
    const prNum = b.triggerInfo?.['pr.number']
    if (!prNum) continue
    const key = parseInt(prNum, 10)
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(b)
  }
  return map
}

export function prLastBuildSummary(prBuilds) {
  const completed = prBuilds.filter(b => b.status === 'completed')
  if (!completed.length) {
    const running = prBuilds.find(b => b.status === 'inProgress')
    return running ? { result: 'inProgress', durationMinutes: null, totalRuns: 0 } : null
  }
  const last = [...completed].sort((a, b) => new Date(b.finishTime) - new Date(a.finishTime))[0]
  return {
    result: last.result,
    durationMinutes: durationMinutes(last),
    totalRuns: completed.length,
  }
}

export function buildTrendByWeek(builds, startDate, endDate) {
  const start = new Date(startDate)
  const day = start.getDay()
  start.setDate(start.getDate() - (day === 0 ? 6 : day - 1))
  start.setHours(0, 0, 0, 0)

  const labels = [], buckets = [], weekStarts = []
  for (let d = new Date(start); d <= new Date(endDate); d.setDate(d.getDate() + 7)) {
    weekStarts.push(new Date(d))
    labels.push(d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }))
    buckets.push([])
  }

  const completed = builds.filter(b => b.status === 'completed' && b.result !== 'canceled' && b.finishTime)
  for (const b of completed) {
    const dur = durationMinutes(b)
    if (dur == null) continue
    const finished = new Date(b.finishTime)
    for (let i = weekStarts.length - 1; i >= 0; i--) {
      if (finished >= weekStarts[i]) { buckets[i].push(dur); break }
    }
  }

  return {
    labels,
    data: buckets.map(arr => arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null),
  }
}
