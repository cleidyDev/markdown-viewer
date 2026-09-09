# Markdown Viewer

Visualizador de arquivos **Markdown** somente leitura para Linux, construído com **Go + Wails v2**.

Abra qualquer arquivo `.md`, `.markdown` ou `.mdown` e visualize com renderização completa — sem edição.

![Go](https://img.shields.io/badge/Go-1.26-00ADD8?logo=go&logoColor=white)
![Wails](https://img.shields.io/badge/Wails-v2-DF0000)
![License](https://img.shields.io/badge/license-MIT-blue)

## ✨ Funcionalidades

- 📂 Abrir arquivos via diálogo nativo (botão **Abrir** ou `Ctrl+O`)
- 👁️ **Somente visualização** — sem edição
- 📝 Renderização GFM completa: títulos, listas, tabelas, blockquotes, links
- 🎨 Syntax highlight em blocos de código ([highlight.js](https://highlightjs.org/), tema GitHub)
- 🖼️ Imagens relativas resolvidas em relação à pasta do arquivo aberto
- 🪶 Binário único leve (~9 MB) com WebView nativo

## 🛠️ Tecnologias

| Camada | Tecnologia |
|---|---|
| Backend | Go + [Wails v2](https://wails.io) |
| Parser Markdown | [marked](https://marked.js.org/) + [marked-highlight](https://github.com/markedjs/marked-highlight) |
| Syntax highlight | [highlight.js](https://highlightjs.org/) |
| Frontend | Vite + HTML/CSS/JS puro |

## 🚀 Como rodar

### Pré-requisitos

- Go 1.21+
- Node.js 18+
- Wails CLI: `go install github.com/wailsapp/wails/v2/cmd/wails@latest`
- Dependências Linux (Ubuntu/Debian):

```bash
sudo apt install libgtk-3-dev libwebkit2gtk-4.1-dev libsoup-3.0-dev
```

### Rodar em desenvolvimento

```bash
wails dev -tags webkit2_41
```

### Gerar binário de produção

```bash
wails build -tags webkit2_41
./build/bin/markdown-viewer
```

## 📄 Licença

MIT

