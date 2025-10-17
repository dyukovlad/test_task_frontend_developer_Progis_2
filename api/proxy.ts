import type { VercelRequest, VercelResponse } from '@vercel/node';

const ALLOWED_HOSTS = (process.env.PROXY_WHITELIST || 'zs.zulugis.ru')
  .split(',')
  .map((h) => h.trim());

function isAllowedHost(hostname: string) {
  return ALLOWED_HOSTS.includes(hostname);
}

function buildTargetUrl(originalUrl: string, query: Record<string, any>) {
  const base = new URL(originalUrl);
  Object.entries(query).forEach(([k, v]) => {
    if (k === 'url') return;
    if (Array.isArray(v)) {
      v.forEach((val) => base.searchParams.append(k, String(val)));
    } else {
      base.searchParams.append(k, String(v));
    }
  });
  return base.toString();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Support both ?url=encoded and x-target-url header
    const rawUrl =
      (req.query.url as string) || (req.headers['x-target-url'] as string);
    if (!rawUrl)
      return res
        .status(400)
        .send('Missing `url` query parameter or `x-target-url` header');

    // decode in case double-encoded by client
    const decoded = decodeURIComponent(rawUrl);

    let targetUrl: URL;
    try {
      targetUrl = new URL(decoded);
    } catch (err) {
      return res.status(400).send('Invalid target URL');
    }

    if (!isAllowedHost(targetUrl.hostname)) {
      return res.status(403).send(`Host not allowed: ${targetUrl.hostname}`);
    }

    // Rebuild target url by appending remaining query params from the proxy request
    const finalTarget = buildTargetUrl(decoded, req.query);

    // Build headers for upstream request
    const upstreamHeaders: Record<string, string> = {};
    for (const [k, v] of Object.entries(req.headers)) {
      if (!v) continue;
      const lk = k.toLowerCase();
      if (
        ['host', 'connection', 'content-length', 'transfer-encoding'].includes(
          lk
        )
      )
        continue;
      upstreamHeaders[k] = Array.isArray(v) ? v.join(',') : String(v);
    }

    // Server-side basic auth option (hidden in env)
    if (process.env.PROXY_BASIC_AUTH) {
      upstreamHeaders['Authorization'] = `Basic ${Buffer.from(
        process.env.PROXY_BASIC_AUTH
      ).toString('base64')}`;
    }
    // If client provided Authorization and you want to forward it:
    if (req.headers.authorization) {
      upstreamHeaders['Authorization'] = String(req.headers.authorization);
    }

    // Configure fetch options
    const fetchOptions: RequestInit = {
      method: req.method as string,
      headers: upstreamHeaders,
      redirect: 'follow',
    };

    // handle body for POST/PUT
    if (!['GET', 'HEAD'].includes((req.method || '').toUpperCase())) {
      // Vercel passes body as raw already; ensure Content-Type preserved
      fetchOptions.body = req.body;
    }

    const upstream = await fetch(finalTarget, fetchOptions);

    // copy status
    res.status(upstream.status);

    // copy headers (filter hop-by-hop)
    upstream.headers.forEach((value, name) => {
      const lower = name.toLowerCase();
      if (
        [
          'transfer-encoding',
          'connection',
          'keep-alive',
          'upgrade',
          'proxy-authenticate',
          'proxy-authorization',
        ].includes(lower)
      )
        return;
      res.setHeader(name, value);
    });

    // set safe CORS for client (adjust in prod)
    const allowOrigin = process.env.PROXY_ALLOW_ORIGIN || '*';
    res.setHeader('Access-Control-Allow-Origin', allowOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');

    // stream body back: handle binary and text
    const arrayBuffer = await upstream.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    res.send(buffer);
  } catch (err: any) {
    console.error('proxy error', err);
    if (err?.name === 'AbortError')
      return res.status(499).send('Client closed request');
    res.status(500).send(err?.message || 'proxy error');
  }
}
