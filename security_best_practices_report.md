# Relatório de Segurança — dashdevs

**Data:** 2026-05-30  
**Linguagem/Stack:** JavaScript (Node.js HTTP puro no backend, JS vanilla no frontend)  
**Escopo:** `server.js`, `js/auth.js`, `js/ui.js`, `js/file-guard.js`

---

## Sumário Executivo

O projeto é um dashboard local/interno que faz proxy para a API do Azure DevOps. Por ser projetado para uso local, muitos riscos de produção não se aplicam (TLS, sessões, CSRF via cookie, etc.). Ainda assim, foram encontrados achados relevantes — especialmente o armazenamento de PAT (Personal Access Token) em `localStorage` e a ausência de cabeçalhos de segurança no servidor.

---

## Crítico

Nenhum achado crítico confirmado.

---

## Alto

### [H-01] PAT do Azure DevOps armazenado em `localStorage`

- **Rule ID:** JS-STORAGE-001
- **Severity:** High
- **Location:** [`js/auth.js:9,16`](js/auth.js)
- **Evidence:**
  ```js
  pat: localStorage.getItem(KEYS.pat) ?? '',
  // ...
  if (pat != null) localStorage.setItem(KEYS.pat, pat)
  ```
- **Impact:** O PAT é uma credencial de alto privilégio. Qualquer XSS na página consegue lê-lo via `localStorage.getItem('azdo_pat')` e exfiltrá-lo. `localStorage` é acessível por todo JavaScript rodando na mesma origem.
- **Fix:** Por se tratar de uma ferramenta local sem servidor de sessão, a mitigação principal é garantir que nenhum XSS seja possível (ver H-02 e M-01). Uma alternativa arquitetural seria o servidor Node receber o PAT uma vez, guardá-lo em memória, e o frontend nunca ter acesso direto — mas isso é uma mudança maior de design.
- **Mitigation:** Garantir CSP rígida e evitar todo uso de `innerHTML` com dados não-sanitizados (ver H-02).

---

### [H-02] `innerHTML` com HTML literal não derivado de input externo (baixo risco imediato, padrão perigoso)

- **Rule ID:** JS-XSS-001
- **Severity:** High (padrão de risco; baixo risco imediato dado que o conteúdo é estático)
- **Location:** [`js/ui.js:49`](js/ui.js), [`js/ui.js:64`](js/ui.js), [`js/ui.js:70`](js/ui.js)
- **Evidence:**
  ```js
  // linha 49 — HTML fixo, sem input externo
  if (el) el.innerHTML = html

  // linha 64 — usa escapeHtml, OK
  el.innerHTML = `<div class="alert danger">${escapeHtml(message)}</div>`

  // linha 70 — usa escapeHtml, OK
  el.innerHTML = `<div class="card"><span class="spinner"></span> ${escapeHtml(text)}</div>`
  ```
- **Impact:** A linha 49 usa um template literal com conteúdo 100% fixo — não há risco imediato. As linhas 64 e 70 aplicam `escapeHtml` corretamente. O risco é que o padrão de usar `innerHTML` torna futuras regressões mais prováveis.
- **Fix:** Para a linha 49, substituir `innerHTML` por criação de DOM explícita, ou manter com atenção ao revisar qualquer mudança futura nesse template.
- **False positive notes:** Conteúdo da linha 49 é completamente estático; conteúdo das linhas 64 e 70 é sanitizado. Risco atual é baixo.

---

## Médio

### [M-01] Ausência de cabeçalhos de segurança no servidor

- **Rule ID:** EXPRESS-HEADERS-001 (adaptado para Node HTTP puro)
- **Severity:** Medium
- **Location:** [`server.js:96-100`](server.js)
- **Evidence:**
  ```js
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Content-Length': stat.size,
    'Cache-Control': 'no-cache',
  })
  ```
- **Impact:** Ausência de `X-Content-Type-Options: nosniff`, `X-Frame-Options`, e Content Security Policy. Para uso local isso é de baixo impacto, mas se o servidor for exposto em rede, permite clickjacking e MIME sniffing.
- **Fix:** Adicionar headers de segurança mínimos nas respostas estáticas:
  ```js
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; object-src 'none'",
  ```

---

### [M-02] Erro do proxy expõe mensagem de erro upstream ao cliente

- **Rule ID:** EXPRESS-ERROR-001 (adaptado)
- **Severity:** Medium
- **Location:** [`server.js:62-63`](server.js)
- **Evidence:**
  ```js
  res.end(`Upstream proxy error: ${err.message}`)
  ```
- **Impact:** Mensagens de erro internas do Node/`https` podem vazar informações sobre a infraestrutura interna (hostnames, portas, detalhes de rede).
- **Fix:** Substituir por mensagem genérica e logar o erro apenas no servidor:
  ```js
  console.error(`[proxy] ${req.method} ${targetPath} -> ${err.message}`)
  res.end('Proxy error')
  ```

---

### [M-03] `404 Not Found` expõe o pathname requisitado ao cliente

- **Rule ID:** EXPRESS-ERROR-001 (adaptado)
- **Severity:** Low-Medium
- **Location:** [`server.js:93`](server.js)
- **Evidence:**
  ```js
  res.end(`Not Found: ${pathname}`)
  ```
- **Impact:** Reflete input do usuário (URL) diretamente na resposta. Embora seja texto plano (sem HTML), pode facilitar enumeração de caminhos.
- **Fix:**
  ```js
  res.end('Not Found')
  ```

---

## Baixo

### [L-01] PAT armazenado em `localStorage` acessível por outros módulos JS na mesma origem ✅ MITIGADO

> **Status (2026-05-30):** Mitigado. Adicionada CSP restritiva (`script-src 'self'` + CDN do Chart.js, sem `unsafe-inline`/`unsafe-eval`) nos 5 HTMLs, reduzindo a superfície de XSS que poderia exfiltrar o PAT. O armazenamento em si permanece (mudança arquitetural é parte do H-01, fora de escopo).

- **Rule ID:** JS-STORAGE-001
- **Severity:** Low (aspecto adicional do H-01)
- **Location:** [`js/auth.js:33`](js/auth.js)
- **Evidence:**
  ```js
  const pat = localStorage.getItem(KEYS.pat) ?? ''
  const token = btoa(':' + pat)
  return { 'Authorization': 'Basic ' + token }
  ```
- **Impact:** `btoa(':' + pat)` é Base64 simples, não criptografia. Qualquer acesso ao `localStorage` dá o PAT em texto claro (basta decodificar Base64).
- **Fix:** Reforçar defesas anti-XSS (CSP, evitar `innerHTML` sem sanitização) como controle compensatório.

---

### [L-02] Ausência de Content Security Policy no HTML ✅ MITIGADO

> **Status (2026-05-30):** Corrigido. Adicionada `<meta http-equiv="Content-Security-Policy">` nos 5 HTMLs (`index`, `config`, `dashboard`, `developer`, `codereview`). Como não há `<script>` inline no projeto, `script-src` ficou restritivo sem `unsafe-inline`; `cdn.jsdelivr.net` é permitido apenas nas páginas que usam Chart.js. `style-src 'unsafe-inline'` foi mantido por causa dos atributos `style="..."` inline existentes.

- **Rule ID:** JS-CSP-001
- **Severity:** Low (uso local)
- **Location:** HTMLs do projeto (não inspecionados em detalhe nesta análise)
- **Impact:** Sem CSP, um XSS pode executar scripts arbitrários e acessar o `localStorage` com o PAT.
- **Fix aplicado:**
  ```html
  <!-- index.html, config.html (sem CDN) -->
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'self'">
  <!-- dashboard.html, developer.html, codereview.html (com Chart.js) -->
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'self'">
  ```
  Idealmente, reforçar futuramente com o header equivalente no `server.js` (ver M-01).

---

## Contexto e Isenções

Os seguintes itens das referências foram **conscientemente desconsiderados** por incompatibilidade com o contexto do projeto:

- **TLS/Secure cookies:** Ferramenta local; sem TLS é o comportamento esperado.
- **CSRF:** Autenticação via header `Authorization: Basic`, não via cookie — sem risco de CSRF.
- **express-session / MemoryStore:** Não usa Express nem sessões.
- **Rate limiting de login:** Não há endpoint de login; credenciais são configuradas localmente.
- **`--inspect` do Node:** Não identificado em scripts de produção.

---

Relatório gerado em: `security_best_practices_report.md`
