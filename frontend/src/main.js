import { marked } from 'marked';
import { markedHighlight } from 'marked-highlight';
import hljs from 'highlight.js';
import lightHljs from 'highlight.js/styles/github.css?raw';
import darkHljs from 'highlight.js/styles/github-dark.css?raw';
import './style.css';

import { OpenFile, LoadFile, GetRecentFiles, ClearRecentFiles, ResolveImagePath } from '../wailsjs/go/main/App';
import { EventsOn } from '../wailsjs/runtime/runtime';

// ===== Elementos =====
const contentEl = document.getElementById('content');
const fileNameEl = document.getElementById('file-name');
const recentsListEl = document.getElementById('recents-list');
const recentsEmptyEl = document.getElementById('recents-empty');
const sidebarEl = document.getElementById('sidebar');
const progressFillEl = document.getElementById('progress-fill');
const recentsFilterEl = document.getElementById('recents-filter');
const tocListEl = document.getElementById('toc-list');
const toastContainerEl = document.getElementById('toast-container');
const searchBarEl = document.getElementById('search-bar');
const searchInputEl = document.getElementById('search-input');
const searchCountEl = document.getElementById('search-count');

// ===== Tema (claro/escuro, sincronizado com o sistema por padrão) =====
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

const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
applyTheme(localStorage.getItem('mv-theme') || (prefersDark ? 'dark' : 'light'));
themeBtn.addEventListener('click', toggleTheme);

// ===== Zoom (Ctrl+/-/0) =====
function applyZoom(z) {
    zoom = Math.min(2.4, Math.max(0.7, Math.round(z * 10) / 10));
    localStorage.setItem('mv-zoom', String(zoom));
    document.documentElement.style.setProperty('--zoom', zoom);
}

let zoom = parseFloat(localStorage.getItem('mv-zoom')) || 1;
applyZoom(zoom);

// ===== Toasts (substituem alert) =====
function showToast(message, opts = {}) {
    const t = document.createElement('div');
    t.className = 'toast';
    const span = document.createElement('span');
    span.textContent = message;
    t.appendChild(span);
    if (opts.action) {
        const b = document.createElement('button');
        b.className = 'toast-action';
        b.textContent = opts.actionLabel || 'OK';
        b.addEventListener('click', () => {
            opts.action();
            t.remove();
        });
        t.appendChild(b);
    }
    toastContainerEl.appendChild(t);
    const duration = opts.duration || (opts.action ? 8000 : 3500);
    setTimeout(() => {
        t.classList.add('fade');
        setTimeout(() => t.remove(), 350);
    }, duration);
}

// ===== Marked + highlight.js =====
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

let currentFile = null;
let currentPath = null;
let recentsItems = [];
let tocObserver = null;

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

async function resolveImages(baseDir, html) {
    const div = document.createElement('div');
    div.innerHTML = html;
    const imgs = [...div.querySelectorAll('img')];
    await Promise.all(imgs.map(async (img) => {
        const src = img.getAttribute('src') || '';
        img.src = await ResolveImagePath(baseDir, src);
    }));
    return div.innerHTML;
}

function updateProgressBar() {
    const max = contentEl.scrollHeight - contentEl.clientHeight;
    progressFillEl.style.width = max > 0 ? (contentEl.scrollTop / max) * 100 + '%' : '0%';
}

contentEl.addEventListener('scroll', updateProgressBar);

// ===== Botão copiar código + badge de linguagem =====
async function copyText(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (_) {
        // fallback para webviews sem clipboard API
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        ta.remove();
        return ok;
    }
}

function addCodeButtons() {
    contentEl.querySelectorAll('pre > code').forEach((code) => {
        const pre = code.parentElement;
        const langClass = [...code.classList].find((c) => c.startsWith('language-'));
        if (langClass && langClass.length > 'language-'.length) {
            const lang = langClass.slice('language-'.length);
            const badge = document.createElement('span');
            badge.className = 'code-lang';
            badge.textContent = lang;
            pre.appendChild(badge);
        }
        const btn = document.createElement('button');
        btn.className = 'code-copy';
        btn.textContent = 'Copiar';
        btn.title = 'Copiar código';
        btn.addEventListener('click', async () => {
            const ok = await copyText(code.textContent);
            btn.textContent = ok ? '✓ Copiado' : '✗ Erro';
            setTimeout(() => { btn.textContent = 'Copiar'; }, 1200);
        });
        pre.appendChild(btn);
    });
}

// ===== Índice (TOC) com scroll-spy =====
function setActiveToc(id) {
    tocListEl.querySelectorAll('.toc-item.active').forEach((el) => el.classList.remove('active'));
    const active = tocListEl.querySelector(`.toc-item[data-target="${id}"]`);
    if (active) {
        active.classList.add('active');
        const listRect = tocListEl.getBoundingClientRect();
        const itemRect = active.getBoundingClientRect();
        if (itemRect.top < listRect.top || itemRect.bottom > listRect.bottom) {
            active.scrollIntoView({ block: 'nearest' });
        }
    }
}

function buildToc() {
    const heads = [...contentEl.querySelectorAll('h1, h2, h3')];
    tocListEl.innerHTML = '';
    if (tocObserver) tocObserver.disconnect();
    if (!heads.length) {
        tocListEl.innerHTML = '<li class="toc-empty">Este arquivo não tem cabeçalhos.</li>';
        return;
    }
    heads.forEach((h, i) => {
        if (!h.id) h.id = 'heading-' + i;
        const li = document.createElement('li');
        li.className = 'toc-item toc-' + h.tagName.toLowerCase();
        li.dataset.target = h.id;
        li.textContent = h.textContent;
        li.addEventListener('click', () => {
            document.getElementById(h.id).scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        tocListEl.appendChild(li);
    });
    tocObserver = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
            if (e.isIntersecting) setActiveToc(e.target.id);
        });
    }, { root: contentEl, rootMargin: '0px 0px -65% 0px', threshold: 0 });
    heads.forEach((h) => tocObserver.observe(h));
}

// ===== Busca no documento (Ctrl+F) =====
let searchState = { hits: [], idx: -1 };

async function runSearch() {
    const query = searchInputEl.value;
    // restaura o conteúdo limpo antes de marcar de novo
    if (currentFile) await renderContent(currentFile, true);
    searchState = { hits: [], idx: -1 };
    if (!query) {
        searchCountEl.textContent = '';
        return;
    }
    const n = markMatches(query);
    searchCountEl.textContent = n ? `1/${n}` : '0';
    if (n) {
        searchState.idx = 0;
        highlightCurrentHit();
    }
}

function markMatches(query) {
    const q = query.toLowerCase();
    if (!q) return 0;
    const walker = document.createTreeWalker(contentEl, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
            if (node.parentElement.closest('.code-copy')) return NodeFilter.FILTER_REJECT;
            return node.nodeValue.toLowerCase().includes(q)
                ? NodeFilter.FILTER_ACCEPT
                : NodeFilter.FILTER_REJECT;
        },
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    let count = 0;
    nodes.forEach((node) => {
        const text = node.nodeValue;
        const lower = text.toLowerCase();
        const frag = document.createDocumentFragment();
        let pos = 0;
        let idx;
        while ((idx = lower.indexOf(q, pos)) !== -1) {
            if (idx > pos) frag.appendChild(document.createTextNode(text.slice(pos, idx)));
            const mark = document.createElement('mark');
            mark.className = 'search-hit';
            mark.textContent = text.slice(idx, idx + q.length);
            frag.appendChild(mark);
            searchState.hits.push(mark);
            count++;
            pos = idx + q.length;
        }
        if (pos === 0) return;
        if (pos < text.length) frag.appendChild(document.createTextNode(text.slice(pos)));
        node.parentNode.replaceChild(frag, node);
    });
    return count;
}

function highlightCurrentHit() {
    searchState.hits.forEach((h) => h.classList.remove('current'));
    const hit = searchState.hits[searchState.idx];
    if (!hit) return;
    hit.classList.add('current');
    hit.scrollIntoView({ block: 'center' });
    searchCountEl.textContent = `${searchState.idx + 1}/${searchState.hits.length}`;
}

function moveHit(delta) {
    if (!searchState.hits.length) return;
    searchState.idx = (searchState.idx + delta + searchState.hits.length) % searchState.hits.length;
    highlightCurrentHit();
}

async function closeSearch() {
    searchBarEl.classList.add('hidden');
    searchInputEl.value = '';
    searchCountEl.textContent = '';
    if (currentFile) await renderContent(currentFile, true);
    searchState = { hits: [], idx: -1 };
}

let searchTimer = null;
searchInputEl.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(runSearch, 300);
});
searchInputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        moveHit(e.shiftKey ? -1 : 1);
    } else if (e.key === 'Escape') {
        e.preventDefault();
        closeSearch();
    }
});
document.getElementById('btn-search-next').addEventListener('click', () => moveHit(1));
document.getElementById('btn-search-prev').addEventListener('click', () => moveHit(-1));
document.getElementById('btn-search-close').addEventListener('click', closeSearch);
document.getElementById('btn-search').addEventListener('click', openSearch);

function openSearch() {
    searchBarEl.classList.remove('hidden');
    searchInputEl.focus();
    searchInputEl.select();
}

// ===== Arquivos recentes =====
async function refreshRecents() {
    try {
        recentsItems = (await GetRecentFiles()) || [];
    } catch (err) {
        console.error(err);
        recentsItems = [];
    }
    renderRecents();
}

function renderRecents() {
    const filter = (recentsFilterEl.value || '').toLowerCase();
    const items = recentsItems.filter(
        (it) => it.name.toLowerCase().includes(filter) || it.path.toLowerCase().includes(filter),
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
        showToast('Erro ao abrir arquivo: ' + err);
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
        showToast('Erro ao abrir arquivo: ' + err);
    }
}

// ===== Renderização do conteúdo =====
async function renderContent(file, preserveScroll) {
    const max = contentEl.scrollHeight - contentEl.clientHeight;
    const ratio = preserveScroll && max > 0 ? contentEl.scrollTop / max : 0;

    currentFile = file;
    currentPath = file.path;
    fileNameEl.textContent = file.name;
    document.title = file.name + ' — Markdown Viewer';
    const html = marked.parse(file.content);
    contentEl.innerHTML = await resolveImages(file.baseDir, html);
    addCodeButtons();
    buildToc();
    contentEl.classList.remove('empty-state');
    if (preserveScroll) {
        const newMax = contentEl.scrollHeight - contentEl.clientHeight;
        contentEl.scrollTop = newMax > 0 ? ratio * newMax : 0;
    } else {
        contentEl.scrollTop = 0;
    }
    updateProgressBar();
    renderRecents();
}

function renderFile(file) {
    renderContent(file, false);
}

function toggleSidebar() {
    sidebarEl.classList.toggle('hidden');
}

// ===== Eventos =====
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
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        openFile();
        return;
    }
    if (mod && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        openSearch();
        return;
    }
    if (mod && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleSidebar();
        return;
    }
    if (mod && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        toggleTheme();
        return;
    }
    if (mod && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        applyZoom(zoom + 0.1);
        return;
    }
    if (mod && e.key === '-') {
        e.preventDefault();
        applyZoom(zoom - 0.1);
        return;
    }
    if (mod && e.key === '0') {
        e.preventDefault();
        applyZoom(1);
        return;
    }
    if (mod && e.key === 'Home') {
        e.preventDefault();
        contentEl.scrollTo({ top: 0, behavior: 'smooth' });
    }
    if (mod && e.key === 'End') {
        e.preventDefault();
        contentEl.scrollTo({ top: contentEl.scrollHeight, behavior: 'smooth' });
    }
});

// ===== Eventos do backend =====
EventsOn('file:changed', (path) => {
    if (path !== currentPath) return;
    showToast('O arquivo foi modificado no disco.', {
        actionLabel: 'Recarregar',
        action: () => openRecent(path),
    });
});

EventsOn('open-path', (path) => {
    openRecent(path);
});

// ===== Inicialização =====
refreshRecents();
console.info('Markdown Viewer pronto.');
