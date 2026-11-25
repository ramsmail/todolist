import { describe, it, expect } from 'vitest';
import { assertSafeUrl } from './urlGuard';

describe('assertSafeUrl — allowed', () => {
  it('passes https URLs with public IPs', () => {
    expect(() => assertSafeUrl('https://example.com')).not.toThrow();
    expect(() => assertSafeUrl('https://8.8.8.8/api')).not.toThrow();
  });
  it('passes http URLs (enricher may need them)', () => {
    expect(() => assertSafeUrl('http://example.com')).not.toThrow();
  });
});

describe('assertSafeUrl — blocked', () => {
  it('rejects non-http schemes', () => {
    expect(() => assertSafeUrl('ftp://example.com')).toThrow('unsafe URL');
    expect(() => assertSafeUrl('javascript:alert(1)')).toThrow('unsafe URL');
    expect(() => assertSafeUrl('file:///etc/passwd')).toThrow('unsafe URL');
  });
  it('rejects loopback', () => {
    expect(() => assertSafeUrl('http://127.0.0.1')).toThrow('unsafe URL');
    expect(() => assertSafeUrl('http://localhost')).toThrow('unsafe URL');
    expect(() => assertSafeUrl('http://127.1.2.3')).toThrow('unsafe URL');
  });
  it('rejects RFC-1918 private ranges', () => {
    expect(() => assertSafeUrl('http://10.0.0.1')).toThrow('unsafe URL');
    expect(() => assertSafeUrl('http://172.16.0.1')).toThrow('unsafe URL');
    expect(() => assertSafeUrl('http://172.31.255.255')).toThrow('unsafe URL');
    expect(() => assertSafeUrl('http://192.168.1.1')).toThrow('unsafe URL');
  });
  it('rejects link-local (AWS metadata)', () => {
    expect(() => assertSafeUrl('http://169.254.169.254')).toThrow('unsafe URL');
  });
  it('rejects IPv6 loopback and unspecified', () => {
    expect(() => assertSafeUrl('http://[::1]')).toThrow('unsafe URL');
    expect(() => assertSafeUrl('http://[::]')).toThrow('unsafe URL');
  });
});
