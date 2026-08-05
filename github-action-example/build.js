#!/usr/bin/env node
// Generates the static site into dist/. No dependencies — plain Node 18+.
//
// Content source: the "#### Jamstack" section of debarshibasak/awesome-paas.
// The build runs daily, so the published page tracks whatever upstream says today.

const fs = require('node:fs');
const path = require('node:path');

const SOURCE_URL = 'https://raw.githubusercontent.com/debarshibasak/awesome-paas/main/README.md';
const SOURCE_REPO = 'https://github.com/debarshibasak/awesome-paas';
const SECTION = 'Jamstack';

const OUT_DIR = path.join(__dirname, 'dist');
const SRC_DIR = path.join(__dirname, 'src');
const CACHE_FILE = path.join(SRC_DIR, 'awesome-paas.md');

async function fetchSource() {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(SOURCE_URL, { headers: { 'user-agent': 'harvis-daily-demo' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      fs.writeFileSync(CACHE_FILE, text); // keep a copy so a bad upstream day can't empty the page
      return { text, live: true };
    } catch (err) {
      lastError = err;
      console.warn(`fetch attempt ${attempt} failed: ${err.message}`);
    }
  }
  if (fs.existsSync(CACHE_FILE)) {
    console.warn(`falling back to cached ${path.basename(CACHE_FILE)}`);
    return { text: fs.readFileSync(CACHE_FILE, 'utf8'), live: false };
  }
  throw new Error(`could not fetch ${SOURCE_URL} and no cache available: ${lastError.message}`);
}

// Pull the lines under `#### <SECTION>` up to the next heading.
function extractSection(markdown, heading) {
  const lines = markdown.split('\n');
  const start = lines.findIndex((l) => l.trim().toLowerCase() === `#### ${heading}`.toLowerCase());
  if (start === -1) throw new Error(`section "#### ${heading}" not found in source`);
  const body = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].startsWith('#')) break;
    body.push(lines[i]);
  }
  return body;
}

// `- [Name](url) \`status\` — description`
const ENTRY = /^-\s*\[([^\]]+)\]\(([^)]+)\)\s*(?:`([^`]+)`)?\s*(?:[—–-]\s*(.*))?$/;

function parseEntries(lines) {
  const entries = [];
  for (const line of lines) {
    const m = line.trim().match(ENTRY);
    if (!m) continue;
    entries.push({
      name: m[1].trim(),
      url: m[2].trim(),
      status: (m[3] || 'unknown').trim().toLowerCase(),
      description: (m[4] || '').trim(),
    });
  }
  if (!entries.length) throw new Error('parsed zero entries — upstream format may have changed');
  return entries;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

// Escape first, then turn the escaped [text](https://…) back into anchors.
function renderInline(md) {
  return escapeHtml(md).replace(
    /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
    (_, text, url) => `<a href="${url}" rel="noopener">${text}</a>`,
  );
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function card(entry) {
  const live = entry.status === 'alive';
  return `<li class="provider${live ? '' : ' is-defunct'}">
      <div class="provider-head">
        <h3><a href="${escapeHtml(entry.url)}" rel="noopener">${escapeHtml(entry.name)}</a></h3>
        <span class="status status-${escapeHtml(entry.status)}">${escapeHtml(entry.status)}</span>
      </div>
      <p class="desc">${renderInline(entry.description)}</p>
      <p class="host">${escapeHtml(hostOf(entry.url))}</p>
    </li>`;
}

async function main() {
  const now = new Date();
  const { text, live } = await fetchSource();
  const entries = parseEntries(extractSection(text, SECTION));

  const rank = { alive: 0, unknown: 1, defunct: 2 };
  entries.sort((a, b) => (rank[a.status] ?? 1) - (rank[b.status] ?? 1)
    || a.name.localeCompare(b.name));

  const counts = entries.reduce((acc, e) => {
    acc[e.status] = (acc[e.status] || 0) + 1;
    return acc;
  }, {});

  const longDate = now.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
  });
  const stamp = `${now.toISOString().replace('T', ' ').slice(0, 16)} UTC`;

  const stats = [
    { value: entries.length, label: 'Providers', sub: 'in the list' },
    { value: counts.alive || 0, label: 'Alive', sub: 'still operating' },
    { value: counts.defunct || 0, label: 'Defunct', sub: 'sunset or acquired' },
    { value: `${Math.round(((counts.alive || 0) / entries.length) * 100)}%`, label: 'Survival', sub: 'of the section' },
  ];

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Jamstack Providers — updated ${escapeHtml(longDate)}</title>
<meta name="description" content="Every Jamstack hosting provider listed in awesome-paas, rebuilt and redeployed daily.">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><text y='13' font-size='14'>⚡</text></svg>">
<link rel="stylesheet" href="styles.css">
</head>
<body>
<main>
  <header>
    <p class="eyebrow">Rebuilt daily · deployed to harvis.dev</p>
    <h1>Jamstack providers</h1>
    <p class="lede">Every entry from the <strong>${escapeHtml(SECTION)}</strong> section of
      <a href="${SOURCE_REPO}" rel="noopener">awesome-paas</a>, parsed straight from the README
      on each build. A scheduled GitHub Actions run regenerates this page every morning, so it
      reflects whatever upstream says today${live ? '' : ' (this build used a cached copy — upstream was unreachable)'}.</p>
  </header>

  <section class="grid" aria-label="Summary">
    ${stats.map((s) => `<div class="card">
      <span class="value">${escapeHtml(s.value)}</span>
      <span class="label">${escapeHtml(s.label)}</span>
      <span class="sub">${escapeHtml(s.sub)}</span>
    </div>`).join('\n    ')}
  </section>

  <ul class="providers">
    ${entries.map(card).join('\n    ')}
  </ul>

  <footer>
    <p>Source: <a href="${SOURCE_REPO}" rel="noopener">debarshibasak/awesome-paas</a> ·
      Built ${escapeHtml(stamp)} ·
      Deployed with <a href="https://github.com/harvis-io/static-deploy-action" rel="noopener">static-deploy-action</a></p>
  </footer>
</main>
</body>
</html>
`;

  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'index.html'), html);
  fs.copyFileSync(path.join(SRC_DIR, 'styles.css'), path.join(OUT_DIR, 'styles.css'));

  console.log(`Built dist/ — ${entries.length} providers (${counts.alive || 0} alive, ${counts.defunct || 0} defunct)`);
}

main().catch((err) => {
  console.error(`build failed: ${err.message}`);
  process.exit(1);
});
