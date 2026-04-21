import { queryByWiql, getWorkItems, getWorkItemRevisions, getTeamAreaPaths, areaPathWiqlClause } from '../api.js'
import { daysBetween } from '../ui.js'

const IN_PROGRESS_STATES = ['Active', 'In Progress', 'Committed', 'Doing']
const DONE_STATES = ['Done', 'Closed', 'Completed', 'Resolved']

export async function loadCompletedWorkItems({ days = 90, team } = {}) {
  const areaClause = areaPathWiqlClause(await getTeamAreaPaths(team))
  const wiql = `
    SELECT [System.Id]
    FROM WorkItems
    WHERE [System.TeamProject] = @project
      ${areaClause}
      AND [System.State] IN ('Done', 'Closed', 'Completed', 'Resolved')
      AND [System.ChangedDate] >= @today - ${days}
    ORDER BY [System.ChangedDate] DESC
  `
  const result = await queryByWiql(wiql, team)
  const ids = (result.workItems || []).map(w => w.id).slice(0, 200)
  if (ids.length === 0) return []
  return getWorkItems(ids, [
    'System.Id', 'System.Title', 'System.WorkItemType', 'System.State',
    'System.CreatedDate', 'System.ChangedDate', 'System.AssignedTo',
    'Microsoft.VSTS.Common.ActivatedDate', 'Microsoft.VSTS.Common.ClosedDate',
    'Microsoft.VSTS.Common.ResolvedDate',
  ])
}

export function computeCycleTime(workItems) {
  const rows = []
  for (const wi of workItems) {
    const f = wi.fields || {}
    const start = f['Microsoft.VSTS.Common.ActivatedDate']
    const end = f['Microsoft.VSTS.Common.ClosedDate']
      || f['Microsoft.VSTS.Common.ResolvedDate']
      || f['System.ChangedDate']
    if (!start || !end) continue
    const cycle = daysBetween(start, end)
    if (cycle < 0 || cycle > 365) continue
    rows.push({
      id: wi.id,
      title: f['System.Title'],
      type: f['System.WorkItemType'],
      state: f['System.State'],
      assignedTo: f['System.AssignedTo']?.displayName,
      start, end,
      cycle,
    })
  }
  return rows
}

export function cycleTimeByType(rows) {
  const byType = new Map()
  for (const r of rows) {
    if (!byType.has(r.type)) byType.set(r.type, [])
    byType.get(r.type).push(r.cycle)
  }
  const out = []
  for (const [type, values] of byType) {
    values.sort((a, b) => a - b)
    const avg = values.reduce((s, v) => s + v, 0) / values.length
    const median = values[Math.floor(values.length / 2)]
    out.push({ type, count: values.length, avg, median })
  }
  return out.sort((a, b) => b.count - a.count)
}

export function scatterPoints(rows) {
  return rows.map(r => ({ x: new Date(r.end).getTime(), y: r.cycle, type: r.type, title: r.title, id: r.id }))
}

export function trendLine(rows) {
  if (rows.length < 2) return null
  const points = rows.map(r => ({ x: new Date(r.end).getTime(), y: r.cycle }))
  const n = points.length
  const sumX = points.reduce((s, p) => s + p.x, 0)
  const sumY = points.reduce((s, p) => s + p.y, 0)
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0)
  const sumXX = points.reduce((s, p) => s + p.x * p.x, 0)
  const denom = n * sumXX - sumX * sumX
  if (denom === 0) return null
  const slope = (n * sumXY - sumX * sumY) / denom
  const intercept = (sumY - slope * sumX) / n
  const xs = points.map(p => p.x).sort((a, b) => a - b)
  const minX = xs[0], maxX = xs[xs.length - 1]
  return [
    { x: minX, y: slope * minX + intercept },
    { x: maxX, y: slope * maxX + intercept },
  ]
}
