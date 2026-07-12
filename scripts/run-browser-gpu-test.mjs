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
const expectedArgument = process.argv.find((argument) =>
  argument.startsWith('--expected='),
);
const operatorArgument = process.argv.find((argument) =>
  argument.startsWith('--operator='),
);
const domainArgument = process.argv.find((argument) =>
  argument.startsWith('--domain='),
);
const targetRadiusArgument = process.argv.find((argument) =>
  argument.startsWith('--target-radius-multiple='),
);
const checkpointStepsArgument = process.argv.find((argument) =>
  argument.startsWith('--checkpoint-steps='),
);
const maximumWallTimeArgument = process.argv.find((argument) =>
  argument.startsWith('--max-wall-ms='),
);
const profileArgument = process.argv.find((argument) =>
  argument.startsWith('--profile='),
);
const seedArgument = process.argv.find((argument) =>
  argument.startsWith('--seed='),
);
const timeoutMilliseconds = morphologyMode ? 600_000 : 120_000;
const runId = randomUUID();
const fixturePath = morphologyMode
  ? '/__dev/single-crystal'
  : '/__dev/webgpu-proof';

if (includeBenchmark && morphologyMode) {
  throw new Error('Benchmark and morphology modes must be run separately.');
}
if (expectedArgument && !morphologyMode) {
  throw new Error('--expected is valid only with --morphology.');
}
if (operatorArgument && !morphologyMode) {
  throw new Error('--operator is valid only with --morphology.');
}
if (
  (domainArgument || targetRadiusArgument || checkpointStepsArgument) &&
  !morphologyMode
) {
  throw new Error(
    '--domain and maturity options are valid only with --morphology.',
  );
}
if (maximumWallTimeArgument && !morphologyMode) {
  throw new Error('--max-wall-ms is valid only with --morphology.');
}
if (profileArgument && !morphologyMode) {
  throw new Error('--profile is valid only with --morphology.');
}
if (seedArgument && !morphologyMode) {
  throw new Error('--seed is valid only with --morphology.');
}
if (seedArgument && !perturbedMode) {
  throw new Error('--seed requires --perturbed.');
}
const requestedSeed = seedArgument
  ? Number(seedArgument.slice('--seed='.length))
  : 0x5eeda11;
if (
  !Number.isInteger(requestedSeed) ||
  requestedSeed < 0 ||
  requestedSeed > 0xffff_ffff
) {
  throw new Error('--seed must be a uint32 integer.');
}
const requestedProfile = profileArgument?.slice('--profile='.length);
if (
  requestedProfile &&
  ![
    'hopper-quick',
    'hopper-reference',
    'hopper-acceptance',
    'dl4-screen-control',
    'dl4-screen-quick',
    'dl4-screen-reference',
  ].includes(requestedProfile)
) {
  throw new Error(`Invalid morphology profile: ${requestedProfile}.`);
}
const requestedMaximumWallTime = maximumWallTimeArgument
  ? Number(maximumWallTimeArgument.slice('--max-wall-ms='.length))
  : undefined;
if (
  requestedMaximumWallTime !== undefined &&
  (!Number.isInteger(requestedMaximumWallTime) ||
    requestedMaximumWallTime < 1000 ||
    requestedMaximumWallTime > 600_000)
) {
  throw new Error('--max-wall-ms must be an integer from 1000 through 600000.');
}
const requestedOperator =
  operatorArgument?.slice('--operator='.length) ?? 'conservative-flux';
if (!['conservative-flux', 'author-centered'].includes(requestedOperator)) {
  throw new Error(`Invalid phase operator: ${requestedOperator}.`);
}
const requestedDomain = domainArgument?.slice('--domain='.length) ?? 'full';
if (!['full', 'octant'].includes(requestedDomain)) {
  throw new Error(`Invalid domain mode: ${requestedDomain}.`);
}
if (requestedDomain === 'octant' && !baselineMode) {
  throw new Error('The octant domain requires --baseline symmetry.');
}
if (checkpointStepsArgument && !targetRadiusArgument) {
  throw new Error('--checkpoint-steps requires --target-radius-multiple.');
}
if (morphologyMode && !expectedArgument) {
  throw new Error(
    'Morphology runs require --expected=cube|hopper|fractal|dendritic.',
  );
}
const expectedMorphology = expectedArgument?.slice('--expected='.length);
const expectedDiffusivity = {
  cube: 20,
  hopper: 1 / 12,
  fractal: 0.5,
  dendritic: 4,
};
if (
  expectedMorphology &&
  !Object.hasOwn(expectedDiffusivity, expectedMorphology)
) {
  throw new Error(`Invalid expected morphology: ${expectedMorphology}.`);
}
if (expectedMorphology && diffusivityArgument) {
  const requestedDiffusivity = Number(
    diffusivityArgument.slice('--dl='.length),
  );
  if (requestedDiffusivity !== expectedDiffusivity[expectedMorphology]) {
    throw new Error(
      `--expected=${expectedMorphology} requires --dl=${expectedDiffusivity[expectedMorphology]}.`,
    );
  }
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
let resolveFixtureStarted;
const fixtureStartedPromise = new Promise((resolve) => {
  resolveFixtureStarted = resolve;
});

const server = await createServer({
  server: { host, port, strictPort: true },
  plugins: [
    {
      name: 'bismuth-gpu-report-receiver',
      configureServer(viteServer) {
        viteServer.middlewares.use((request, _response, next) => {
          const requestedUrl = new URL(
            request.url ?? '/',
            `http://${host}:${port}`,
          );
          if (
            request.method === 'GET' &&
            requestedUrl.pathname === fixturePath &&
            requestedUrl.searchParams.get('run') === runId
          ) {
            resolveFixtureStarted();
          }
          next();
        });
        viteServer.middlewares.use('/__gpu-start', (request, response) => {
          if (request.method !== 'POST') {
            response.statusCode = 405;
            response.end('Method Not Allowed');
            return;
          }
          const reportedRunId = new URL(
            request.url ?? '/',
            `http://${host}:${port}`,
          ).searchParams.get('run');
          if (reportedRunId !== runId) {
            response.statusCode = 409;
            response.end('Start does not match the active run.');
            return;
          }
          resolveFixtureStarted();
          response.statusCode = 204;
          response.end();
        });
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
if (expectedMorphology) query.set('expected', expectedMorphology);
if (operatorArgument) query.set('operator', requestedOperator);
if (domainArgument) query.set('domain', requestedDomain);
if (targetRadiusArgument)
  query.set(
    'target-radius-multiple',
    targetRadiusArgument.slice('--target-radius-multiple='.length),
  );
if (checkpointStepsArgument)
  query.set(
    'checkpoint-steps',
    checkpointStepsArgument.slice('--checkpoint-steps='.length),
  );
if (maximumWallTimeArgument)
  query.set(
    'max-wall-ms',
    maximumWallTimeArgument.slice('--max-wall-ms='.length),
  );
if (requestedProfile) query.set('profile', requestedProfile);
if (seedArgument) query.set('seed', String(requestedSeed));
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
const fixtureBudgetTimeoutPromise =
  requestedMaximumWallTime === undefined
    ? new Promise(() => {})
    : fixtureStartedPromise.then(
        () =>
          new Promise((_, reject) => {
            setTimeout(
              () =>
                reject(
                  new Error(
                    `The browser fixture did not report within its ${requestedMaximumWallTime} ms wall-time budget.`,
                  ),
                ),
              requestedMaximumWallTime,
            ).unref();
          }),
      );

try {
  const outcome = await Promise.race([
    reportPromise,
    timeoutPromise,
    fixtureBudgetTimeoutPromise,
  ]);
  const profileResultPaths = {
    'hopper-quick': 'test-results/gpu/latest-morphology-quick.json',
    'hopper-reference': 'test-results/gpu/latest-morphology-reference.json',
    'hopper-acceptance': 'test-results/gpu/latest-morphology-acceptance.json',
    'dl4-screen-control': 'test-results/gpu/latest-dl4-screen-control.json',
    'dl4-screen-quick': 'test-results/gpu/latest-dl4-screen-quick.json',
    'dl4-screen-reference': 'test-results/gpu/latest-dl4-screen-reference.json',
  };
  const genericMorphologyResultPath = seedArgument
    ? `test-results/gpu/latest-morphology-seed-${requestedSeed}.json`
    : baselineMode && expectedMorphology !== 'hopper'
      ? `test-results/gpu/latest-transition-${expectedMorphology}-${requestedOperator}.json`
      : 'test-results/gpu/latest-morphology.json';
  const resultPath = morphologyMode
    ? (profileResultPaths[requestedProfile] ?? genericMorphologyResultPath)
    : 'test-results/gpu/latest.json';
  await writeFile(resultPath, `${JSON.stringify(outcome, null, 2)}\n`, 'utf8');
  console.info(JSON.stringify(outcome, null, 2));

  if (!outcome?.ok) {
    throw new Error(outcome?.error?.message ?? 'The GPU fixture failed.');
  }
  if (morphologyMode) {
    const result = outcome.result;
    const requestedNumber = (argument, prefix) =>
      argument ? Number(argument.slice(prefix.length)) : undefined;
    const assertReported = (name, requested, reported) => {
      if (requested !== undefined && requested !== reported) {
        throw new Error(
          `Morphology report ${name}=${reported} did not match requested ${requested}.`,
        );
      }
    };
    const requestedMode = perturbedMode
      ? 'perturbed'
      : process.argv.includes('--baseline')
        ? 'baseline'
        : undefined;
    if ((result.validationProfile ?? undefined) !== requestedProfile) {
      throw new Error(
        `Morphology report profile=${result.validationProfile ?? 'none'} did not match requested ${requestedProfile ?? 'none'}.`,
      );
    }
    if (requestedMode && result.mode !== requestedMode) {
      throw new Error(
        `Morphology report mode=${result.mode} did not match requested ${requestedMode}.`,
      );
    }
    if (result.expectedMorphology !== expectedMorphology) {
      throw new Error(
        `Morphology report expected=${result.expectedMorphology} did not match requested ${expectedMorphology}.`,
      );
    }
    if (result.configuration.phaseOperator !== requestedOperator) {
      throw new Error(
        `Morphology report operator=${result.configuration.phaseOperator} did not match requested ${requestedOperator}.`,
      );
    }
    if (result.configuration.domainMode !== requestedDomain) {
      throw new Error(
        `Morphology report domain=${result.configuration.domainMode} did not match requested ${requestedDomain}.`,
      );
    }
    assertReported(
      'grid',
      requestedNumber(gridArgument, '--grid='),
      result.configuration.grid[0],
    );
    if (
      result.configuration.grid.some(
        (size) => size !== result.configuration.grid[0],
      )
    ) {
      throw new Error('Morphology report grid was not cubic.');
    }
    if (JSON.stringify(result.configuration.workgroup) !== '[4,4,4]') {
      throw new Error('Morphology report workgroup was not 4x4x4.');
    }
    if (result.configuration.precision !== 'float32') {
      throw new Error('Morphology report precision was not float32.');
    }
    assertReported(
      'steps',
      requestedNumber(stepsArgument, '--steps='),
      result.configuration.steps,
    );
    assertReported(
      'timeStep',
      requestedNumber(timeStepArgument, '--dt='),
      result.configuration.timeStep,
    );
    assertReported(
      'spacing',
      requestedNumber(spacingArgument, '--spacing='),
      result.configuration.spacing,
    );
    assertReported(
      'liquidDiffusivity',
      requestedNumber(diffusivityArgument, '--dl=') ??
        expectedDiffusivity[expectedMorphology],
      result.configuration.liquidDiffusivity,
    );
    assertReported(
      'farFieldChemicalPotential',
      requestedNumber(chemicalPotentialArgument, '--mu='),
      result.configuration.farFieldChemicalPotential,
    );
    assertReported(
      'surfaceEnergyNormalization',
      requestedNumber(surfaceScaleArgument, '--surface-scale='),
      result.configuration.surfaceEnergyNormalization,
    );
    const expectedLengthScale = highResolutionMode
      ? { criticalRadius: 10, initialRadius: 20, interfaceWidth: 2 }
      : { criticalRadius: 5, initialRadius: 10, interfaceWidth: 1 };
    for (const [name, expected] of Object.entries(expectedLengthScale)) {
      if (result.configuration[name] !== expected) {
        throw new Error(
          `Morphology report ${name}=${result.configuration[name]} did not match profile value ${expected}.`,
        );
      }
    }
    const expectedPerturbations = {
      seed: requestedSeed,
      seedRadiusAmplitude: perturbedMode ? 0.3 : 0,
      seedRadiusCorrelationLength: 8,
      chemicalPotentialAmplitude: perturbedMode ? 0.006 : 0,
      chemicalPotentialCorrelationLength: 12,
      farFieldGradient: perturbedMode ? [0.00018, -0.0001, 0.00014] : [0, 0, 0],
    };
    if (
      JSON.stringify(result.configuration.perturbations) !==
      JSON.stringify(expectedPerturbations)
    ) {
      throw new Error(
        'Morphology report perturbations did not match the deterministic profile.',
      );
    }
    assertReported(
      'targetRadiusMultiple',
      requestedNumber(targetRadiusArgument, '--target-radius-multiple='),
      result.maturity.targetRadiusMultiple ?? undefined,
    );
    assertReported(
      'checkpointSteps',
      requestedNumber(checkpointStepsArgument, '--checkpoint-steps='),
      result.maturity.checkpointSteps,
    );
    assertReported(
      'wallTimeBudgetMilliseconds',
      requestedMaximumWallTime,
      result.runtime?.budgetMilliseconds ?? undefined,
    );
    if (
      requestedMaximumWallTime !== undefined &&
      (!result.runtime?.passed ||
        result.runtime.fixtureWallMilliseconds > requestedMaximumWallTime)
    ) {
      throw new Error(
        `Morphology fixture wall time ${result.runtime?.fixtureWallMilliseconds ?? 'unknown'} ms exceeded the ${requestedMaximumWallTime} ms budget.`,
      );
    }
    if (
      requestedProfile &&
      (!result.profileValidation ||
        result.profileValidation.profile !== requestedProfile ||
        !result.profileValidation.passed)
    ) {
      const failures = result.profileValidation?.failures?.join('; ');
      throw new Error(
        `Morphology profile ${requestedProfile} did not pass${failures ? `: ${failures}` : '.'}`,
      );
    }
    if (!outcome.result.passed) {
      const failures = outcome.result.expectation?.failures?.join('; ');
      throw new Error(
        `The ${expectedMorphology} morphology fixture did not pass${failures ? `: ${failures}` : '.'}`,
      );
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
