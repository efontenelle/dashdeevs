# Developer Dashboard — Azure DevOps

Dashboard web estático para acompanhar métricas de desenvolvedores consumindo a API REST do Azure DevOps Services diretamente do navegador.

- Sem frameworks (HTML + CSS + JS puro, ES Modules nativos)
- Sem bundler e sem etapa de build
- Gráficos via [Chart.js](https://www.chartjs.org/) (CDN)
- Autenticação via Personal Access Token salvo no `localStorage`
- Cache local de 15 minutos para evitar rate limiting

## Como rodar

Por causa das restrições de CORS e de ES Modules em `file://`, é preciso servir por HTTP. Qualquer servidor estático resolve:

```bash
# a partir da raiz do projeto
npx serve .
# ou
python -m http.server 8080
```

Abra `http://localhost:3000` (ou a porta indicada pelo servidor) e navegue até `config.html` para configurar o acesso.

> Abrir direto `index.html` via `file://` pode funcionar em alguns navegadores, mas é mais seguro servir por HTTP.

## Primeiro acesso

1. Abra `config.html`.
2. Preencha **Organização** (ex.: `minha-empresa`), **Projeto** (ex.: `meu-projeto`) e **PAT**.
3. Clique em **Testar conexão**.
4. Clique em **Salvar**.
5. Acesse **Time** ou **Desenvolvedor** no menu.

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

css/
  main.css              # variáveis, tema claro/escuro, tipografia
  components.css        # cards, badges, tabelas, filtros

js/
  auth.js               # leitura/gravação do PAT + header Authorization
  cache.js              # cache em localStorage com TTL de 15 minutos
  api.js                # wrapper fetch para a API REST do Azure DevOps
  charts.js             # helpers de inicialização do Chart.js
  ui.js                 # topbar, tema, utilitários de DOM/datas
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
- Status das PRs (ativas, concluídas, abandonadas)
- Velocity por sprint (planejado vs. entregue em story points)
- Burnup acumulado
- Cycle time com linha de tendência (scatter)
- Work items por tipo e estado
- Backlog health: items sem estimativa, sem responsável
- Ranking por autor: commits + PRs + taxa de aprovação
- Revisões de código: aprovações, rejeições, comentários, tempo de resposta

### Desenvolvedor (`developer.html`)
- KPIs de commits, PRs, revisões e work items
- Commits por dia
- Status das PRs autoradas
- Tabela de últimos commits
- Tabela de PRs como autor
- Tabela de revisões feitas (com voto)
- Tabela de work items atribuídos

## Filtros

- **Período**: últimos 7, 30 ou 90 dias (afeta commits, PRs, cycle time, work items)
- **Time**: seleção de time quando o projeto tem múltiplos (dashboard.html)
- **Desenvolvedor**: dropdown populado a partir dos PRs e work items recentes (developer.html)

## Tema

O modo escuro segue `prefers-color-scheme` por padrão e pode ser alternado manualmente pelo botão no topo (persistido em `localStorage`).

## Observações

- A API do Azure DevOps permite CORS para chamadas com header `Authorization` em Basic Auth — não é necessário proxy.
- Tokens enviados como `Basic base64(":PAT")`.
- Versão de API usada: `api-version=7.0`.
- O cache é invalidado automaticamente após 15 minutos. Use **Recarregar** ou **Limpar cache** no dashboard para forçar busca fresca.

## Limitações conhecidas

- Coleta de comentários em PRs é feita nas ~30 PRs mais recentes do período (chamada por PR) para evitar rate limiting.
- A identificação do desenvolvedor usa `displayName`/`uniqueName`. Se um autor de commit usar um email/nome diferente do nome de exibição do Azure DevOps, os contadores podem não bater.
- Cycle time usa `ActivatedDate` → `ClosedDate/ResolvedDate/ChangedDate`. Processos que não populam esses campos (ex.: fluxo customizado) mostrarão dados incompletos.
