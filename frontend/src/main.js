import { marked } from 'marked';
import { markedHighlight } from 'marked-highlight';
import hljs from 'highlight.js';
import 'highlight.js/styles/github.css';
import './style.css';

import { OpenFile, LoadFile, ResolveImagePath } from '../wailsjs/go/main/App';

marked.use(
    markedHighlight({
        langPrefix: 'hljs language-',
        highlight(code, lang) {
            const language = hljs.getLanguage(lang) ? lang : 'plaintext';
            return hljs.highlight(code, { language }).value;
        },
    }),
    { gfm: true, breaks: false },
);

const contentEl = document.getElementById('content');
const fileNameEl = document.getElementById('file-name');

function resolveImages(baseDir, html) {
    const div = document.createElement('div');
    div.innerHTML = html;
    div.querySelectorAll('img').forEach((img) => {
        const src = img.getAttribute('src') || '';
        img.src = ResolveImagePath(baseDir, src);
    });
    return div.innerHTML;
}

async function openFile() {
    try {
        const file = await OpenFile();
        if (!file) return;
        renderFile(file);
    } catch (err) {
        console.error(err);
        alert('Erro ao abrir arquivo: ' + err);
    }
}

function renderFile(file) {
    fileNameEl.textContent = file.name;
    document.title = file.name + ' — Markdown Viewer';
    const html = marked.parse(file.content);
    contentEl.innerHTML = resolveImages(file.baseDir, html);
    contentEl.classList.remove('empty-state');
    contentEl.scrollTop = 0;
}

document.getElementById('btn-open').addEventListener('click', openFile);
document.getElementById('btn-open-empty').addEventListener('click', openFile);

window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        openFile();
        return;
    }
    // Ctrl+Home / Ctrl+End: rolar para o topo / fim do documento
    if (e.ctrlKey && e.key === 'Home') {
        e.preventDefault();
        contentEl.scrollTo({ top: 0, behavior: 'smooth' });
    }
    if (e.ctrlKey && e.key === 'End') {
        e.preventDefault();
        contentEl.scrollTo({ top: contentEl.scrollHeight, behavior: 'smooth' });
    }
});


// Permite abrir um arquivo passado via linha de comando (futuro: CLI args)
console.info('Markdown Viewer pronto.');
