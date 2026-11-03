import { describe, expect, it, vi } from 'vitest';
import { launchWithFallback } from '../scripts/browser/index.ts';

describe('launchWithFallback', () => {
  it("uses Playwright's own browser when it launches", async () => {
    const launch = vi.fn().mockResolvedValue('browser');
    expect(await launchWithFallback(launch, '/fallback', () => true)).toBe('browser');
    expect(launch).toHaveBeenCalledTimes(1);
    expect(launch).toHaveBeenCalledWith({});
  });

  it('retries with the fallback path when the first launch fails and the path exists', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const launch = vi.fn().mockRejectedValueOnce(new Error('missing')).mockResolvedValue('fallback browser');
    expect(await launchWithFallback(launch, '/fallback', () => true)).toBe('fallback browser');
    expect(launch).toHaveBeenLastCalledWith({ executablePath: '/fallback' });
  });

  it('rethrows the first error when there is no fallback', async () => {
    const launch = vi.fn().mockRejectedValue(new Error('missing'));
    await expect(launchWithFallback(launch, '/fallback', () => false)).rejects.toThrow('missing');
    expect(launch).toHaveBeenCalledTimes(1);
  });
});
