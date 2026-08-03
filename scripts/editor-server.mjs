#!/usr/bin/env node
/**
 * A tiny, local-only content editor — a fast alternative to `npm run dev:cms`
 * for the common case of just editing text/frontmatter/images.
 *
 * Plain node:http, one dependency already in node_modules (js-yaml). No Vite,
 * no React, no @keystar/ui — so it starts instantly instead of paying the
 * Keystatic admin's cold-bundle cost. It only ever touches src/content and
 * public/images (the same paths `npm run content:*` operates on), writes
 * working files only (never commits/pushes — use the content:* scripts for
 * that), and binds to localhost only.
 */
import http from 'node:http';
import { readFile, writeFile, mkdir, readdir, stat, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';
import yaml from 'js-yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT) || 4322;

// ------------------------------------------------------------------ schema
// Mirrors keystatic.config.tsx / src/content.config.ts. Kept in sync by hand
// — this tool intentionally has no dependency on Keystatic's own config
// format, so there is one small, readable source of truth for it here.

const COLLECTIONS = {
  pages: {
    kind: 'singleton',
    label: 'Pages',
    fields: [],
    entries: [
      {
        id: 'home',
        label: 'Home intro',
        file: 'src/content/home.mdx',
        imageDir: 'public/images/home',
        imagePublicPath: '/images/home/',
      },
      {
        id: 'about',
        label: 'About page',
        file: 'src/content/about.mdx',
        imageDir: 'public/images/about',
        imagePublicPath: '/images/about/',
      },
    ],
  },
  writing: {
    kind: 'collection',
    label: 'Writing',
    dir: 'src/content/writing',
    imageDir: 'public/images/writing',
    imagePublicPath: '/images/writing/',
    listColumns: ['title', 'date', 'draft'],
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true },
      { name: 'date', label: 'Date', type: 'date', required: true, default: 'today' },
      { name: 'dek', label: 'Dek', type: 'text', description: 'Optional one-line summary shown in the list view.' },
      { name: 'tags', label: 'Tags', type: 'tags', description: 'Comma separated.' },
      { name: 'draft', label: 'Draft', type: 'checkbox', description: 'Hidden from the list and from the production build.', default: false },
    ],
  },
  projects: {
    kind: 'collection',
    label: 'Projects',
    dir: 'src/content/projects',
    imageDir: 'public/images/projects',
    imagePublicPath: '/images/projects/',
    listColumns: ['title', 'status'],
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true },
      { name: 'description', label: 'Description', type: 'textarea', required: true, description: 'One-line summary — shown in the list and as the page lede.' },
      { name: 'status', label: 'Status', type: 'text', description: 'Optional — e.g. active, in progress, archived, complete.' },
      { name: 'date', label: 'Date', type: 'date', description: 'Used for ordering (newest first).', default: 'today' },
      { name: 'links.repo', label: 'Repo URL', type: 'url' },
      { name: 'links.live', label: 'Live URL', type: 'url' },
    ],
  },
  recommendations: {
    kind: 'collection',
    label: 'Recommendations',
    dir: 'src/content/recommendations',
    imageDir: 'public/images/recommendations',
    imagePublicPath: '/images/recommendations/',
    listColumns: ['title', 'category'],
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true },
      { name: 'url', label: 'Link', type: 'url', description: 'Optional — where to find it.' },
      { name: 'category', label: 'Category', type: 'text', description: 'Optional — e.g. Book, Article, Tool, Rabbit hole.' },
      { name: 'date', label: 'Date added', type: 'date', required: true, default: 'today' },
    ],
  },
};

// ------------------------------------------------------------- fs helpers

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function isoDate(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value ?? '';
}

/** Splits a `---\nyaml\n---\nbody` file into { data, body }. */
function parseFrontmatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: raw };
  const data = yaml.load(m[1]) || {};
  return { data, body: m[2].replace(/^\n/, '') };
}

function serializeEntry(data, body) {
  const yamlText = yaml.dump(data, { lineWidth: -1 });
  return `---\n${yamlText}---\n\n${body.trim()}\n`;
}

/** Builds the frontmatter object for a collection from posted field values. */
function buildFrontmatter(collectionKey, values) {
  const def = COLLECTIONS[collectionKey];
  const data = {};
  for (const field of def.fields) {
    const raw = values[field.name];
    if (field.name.includes('.')) {
      const [group, key] = field.name.split('.');
      data[group] = data[group] || {};
      data[group][key] = raw ?? '';
      continue;
    }
    if (field.type === 'checkbox') {
      data[field.name] = Boolean(raw);
    } else if (field.type === 'tags') {
      data[field.name] = Array.isArray(raw)
        ? raw
        : String(raw ?? '')
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean);
    } else if (field.type === 'date') {
      data[field.name] = raw && raw.length > 0 ? raw : todayISO();
    } else {
      data[field.name] = raw ?? '';
    }
  }
  return data;
}

/** Reads posted frontmatter back out into flat field values for the client. */
function readFrontmatter(collectionKey, data) {
  const def = COLLECTIONS[collectionKey];
  const values = {};
  for (const field of def.fields) {
    if (field.name.includes('.')) {
      const [group, key] = field.name.split('.');
      values[field.name] = (data[group] && data[group][key]) ?? '';
      continue;
    }
    let v = data[field.name];
    if (field.type === 'date') v = isoDate(v);
    if (field.type === 'tags') v = Array.isArray(v) ? v.join(', ') : (v ?? '');
    values[field.name] = v ?? (field.type === 'checkbox' ? false : '');
  }
  return values;
}

function slugify(title) {
  return String(title)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'untitled';
}

async function uniqueSlug(dir, base) {
  let slug = base;
  let n = 2;
  while (await pathExists(path.join(ROOT, dir, `${slug}.mdx`))) {
    slug = `${base}-${n++}`;
  }
  return slug;
}

async function pathExists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

function sanitizeFilename(name) {
  const ext = path.extname(name).toLowerCase().replace(/[^a-z0-9.]/g, '');
  const base = path
    .basename(name, path.extname(name))
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'image';
  return { base, ext: ext || '.png' };
}

async function uniqueFilename(dir, base, ext) {
  let name = `${base}${ext}`;
  let n = 2;
  while (await pathExists(path.join(dir, name))) {
    name = `${base}-${n++}${ext}`;
  }
  return name;
}

// ------------------------------------------------------------ entry logic

function collectionOrThrow(key) {
  const def = COLLECTIONS[key];
  if (!def) {
    const err = new Error(`Unknown collection "${key}"`);
    err.status = 404;
    throw err;
  }
  return def;
}

async function listEntries(key) {
  const def = collectionOrThrow(key);
  if (def.kind === 'singleton') {
    return def.entries.map((e) => ({ id: e.id, label: e.label }));
  }
  const dir = path.join(ROOT, def.dir);
  let files = [];
  try {
    files = (await readdir(dir)).filter((f) => /\.(mdx?|MDX?)$/.test(f));
  } catch {
    files = [];
  }
  const entries = await Promise.all(
    files.map(async (file) => {
      const id = file.replace(/\.(mdx|md)$/i, '');
      const raw = await readFile(path.join(dir, file), 'utf8');
      const { data } = parseFrontmatter(raw);
      const values = readFrontmatter(key, data);
      return { id, ...values };
    }),
  );
  entries.sort((a, b) => {
    if (a.date && b.date) return a.date < b.date ? 1 : a.date > b.date ? -1 : 0;
    return String(a.title || '').localeCompare(String(b.title || ''));
  });
  return entries;
}

/** ids come straight from the URL — keep them from escaping the collection's directory. */
function assertInside(dir, filePath) {
  if (filePath !== dir && !filePath.startsWith(dir + path.sep)) {
    const err = new Error('Invalid id');
    err.status = 400;
    throw err;
  }
  return filePath;
}

function entryFilePath(key, id) {
  const def = collectionOrThrow(key);
  if (def.kind === 'singleton') {
    const e = def.entries.find((x) => x.id === id);
    if (!e) {
      const err = new Error(`Unknown entry "${id}"`);
      err.status = 404;
      throw err;
    }
    return path.join(ROOT, e.file);
  }
  const dir = path.join(ROOT, def.dir);
  return assertInside(dir, path.join(dir, `${id}.mdx`));
}

async function readEntry(key, id) {
  const def = collectionOrThrow(key);
  const filePath = entryFilePath(key, id);
  const raw = await readFile(filePath, 'utf8').catch(() => '---\n{}\n---\n\n');
  const { data, body } = parseFrontmatter(raw);
  return {
    id,
    fields: def.kind === 'singleton' ? {} : readFrontmatter(key, data),
    body,
  };
}

async function writeEntry(key, id, fields, body) {
  const def = collectionOrThrow(key);
  const filePath = entryFilePath(key, id);
  const data = def.kind === 'singleton' ? {} : buildFrontmatter(key, fields);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, serializeEntry(data, body), 'utf8');
}

async function createEntry(key, fields, body) {
  const def = collectionOrThrow(key);
  if (def.kind !== 'collection') {
    const err = new Error('Cannot create entries in a singleton');
    err.status = 400;
    throw err;
  }
  const title = fields.title || 'untitled';
  const id = await uniqueSlug(def.dir, slugify(title));
  await writeEntry(key, id, fields, body || '');
  return id;
}

async function deleteEntry(key, id) {
  const def = collectionOrThrow(key);
  if (def.kind !== 'collection') {
    const err = new Error('Cannot delete a singleton page');
    err.status = 400;
    throw err;
  }
  const filePath = entryFilePath(key, id);
  await unlink(filePath);
}

// ------------------------------------------------------------ image logic

function imageConfigFor(key, id) {
  const def = collectionOrThrow(key);
  if (def.kind === 'singleton') {
    const e = def.entries.find((x) => x.id === id);
    if (!e) {
      const err = new Error(`Unknown entry "${id}"`);
      err.status = 404;
      throw err;
    }
    return { dir: e.imageDir, publicPath: e.imagePublicPath };
  }
  return { dir: def.imageDir, publicPath: def.imagePublicPath };
}

async function listImages(key, id) {
  const { dir, publicPath } = imageConfigFor(key, id);
  const abs = path.join(ROOT, dir);
  let files = [];
  try {
    files = (await readdir(abs)).filter((f) => /\.(webp|png|jpe?g|gif|svg)$/i.test(f));
  } catch {
    files = [];
  }
  const withStat = await Promise.all(
    files.map(async (f) => {
      const s = await stat(path.join(abs, f));
      return { name: f, url: publicPath + f, mtime: s.mtimeMs };
    }),
  );
  withStat.sort((a, b) => b.mtime - a.mtime);
  return withStat.map(({ name, url }) => ({ name, url }));
}

async function saveImage(key, id, filename, base64) {
  const { dir, publicPath } = imageConfigFor(key, id);
  const abs = path.join(ROOT, dir);
  await mkdir(abs, { recursive: true });
  const { base, ext } = sanitizeFilename(filename);
  const finalName = await uniqueFilename(abs, base, ext);
  const buffer = Buffer.from(base64, 'base64');
  await writeFile(path.join(abs, finalName), buffer);
  return { name: finalName, url: publicPath + finalName };
}

// ------------------------------------------------------------------ http

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
};

function send(res, status, body, contentType = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': contentType });
  res.end(body);
}

function sendJSON(res, status, obj) {
  send(res, status, JSON.stringify(obj), 'application/json; charset=utf-8');
}

async function readJSONBody(req, maxBytes = 30 * 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) throw Object.assign(new Error('Request body too large'), { status: 413 });
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

/** Only ever serves files that resolve inside `public/images`. */
async function serveStaticImage(req, res, urlPath) {
  const rel = decodeURIComponent(urlPath.replace(/^\/images\//, ''));
  const abs = path.join(ROOT, 'public', 'images', rel);
  if (!abs.startsWith(path.join(ROOT, 'public', 'images') + path.sep)) {
    return send(res, 403, 'Forbidden', 'text/plain');
  }
  try {
    const buf = await readFile(abs);
    const ext = path.extname(abs).toLowerCase();
    send(res, 200, buf, MIME[ext] || 'application/octet-stream');
  } catch {
    send(res, 404, 'Not found', 'text/plain');
  }
}

async function serveClientAsset(res, name) {
  const abs = path.join(__dirname, 'editor', name);
  try {
    const buf = await readFile(abs);
    const ext = path.extname(abs).toLowerCase();
    send(res, 200, buf, MIME[ext] || 'application/octet-stream');
  } catch {
    send(res, 404, 'Not found', 'text/plain');
  }
}

function schemaForClient() {
  const out = {};
  for (const [key, def] of Object.entries(COLLECTIONS)) {
    out[key] = {
      kind: def.kind,
      label: def.label,
      fields: def.fields,
      listColumns: def.listColumns,
      entries: def.kind === 'singleton' ? def.entries.map((e) => ({ id: e.id, label: e.label })) : undefined,
    };
  }
  return out;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const p = url.pathname;

    // --- static: client shell + preview images -------------------------
    if (req.method === 'GET' && p === '/') return serveClientAsset(res, 'index.html');
    if (req.method === 'GET' && p === '/editor.js') return serveClientAsset(res, 'editor.js');
    if (req.method === 'GET' && p === '/editor.css') return serveClientAsset(res, 'editor.css');
    if (req.method === 'GET' && p.startsWith('/images/')) return serveStaticImage(req, res, p);

    // --- api -------------------------------------------------------------
    if (req.method === 'GET' && p === '/api/schema') return sendJSON(res, 200, schemaForClient());

    let m;
    if (req.method === 'GET' && (m = p.match(/^\/api\/entries\/([^/]+)$/))) {
      return sendJSON(res, 200, await listEntries(m[1]));
    }
    if (req.method === 'GET' && (m = p.match(/^\/api\/entry\/([^/]+)\/([^/]+)$/))) {
      return sendJSON(res, 200, await readEntry(m[1], decodeURIComponent(m[2])));
    }
    if (req.method === 'PUT' && (m = p.match(/^\/api\/entry\/([^/]+)\/([^/]+)$/))) {
      const body = await readJSONBody(req);
      await writeEntry(m[1], decodeURIComponent(m[2]), body.fields || {}, body.body || '');
      return sendJSON(res, 200, { ok: true });
    }
    if (req.method === 'POST' && (m = p.match(/^\/api\/entry\/([^/]+)$/))) {
      const body = await readJSONBody(req);
      const id = await createEntry(m[1], body.fields || {}, body.body || '');
      return sendJSON(res, 200, { ok: true, id });
    }
    if (req.method === 'DELETE' && (m = p.match(/^\/api\/entry\/([^/]+)\/([^/]+)$/))) {
      await deleteEntry(m[1], decodeURIComponent(m[2]));
      return sendJSON(res, 200, { ok: true });
    }
    if (req.method === 'GET' && (m = p.match(/^\/api\/images\/([^/]+)\/([^/]+)$/))) {
      return sendJSON(res, 200, await listImages(m[1], decodeURIComponent(m[2])));
    }
    if (req.method === 'POST' && (m = p.match(/^\/api\/images\/([^/]+)\/([^/]+)$/))) {
      const body = await readJSONBody(req);
      if (!body.filename || !body.dataBase64) {
        return sendJSON(res, 400, { error: 'filename and dataBase64 are required' });
      }
      const saved = await saveImage(m[1], decodeURIComponent(m[2]), body.filename, body.dataBase64);
      return sendJSON(res, 200, { ok: true, ...saved });
    }

    send(res, 404, 'Not found', 'text/plain');
  } catch (err) {
    console.error(err);
    sendJSON(res, err.status || 500, { error: err.message || 'Internal error' });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  const url = `http://localhost:${PORT}`;
  console.log(`\n  Editor running at \x1b[1m${url}\x1b[0m`);
  console.log('  Writes go straight to src/content and public/images on disk.');
  console.log('  Review with `npm run dev`, then `npm run content:publish` when ready.\n');
  if (process.platform === 'darwin' && !process.env.EDITOR_NO_OPEN) {
    exec(`open ${url}`, () => {});
  }
});
