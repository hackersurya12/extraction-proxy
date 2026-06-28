export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const targetUrl = req.query.url;

  if (!targetUrl) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  try {
    new URL(targetUrl);
  } catch {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  try {
    const finalUrl = await resolveRedirects(targetUrl, 5);
    return res.status(200).json({ redirectUrl: finalUrl });
  } catch (error) {
    return res.status(502).json({ error: 'Failed to resolve' });
  }
}

async function resolveRedirects(url, maxHops) {
  let currentUrl = url;
  let hopCount = 0;

  while (hopCount < maxHops) {
    const response = await fetch(currentUrl, {
      method: 'GET',
      redirect: 'manual',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
        'Referer': new URL(currentUrl).origin + '/'
      }
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) break;
      currentUrl = new URL(location, currentUrl).href;
      hopCount++;
      continue;
    }

    if (response.status === 200) {
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/html')) {
        const body = await response.text();
        const metaRefresh = body.match(
          /<meta[^>]+http-equiv\s*=\s*["']?refresh["']?[^>]+content\s*=\s*["']?\d+;\s*url\s*=\s*([^"'>]+)/i
        );
        if (metaRefresh) {
          currentUrl = new URL(metaRefresh[1].trim(), currentUrl).href;
          hopCount++;
          continue;
        }
        const jsRedirect = body.match(/window\.location\s*=\s*["']([^"']+)["']/i);
        if (jsRedirect) {
          currentUrl = new URL(jsRedirect[1].trim(), currentUrl).href;
          hopCount++;
          continue;
        }
      }
    }
    break;
  }
  return currentUrl;
}
