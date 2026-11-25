#!/usr/bin/env node
'use strict';

/**
 * Smoke test hors client MCP pour mcp-ihm.
 *
 *   node scripts/smoke-ping.js          -> ping (lance Chromium et authentifie)
 *   node scripts/smoke-ping.js --list   -> tools/list seulement, sans navigateur
 */

const { spawn } = require('child_process');
const path = require('path');
const readline = require('readline');

const LIST_ONLY = process.argv.includes('--list');
const TIMEOUT_MS = parseInt(process.env.SMOKE_TIMEOUT || '120000', 10);

const serverPath = path.join(__dirname, '..', 'src', 'server.js');
const child = spawn(process.execPath, [serverPath], {
  stdio: ['pipe', 'pipe', 'inherit'],
  env: process.env,
});

const pending = new Map();
let nextId = 1;

readline.createInterface({ input: child.stdout, terminal: false })
  .on('line', (line) => {
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      console.error('Ligne non JSON sur stdout (le protocole est corrompu) :', line);
      return;
    }
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      message.error ? reject(new Error(message.error.message)) : resolve(message.result);
    }
  });

function request(method, params) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  });
}

function notify(method, params) {
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n');
}

function fail(message) {
  console.error('\nECHEC : ' + message);
  child.kill();
  process.exitCode = 1;
}

const timer = setTimeout(() => {
  fail(`aucune reponse en ${TIMEOUT_MS / 1000} s. Relancez avec EPC_DEBUG=1 et lisez debug.log.`);
  process.exit(1);
}, TIMEOUT_MS);

(async () => {
  const init = await request('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'smoke-ping', version: '1' },
  });
  notify('notifications/initialized', {});

  console.log(`Serveur    : ${init.serverInfo.name} v${init.serverInfo.version}`);
  console.log(`Protocole  : ${init.protocolVersion}`);

  const { tools } = await request('tools/list', {});
  console.log(`Outils     : ${tools.map(t => t.name).join(', ')}`);

  if (LIST_ONLY) {
    console.log('\nOK — protocole et declaration des outils valides (navigateur non sollicite).');
    clearTimeout(timer);
    child.kill();
    return;
  }

  console.log('\nAppel de epc_ihm_ping (lance Chromium et authentifie)...\n');
  const result = await request('tools/call', { name: 'epc_ihm_ping', arguments: {} });

  for (const part of result.content) {
    if (part.type === 'text') console.log(part.text);
    if (part.type === 'image') console.log(`[capture d'ecran : ${part.data.length} octets base64]`);
  }

  clearTimeout(timer);
  child.kill();

  if (result.isError) {
    console.error('\nECHEC : l\'outil a renvoye une erreur (voir ci-dessus).');
    process.exitCode = 1;
  } else {
    console.log('\nOK — le serveur repond et la session Salesforce est valide.');
  }
})().catch((err) => {
  clearTimeout(timer);
  fail(err.message);
});
