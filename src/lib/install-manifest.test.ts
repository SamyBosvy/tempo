import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const manifest = JSON.parse(readFileSync('public/manifest.webmanifest', 'utf8'));
describe('Tempo installation manifest', () => {
  it('has stable identity without changing installed start URL', () => {
    expect(manifest.id).toBe('/today');
    expect(manifest.start_url).toBe('/today');
    expect(manifest.scope).toBe('/');
    expect(manifest.display).toBe('standalone');
  });
  it('has dedicated 512px maskable and standard icons with actual dimensions', () => {
    const mask = manifest.icons.find((icon: { purpose: string }) => icon.purpose === 'maskable');
    expect(mask.src).toBe('/icon-maskable-512.png');
    for (const icon of manifest.icons) {
      const png = readFileSync(`public${icon.src}`);
      const size = `${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`;
      expect(size).toBe(icon.sizes);
    }
    expect(manifest.icons.find((icon: { src: string }) => icon.src === '/icon-512.png').purpose).toBe('any');
  });
});