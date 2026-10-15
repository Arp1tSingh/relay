import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const API_PREFIX = '/api/';

function apiDevServer() {
  return {
    name: 'relay-api-dev-server',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? '';
        if (!url.startsWith(API_PREFIX)) return next();

        const name = url.slice(API_PREFIX.length).split('?')[0].replace(/\.js$/, '');

        if (!/^[\w-]+$/.test(name) || !existsSync(join(server.config.root, 'api', `${name}.js`))) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ error: `No handler at ${API_PREFIX}${name}` }));
          return;
        }

        try {
          const mod = await server.ssrLoadModule(`${API_PREFIX}${name}.js`);
          const handler = mod.default;

          const search = new URL(url, 'http://localhost').searchParams;
          req.query = Object.fromEntries(search.entries());

          res.status = (code) => {
            res.statusCode = code;
            return res;
          };
          res.json = (body) => {
            if (!res.getHeader('Content-Type')) {
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
            }
            res.end(JSON.stringify(body));
            return res;
          };

          await handler(req, res);
        } catch (error) {
          server.config.logger.error(`[api] ${name}: ${error?.stack ?? error}`);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ error: 'Internal error in dev server.' }));
          }
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  for (const [key, value] of Object.entries(env)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }

  return {
    plugins: [react(), apiDevServer()],
  };
});