import { listRepositories, listCommits, listPullRequests, getTeamMemberIdentifierSet, getPullRequestIterations, getPullRequestIterationChanges } from '../api.js'
import { daysAgoIso, bucketByDay, groupBy, daysBetween } from '../ui.js'

function norm(s) {
  return (s || '').toLowerCase().trim()
}

function commitMatchesTeam(c, memberSet) {
  const email = norm(c.author?.email)
  const name = norm(c.author?.name)
  const cEmail = norm(c.committer?.email)
  const cName = norm(c.committer?.name)
  return (email && memberSet.has(email))
      || (name && memberSet.has(name))
      || (cEmail && memberSet.has(cEmail))
      || (cName && memberSet.has(cName))
}

function prCreatorMatchesTeam(pr, memberSet) {
  const u = norm(pr.createdBy?.uniqueName)
  const d = norm(pr.createdBy?.displayName)
  return (u && memberSet.has(u)) || (d && memberSet.has(d))
}

export async function loadCommitsAllRepos({ days, author, team } = {}) {
  const memberSet = await getTeamMemberIdentifierSet(team)
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
  if (!memberSet) return all
  return all.filter(c => commitMatchesTeam(c, memberSet))
}

export async function loadPullRequests({ days, author, team } = {}) {
  const memberSet = await getTeamMemberIdentifierSet(team)
  const since = new Date(daysAgoIso(days))
  const [active, completed, abandoned] = await Promise.all([
    listPullRequests({ status: 'active', top: 500 }),
    listPullRequests({ status: 'completed', top: 500 }),
    listPullRequests({ status: 'abandoned', top: 500 }),
  ])
  const all = [...active, ...completed, ...abandoned]
  let filtered = all.filter(pr => new Date(pr.creationDate) >= since)
  if (memberSet) filtered = filtered.filter(pr => prCreatorMatchesTeam(pr, memberSet))
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

export async function loadOpenPullRequests({ team } = {}) {
  const memberSet = await getTeamMemberIdentifierSet(team)
  const prs = await listPullRequests({ status: 'active', top: 500 })
  const currentYear = new Date().getFullYear()
  const thisYear = prs.filter(pr => new Date(pr.creationDate).getFullYear() === currentYear)
  if (!memberSet) return thisYear
  return thisYear.filter(pr => prCreatorMatchesTeam(pr, memberSet))
}

export async function fetchFileCounts(prs, { maxPrs = 50 } = {}) {
  const subset = prs.slice(0, maxPrs)
  const map = new Map()
  for (const pr of subset) {
    if (!pr.repository?.id) continue
    try {
      const iterations = await getPullRequestIterations(pr.repository.id, pr.pullRequestId)
      if (!iterations.length) continue
      const latest = iterations[iterations.length - 1]
      const changes = await getPullRequestIterationChanges(pr.repository.id, pr.pullRequestId, latest.id)
      const paths = new Set()
      for (const c of changes) {
        if (c.item?.gitObjectType && c.item.gitObjectType !== 'blob') continue
        const p = c.item?.path
        if (p) paths.add(p)
      }
      map.set(pr.pullRequestId, paths.size)
    } catch (e) {
      console.warn(`Falha ao buscar iterations do PR ${pr.pullRequestId}:`, e.message)
    }
  }
  return map
}

export function avgApprovalTime(prs) {
  const approved = prs.filter(pr =>
    pr.status === 'completed' &&
    pr.closedDate &&
    (pr.reviewers || []).some(r => !r.isContainer && r.vote >= 5)
  )
  if (!approved.length) return null
  const total = approved.reduce((sum, pr) => sum + daysBetween(pr.creationDate, pr.closedDate), 0)
  return (total / approved.length) * 24
}

export function prAuthorRanking(completedPrs, abandonedPrs, activePrs) {
  const map = new Map()
  const ensure = name => {
    if (!map.has(name)) map.set(name, { author: name, completed: 0, open: 0, abandoned: 0, _approvalHours: [] })
    return map.get(name)
  }
  for (const pr of completedPrs) {
    const s = ensure(pr.createdBy?.displayName || 'Desconhecido')
    s.completed++
    if (pr.closedDate && (pr.reviewers || []).some(r => !r.isContainer && r.vote >= 5)) {
      const hours = daysBetween(pr.creationDate, pr.closedDate) * 24
      if (hours >= 0) s._approvalHours.push(hours)
    }
  }
  for (const pr of abandonedPrs) ensure(pr.createdBy?.displayName || 'Desconhecido').abandoned++
  for (const pr of activePrs)    ensure(pr.createdBy?.displayName || 'Desconhecido').open++

  return [...map.values()]
    .map(s => ({
      author: s.author,
      completed: s.completed,
      open: s.open,
      abandoned: s.abandoned,
      avgApprovalHours: s._approvalHours.length
        ? s._approvalHours.reduce((a, b) => a + b, 0) / s._approvalHours.length
        : null,
    }))
    .sort((a, b) => b.completed - a.completed)
}

export async function avgFilesPerPr(prs, { maxPrs = 50 } = {}) {
  const subset = prs.slice(0, maxPrs)
  const counts = []
  for (const pr of subset) {
    if (!pr.repository?.id) continue
    try {
      const iterations = await getPullRequestIterations(pr.repository.id, pr.pullRequestId)
      if (!iterations.length) continue
      const latest = iterations[iterations.length - 1]
      const changes = await getPullRequestIterationChanges(pr.repository.id, pr.pullRequestId, latest.id)
      const paths = new Set()
      for (const c of changes) {
        if (c.item?.gitObjectType && c.item.gitObjectType !== 'blob') continue
        const p = c.item?.path
        if (p) paths.add(p)
      }
      counts.push(paths.size)
    } catch (e) {
      console.warn(`Falha ao buscar iterations do PR ${pr.pullRequestId}:`, e.message)
    }
  }
  return counts.length ? counts.reduce((s, v) => s + v, 0) / counts.length : null
}
