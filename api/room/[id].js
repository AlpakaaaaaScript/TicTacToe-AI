// Serverless signaling endpoint for WebRTC (Vercel API route)
// Uses Upstash Redis REST API to store ephemeral offer/answer/candidates.
// Required environment variables:
// - UPSTASH_REDIS_REST_URL
// - UPSTASH_REDIS_REST_TOKEN

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

// Storage abstraction: prefer Vercel KV (if available at runtime), otherwise fall back to Upstash REST.
async function upstashGetRaw(key) {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return null;
  const r = await fetch(`${UPSTASH_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }
  });
  return await r.json();
}

async function upstashSetRaw(key, value, ttl = 600) {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return null;
  const body = JSON.stringify({ value, ex: ttl });
  const r = await fetch(`${UPSTASH_URL}/set/${encodeURIComponent(key)}`, {
    method: 'POST', headers: { Authorization: `Bearer ${UPSTASH_TOKEN}`, 'Content-Type': 'application/json' }, body
  });
  return await r.json();
}

export default async function handler(req, res) {
  // Create a storage wrapper that uses @vercel/kv when available in the runtime
  let storage = {
    get: async (k) => {
      // Upstash raw returns { result: '...' } or { result: null }
      const raw = await upstashGetRaw(k);
      if (!raw || !('result' in raw) || raw.result === null) return null;
      return raw.result;
    },
    set: async (k, v, ttl = 600) => {
      return await upstashSetRaw(k, v, ttl);
    },
    del: async (k) => {
      if (!UPSTASH_URL || !UPSTASH_TOKEN) return null;
      return await fetch(`${UPSTASH_URL}/del/${encodeURIComponent(k)}`, { method: 'POST', headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` } });
    }
  };

  // Try to dynamically import Vercel KV and override storage methods
  try {
    const kvModule = await import('@vercel/kv');
    const kv = kvModule && kvModule.default ? kvModule.default : kvModule;
    if (kv) {
      storage.get = async (k) => {
        const val = await kv.get(k);
        return val === null || typeof val === 'undefined' ? null : val;
      };
      storage.set = async (k, v, ttl = 600) => {
        // kv.set may not support TTL directly in all versions; set then expire if available
        await kv.set(k, v);
        try { if (ttl && ttl > 0 && kv.expire) await kv.expire(k, ttl); } catch (e) { /* ignore */ }
        return { ok: true };
      };
      storage.del = async (k) => { try { await kv.del(k); return { ok: true }; } catch (e) { return null; } };
    }
  } catch (e) {
    // No @vercel/kv available at runtime; fall back to Upstash
  }

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing room id' });

  try {
    if (req.method === 'POST') {
      const { type, value } = req.body || {};
      if (!type || typeof value === 'undefined') return res.status(400).json({ error: 'Missing type or value' });

      const key = `room:${id}:${type}`;
      if (type === 'candidate') {
        // store as a JSON array
        const existingRaw = await storage.get(key);
        let arr = [];
        if (existingRaw) {
          try { arr = typeof existingRaw === 'string' ? JSON.parse(existingRaw) : existingRaw; } catch (e) { arr = []; }
        }
        arr.push(value);
        await storage.set(key, JSON.stringify(arr), 600);
        return res.json({ ok: true });
      } else {
        // offer or answer: store single object
        await storage.set(key, JSON.stringify(value), 600);
        return res.json({ ok: true });
      }
    }

    if (req.method === 'GET') {
      const type = req.query.type;
      if (!type) return res.status(400).json({ error: 'Missing type query param' });
      const key = `room:${id}:${type}`;
      const existing = await storage.get(key);
      if (!existing) return res.json({ result: null });
      try {
        const parsed = typeof existing === 'string' ? JSON.parse(existing) : existing;
        return res.json({ result: parsed });
      } catch (e) {
        return res.json({ result: existing });
      }
    }

    if (req.method === 'DELETE') {
      const type = req.query.type;
      if (!type) return res.status(400).json({ error: 'Missing type to delete' });
      const key = `room:${id}:${type}`;
      await storage.del(key);
      return res.json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error', details: String(err) });
  }
}
