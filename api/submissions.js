import { list, put } from '@vercel/blob';

const DATA_PATH = 'sapporo-night-selection/submissions.json';

function json(res, status, data) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(data));
}

function authAdmin(req) {
  return !!process.env.ADMIN_KEY && req.headers['x-admin-key'] === process.env.ADMIN_KEY;
}

async function readAll() {
  const { blobs } = await list({ prefix: DATA_PATH, limit: 1 });
  if (!blobs.length) return [];
  const r = await fetch(blobs[0].url, { cache: 'no-store' });
  if (!r.ok) return [];
  const data = await r.json().catch(() => []);
  return Array.isArray(data) ? data : [];
}

async function writeAll(items) {
  await put(DATA_PATH, JSON.stringify(items, null, 2), {
    access: 'public',
    addRandomSuffix: false,
    contentType: 'application/json; charset=utf-8',
    allowOverwrite: true,
  });
}

export default async function handler(req, res) {
  try {
    if (req.method === 'POST') {
      const d = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      if (!d.organization || !d.name || !['A', 'B', 'C'].includes(d.course)) {
        return json(res, 400, { error: '入力内容が不足しています' });
      }
      const items = await readAll();
      const item = {
        id: crypto.randomUUID(),
        organization: String(d.organization).slice(0, 120),
        name: String(d.name).slice(0, 80),
        course: d.course,
        receiptRequired: !!d.receiptRequired,
        receiptName: d.receiptRequired ? String(d.receiptName || '').slice(0, 120) : '',
        createdAt: new Date().toISOString(),
      };
      items.push(item);
      await writeAll(items);
      return json(res, 201, { ok: true, id: item.id });
    }

    if (req.method === 'GET') {
      if (!authAdmin(req)) return json(res, 401, { error: 'unauthorized' });
      const items = await readAll();
      return json(res, 200, items.slice().reverse());
    }

    if (req.method === 'DELETE') {
      if (!authAdmin(req)) return json(res, 401, { error: 'unauthorized' });
      const id = new URL(req.url, 'http://localhost').searchParams.get('id');
      if (!id) return json(res, 400, { error: 'id required' });
      const items = await readAll();
      const next = items.filter((x) => x.id !== id);
      if (next.length === items.length) return json(res, 404, { error: 'not found' });
      await writeAll(next);
      return json(res, 200, { ok: true });
    }

    return json(res, 405, { error: 'method not allowed' });
  } catch (e) {
    console.error(e);
    return json(res, 500, { error: 'server error' });
  }
}
