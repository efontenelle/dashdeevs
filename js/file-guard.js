(function () {
  if (location.protocol !== 'file:') return

  var html =
    '<main style="max-width: 720px; margin: 40px auto; padding: 0 16px; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; line-height: 1.5;">' +
      '<h1 style="margin-bottom: 8px;">Abra via servidor HTTP</h1>' +
      '<p style="color: #6e7781;">Este dashboard usa <code>ES Modules</code>, que o navegador bloqueia quando o arquivo e aberto direto do disco (<code>file://</code>).</p>' +
      '<div style="background: rgba(9,105,218,0.08); border: 1px solid rgba(9,105,218,0.3); border-radius: 8px; padding: 16px; margin-top: 16px;">' +
        '<strong>Como rodar:</strong>' +
        '<ul style="margin: 8px 0 0 20px; padding: 0;">' +
          '<li><strong>Windows:</strong> duplo-clique em <code>start.bat</code> na raiz do projeto.</li>' +
          '<li><strong>macOS / Linux:</strong> execute <code>./start.sh</code> no terminal.</li>' +
          '<li>Alternativa manual: <code>node server.js</code> e abra <code>http://localhost:8080</code>.</li>' +
        '</ul>' +
      '</div>' +
      '<p style="margin-top: 16px; color: #6e7781;">Em seguida abra <code>http://localhost:8080/index.html</code> no navegador.</p>' +
    '</main>'

  function render() {
    document.body.innerHTML = html
    document.title = 'Abra via servidor HTTP — Developer Dashboard'
  }

  if (document.body) render()
  else document.addEventListener('DOMContentLoaded', render)
})()
