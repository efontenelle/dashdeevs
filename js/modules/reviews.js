import { listPullRequests, getPullRequestThreads, getTeamMemberIdentifierSet } from '../api.js'
import { daysAgoIso, daysBetween } from '../ui.js'

function norm(s) {
  return (s || '').toLowerCase().trim()
}

function prInvolvesTeam(pr, memberSet) {
  const u = norm(pr.createdBy?.uniqueName)
  const d = norm(pr.createdBy?.displayName)
  if ((u && memberSet.has(u)) || (d && memberSet.has(d))) return true
  for (const r of pr.reviewers || []) {
    if (r.isContainer) continue
    const ru = norm(r.uniqueName)
    const rd = norm(r.displayName)
    if ((ru && memberSet.has(ru)) || (rd && memberSet.has(rd))) return true
  }
  return false
}

// Azure DevOps reviewer vote codes
// 10 = approved, 5 = approved with suggestions, 0 = no vote, -5 = waiting, -10 = rejected
function voteStatus(vote) {
  if (vote >= 5) return 'approved'
  if (vote === 0) return 'none'
  if (vote === -5) return 'waiting'
  if (vote <= -10) return 'rejected'
  return 'none'
}

export async function loadReviews({ days, team } = {}) {
  const memberSet = await getTeamMemberIdentifierSet(team)
  const since = new Date(daysAgoIso(days))
  const [completed, active] = await Promise.all([
    listPullRequests({ status: 'completed', top: 500 }),
    listPullRequests({ status: 'active', top: 500 }),
  ])
  let all = [...completed, ...active].filter(pr => new Date(pr.creationDate) >= since)
  if (memberSet) all = all.filter(pr => prInvolvesTeam(pr, memberSet))
  return all
}

export function reviewStatsByReviewer(prs) {
  const stats = new Map()
  for (const pr of prs) {
    const reviewers = pr.reviewers || []
    for (const r of reviewers) {
      if (r.isContainer) continue
      const name = r.displayName || 'Desconhecido'
      if (!stats.has(name)) {
        stats.set(name, { reviewer: name, reviews: 0, approved: 0, rejected: 0, waiting: 0 })
      }
      const s = stats.get(name)
      s.reviews++
      const status = voteStatus(r.vote || 0)
      if (status === 'approved') s.approved++
      else if (status === 'rejected') s.rejected++
      else if (status === 'waiting') s.waiting++
    }
  }
  return [...stats.values()].sort((a, b) => b.reviews - a.reviews)
}

export async function avgTimeToFirstReview(prs, { maxPrs = 50 } = {}) {
  // Cap to avoid rate-limiting the threads API (one call per PR)
  const subset = prs.slice(0, maxPrs)
  const times = []
  for (const pr of subset) {
    if (!pr.repository?.id) continue
    const authorId = pr.createdBy?.uniqueName
    try {
      const threads = await getPullRequestThreads(pr.repository.id, pr.pullRequestId)
      let firstTs = null
      for (const t of threads) {
        for (const c of t.comments || []) {
          if (c.author?.uniqueName === authorId) continue
          const ts = c.publishedDate
          if (ts && (!firstTs || ts < firstTs)) firstTs = ts
        }
      }
      if (firstTs) {
        const hours = (new Date(firstTs) - new Date(pr.creationDate)) / 3600000
        if (hours >= 0 && hours < 24 * 30) times.push(hours)
      }
    } catch (e) {
      console.warn(`Falha ao buscar threads do PR ${pr.pullRequestId}:`, e.message)
    }
  }
  return times.length ? times.reduce((s, v) => s + v, 0) / times.length : null
}

export async function computeCommentStats(prs, { maxPrs = 40 } = {}) {
  // Limit: threads call is per-PR; we cap to avoid rate limiting
  const subset = prs.slice(0, maxPrs)
  const byMaker = new Map()
  const byReceiver = new Map()
  const responseTimes = new Map()
  for (const pr of subset) {
    if (!pr.repository?.id) continue
    try {
      const threads = await getPullRequestThreads(pr.repository.id, pr.pullRequestId)
      const author = pr.createdBy?.displayName || 'Desconhecido'
      for (const t of threads) {
        const comments = (t.comments || []).filter(c => c.commentType !== 'system')
        let firstExternalTs = null
        let firstAuthorReplyTs = null
        for (const c of comments) {
          const maker = c.author?.displayName || 'Desconhecido'
          if (!byMaker.has(maker)) byMaker.set(maker, 0)
          byMaker.set(maker, byMaker.get(maker) + 1)
          if (maker !== author) {
            byReceiver.set(author, (byReceiver.get(author) || 0) + 1)
            if (!firstExternalTs) firstExternalTs = c.publishedDate
          } else if (firstExternalTs && !firstAuthorReplyTs) {
            firstAuthorReplyTs = c.publishedDate
          }
        }
        if (firstExternalTs && firstAuthorReplyTs) {
          const hours = daysBetween(firstExternalTs, firstAuthorReplyTs) * 24
          if (hours >= 0 && hours < 24 * 30) {
            if (!responseTimes.has(author)) responseTimes.set(author, [])
            responseTimes.get(author).push(hours)
          }
        }
      }
    } catch (e) {
      console.warn(`Falha ao buscar threads do PR ${pr.pullRequestId}:`, e.message)
    }
  }
  const rows = []
  const names = new Set([...byMaker.keys(), ...byReceiver.keys()])
  for (const name of names) {
    const times = responseTimes.get(name) || []
    const avgResponseHours = times.length ? times.reduce((s, v) => s + v, 0) / times.length : null
    rows.push({
      person: name,
      made: byMaker.get(name) || 0,
      received: byReceiver.get(name) || 0,
      avgResponseHours,
    })
  }
  return rows.sort((a, b) => (b.made + b.received) - (a.made + a.received))
}
