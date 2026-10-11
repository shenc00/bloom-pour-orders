// Publish an approved queue folder to Instagram. No dependencies.
//   node social/publish.mjs whoami
//   node social/publish.mjs post social/queue/<slug>      (needs meta.json status: "approved")
//   node social/publish.mjs insights <media-id>
//   node social/publish.mjs refresh                       (extends the token ~60 days; run after day 1)
//   node social/publish.mjs selftest
// Queue folder: meta.json {"status":"approved","images":["01.jpg",...]}, caption.md, and the images
// already deployed at SITE_URL/social/<slug>/<image> (Instagram fetches them from that public URL).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { basename, join } from 'node:path';
import assert from 'node:assert/strict';

const API = 'https://graph.instagram.com/v21.0';
const ENV_FILE = ['.env', '.env.txt'].find(existsSync);

function loadEnv() {
  const env = {};
  for (const line of readFileSync(ENV_FILE, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

async function call(method, path, params) {
  const url = new URL(`${API}/${path}`);
  const body = new URLSearchParams(params);
  if (method === 'GET') body.forEach((v, k) => url.searchParams.set(k, v));
  const res = await fetch(url, method === 'GET' ? {} : { method, body });
  const json = await res.json();
  if (json.error) throw new Error(`${path}: ${json.error.message}`);
  return json;
}

// Pure gate so the approval rule is testable.
function checkQueue(meta, caption) {
  if (meta.status !== 'approved') throw new Error(`status is "${meta.status}", not "approved"`);
  if (meta.video) { if (meta.images) throw new Error('video and images are mutually exclusive'); }
  else if (!meta.images?.length || meta.images.length > 10) throw new Error('need 1-10 images');
  if (!caption.trim()) throw new Error('caption.md is empty');
  if (caption.length > 2200) throw new Error('caption over 2200 characters');
}

async function waitFinished(id, token, tries = 30) {
  for (let i = 0; i < tries; i++) {
    const { status_code } = await call('GET', id, { fields: 'status_code', access_token: token });
    if (status_code === 'FINISHED') return;
    if (status_code === 'ERROR' || status_code === 'EXPIRED') throw new Error(`container ${id}: ${status_code}`);
    await new Promise(r => setTimeout(r, 2000));
  }
  throw new Error(`container ${id}: timed out`);
}

async function post(dir) {
  const env = loadEnv();
  const meta = JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf8'));
  const caption = readFileSync(join(dir, 'caption.md'), 'utf8');
  checkQueue(meta, caption);
  const { IG_ACCESS_TOKEN: token, IG_USER_ID: user, SITE_URL: site } = env;
  const files = meta.video ? [meta.video] : meta.images;
  const urls = files.map(f => `${site.replace(/\/$/, '')}/social/${basename(dir)}/${f}`);
  for (const u of urls) {
    const r = await fetch(u, { method: 'HEAD' });
    if (!r.ok) throw new Error(`media not live yet (${r.status}): ${u}`);
  }
  let creation;
  if (meta.video) {
    // ponytail: Instagram Login tokens reject resumable upload, so video must be hosted at a public URL.
    creation = (await call('POST', `${user}/media`, { media_type: 'REELS', video_url: urls[0], share_to_feed: 'true', caption, access_token: token })).id;
    await waitFinished(creation, token, 90);
  } else if (urls.length === 1) {
    creation = (await call('POST', `${user}/media`, { image_url: urls[0], caption, access_token: token })).id;
  } else {
    const kids = [];
    for (const u of urls) {
      const { id } = await call('POST', `${user}/media`, { image_url: u, is_carousel_item: 'true', access_token: token });
      await waitFinished(id, token);
      kids.push(id);
    }
    creation = (await call('POST', `${user}/media`, { media_type: 'CAROUSEL', children: kids.join(','), caption, access_token: token })).id;
  }
  await waitFinished(creation, token);
  const { id } = await call('POST', `${user}/media_publish`, { creation_id: creation, access_token: token });
  const { permalink } = await call('GET', id, { fields: 'permalink', access_token: token });
  Object.assign(meta, { status: 'published', post_id: id, permalink });
  writeFileSync(join(dir, 'meta.json'), JSON.stringify(meta, null, 2));
  console.log('published', permalink);
}

async function refresh() {
  const { IG_ACCESS_TOKEN: old } = loadEnv();
  const { access_token, expires_in } = await call('GET', '../refresh_access_token', { grant_type: 'ig_refresh_token', access_token: old });
  writeFileSync(ENV_FILE, readFileSync(ENV_FILE, 'utf8').replace(/^(\s*IG_ACCESS_TOKEN\s*=).*$/m, `$1${access_token}`));
  console.log(`token refreshed, valid ${Math.floor(expires_in / 86400)} days`);
}

function selftest() {
  const ok = { status: 'approved', images: ['a.jpg'] };
  checkQueue(ok, 'hi');
  checkQueue({ status: 'approved', video: 'v.mp4' }, 'hi');
  assert.throws(() => checkQueue({ ...ok, video: 'v.mp4' }, 'hi'), /mutually exclusive/);
  assert.throws(() => checkQueue({ ...ok, status: 'draft' }, 'hi'), /not "approved"/);
  assert.throws(() => checkQueue({ ...ok, images: [] }, 'hi'), /1-10/);
  assert.throws(() => checkQueue(ok, '  '), /empty/);
  assert.throws(() => checkQueue(ok, 'x'.repeat(2201)), /2200/);
  console.log('selftest ok');
}

const [cmd, arg] = process.argv.slice(2);
{
  const run = {
    whoami: async () => { const e = loadEnv(); console.log(await call('GET', 'me', { fields: 'user_id,username,account_type', access_token: e.IG_ACCESS_TOKEN })); },
    post: () => post(arg),
    insights: async () => { const e = loadEnv(); console.log(await call('GET', `${arg}/insights`, { metric: 'reach,saved,shares,views', access_token: e.IG_ACCESS_TOKEN })); },
    refresh,
    selftest,
  }[cmd];
  if (!run) { console.error('usage: whoami | post <dir> | insights <id> | refresh | selftest'); process.exit(1); }
  Promise.resolve(run()).catch(e => { console.error('error:', e.message); process.exit(1); });
}
