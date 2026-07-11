import express, { type Express } from 'express';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const defaultClientDistPath = fileURLToPath(
  new URL('../dist/', import.meta.url),
);

export function createApp(clientDistPath = defaultClientDistPath): Express {
  const app = express();

  app.disable('x-powered-by');

  app.get('/healthz', (_request, response) => {
    response.status(200).json({ status: 'ok' });
  });

  app.use(
    '/assets',
    express.static(resolve(clientDistPath, 'assets'), {
      immutable: true,
      maxAge: '1y',
    }),
  );
  app.use(
    express.static(clientDistPath, {
      index: false,
      maxAge: 0,
      setHeaders(response, filePath) {
        if (filePath.endsWith('.html')) {
          response.setHeader('Cache-Control', 'no-cache');
        }
      },
    }),
  );

  app.use((request, response, next) => {
    if (request.method !== 'GET' || !request.accepts('html')) {
      next();
      return;
    }

    response.setHeader('Cache-Control', 'no-cache');
    response.sendFile(resolve(clientDistPath, 'index.html'));
  });

  return app;
}

export function startServer(
  port = Number(process.env.PORT ?? 3000),
  host = process.env.HOST ?? '127.0.0.1',
) {
  const server = createApp().listen(port, host, () => {
    console.info(`[Bismuth] server listening on http://${host}:${port}`);
  });

  const shutdown = (signal: NodeJS.Signals) => {
    console.info(`[Bismuth] received ${signal}; shutting down`);
    server.close((error) => {
      if (error) {
        console.error('[Bismuth] shutdown failed', error);
        process.exitCode = 1;
      }
    });
  };

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);

  return server;
}

const entryPath = process.argv[1];

if (entryPath && import.meta.url === pathToFileURL(entryPath).href) {
  startServer();
}
