import { marked } from 'marked';
import { markedHighlight } from 'marked-highlight';
import hljs from 'highlight.js';
import 'highlight.js/styles/github.css';
import './style.css';

import { OpenFile, LoadFile, GetRecentFiles, ClearRecentFiles, ResolveImagePath } from '../wailsjs/go/main/App';

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
const recentsListEl = document.getElementById('recents-list');
const recentsEmptyEl = document.getElementById('recents-empty');
const sidebarEl = document.getElementById('sidebar');

let currentPath = null;

function resolveImages(baseDir, html) {
    const div = document.createElement('div');
    div.innerHTML = html;
    div.querySelectorAll('img').forEach((img) => {
        const src = img.getAttribute('src') || '';
        img.src = ResolveImagePath(baseDir, src);
    });
    return div.innerHTML;
}

async function refreshRecents() {
    try {
        const items = (await GetRecentFiles()) || [];
        renderRecents(items);
    } catch (err) {
        console.error(err);
    }
}

function renderRecents(items) {
    recentsListEl.innerHTML = '';
    items.forEach((item) => {
        const li = document.createElement('li');
        li.className = 'recent-item' + (item.path === currentPath ? ' active' : '');
        li.title = item.path;

        const nameDiv = document.createElement('div');
        nameDiv.className = 'recent-name';
        nameDiv.textContent = item.name;

        const pathDiv = document.createElement('div');
        pathDiv.className = 'recent-path';
        pathDiv.textContent = item.path;

        li.appendChild(nameDiv);
        li.appendChild(pathDiv);
        li.addEventListener('click', () => openRecent(item.path));
        recentsListEl.appendChild(li);
    });
    recentsEmptyEl.style.display = items.length ? 'none' : 'block';
}

async function openRecent(path) {
    try {
        const file = await LoadFile(path);
        if (!file) return;
        renderFile(file);
    } catch (err) {
        console.error(err);
        alert('Erro ao abrir arquivo: ' + err);
    }
    refreshRecents();
}

async function openFile() {
    try {
        const file = await OpenFile();
        if (!file) return;
        renderFile(file);
        refreshRecents();
    } catch (err) {
        console.error(err);
        alert('Erro ao abrir arquivo: ' + err);
    }
}

function renderFile(file) {
    currentPath = file.path;
    fileNameEl.textContent = file.name;
    document.title = file.name + ' — Markdown Viewer';
    const html = marked.parse(file.content);
    contentEl.innerHTML = resolveImages(file.baseDir, html);
    contentEl.classList.remove('empty-state');
    contentEl.scrollTop = 0;
}

function toggleSidebar() {
    sidebarEl.classList.toggle('hidden');
}

document.getElementById('btn-open').addEventListener('click', openFile);
document.getElementById('btn-open-empty').addEventListener('click', openFile);
document.getElementById('btn-sidebar').addEventListener('click', toggleSidebar);
document.getElementById('btn-clear-recents').addEventListener('click', async () => {
    try {
        await ClearRecentFiles();
        refreshRecents();
    } catch (err) {
        console.error(err);
    }
});

window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        openFile();
        return;
    }
    // Ctrl+B: alternar barra lateral
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleSidebar();
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

// Carrega a lista de arquivos recentes ao iniciar
refreshRecents();
console.info('Markdown Viewer pronto.');
