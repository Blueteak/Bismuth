import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { createServer } from 'vite';

const host = '127.0.0.1';
const port = 4173;
const includeBenchmark = process.argv.includes('--benchmark');
const morphologyMode = process.argv.includes('--morphology');
const perturbedMode = process.argv.includes('--perturbed');
const baselineMode = process.argv.includes('--baseline') && !perturbedMode;
const highResolutionMode = process.argv.includes('--high-resolution');
const gridArgument = process.argv.find((argument) =>
  argument.startsWith('--grid='),
);
const stepsArgument = process.argv.find((argument) =>
  argument.startsWith('--steps='),
);
const timeStepArgument = process.argv.find((argument) =>
  argument.startsWith('--dt='),
);
const spacingArgument = process.argv.find((argument) =>
  argument.startsWith('--spacing='),
);
const diffusivityArgument = process.argv.find((argument) =>
  argument.startsWith('--dl='),
);
const chemicalPotentialArgument = process.argv.find((argument) =>
  argument.startsWith('--mu='),
);
const surfaceScaleArgument = process.argv.find((argument) =>
  argument.startsWith('--surface-scale='),
);
const timeoutMilliseconds = morphologyMode ? 600_000 : 120_000;
const runId = randomUUID();

if (includeBenchmark && morphologyMode) {
  throw new Error('Benchmark and morphology modes must be run separately.');
}
if (process.argv.includes('--baseline') && perturbedMode) {
  // The package script supplies --baseline; an explicit trailing --perturbed
  // is the supported override used for the physics-perturbed validation.
  console.info('[Bismuth] --perturbed overrides the scripted --baseline mode.');
}

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
if (baselineMode) query.set('mode', 'baseline');
if (perturbedMode) query.set('mode', 'perturbed');
if (highResolutionMode) query.set('high-resolution', '1');
if (gridArgument) query.set('grid', gridArgument.slice('--grid='.length));
if (stepsArgument) query.set('steps', stepsArgument.slice('--steps='.length));
if (timeStepArgument) query.set('dt', timeStepArgument.slice('--dt='.length));
if (spacingArgument)
  query.set('spacing', spacingArgument.slice('--spacing='.length));
if (diffusivityArgument)
  query.set('dl', diffusivityArgument.slice('--dl='.length));
if (chemicalPotentialArgument)
  query.set('mu', chemicalPotentialArgument.slice('--mu='.length));
if (surfaceScaleArgument)
  query.set(
    'surface-scale',
    surfaceScaleArgument.slice('--surface-scale='.length),
  );
const fixturePath = morphologyMode
  ? '/__dev/single-crystal'
  : '/__dev/webgpu-proof';
const fixtureUrl = `http://${host}:${port}${fixturePath}?${query}`;

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
  const resultPath = morphologyMode
    ? 'test-results/gpu/latest-morphology.json'
    : 'test-results/gpu/latest.json';
  await writeFile(resultPath, `${JSON.stringify(outcome, null, 2)}\n`, 'utf8');
  console.info(JSON.stringify(outcome, null, 2));

  if (!outcome?.ok) {
    throw new Error(outcome?.error?.message ?? 'The GPU fixture failed.');
  }
  if (morphologyMode) {
    if (!outcome.result.passed) {
      throw new Error('The single-crystal morphology fixture did not pass.');
    }
    if (outcome.result.uncapturedErrors.length > 0) {
      throw new Error('The morphology fixture reported WebGPU errors.');
    }
  } else {
    if (!outcome.result.compute.passed) {
      throw new Error('The 3D ping-pong compute comparison failed.');
    }
    if (!outcome.result.singleCrystal?.passed) {
      throw new Error('The Step 1 CPU/WebGPU solver comparison failed.');
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
  }
} finally {
  await server.close();
}
