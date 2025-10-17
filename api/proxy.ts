import type { VercelRequest, VercelResponse } from '@vercel/node';

const ALLOWED_HOSTS = (process.env.PROXY_WHITELIST || 'zs.zulugis.ru')
  .split(',')
  .map((h) => h.trim());

function isAllowedHost(hostname: string) {
  return ALLOWED_HOSTS.includes(hostname);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const target =
      (req.query.url as string) || (req.headers['x-target-url'] as string);
    if (!target) {
      res
        .status(400)
        .send('Missing `url` query parameter or `x-target-url` header');
      return;
    }

    let targetUrl: URL;
    try {
      targetUrl = new URL(target);
    } catch (err) {
      res.status(400).send('Invalid target URL');
      return;
    }

    if (!isAllowedHost(targetUrl.hostname)) {
      res.status(403).send('Host not allowed');
      return;
    }

    // Build fetch options
    const headers: Record<string, string> = {};
    // copy user-supplied headers except host/connection
    for (const [k, v] of Object.entries(req.headers)) {
      if (!v) continue;
      const lk = k.toLowerCase();
      if (
        ['host', 'connection', 'content-length', 'transfer-encoding'].includes(
          lk
        )
      )
        continue;
      // @ts-ignore
      headers[k] = Array.isArray(v) ? v.join(',') : String(v);
    }

    // If you want server-side Basic auth for target: set PROXY_BASIC_AUTH="user:pass" in Vercel env
    if (process.env.PROXY_BASIC_AUTH) {
      const b64 = Buffer.from(process.env.PROXY_BASIC_AUTH).toString('base64');
      headers['Authorization'] = `Basic ${b64}`;
    }

    // If the client forwarded an Authorization header and you trust it, keep it:
    if (req.headers.authorization) {
      headers['Authorization'] = req.headers.authorization as string;
    }

    const fetchOptions: RequestInit = {
      method: req.method,
      headers,
      // for GET/HEAD body must be undefined
      body: ['GET', 'HEAD'].includes(req.method || '') ? undefined : req.body,
      redirect: 'follow',
    };

    const upstream = await fetch(target, fetchOptions);

    // copy response status and headers (filter hop-by-hop)
    res.status(upstream.status);
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

    // ensure CORS headers for safety (client and debug)
    // If you want to limit origin, set PROXY_ALLOW_ORIGIN env (or use Vercel's domains)
    const allowOrigin = process.env.PROXY_ALLOW_ORIGIN || '*';
    res.setHeader('Access-Control-Allow-Origin', allowOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');

    // stream response body
    const buffer = Buffer.from(await upstream.arrayBuffer());
    res.send(buffer);
  } catch (err: any) {
    console.error('proxy error', err);
    res.status(500).send(err?.message || 'proxy error');
  }
}
