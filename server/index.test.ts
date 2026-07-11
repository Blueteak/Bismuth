import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import type { Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from './index.js';

let server: Server | undefined;
let clientDistPath: string;

beforeEach(async () => {
  clientDistPath = await mkdtemp(join(tmpdir(), 'bismuth-server-test-'));
  await mkdir(join(clientDistPath, 'assets'));
  await writeFile(
    join(clientDistPath, 'index.html'),
    '<!doctype html><title>Bismuth Visualizer</title>',
  );
  await writeFile(join(clientDistPath, 'assets', 'hdri-test123.jpg'), 'jpg');
});

afterEach(async () => {
  await new Promise<void>((resolve, reject) => {
    if (!server) {
      resolve();
      return;
    }

    server.close((error) => {
      server = undefined;
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
  await rm(clientDistPath, { recursive: true, force: true });
});

async function startTestServer(): Promise<string> {
  server = createApp(clientDistPath).listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server?.once('listening', resolve));

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Expected the test server to use a TCP port.');
  }

  return `http://127.0.0.1:${address.port}`;
}

describe('production server', () => {
  it('reports a successful health response', async () => {
    const origin = await startTestServer();
    const response = await fetch(`${origin}/healthz`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: 'ok' });
  });

  it('keeps the application shell revalidatable', async () => {
    const origin = await startTestServer();
    const response = await fetch(`${origin}/some/client/route`, {
      headers: { Accept: 'text/html' },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-cache');
    await expect(response.text()).resolves.toContain('Bismuth Visualizer');
  });

  it('serves hashed environment assets with immutable caching', async () => {
    const origin = await startTestServer();
    const response = await fetch(`${origin}/assets/hdri-test123.jpg`);

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('max-age=31536000');
    expect(response.headers.get('cache-control')).toContain('immutable');
  });
});
