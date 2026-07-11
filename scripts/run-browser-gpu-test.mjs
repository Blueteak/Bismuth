import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { createServer } from 'vite';

const host = '127.0.0.1';
const port = 4173;
const includeBenchmark = process.argv.includes('--benchmark');
const timeoutMilliseconds = 120_000;
const runId = randomUUID();

let resolveReport;
const reportPromise = new Promise((resolve) => {
  resolveReport = resolve;
});

const server = await createServer({
  server: { host, port, strictPort: true },
  plugins: [
    {
      name: 'bismuth-gpu-report-receiver',
      configureServer(viteServer) {
        viteServer.middlewares.use('/__gpu-report', (request, response) => {
          if (request.method !== 'POST') {
            response.statusCode = 405;
            response.end('Method Not Allowed');
            return;
          }

          let body = '';
          request.setEncoding('utf8');
          request.on('data', (chunk) => {
            body += chunk;
          });
          request.on('end', () => {
            try {
              const report = JSON.parse(body);
              if (report.runId !== runId) {
                response.statusCode = 409;
                response.end('Report does not match the active run.');
                return;
              }
              resolveReport(report.outcome);
              response.statusCode = 204;
              response.end();
            } catch (error) {
              response.statusCode = 400;
              response.end(
                error instanceof Error ? error.message : String(error),
              );
            }
          });
        });
      },
    },
  ],
});

await server.listen();

const query = new URLSearchParams({ report: '1', run: runId });
if (includeBenchmark) query.set('benchmark', '1');
const fixtureUrl = `http://${host}:${port}/__dev/webgpu-proof?${query}`;

await mkdir('test-results/gpu', { recursive: true });
await writeFile('test-results/gpu/fixture-url.txt', `${fixtureUrl}\n`, 'utf8');

console.info(
  `[Bismuth] Open this fixture in the Codex in-app browser:\n${fixtureUrl}`,
);

const timeoutPromise = new Promise((_, reject) => {
  setTimeout(
    () => reject(new Error('Timed out waiting for the in-app browser report.')),
    timeoutMilliseconds,
  ).unref();
});

try {
  const outcome = await Promise.race([reportPromise, timeoutPromise]);
  await writeFile(
    'test-results/gpu/latest.json',
    `${JSON.stringify(outcome, null, 2)}\n`,
    'utf8',
  );
  console.info(JSON.stringify(outcome, null, 2));

  if (!outcome?.ok) {
    throw new Error(outcome?.error?.message ?? 'The GPU fixture failed.');
  }
  if (!outcome.result.compute.passed) {
    throw new Error('The 3D ping-pong compute comparison failed.');
  }
  if (!outcome.result.indirectDraw.passed) {
    throw new Error('The compute-generated indirect draw proof failed.');
  }
  if (outcome.result.uncapturedErrors.length > 0) {
    throw new Error('The WebGPU device reported uncaptured errors.');
  }
  if (includeBenchmark && !outcome.result.benchmark) {
    throw new Error('The browser report did not include benchmark timings.');
  }
  if (!includeBenchmark && outcome.result.benchmark) {
    throw new Error('The GPU test received a benchmark-mode report.');
  }
} finally {
  await server.close();
}
