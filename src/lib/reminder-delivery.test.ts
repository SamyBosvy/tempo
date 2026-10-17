import { describe, it, expect, vi } from 'vitest';
import { attemptReminder } from './reminder-delivery';
describe('Reminder delivery', () => {
  it('releases a failed delivery for retry and never remembers it', async () => {
    const release = vi.fn(), remember = vi.fn();
    await attemptReminder('failed', async () => true, async () => false, release, remember);
    expect(release).toHaveBeenCalledTimes(1); expect(remember).not.toHaveBeenCalled();
  });
  it('remembers only successful delivery', async () => {
    const release = vi.fn(), remember = vi.fn();
    await attemptReminder('success', async () => true, async () => true, release, remember);
    expect(remember).toHaveBeenCalledTimes(1); expect(release).not.toHaveBeenCalled();
  });
});