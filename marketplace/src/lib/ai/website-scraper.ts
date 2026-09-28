import { lookup } from 'dns/promises';
import net from 'net';

const MAX_HTML_BYTES = 2 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 10_000;

export interface ScrapedContent {
  homepage: string;
  productPages: Array<{ url: string; content: string; title: string }>;
  servicePages: Array<{ url: string; content: string; title: string }>;
  pricingPage?: string;
  integrationsPage?: string;
  compliancePage?: string;
}

function isPrivateIPv4(address: string) {
  const parts = address.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return true;
  }

  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
}

function isPrivateIPv6(address: string) {
  const normalized = address.toLowerCase();
  return (
    normalized === '::1' ||
    normalized === '::' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe80') ||
    normalized.startsWith('::ffff:10.') ||
    normalized.startsWith('::ffff:127.') ||
    normalized.startsWith('::ffff:192.168.') ||
    /^::ffff:172\.(1[6-9]|2\d|3[0-1])\./.test(normalized)
  );
}

function isBlockedAddress(address: string) {
  const version = net.isIP(address);
  if (version === 4) return isPrivateIPv4(address);
  if (version === 6) return isPrivateIPv6(address);
  return true;
}

function normalizeWebsiteUrl(input: string) {
  const candidate = input.startsWith('http://') || input.startsWith('https://')
    ? input
    : `https://${input}`;
  const parsed = new URL(candidate);

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('Only HTTP and HTTPS URLs can be scraped');
  }

  if (parsed.username || parsed.password) {
    throw new Error('URLs with embedded credentials are not allowed');
  }

  if (parsed.port && parsed.port !== '80' && parsed.port !== '443') {
    throw new Error('Only standard HTTP and HTTPS ports are allowed');
  }

  return parsed;
}

async function assertPublicHostname(hostname: string) {
  const normalizedHost = hostname.toLowerCase();
  if (normalizedHost === 'localhost' || normalizedHost.endsWith('.localhost')) {
    throw new Error('Localhost URLs are not allowed');
  }

  if (net.isIP(normalizedHost)) {
    if (isBlockedAddress(normalizedHost)) {
      throw new Error('Private network URLs are not allowed');
    }
    return;
  }

  const addresses = await lookup(normalizedHost, { all: true, verbatim: false });
  if (addresses.length === 0 || addresses.some((entry) => isBlockedAddress(entry.address))) {
    throw new Error('Private network URLs are not allowed');
  }
}

async function readLimitedResponse(response: Response) {
  const contentLength = response.headers.get('content-length');
  if (contentLength && Number(contentLength) > MAX_HTML_BYTES) {
    throw new Error('Website response is too large');
  }

  const reader = response.body?.getReader();
  if (!reader) return response.text();

  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    total += value.byteLength;
    if (total > MAX_HTML_BYTES) {
      throw new Error('Website response is too large');
    }
    chunks.push(value);
  }

  return Buffer.concat(chunks).toString('utf8');
}

export async function scrapeWebsite(url: string): Promise<ScrapedContent> {
  try {
    const fullUrl = normalizeWebsiteUrl(url);
    await assertPublicHostname(fullUrl.hostname);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(fullUrl, {
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'User-Agent': 'CompassMarketplaceBot/1.0',
          Accept: 'text/html,application/xhtml+xml',
        },
      });
    } finally {
      clearTimeout(timeout);
    }

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) {
        throw new Error('Website redirected without a location');
      }

      const redirectedUrl = new URL(location, fullUrl);
      await assertPublicHostname(redirectedUrl.hostname);
      throw new Error('Website redirects are not followed automatically');
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch website: ${response.status}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType && !contentType.toLowerCase().includes('text/html')) {
      throw new Error('Website did not return HTML content');
    }

    const homepage = await readLimitedResponse(response);

    return {
      homepage,
      productPages: [],
      servicePages: [],
    };
  } catch (error) {
    console.error('Website scraping error:', error);

    const message =
      error instanceof Error
        ? error.message
        : 'Unknown scraping error';

    throw new Error(`Failed to scrape website: ${message}`);
  }
}

export function extractTextFromHTML(html: string): string {
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

  text = text.replace(/<[^>]+>/g, ' ');

  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');

  text = text.replace(/\s+/g, ' ').trim();

  return text;
}
