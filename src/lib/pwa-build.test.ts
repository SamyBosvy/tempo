import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getManifest } from 'workbox-build';
import { expect, it } from 'vitest';
import { precacheURLPrefixes } from './pwa-build';

it('precaches served asset URLs rather than nonexistent client/ URLs', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'tempo-pwa-'));
  try {
    await mkdir(join(directory, 'client/assets'), { recursive: true });
    await writeFile(join(directory, 'client/assets/focus-hash.js'), 'export const focus = true;');
    await writeFile(join(directory, 'client/icon-192.png'), 'icon');
    const { manifestEntries } = await getManifest({
      globDirectory: directory,
      globPatterns: ['**/*.{js,png}'],
      modifyURLPrefix: precacheURLPrefixes,
    });
    expect(manifestEntries.map(entry => entry.url).sort()).toEqual(['assets/focus-hash.js', 'icon-192.png']);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});