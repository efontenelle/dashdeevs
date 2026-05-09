(function () {
  if (location.protocol !== 'file:') return

  function el(tag, attrs, children) {
    var node = document.createElement(tag)
    if (attrs) {
      for (var k in attrs) {
        if (k === 'style') node.setAttribute('style', attrs[k])
        else node.setAttribute(k, attrs[k])
      }
    }
    if (children) {
      for (var i = 0; i < children.length; i++) {
        var c = children[i]
        node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c)
      }
    }
    return node
  }

  function code(text) { return el('code', null, [text]) }
  function strong(text) { return el('strong', null, [text]) }

  function buildView() {
    var heading = el('h1', { style: 'margin-bottom: 8px;' }, ['Abra via servidor HTTP'])

    var lead = el('p', { style: 'color: #6e7781;' }, [
      'Este dashboard usa ',
      code('ES Modules'),
      ', que o navegador bloqueia quando o arquivo e aberto direto do disco (',
      code('file://'),
      ').',
    ])

    var listItems = [
      el('li', null, [strong('Windows: '), 'duplo-clique em ', code('start.bat'), ' na raiz do projeto.']),
      el('li', null, [strong('macOS / Linux: '), 'execute ', code('./start.sh'), ' no terminal.']),
      el('li', null, ['Alternativa manual: ', code('node server.js'), ' e abra ', code('http://localhost:8080'), '.']),
    ]
    var ul = el('ul', { style: 'margin: 8px 0 0 20px; padding: 0;' }, listItems)

    var box = el('div', {
      style: 'background: rgba(9,105,218,0.08); border: 1px solid rgba(9,105,218,0.3); border-radius: 8px; padding: 16px; margin-top: 16px;',
    }, [strong('Como rodar:'), ul])

    var footer = el('p', { style: 'margin-top: 16px; color: #6e7781;' }, [
      'Em seguida abra ', code('http://localhost:8080/index.html'), ' no navegador.',
    ])

    return el('main', {
      style: 'max-width: 720px; margin: 40px auto; padding: 0 16px; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; line-height: 1.5;',
    }, [heading, lead, box, footer])
  }

  function render() {
    while (document.body.firstChild) document.body.removeChild(document.body.firstChild)
    document.body.appendChild(buildView())
    document.title = 'Abra via servidor HTTP — Developer Dashboard'
  }

  if (document.body) render()
  else document.addEventListener('DOMContentLoaded', render)
})()
