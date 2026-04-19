const KEYS = {
  pat: 'azdo_pat',
  org: 'azdo_org',
  project: 'azdo_project',
}

export function getConfig() {
  return {
    pat: localStorage.getItem(KEYS.pat) ?? '',
    org: localStorage.getItem(KEYS.org) ?? '',
    project: localStorage.getItem(KEYS.project) ?? '',
  }
}

export function setConfig({ pat, org, project }) {
  if (pat != null) localStorage.setItem(KEYS.pat, pat)
  if (org != null) localStorage.setItem(KEYS.org, org)
  if (project != null) localStorage.setItem(KEYS.project, project)
}

export function clearConfig() {
  localStorage.removeItem(KEYS.pat)
  localStorage.removeItem(KEYS.org)
  localStorage.removeItem(KEYS.project)
}

export function hasConfig() {
  const c = getConfig()
  return !!(c.pat && c.org && c.project)
}

export function getAuthHeader() {
  const pat = localStorage.getItem(KEYS.pat) ?? ''
  const token = btoa(':' + pat)
  return { 'Authorization': 'Basic ' + token }
}
