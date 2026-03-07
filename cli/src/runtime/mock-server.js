#!/usr/bin/env node
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

async function main() {
  const [prototypeRoot, portRaw] = process.argv.slice(2);
  if (!prototypeRoot || !portRaw) {
    console.error('Usage: mock-server <prototype-root> <port>');
    process.exit(1);
  }

  const port = Number.parseInt(portRaw, 10);
  if (!Number.isInteger(port) || port <= 0) {
    console.error(`Invalid port: ${portRaw}`);
    process.exit(1);
  }

  const seedPath = path.join(prototypeRoot, '.uxproto', 'mock', 'seed.json');
  const statePath = path.join(prototypeRoot, '.uxproto', 'mock', 'state.json');

  const seedState = readJson(seedPath, {});
  if (!fs.existsSync(statePath)) {
    writeJson(statePath, seedState);
  }

  const server = http.createServer(async (req, res) => {
    try {
      if (req.url === '/health') {
        res.statusCode = 200;
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      if (req.url === '/state' && req.method === 'GET') {
        const state = readJson(statePath, seedState);
        res.statusCode = 200;
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify(state));
        return;
      }

      if (req.url === '/state' && req.method === 'PUT') {
        const body = await parseBody(req);
        writeJson(statePath, body);
        res.statusCode = 200;
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify(body));
        return;
      }

      if (req.url === '/reset' && req.method === 'POST') {
        writeJson(statePath, seedState);
        res.statusCode = 200;
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify(seedState));
        return;
      }

      res.statusCode = 404;
      res.end('Not found');
    } catch (error) {
      res.statusCode = 500;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ error: error.message }));
    }
  });

  server.on('error', (error) => {
    console.error(`mock server failed: ${error.message}`);
    process.exit(1);
  });

  server.listen(port, '127.0.0.1', () => {
    process.stdout.write(`uxproto mock server listening on 127.0.0.1:${port}\n`);
  });

  const close = () => {
    server.close(() => process.exit(0));
  };

  process.on('SIGINT', close);
  process.on('SIGTERM', close);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
