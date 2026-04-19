import { listIterations, getIterationWorkItems, getWorkItems, listTeams } from '../api.js'

const DONE_STATES = new Set(['Done', 'Closed', 'Completed', 'Resolved'])

export async function pickDefaultTeam() {
  try {
    const teams = await listTeams()
    return teams[0]?.name
  } catch {
    return undefined
  }
}

export async function loadSprints({ team, limit = 6 } = {}) {
  const iterations = await listIterations(team)
  const now = Date.now()
  const withDates = iterations.filter(it => it.attributes?.startDate && it.attributes?.finishDate)
  withDates.sort((a, b) => new Date(a.attributes.startDate) - new Date(b.attributes.startDate))
  const past = withDates.filter(it => new Date(it.attributes.finishDate) <= now)
  const current = withDates.find(it => {
    const s = new Date(it.attributes.startDate), f = new Date(it.attributes.finishDate)
    return s <= now && now <= f
  })
  const recent = past.slice(-limit)
  if (current && !recent.includes(current)) recent.push(current)
  return recent
}

export async function computeVelocity({ team, limit = 6 } = {}) {
  const sprints = await loadSprints({ team, limit })
  const out = []
  for (const sprint of sprints) {
    try {
      const rel = await getIterationWorkItems(team, sprint.id)
      const ids = (rel.workItemRelations || []).map(r => r.target?.id).filter(Boolean)
      if (ids.length === 0) {
        out.push({ sprint: sprint.name, completed: 0, total: 0, points: 0, pointsDone: 0 })
        continue
      }
      const items = await getWorkItems(ids, [
        'System.State', 'System.WorkItemType', 'Microsoft.VSTS.Scheduling.StoryPoints'
      ])
      let completed = 0, points = 0, pointsDone = 0
      for (const wi of items) {
        const f = wi.fields || {}
        const sp = Number(f['Microsoft.VSTS.Scheduling.StoryPoints'] || 0)
        points += sp
        if (DONE_STATES.has(f['System.State'])) {
          completed++
          pointsDone += sp
        }
      }
      out.push({
        sprint: sprint.name,
        startDate: sprint.attributes.startDate,
        finishDate: sprint.attributes.finishDate,
        completed,
        total: items.length,
        points,
        pointsDone,
      })
    } catch (e) {
      console.warn(`Falha ao carregar sprint ${sprint.name}:`, e.message)
    }
  }
  return out
}

export function burndownData(velocityRows) {
  // Cumulative story points: planned total vs. completed over sprints
  const labels = velocityRows.map(r => r.sprint)
  const planned = []
  const done = []
  let plannedAcc = 0, doneAcc = 0
  for (const r of velocityRows) {
    plannedAcc += r.points
    doneAcc += r.pointsDone
    planned.push(plannedAcc)
    done.push(doneAcc)
  }
  return { labels, planned, done }
}
