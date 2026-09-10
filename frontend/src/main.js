import { marked } from 'marked';
import { markedHighlight } from 'marked-highlight';
import hljs from 'highlight.js';
import lightHljs from 'highlight.js/styles/github.css?raw';
import darkHljs from 'highlight.js/styles/github-dark.css?raw';
import './style.css';

import { OpenFile, LoadFile, GetRecentFiles, ClearRecentFiles, ResolveImagePath } from '../wailsjs/go/main/App';

// ===== Tema (claro/escuro) =====
const themeBtn = document.getElementById('btn-theme');
const hljsStyleEl = document.createElement('style');
hljsStyleEl.id = 'hljs-theme-style';
document.head.appendChild(hljsStyleEl);

function applyHljsTheme(theme) {
    hljsStyleEl.textContent = theme === 'dark' ? darkHljs : lightHljs;
}

function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    themeBtn.textContent = theme === 'dark' ? '☀️' : '🌙';
    applyHljsTheme(theme);
    localStorage.setItem('mv-theme', theme);
}

function toggleTheme() {
    applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
}

applyTheme(localStorage.getItem('mv-theme') || 'light');
themeBtn.addEventListener('click', toggleTheme);

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
const progressFillEl = document.getElementById('progress-fill');
const recentsFilterEl = document.getElementById('recents-filter');

let currentPath = null;
let recentsItems = [];

function relTime(ts) {
    if (!ts) return '';
    const s = Math.floor(Date.now() / 1000 - ts);
    if (s < 60) return 'agora';
    const m = Math.floor(s / 60);
    if (m < 60) return `há ${m} min`;
    const h = Math.floor(m / 60);
    if (h < 24) return `há ${h} h`;
    const d = Math.floor(h / 24);
    if (d < 30) return `há ${d} d`;
    return new Date(ts * 1000).toLocaleDateString('pt-BR');
}

function resolveImages(baseDir, html) {
    const div = document.createElement('div');
    div.innerHTML = html;
    div.querySelectorAll('img').forEach((img) => {
        const src = img.getAttribute('src') || '';
        img.src = ResolveImagePath(baseDir, src);
    });
    return div.innerHTML;
}

function updateProgressBar() {
    const max = contentEl.scrollHeight - contentEl.clientHeight;
    progressFillEl.style.width = max > 0 ? (contentEl.scrollTop / max) * 100 + '%' : '0%';
}

contentEl.addEventListener('scroll', updateProgressBar);

function addCodeLangBadges() {
    contentEl.querySelectorAll('pre > code').forEach((code) => {
        const match = [...code.classList].find((c) => c.startsWith('language-'));
        if (!match) return;
        const lang = match.slice('language-'.length);
        if (!lang) return;
        const badge = document.createElement('span');
        badge.className = 'code-lang';
        badge.textContent = lang;
        code.parentElement.appendChild(badge);
    });
}

async function refreshRecents() {
    try {
        recentsItems = (await GetRecentFiles()) || [];
        renderRecents();
    } catch (err) {
        console.error(err);
    }
}

function renderRecents() {
    const query = recentsFilterEl.value.trim().toLowerCase();
    const items = recentsItems.filter(
        (it) => !query || it.name.toLowerCase().includes(query) || it.path.toLowerCase().includes(query),
    );
    recentsListEl.innerHTML = '';
    items.forEach((item) => {
        const li = document.createElement('li');
        li.className = 'recent-item' + (item.path === currentPath ? ' active' : '');
        li.title = item.path;

        const top = document.createElement('div');
        top.className = 'recent-item-top';

        const nameDiv = document.createElement('div');
        nameDiv.className = 'recent-name';
        nameDiv.textContent = '📄 ' + item.name;

        const timeDiv = document.createElement('div');
        timeDiv.className = 'recent-time';
        timeDiv.textContent = relTime(item.lastOpened);

        const pathDiv = document.createElement('div');
        pathDiv.className = 'recent-path';
        pathDiv.textContent = item.path;

        top.appendChild(nameDiv);
        top.appendChild(timeDiv);
        li.appendChild(top);
        li.appendChild(pathDiv);
        li.addEventListener('click', () => openRecent(item.path));
        recentsListEl.appendChild(li);
    });
    recentsEmptyEl.style.display = items.length ? 'none' : 'block';
}

recentsFilterEl.addEventListener('input', renderRecents);

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
    addCodeLangBadges();
    contentEl.classList.remove('empty-state');
    contentEl.scrollTop = 0;
    updateProgressBar();
    renderRecents();
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
    // Ctrl+J: alternar tema claro/escuro
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        toggleTheme();
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
