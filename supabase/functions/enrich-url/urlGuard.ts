// SSRF guard: reject private/internal addresses before making any outbound
// fetch from the enrich-url edge function. The error message is intentionally
// opaque ('unsafe URL') so callers cannot probe which addresses are blocked.

const PRIVATE_RANGES: [number, number, number][] = [
  // [start, end, bits] expressed as 32-bit integers
  [ip('10.0.0.0'), ip('10.255.255.255'), 8],
  [ip('172.16.0.0'), ip('172.31.255.255'), 12],
  [ip('192.168.0.0'), ip('192.168.255.255'), 16],
  [ip('127.0.0.0'), ip('127.255.255.255'), 8],     // loopback
  [ip('169.254.0.0'), ip('169.254.255.255'), 16],   // link-local / cloud metadata
];

function ip(s: string): number {
  return s.split('.').reduce((acc, o) => (acc << 8) | parseInt(o, 10), 0) >>> 0;
}

function isPrivateIp(host: string): boolean {
  // Exact hostnames
  if (host === 'localhost') return true;
  // IPv6 loopback / unspecified
  if (host.startsWith('[')) {
    const inner = host.slice(1, -1);
    return inner === '::1' || inner === '::';
  }
  // IPv4
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    const n = ip(host);
    return PRIVATE_RANGES.some(([start, end]) => n >= start && n <= end);
  }
  return false;
}

export function assertSafeUrl(raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error('unsafe URL');
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('unsafe URL');
  if (isPrivateIp(u.hostname)) throw new Error('unsafe URL');
  return u;
}
