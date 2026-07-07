import { describe, it, expect } from 'vitest';
import { NavigateExecutor } from '../navigate.js';
import { buildMockCtx, buildMockPage } from '../../test-helpers.js';

const executor = new NavigateExecutor();

describe('NavigateExecutor', () => {
  it('prepends baseUrl for relative URLs', async () => {
    const page = buildMockPage();
    const ctx  = buildMockCtx({ page, config: { baseUrl: 'https://app.test' } });

    await executor.execute({ navigate: { url: '/dashboard' } }, ctx);

    expect(page.goto).toHaveBeenCalledWith('https://app.test/dashboard', { waitUntil: 'load' });
  });

  it('uses absolute URLs as-is (does not prepend baseUrl)', async () => {
    const page = buildMockPage();
    const ctx  = buildMockCtx({ page, config: { baseUrl: 'https://app.test' } });

    await executor.execute({ navigate: { url: 'https://other.test/path' } }, ctx);

    expect(page.goto).toHaveBeenCalledWith('https://other.test/path', { waitUntil: 'load' });
  });

  it('defaults waitUntil to "load"', async () => {
    const page = buildMockPage();
    const ctx  = buildMockCtx({ page });

    await executor.execute({ navigate: { url: 'https://app.test' } }, ctx);

    expect(page.goto).toHaveBeenCalledWith(
      expect.any(String),
      { waitUntil: 'load' },
    );
  });

  it('passes custom waitUntil through to page.goto', async () => {
    const page = buildMockPage();
    const ctx  = buildMockCtx({ page });

    await executor.execute({ navigate: { url: 'https://app.test', waitUntil: 'networkidle' } }, ctx);

    expect(page.goto).toHaveBeenCalledWith(
      expect.any(String),
      { waitUntil: 'networkidle' },
    );
  });

  it('returns the same RuntimeContext', async () => {
    const ctx    = buildMockCtx();
    const result = await executor.execute({ navigate: { url: 'https://app.test' } }, ctx);
    expect(result).toBe(ctx);
  });

  it('uses an empty string for baseUrl when none is configured', async () => {
    const page = buildMockPage();
    const ctx  = buildMockCtx({ page, config: {} });

    await executor.execute({ navigate: { url: '/login' } }, ctx);

    expect(page.goto).toHaveBeenCalledWith('/login', { waitUntil: 'load' });
  });
});
