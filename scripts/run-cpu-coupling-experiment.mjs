import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';

const outputPath = 'test-results/cpu/latest-coupling-experiment.json';
const commandStarted = performance.now();
const commandDeadline = commandStarted + 25_000;
const server = await createServer({
  appType: 'custom',
  logLevel: 'error',
  server: { hmr: false, middlewareMode: true },
});

try {
  const experiment = await server.ssrLoadModule(
    '/src/simulation/cpu-coupling-experiment.ts',
  );
  const result = experiment.runCpuCouplingExperiment({
    deadline: commandDeadline,
  });
  const setupAndMatrixWallMilliseconds = performance.now() - commandStarted;
  const commandBudgetPassed =
    setupAndMatrixWallMilliseconds <= result.runtime.budgetMilliseconds;
  const reportedResult = {
    ...result,
    runtime: {
      ...result.runtime,
      setupAndMatrixWallMilliseconds,
      passed: result.runtime.passed && commandBudgetPassed,
    },
    checks: {
      ...result.checks,
      passed: result.checks.passed && commandBudgetPassed,
    },
  };
  await mkdir('test-results/cpu', { recursive: true });
  await writeFile(
    outputPath,
    `${JSON.stringify(reportedResult, null, 2)}\n`,
    'utf8',
  );
  console.info(JSON.stringify(reportedResult, null, 2));
  if (!reportedResult.checks.passed) {
    throw new Error('The coupled CPU integration experiment did not pass.');
  }
} finally {
  await server.close();
}
