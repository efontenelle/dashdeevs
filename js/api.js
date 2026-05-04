import { getAuthHeader, getConfig } from './auth.js'
import { cached } from './cache.js'

const BASE = '/_azdo'
const API_VERSION = '7.0'

function buildUrl(org, project, path, params = {}) {
  const scope = project ? `${org}/${encodeURIComponent(project)}` : org
  const url = new URL(`${BASE}/${scope}${path}`, location.origin)
  url.searchParams.set('api-version', API_VERSION)
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== '') url.searchParams.set(k, v)
  }
  return url.toString()
}

async function request(url, { method = 'GET', body } = {}) {
  const headers = { ...getAuthHeader(), 'Accept': 'application/json' }
  if (body) headers['Content-Type'] = 'application/json'
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    let detail = ''
    try { detail = (await res.text()).slice(0, 200) } catch {}
    throw new Error(`Azure DevOps API ${res.status}: ${res.statusText}${detail ? ` — ${detail}` : ''}`)
  }
  return res.json()
}

function cacheKey(url, body) {
  return body ? `${url}::${JSON.stringify(body)}` : url
}

export async function get(path, params = {}, { useCache = true, scope = 'project' } = {}) {
  const { org, project } = getConfig()
  const url = buildUrl(org, scope === 'project' ? project : '', path, params)
  if (!useCache) return request(url)
  return cached(cacheKey(url), () => request(url))
}

export async function post(path, body, { useCache = true, scope = 'project' } = {}) {
  const { org, project } = getConfig()
  const url = buildUrl(org, scope === 'project' ? project : '', path, {})
  if (!useCache) return request(url, { method: 'POST', body })
  return cached(cacheKey(url, body), () => request(url, { method: 'POST', body }))
}

export async function testConnection() {
  const { org } = getConfig()
  const url = buildUrl(org, '', '/_apis/projects', { '$top': 1 })
  return request(url)
}

export async function listProjects() {
  return get('/_apis/projects', { '$top': 200 }, { scope: 'org' })
}

export async function listRepositories() {
  const data = await get('/_apis/git/repositories', {})
  return (data.value || []).filter(r => !r.isDisabled)
}

export async function listCommits(repoId, { fromDate, toDate, author, top = 1000 } = {}) {
  const params = {
    'searchCriteria.$top': top,
  }
  if (fromDate) params['searchCriteria.fromDate'] = fromDate
  if (toDate) params['searchCriteria.toDate'] = toDate
  if (author) params['searchCriteria.author'] = author
  const data = await get(`/_apis/git/repositories/${repoId}/commits`, params)
  return data.value || []
}

export async function listPullRequests({ status = 'all', top = 500 } = {}) {
  const params = {
    'searchCriteria.status': status,
    '$top': top,
  }
  const data = await get('/_apis/git/pullrequests', params)
  return data.value || []
}

export async function getPullRequestReviewers(repoId, prId) {
  const data = await get(`/_apis/git/repositories/${repoId}/pullRequests/${prId}/reviewers`)
  return data.value || []
}

export async function getPullRequestThreads(repoId, prId) {
  const data = await get(`/_apis/git/repositories/${repoId}/pullRequests/${prId}/threads`)
  return data.value || []
}

export async function getPullRequestIterations(repoId, prId) {
  const data = await get(`/_apis/git/repositories/${repoId}/pullRequests/${prId}/iterations`)
  return data.value || []
}

export async function getPullRequestIterationChanges(repoId, prId, iterationId) {
  const data = await get(
    `/_apis/git/repositories/${repoId}/pullRequests/${prId}/iterations/${iterationId}/changes`,
    { '$top': 1000 }
  )
  return data.changeEntries || []
}

export async function listIterations(team) {
  const scope = team ? `/${encodeURIComponent(team)}` : ''
  const data = await get(`${scope}/_apis/work/teamsettings/iterations`)
  return data.value || []
}

export async function getIterationWorkItems(team, iterationId) {
  const scope = team ? `/${encodeURIComponent(team)}` : ''
  const data = await get(`${scope}/_apis/work/teamsettings/iterations/${iterationId}/workitems`)
  return data
}

export async function listTeams() {
  const { org, project } = getConfig()
  const url = buildUrl(org, '', `/_apis/projects/${encodeURIComponent(project)}/teams`, {})
  const data = await cached(url, () => request(url))
  return data.value || []
}

export async function listTeamMembers(team) {
  if (!team) return []
  const { org, project } = getConfig()
  const url = buildUrl(
    org, '',
    `/_apis/projects/${encodeURIComponent(project)}/teams/${encodeURIComponent(team)}/members`,
    {}
  )
  const data = await cached(url, () => request(url))
  return (data.value || []).map(m => m.identity || m)
}

export async function getTeamMemberIdentifierSet(team) {
  if (!team) return null
  const members = await listTeamMembers(team)
  const set = new Set()
  for (const m of members) {
    const add = (v) => { if (v) set.add(String(v).toLowerCase().trim()) }
    add(m.uniqueName)
    add(m.displayName)
    add(m.mailAddress)
  }
  return set.size ? set : null
}

export async function getTeamAreaPaths(team) {
  if (!team) return []
  const { org, project } = getConfig()
  const url = buildUrl(
    org, project,
    `/${encodeURIComponent(team)}/_apis/work/teamsettings/teamfieldvalues`,
    {}
  )
  const data = await cached(url, () => request(url))
  return (data.values || []).map(v => ({
    path: v.value,
    includeChildren: v.includeChildren !== false,
  }))
}

export function areaPathWiqlClause(areaPaths) {
  if (!areaPaths || !areaPaths.length) return ''
  const clauses = areaPaths.map(a => {
    const escaped = String(a.path).replace(/'/g, "''")
    return a.includeChildren
      ? `[System.AreaPath] UNDER '${escaped}'`
      : `[System.AreaPath] = '${escaped}'`
  })
  return `AND (${clauses.join(' OR ')})`
}

export async function queryByWiql(wiql, team) {
  const scope = team ? `/${encodeURIComponent(team)}` : ''
  return post(`${scope}/_apis/wit/wiql`, { query: wiql })
}

export async function getWorkItems(ids, fields) {
  if (!ids || ids.length === 0) return []
  const chunks = []
  for (let i = 0; i < ids.length; i += 200) chunks.push(ids.slice(i, i + 200))
  const results = []
  for (const chunk of chunks) {
    const params = { ids: chunk.join(',') }
    if (fields && fields.length) params.fields = fields.join(',')
    const data = await get('/_apis/wit/workitems', params)
    if (data.value) results.push(...data.value)
  }
  return results
}

export async function getWorkItemRevisions(id) {
  const data = await get(`/_apis/wit/workitems/${id}/revisions`)
  return data.value || []
}
