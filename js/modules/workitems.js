import { queryByWiql, getWorkItems, getTeamAreaPaths, areaPathWiqlClause } from '../api.js'

export async function loadActiveWorkItems({ team, days = 90 } = {}) {
  const areaClause = areaPathWiqlClause(await getTeamAreaPaths(team))
  const wiql = `
    SELECT [System.Id]
    FROM WorkItems
    WHERE [System.TeamProject] = @project
      ${areaClause}
      AND [System.ChangedDate] >= @today - ${days}
    ORDER BY [System.ChangedDate] DESC
  `
  const result = await queryByWiql(wiql, team)
  const ids = (result.workItems || []).map(w => w.id).slice(0, 400)
  if (ids.length === 0) return []
  return getWorkItems(ids, [
    'System.Id', 'System.Title', 'System.WorkItemType', 'System.State',
    'System.AssignedTo', 'System.CreatedDate', 'System.ChangedDate',
    'Microsoft.VSTS.Scheduling.StoryPoints', 'Microsoft.VSTS.Common.Priority',
  ])
}

function field(wi, name) {
  return wi.fields?.[name]
}

export function distributionByType(items) {
  const map = new Map()
  for (const wi of items) {
    const t = field(wi, 'System.WorkItemType') || 'Outro'
    map.set(t, (map.get(t) || 0) + 1)
  }
  return [...map.entries()].map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)
}

export function distributionByState(items) {
  const map = new Map()
  for (const wi of items) {
    const s = field(wi, 'System.State') || 'Desconhecido'
    map.set(s, (map.get(s) || 0) + 1)
  }
  return [...map.entries()].map(([state, count]) => ({ state, count }))
    .sort((a, b) => b.count - a.count)
}

export function distributionByAssignee(items) {
  const map = new Map()
  for (const wi of items) {
    const a = field(wi, 'System.AssignedTo')?.displayName || 'Não atribuído'
    map.set(a, (map.get(a) || 0) + 1)
  }
  return [...map.entries()].map(([assignee, count]) => ({ assignee, count }))
    .sort((a, b) => b.count - a.count)
}

export function backlogHealth(items) {
  const DONE = new Set(['Done', 'Closed', 'Completed', 'Resolved', 'Removed'])
  const open = items.filter(wi => !DONE.has(field(wi, 'System.State')))
  const noEstimate = open.filter(wi => !field(wi, 'Microsoft.VSTS.Scheduling.StoryPoints'))
  const noAssignee = open.filter(wi => !field(wi, 'System.AssignedTo'))
  return {
    total: open.length,
    noEstimate: noEstimate.length,
    noAssignee: noAssignee.length,
    noEstimatePct: open.length ? Math.round((noEstimate.length / open.length) * 100) : 0,
    noAssigneePct: open.length ? Math.round((noAssignee.length / open.length) * 100) : 0,
  }
}

export function listUniqueAssignees(items) {
  const set = new Set()
  for (const wi of items) {
    const a = field(wi, 'System.AssignedTo')?.displayName
    if (a) set.add(a)
  }
  return [...set].sort()
}
