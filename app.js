// ============================================================
// NOVEL APP - Core Data Management v2
// ============================================================

const DB = {
  KEY: 'novelapp_data',

  load() {
    const raw = localStorage.getItem(this.KEY);
    if (!raw) return this.seed();
    return JSON.parse(raw);
  },

  save(data) {
    localStorage.setItem(this.KEY, JSON.stringify(data));
  },

  seed() {
    const initial = { novels: [], settings: { theme: 'dark', font: 'serif', fontSize: 18 } };
    this.save(initial);
    return initial;
  },

  getNovels()        { return this.load().novels; },
  getSettings()      { return this.load().settings; },
  getNovel(id)       { return this.load().novels.find(n => n.id === id) || null; },

  saveNovel(novel) {
    const data = this.load();
    const idx = data.novels.findIndex(n => n.id === novel.id);
    if (idx >= 0) data.novels[idx] = novel;
    else data.novels.unshift(novel);
    this.save(data);
  },

  deleteNovel(id) {
    const data = this.load();
    data.novels = data.novels.filter(n => n.id !== id);
    this.save(data);
  },

  saveSettings(settings) {
    const data = this.load();
    data.settings = { ...data.settings, ...settings };
    this.save(data);
  },

  saveChapter(novelId, chapter) {
    const data = this.load();
    const novel = data.novels.find(n => n.id === novelId);
    if (!novel) return;
    novel.chapters = novel.chapters || [];
    const idx = novel.chapters.findIndex(c => c.id === chapter.id);
    if (idx >= 0) novel.chapters[idx] = chapter;
    else novel.chapters.push(chapter);
    novel.updatedAt = Date.now();
    this.save(data);
  },

  deleteChapter(novelId, chapterId) {
    const data = this.load();
    const novel = data.novels.find(n => n.id === novelId);
    if (!novel) return;
    novel.chapters = novel.chapters.filter(c => c.id !== chapterId);
    novel.updatedAt = Date.now();
    this.save(data);
  },

  // --- Characters ---
  saveCharacter(novelId, character) {
    const data = this.load();
    const novel = data.novels.find(n => n.id === novelId);
    if (!novel) return;
    novel.characters = novel.characters || [];
    const idx = novel.characters.findIndex(c => c.id === character.id);
    if (idx >= 0) novel.characters[idx] = character;
    else novel.characters.push(character);
    this.save(data);
  },

  deleteCharacter(novelId, charId) {
    const data = this.load();
    const novel = data.novels.find(n => n.id === novelId);
    if (!novel) return;
    novel.characters = (novel.characters || []).filter(c => c.id !== charId);
    this.save(data);
  },

  // --- Timeline events ---
  saveEvent(novelId, event) {
    const data = this.load();
    const novel = data.novels.find(n => n.id === novelId);
    if (!novel) return;
    novel.events = novel.events || [];
    const idx = novel.events.findIndex(e => e.id === event.id);
    if (idx >= 0) novel.events[idx] = event;
    else novel.events.push(event);
    this.save(data);
  },

  deleteEvent(novelId, eventId) {
    const data = this.load();
    const novel = data.novels.find(n => n.id === novelId);
    if (!novel) return;
    novel.events = (novel.events || []).filter(e => e.id !== eventId);
    this.save(data);
  },

  // --- Chapter draft versions ---
  saveDraft(novelId, chapterId, draft) {
    const data = this.load();
    const novel = data.novels.find(n => n.id === novelId);
    if (!novel) return;
    const chapter = (novel.chapters || []).find(c => c.id === chapterId);
    if (!chapter) return;
    chapter.drafts = chapter.drafts || [];
    chapter.drafts.unshift(draft);
    // keep max 10 drafts
    if (chapter.drafts.length > 10) chapter.drafts = chapter.drafts.slice(0, 10);
    this.save(data);
  },

  deleteDraft(novelId, chapterId, draftId) {
    const data = this.load();
    const novel = data.novels.find(n => n.id === novelId);
    if (!novel) return;
    const chapter = (novel.chapters || []).find(c => c.id === chapterId);
    if (!chapter) return;
    chapter.drafts = (chapter.drafts || []).filter(d => d.id !== draftId);
    this.save(data);
  }
};

// --- Helpers ---
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function formatDate(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatDateTime(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function wordCount(text) {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function totalWords(novel) {
  if (!novel.chapters || !novel.chapters.length) return 0;
  return novel.chapters.reduce((sum, c) => sum + wordCount(c.content || ''), 0);
}

// --- Export / Import ---
function exportJSON() {
  const data = DB.load();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'novel-backup-' + new Date().toISOString().slice(0,10) + '.json';
  a.click();
  URL.revokeObjectURL(url);
}

function importJSON(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = JSON.parse(e.target.result);
        if (!data.novels) throw new Error('Format tidak valid');
        DB.save(data);
        resolve(data);
      } catch (err) { reject(err); }
    };
    reader.readAsText(file);
  });
}

// --- Search across all chapters ---
function searchInNovel(novel, query) {
  if (!query || !query.trim()) return [];
  const q = query.toLowerCase();
  const results = [];
  (novel.chapters || []).forEach(ch => {
    const content = (ch.content || '').toLowerCase();
    const title   = (ch.title   || '').toLowerCase();
    if (title.includes(q)) {
      results.push({ chapterId: ch.id, chapterTitle: ch.title, type: 'title', preview: ch.title });
    }
    if (content.includes(q)) {
      // Find surrounding context
      let idx = 0;
      while (true) {
        idx = content.indexOf(q, idx);
        if (idx === -1) break;
        const start   = Math.max(0, idx - 60);
        const end     = Math.min(content.length, idx + q.length + 60);
        const preview = (start > 0 ? '...' : '') + ch.content.slice(start, end) + (end < ch.content.length ? '...' : '');
        results.push({ chapterId: ch.id, chapterTitle: ch.title, type: 'content', preview, matchIdx: idx });
        idx += q.length;
        if (results.filter(r => r.chapterId === ch.id && r.type === 'content').length >= 3) break;
      }
    }
  });
  return results;
}

// --- Theme & Font ---
const THEMES = {
  dark:   { bg: '#0f0f13', surface: '#18181f', text: '#e8e3d8', accent: '#c9a96e', muted: '#6b6570', border: '#2a2830' },
  light:  { bg: '#f5f0e8', surface: '#fffdf7', text: '#1a1714', accent: '#8b5e3c', muted: '#9c8f82', border: '#ddd5c8' },
  sepia:  { bg: '#1a1208', surface: '#241a0e', text: '#e8d5b0', accent: '#d4a853', muted: '#7a6a50', border: '#3a2e1e' },
  forest: { bg: '#0a120e', surface: '#121c16', text: '#d4e8d0', accent: '#5a9e6f', muted: '#5a7060', border: '#1e2e22' },
  ocean:  { bg: '#080f1a', surface: '#0f1824', text: '#cdd8e8', accent: '#4a90d9', muted: '#4a6070', border: '#182030' },
};

const FONTS = {
  serif:   '"Lora", "Georgia", serif',
  sans:    '"DM Sans", sans-serif',
  mono:    '"JetBrains Mono", monospace',
  elegant: '"Cormorant Garamond", serif',
  classic: '"Playfair Display", serif',
};

function applyTheme(name) {
  const t = THEMES[name] || THEMES.dark;
  Object.entries(t).forEach(([k,v]) => document.documentElement.style.setProperty('--'+k, v));
  document.body.dataset.theme = name;
}

function applyFont(name, size) {
  document.documentElement.style.setProperty('--font-body', FONTS[name] || FONTS.serif);
  if (size) document.documentElement.style.setProperty('--font-size', size + 'px');
}

function initSettings() {
  const s = DB.getSettings();
  applyTheme(s.theme || 'dark');
  applyFont(s.font || 'serif', s.fontSize || 18);
}

document.addEventListener('DOMContentLoaded', initSettings);

// --- Shared settings panel wiring ---
function wireSettingsPanel(panelId, closeId) {
  function syncSettings() {
    const s = DB.getSettings();
    document.querySelectorAll('.theme-swatch').forEach(el => el.classList.toggle('active', el.dataset.theme === s.theme));
    document.querySelectorAll('.font-opt').forEach(el => el.classList.toggle('active', el.dataset.font === s.font));
    const r = document.getElementById('font-size-range');
    if (r) { r.value = s.fontSize||18; const v = document.getElementById('font-size-val'); if(v) v.textContent = (s.fontSize||18)+'px'; }
  }

  const panel = document.getElementById(panelId);
  const closeBtn = document.getElementById(closeId);
  if (closeBtn) closeBtn.onclick = () => panel.classList.remove('open');

  document.querySelectorAll('.theme-swatch').forEach(el => {
    el.onclick = () => { applyTheme(el.dataset.theme); DB.saveSettings({theme: el.dataset.theme}); syncSettings(); };
  });
  document.querySelectorAll('.font-opt').forEach(el => {
    el.onclick = () => { const s = DB.getSettings(); applyFont(el.dataset.font, s.fontSize); DB.saveSettings({font: el.dataset.font}); syncSettings(); };
  });
  const fsr = document.getElementById('font-size-range');
  if (fsr) fsr.oninput = function() {
    const v = parseInt(this.value);
    const fsv = document.getElementById('font-size-val'); if(fsv) fsv.textContent = v+'px';
    const s = DB.getSettings(); applyFont(s.font, v); DB.saveSettings({fontSize: v});
  };

  const expBtn = document.getElementById('btn-export');
  if (expBtn) expBtn.onclick = exportJSON;
  const impBtn = document.getElementById('btn-import');
  if (impBtn) impBtn.onchange = async function() {
    const file = this.files[0]; if (!file) return;
    try { await importJSON(file); toast('Data berhasil diimport!', 'success'); location.reload(); }
    catch(e) { toast('Gagal import: ' + e.message, 'error'); }
    this.value = '';
  };

  syncSettings();
  return syncSettings;
}

// --- Toast ---
function toast(msg, type) {
  let c = document.getElementById('toast-container');
  if (!c) { c = document.createElement('div'); c.id = 'toast-container'; c.className = 'toast-container'; document.body.appendChild(c); }
  const t = document.createElement('div');
  t.className = 'toast ' + (type||'');
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => t.remove(), 2800);
}

// --- Status badge ---
const STATUS_CONFIG = {
  draft:   { label: 'Draft',   color: '#6b6570', bg: 'rgba(107,101,112,0.15)' },
  revisi:  { label: 'Revisi',  color: '#d4a853', bg: 'rgba(212,168,83,0.15)'  },
  final:   { label: 'Final',   color: '#5a9e6f', bg: 'rgba(90,158,111,0.15)'  },
};

function statusBadge(status) {
  const s = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
  return '<span style="padding:2px 8px; border-radius:10px; font-size:10px; font-weight:600; letter-spacing:0.05em; text-transform:uppercase; background:' + s.bg + '; color:' + s.color + '">' + s.label + '</span>';
}