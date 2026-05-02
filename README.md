# Developer Dashboard — Azure DevOps

Dashboard web estático para acompanhar métricas de desenvolvedores consumindo a API REST do Azure DevOps Services diretamente do navegador.

- Sem frameworks (HTML + CSS + JS puro, ES Modules nativos)
- Sem bundler e sem etapa de build
- Gráficos via [Chart.js](https://www.chartjs.org/) (CDN)
- Autenticação via Personal Access Token salvo no `localStorage`
- Cache local de 15 minutos para evitar rate limiting

## Como rodar

> ⚠️ **Não funciona abrindo os HTMLs direto do disco (`file://`).** ES Modules são bloqueados nessa origem. Também **não funciona com um servidor estático simples** (`python -m http.server`, `npx serve`): o Azure DevOps não devolve `Access-Control-Allow-Origin` para chamadas do browser com PAT, e a maioria dos endpoints usados aqui (WIQL, work items) seria bloqueada por CORS.

Por isso o projeto inclui um servidor Node.js mínimo (`server.js`, sem dependências externas) que:

1. Serve os arquivos estáticos em `http://localhost:8080`.
2. Faz proxy de `/_azdo/*` para `https://dev.azure.com/*`, repassando o header `Authorization`. Como o browser conversa same-origin com o proxy, não há CORS.

Use os scripts prontos:

- **Windows:** duplo-clique em `start.bat`
- **macOS / Linux:** `./start.sh` no terminal

Requerem **Node.js** instalado ([nodejs.org](https://nodejs.org/)). Nenhum `npm install` é necessário.

Alternativa manual:

```bash
node server.js
# ou com outra porta:
PORT=3000 node server.js
```

Depois abra `http://localhost:8080/index.html` e navegue até `config.html` para configurar o acesso.

## Primeiro acesso

1. Abra `config.html`.
2. Preencha **Organização** (ex.: `minha-empresa`), **Projeto** (ex.: `meu-projeto`) e **PAT**.
3. Clique em **Testar conexão**.
4. Clique em **Salvar**.
5. Acesse **Time**, **Desenvolvedor** ou **Code Review** no menu.

## Como gerar o PAT

1. Em [dev.azure.com](https://dev.azure.com), clique no avatar → **Security** → **Personal access tokens**.
2. **New Token** → defina nome e expiração.
3. Selecione os escopos:
   - `Code (Read)`
   - `Work Items (Read)`
   - `Project and Team (Read)`
   - `Build (Read)` (opcional)
4. Copie o token e cole em `config.html`.

O PAT fica salvo apenas em `localStorage` no seu navegador. Ele nunca é enviado para outro servidor nem aparece em URLs/console.

## Estrutura

```
index.html              # menu de navegação
config.html             # tela de configuração (PAT, org, projeto, teste)
dashboard.html          # visão do time (velocity, cycle time, work items, reviews)
developer.html          # visão individual (commits, PRs, reviews, work items)
codereview.html         # dashboard de code review (PRs por repositório, KPIs, PRs abertas)

css/
  main.css              # variáveis, tema claro/escuro, tipografia
  components.css        # cards, badges, tabelas, filtros

js/
  auth.js               # leitura/gravação do PAT + header Authorization
  cache.js              # cache em localStorage com TTL de 15 minutos
  api.js                # wrapper fetch para a API REST do Azure DevOps
  charts.js             # helpers de inicialização do Chart.js
  ui.js                 # topbar, tema, utilitários de DOM/datas, buildPrUrl, formatOpenDuration
  modules/
    commits.js          # commits e PRs por autor
    velocity.js         # velocity e burnup por sprint
    cycletime.js        # cycle time, agrupamento por tipo, tendência
    reviews.js          # revisões e comentários por revisor/autor
    workitems.js        # distribuição e saúde do backlog
```

## Métricas disponíveis

### Time (`dashboard.html`)
- Commits por dia no período
- PRs abertas (filtradas pelo ano atual, ordenadas por tempo de espera)
- Tempo médio de aprovação de PRs em horas (KPI)
- Velocity por sprint (planejado vs. entregue em story points)
- Burnup acumulado
- Cycle time com linha de tendência (scatter)
- Work items por tipo e estado
- Backlog health: items sem estimativa, sem responsável
- Ranking por autor: commits + PRs + taxa de aprovação
- Revisões de código: aprovações, rejeições, comentários, tempo de resposta

### Code Review (`codereview.html`)
- Seleção de repositórios monitorados (persistida em `localStorage`)
- Filtro por intervalo de datas (início e fim)
- PRs concluídas no período (por repositório selecionado)
- PRs abandonadas no período (por repositório selecionado)
- Tempo médio de aprovação em horas
- Listagem de PRs abertas com link direto, ordenada pelo maior tempo de espera

### Desenvolvedor (`developer.html`)
- KPIs de commits, PRs, revisões e work items
- Commits por dia
- Status das PRs autoradas
- Tabela de últimos commits
- Tabela de PRs como autor
- Tabela de revisões feitas (com voto)
- Tabela de work items atribuídos

## Filtros

- **Período**: últimos 7, 30 ou 90 dias (afeta commits, PRs, cycle time, work items) — `dashboard.html`
- **Intervalo de datas**: data início e data fim — `codereview.html`
- **Repositórios**: seleção de quais repos monitorar, salva em `localStorage` — `codereview.html`
- **Time**: seleção de time quando o projeto tem múltiplos — `dashboard.html`
- **Desenvolvedor**: dropdown populado a partir dos PRs e work items recentes — `developer.html`

## Tema

O modo escuro segue `prefers-color-scheme` por padrão e pode ser alternado manualmente pelo botão no topo (persistido em `localStorage`).

## Observações

- O Azure DevOps **não** devolve CORS para chamadas diretas do browser com PAT em endpoints como WIQL/work items. O `server.js` local repassa as chamadas de `/_azdo/*` para `https://dev.azure.com/*`, contornando o bloqueio sem expor a URL original.
- Tokens enviados como `Basic base64(":PAT")`.
- Versão de API usada: `api-version=7.0`.
- O cache é invalidado automaticamente após 15 minutos. Use **Recarregar** ou **Limpar cache** no dashboard para forçar busca fresca.

## Limitações conhecidas

- Coleta de comentários em PRs é feita nas ~30 PRs mais recentes do período (chamada por PR) para evitar rate limiting.
- A identificação do desenvolvedor usa `displayName`/`uniqueName`. Se um autor de commit usar um email/nome diferente do nome de exibição do Azure DevOps, os contadores podem não bater.
- Cycle time usa `ActivatedDate` → `ClosedDate/ResolvedDate/ChangedDate`. Processos que não populam esses campos (ex.: fluxo customizado) mostrarão dados incompletos.
