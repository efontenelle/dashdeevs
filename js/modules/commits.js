import { listRepositories, listCommits, listPullRequests } from '../api.js'
import { daysAgoIso, bucketByDay, groupBy } from '../ui.js'

export async function loadCommitsAllRepos({ days, author } = {}) {
  const repos = await listRepositories()
  const fromDate = daysAgoIso(days)
  const all = []
  await Promise.all(repos.map(async (r) => {
    try {
      const commits = await listCommits(r.id, { fromDate, author, top: 500 })
      for (const c of commits) all.push({ ...c, repoId: r.id, repoName: r.name })
    } catch (e) {
      console.warn(`Falha ao listar commits do repo ${r.name}:`, e.message)
    }
  }))
  return all
}

export async function loadPullRequests({ days, author } = {}) {
  const since = new Date(daysAgoIso(days))
  const [active, completed, abandoned] = await Promise.all([
    listPullRequests({ status: 'active', top: 500 }),
    listPullRequests({ status: 'completed', top: 500 }),
    listPullRequests({ status: 'abandoned', top: 500 }),
  ])
  const all = [...active, ...completed, ...abandoned]
  const filtered = all.filter(pr => new Date(pr.creationDate) >= since)
  if (author) {
    const needle = author.toLowerCase()
    return filtered.filter(pr =>
      (pr.createdBy?.displayName || '').toLowerCase().includes(needle) ||
      (pr.createdBy?.uniqueName || '').toLowerCase().includes(needle)
    )
  }
  return filtered
}

export function commitsByAuthor(commits) {
  const map = groupBy(commits, c => c.author?.name || c.author?.email || 'Desconhecido')
  return [...map.entries()]
    .map(([author, items]) => ({ author, count: items.length }))
    .sort((a, b) => b.count - a.count)
}

export function commitsOverTime(commits, days) {
  return bucketByDay(commits, c => c.author?.date || c.committer?.date, days)
}

export function prsByAuthor(prs) {
  const map = groupBy(prs, p => p.createdBy?.displayName || 'Desconhecido')
  const rows = []
  for (const [author, items] of map) {
    const open = items.filter(p => p.status === 'active').length
    const completed = items.filter(p => p.status === 'completed').length
    const abandoned = items.filter(p => p.status === 'abandoned').length
    const total = items.length
    const approvalRate = (completed + abandoned) > 0 ? completed / (completed + abandoned) : 0
    rows.push({ author, open, completed, abandoned, total, approvalRate })
  }
  return rows.sort((a, b) => b.total - a.total)
}

export function prStatusSummary(prs) {
  return {
    active: prs.filter(p => p.status === 'active').length,
    completed: prs.filter(p => p.status === 'completed').length,
    abandoned: prs.filter(p => p.status === 'abandoned').length,
  }
}
