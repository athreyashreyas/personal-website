// Vanilla JS, no build step — this is served as-is by editor-server.mjs.
'use strict';

const $main = document.getElementById('main');
const $sidebar = document.getElementById('sidebar');
const $status = document.getElementById('status');
const $themeToggle = document.getElementById('theme-toggle');

let SCHEMA = null;
let dirty = false;

// ---------------------------------------------------------------- theme

function applyTheme() {
  const stored = localStorage.getItem('theme');
  const theme = stored || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', theme);
}
$themeToggle.addEventListener('click', () => {
  const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
});
applyTheme();

// ---------------------------------------------------------------- api

async function api(path, opts) {
  const res = await fetch(path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts && opts.headers) },
    body: opts && opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function setStatus(msg, kind) {
  $status.textContent = msg;
  $status.className = 'topbar-status' + (kind ? ' ' + kind : '');
  if (msg) {
    clearTimeout(setStatus._t);
    setStatus._t = setTimeout(() => {
      $status.textContent = '';
      $status.className = 'topbar-status';
    }, 4000);
  }
}

function markDirty(v) {
  dirty = v;
}
window.addEventListener('beforeunload', (e) => {
  if (dirty) {
    e.preventDefault();
    e.returnValue = '';
  }
});

// ---------------------------------------------------------------- router

function currentRoute() {
  const hash = location.hash.replace(/^#\/?/, '');
  const [key, id] = hash.split('/');
  return { key: key || null, id: id ? decodeURIComponent(id) : null };
}

window.addEventListener('hashchange', () => {
  if (dirty && !confirm('You have unsaved changes. Leave without saving?')) {
    return;
  }
  markDirty(false);
  render();
});

function navigate(hash) {
  if (dirty && !confirm('You have unsaved changes. Leave without saving?')) return;
  markDirty(false);
  location.hash = hash;
}

// ---------------------------------------------------------------- sidebar

function renderSidebar() {
  const { key } = currentRoute();
  $sidebar.innerHTML = '';

  const pagesSection = document.createElement('div');
  pagesSection.className = 'sidebar-section';
  const pagesHeading = document.createElement('div');
  pagesHeading.className = 'sidebar-heading';
  pagesHeading.textContent = 'Pages';
  pagesSection.appendChild(pagesHeading);
  for (const entry of SCHEMA.pages.entries) {
    const a = document.createElement('a');
    a.href = `#/pages/${encodeURIComponent(entry.id)}`;
    a.textContent = entry.label;
    if (key === 'pages' && currentRoute().id === entry.id) a.classList.add('active');
    pagesSection.appendChild(a);
  }
  $sidebar.appendChild(pagesSection);

  const collSection = document.createElement('div');
  collSection.className = 'sidebar-section';
  const collHeading = document.createElement('div');
  collHeading.className = 'sidebar-heading';
  collHeading.textContent = 'Collections';
  collSection.appendChild(collHeading);
  for (const [k, def] of Object.entries(SCHEMA)) {
    if (def.kind !== 'collection') continue;
    const a = document.createElement('a');
    a.href = `#/${k}`;
    a.textContent = def.label;
    if (key === k) a.classList.add('active');
    collSection.appendChild(a);
  }
  $sidebar.appendChild(collSection);
}

// ---------------------------------------------------------------- helpers

function fieldValue(field) {
  if (field.type === 'checkbox') return field.default === true;
  if (field.type === 'date' && field.default === 'today') return new Date().toISOString().slice(0, 10);
  return '';
}

function el(tag, props, children) {
  const node = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (k === 'class') node.className = v;
      else if (k in node) node[k] = v;
      else node.setAttribute(k, v);
    }
  }
  for (const child of children || []) {
    if (child == null) continue;
    node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

// ---------------------------------------------------------------- list view

async function renderListView(key) {
  const def = SCHEMA[key];
  $main.innerHTML = '<p class="empty">Loading…</p>';
  const entries = await api(`/api/entries/${key}`);

  $main.innerHTML = '';
  const header = el('div', { class: 'list-header' }, [
    el('h1', {}, [def.label]),
    el('button', { class: 'btn btn-primary' }, ['+ New']),
  ]);
  header.querySelector('button').addEventListener('click', () => navigate(`#/${key}/__new`));
  $main.appendChild(header);

  if (entries.length === 0) {
    $main.appendChild(el('p', { class: 'empty' }, [`No entries yet. Click “+ New” to add the first one.`]));
    return;
  }

  const cols = def.listColumns || ['title'];
  const table = el('table', { class: 'entry-list' });
  const thead = el('tr', {}, cols.map((c) => el('th', {}, [c])));
  table.appendChild(el('thead', {}, [thead]));
  const tbody = el('tbody');
  for (const entry of entries) {
    const tr = el('tr');
    cols.forEach((c, i) => {
      const td = el('td');
      if (i === 0) {
        const a = el('a', { href: `#/${key}/${encodeURIComponent(entry.id)}` }, [entry[c] || entry.id]);
        td.appendChild(a);
      } else if (typeof entry[c] === 'boolean') {
        if (entry[c]) td.appendChild(el('span', { class: 'badge' }, [c]));
      } else {
        td.textContent = entry[c] || '';
      }
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  $main.appendChild(table);
}

// ---------------------------------------------------------------- edit view

function slugPreview(title) {
  return String(title || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'untitled';
}

function renderField(field, value, onChange) {
  const wrap = el('div', { class: 'field' + (field.type === 'textarea' ? ' wide' : '') });
  const label = el('label', {}, [field.label + (field.required ? ' *' : '')]);
  wrap.appendChild(label);

  let input;
  if (field.type === 'textarea') {
    input = el('textarea', { rows: 2 });
    input.value = value || '';
  } else if (field.type === 'checkbox') {
    wrap.className = 'field checkbox';
    wrap.innerHTML = '';
    input = el('input', { type: 'checkbox' });
    input.checked = Boolean(value);
    wrap.appendChild(input);
    wrap.appendChild(label);
  } else if (field.type === 'date') {
    input = el('input', { type: 'date' });
    input.value = value || '';
  } else if (field.type === 'url') {
    input = el('input', { type: 'url', placeholder: 'https://…' });
    input.value = value || '';
  } else {
    input = el('input', { type: 'text' });
    input.value = value || '';
  }
  input.addEventListener('input', () => {
    markDirty(true);
    onChange(field.type === 'checkbox' ? input.checked : input.value);
  });
  if (field.type !== 'checkbox') wrap.appendChild(input);
  if (field.description) wrap.appendChild(el('div', { class: 'desc' }, [field.description]));
  return wrap;
}

const TOOLBAR_ACTIONS = [
  { label: 'B', title: 'Bold', act: (ta) => wrapSelection(ta, '**', '**') },
  { label: 'I', title: 'Italic', act: (ta) => wrapSelection(ta, '*', '*') },
  { label: 'H2', title: 'Heading', act: (ta) => prefixLines(ta, '## ') },
  { label: 'H3', title: 'Subheading', act: (ta) => prefixLines(ta, '### ') },
  { sep: true },
  { label: '“ ”', title: 'Quote', act: (ta) => prefixLines(ta, '> ') },
  { label: '• List', title: 'Bulleted list', act: (ta) => prefixLines(ta, '- ') },
  { label: '1. List', title: 'Numbered list', act: (ta) => prefixLines(ta, '1. ') },
  { label: '</>', title: 'Inline code', act: (ta) => wrapSelection(ta, '`', '`') },
  { sep: true },
  {
    label: 'Link',
    title: 'Insert link',
    act: (ta) => {
      const url = prompt('Link URL:');
      if (!url) return;
      const sel = ta.value.slice(ta.selectionStart, ta.selectionEnd) || 'link text';
      insertAtSelection(ta, `[${sel}](${url})`);
    },
  },
  { label: 'Image', title: 'Insert image', isImage: true },
];

function wrapSelection(ta, before, after) {
  const { selectionStart: s, selectionEnd: e, value } = ta;
  const sel = value.slice(s, e);
  ta.value = value.slice(0, s) + before + sel + after + value.slice(e);
  ta.selectionStart = s + before.length;
  ta.selectionEnd = s + before.length + sel.length;
  ta.dispatchEvent(new Event('input'));
  ta.focus();
}

function prefixLines(ta, prefix) {
  const { selectionStart: s, selectionEnd: e, value } = ta;
  const lineStart = value.lastIndexOf('\n', s - 1) + 1;
  let lineEnd = value.indexOf('\n', e);
  if (lineEnd === -1) lineEnd = value.length;
  const block = value.slice(lineStart, lineEnd);
  const prefixed = block
    .split('\n')
    .map((l) => (l.startsWith(prefix) ? l : prefix + l))
    .join('\n');
  ta.value = value.slice(0, lineStart) + prefixed + value.slice(lineEnd);
  ta.selectionStart = lineStart;
  ta.selectionEnd = lineStart + prefixed.length;
  ta.dispatchEvent(new Event('input'));
  ta.focus();
}

function insertAtSelection(ta, text) {
  const { selectionStart: s, selectionEnd: e, value } = ta;
  ta.value = value.slice(0, s) + text + value.slice(e);
  ta.selectionStart = ta.selectionEnd = s + text.length;
  ta.dispatchEvent(new Event('input'));
  ta.focus();
}

function buildToolbar(textarea, imageCtx) {
  const bar = el('div', { class: 'toolbar' });
  for (const action of TOOLBAR_ACTIONS) {
    if (action.sep) {
      bar.appendChild(el('div', { class: 'sep' }));
      continue;
    }
    const btn = el('button', { type: 'button', title: action.title }, [action.label]);
    btn.addEventListener('click', () => {
      if (action.isImage) openImageModal(imageCtx, textarea);
      else action.act(textarea);
    });
    bar.appendChild(btn);
  }
  return bar;
}

async function renderEditView(key, id) {
  const def = SCHEMA[key];
  const isNew = id === '__new';
  const isSingleton = def.kind === 'singleton';

  $main.innerHTML = '<p class="empty">Loading…</p>';
  let entry;
  if (isNew) {
    entry = { id: null, fields: {}, body: '' };
    for (const f of def.fields) entry.fields[f.name] = fieldValue(f);
  } else {
    entry = await api(`/api/entry/${key}/${encodeURIComponent(id)}`);
  }

  $main.innerHTML = '';

  const title = isSingleton
    ? def.entries.find((e) => e.id === id).label
    : isNew
      ? `New ${def.label.replace(/s$/, '')}`
      : entry.fields.title || id;

  const header = el('div', { class: 'edit-header' }, [
    el('a', { href: `#/${key}`, class: 'back-link' }, ['← Back']),
    el('h1', {}, [title]),
  ]);
  if (!isSingleton && !isNew) {
    const delBtn = el('button', { class: 'btn btn-danger' }, ['Delete']);
    delBtn.addEventListener('click', async () => {
      if (!confirm(`Delete “${title}”? This removes the file (recoverable via npm run content:undo until you publish).`)) return;
      await api(`/api/entry/${key}/${encodeURIComponent(id)}`, { method: 'DELETE' });
      navigate(`#/${key}`);
    });
    header.appendChild(delBtn);
  }
  $main.appendChild(header);

  const fieldValues = { ...entry.fields };
  if (!isSingleton) {
    const grid = el('div', { class: 'field-grid' });
    for (const field of def.fields) {
      grid.appendChild(renderField(field, fieldValues[field.name], (v) => (fieldValues[field.name] = v)));
    }
    $main.appendChild(grid);

    if (isNew) {
      const preview = el('div', { class: 'slug-preview' });
      const update = () => {
        preview.innerHTML = '';
        preview.append('Will be saved as ', el('code', {}, [`${slugPreview(fieldValues.title)}.mdx`]));
      };
      update();
      grid.querySelector('input[type="text"]')?.addEventListener('input', update);
      $main.appendChild(preview);
    }
  }

  $main.appendChild(el('div', { class: 'body-label' }, ['Body']));
  const textarea = el('textarea', { class: 'body-textarea' });
  textarea.value = entry.body || '';
  textarea.addEventListener('input', () => markDirty(true));

  // Collections keep one shared image directory (not per-entry — see
  // keystatic.config.tsx), so the id only matters for the "pages" singleton
  // lookup below; a not-yet-saved collection entry can still upload images.
  const imageCtx = { key: isSingleton ? 'pages' : key, id: isSingleton ? id : isNew ? 'new' : id };
  const toolbar = buildToolbar(textarea, imageCtx);
  $main.appendChild(toolbar);
  $main.appendChild(textarea);

  const actions = el('div', { class: 'actions' });
  const saveBtn = el('button', { class: 'btn btn-primary' }, [isNew ? 'Create' : 'Save']);
  const msg = el('span', { class: 'save-msg' });
  actions.appendChild(saveBtn);
  actions.appendChild(msg);
  $main.appendChild(actions);

  async function doSave() {
    if (!isSingleton) {
      const missing = def.fields.filter((f) => f.required && !String(fieldValues[f.name] || '').trim());
      if (missing.length) {
        msg.textContent = `${missing.map((f) => f.label).join(', ')} required.`;
        msg.className = 'save-msg err';
        return;
      }
    }
    saveBtn.disabled = true;
    msg.textContent = 'Saving…';
    msg.className = 'save-msg';
    try {
      if (isNew) {
        const res = await api(`/api/entry/${key}`, { method: 'POST', body: { fields: fieldValues, body: textarea.value } });
        markDirty(false);
        setStatus('Created ' + res.id, 'ok');
        navigate(`#/${key}/${encodeURIComponent(res.id)}`);
        return;
      }
      await api(`/api/entry/${key}/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: { fields: isSingleton ? {} : fieldValues, body: textarea.value },
      });
      markDirty(false);
      msg.textContent = 'Saved to disk.';
      msg.className = 'save-msg ok';
      setStatus('Saved', 'ok');
    } catch (err) {
      msg.textContent = err.message;
      msg.className = 'save-msg err';
    } finally {
      saveBtn.disabled = false;
    }
  }

  saveBtn.addEventListener('click', doSave);
  document.addEventListener('keydown', function shortcut(e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      doSave();
    }
  });
}

// ---------------------------------------------------------------- image modal

async function openImageModal(ctx, textarea) {
  if (!ctx.id) return; // guarded by disabled button, but be defensive
  const backdrop = el('div', { class: 'modal-backdrop' });
  const modal = el('div', { class: 'modal' });
  modal.appendChild(el('h2', {}, ['Insert image']));

  const tabs = el('div', { class: 'modal-tabs' });
  const uploadTab = el('button', { class: 'active', type: 'button' }, ['Upload new']);
  const existingTab = el('button', { type: 'button' }, ['Existing']);
  tabs.append(uploadTab, existingTab);
  modal.appendChild(tabs);

  const body = el('div');
  modal.appendChild(body);
  modal.appendChild(el('div', { class: 'modal-close' }, [(() => {
    const b = el('button', { class: 'btn' }, ['Cancel']);
    b.addEventListener('click', () => backdrop.remove());
    return b;
  })()]));

  function insertAndClose(url) {
    const alt = prompt('Alt text (for accessibility):', '') || '';
    insertAtSelection(textarea, `![${alt}](${url})`);
    backdrop.remove();
  }

  function showUpload() {
    uploadTab.classList.add('active');
    existingTab.classList.remove('active');
    body.innerHTML = '';
    const zone = el('div', { class: 'dropzone' }, ['Drag an image here, or click to choose a file']);
    const input = el('input', { type: 'file', accept: 'image/*', style: 'display:none' });
    zone.addEventListener('click', () => input.click());
    ['dragenter', 'dragover'].forEach((evt) =>
      zone.addEventListener(evt, (e) => {
        e.preventDefault();
        zone.classList.add('drag');
      }),
    );
    ['dragleave', 'drop'].forEach((evt) =>
      zone.addEventListener(evt, (e) => {
        e.preventDefault();
        zone.classList.remove('drag');
      }),
    );
    zone.addEventListener('drop', (e) => {
      const file = e.dataTransfer.files[0];
      if (file) upload(file);
    });
    input.addEventListener('change', () => {
      if (input.files[0]) upload(input.files[0]);
    });
    body.append(zone, input);

    async function upload(file) {
      zone.textContent = 'Uploading…';
      try {
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        const base64 = dataUrl.split(',')[1];
        const res = await api(`/api/images/${ctx.key}/${encodeURIComponent(ctx.id)}`, {
          method: 'POST',
          body: { filename: file.name, dataBase64: base64 },
        });
        insertAndClose(res.url);
      } catch (err) {
        zone.textContent = 'Upload failed: ' + err.message;
      }
    }
  }

  async function showExisting() {
    existingTab.classList.add('active');
    uploadTab.classList.remove('active');
    body.innerHTML = 'Loading…';
    const images = await api(`/api/images/${ctx.key}/${encodeURIComponent(ctx.id)}`);
    body.innerHTML = '';
    if (images.length === 0) {
      body.appendChild(el('p', { class: 'empty' }, ['No images uploaded here yet.']));
      return;
    }
    const grid = el('div', { class: 'image-grid' });
    for (const img of images) {
      const btn = el('button', { type: 'button', title: img.name });
      const thumb = el('img', { src: img.url, alt: '' });
      btn.appendChild(thumb);
      btn.addEventListener('click', () => insertAndClose(img.url));
      grid.appendChild(btn);
    }
    body.appendChild(grid);
  }

  uploadTab.addEventListener('click', showUpload);
  existingTab.addEventListener('click', showExisting);
  showUpload();

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) backdrop.remove();
  });
  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);
}

// ---------------------------------------------------------------- render

async function render() {
  const { key, id } = currentRoute();
  renderSidebar();
  if (!key || !SCHEMA[key]) {
    $main.innerHTML = '';
    $main.appendChild(el('p', { class: 'empty' }, ['Pick something to edit from the sidebar.']));
    return;
  }
  try {
    if (id) await renderEditView(key, id);
    else await renderListView(key);
  } catch (err) {
    $main.innerHTML = '';
    $main.appendChild(el('p', { class: 'empty' }, ['Error: ' + err.message]));
  }
}

(async function init() {
  SCHEMA = await api('/api/schema');
  render();
})();
