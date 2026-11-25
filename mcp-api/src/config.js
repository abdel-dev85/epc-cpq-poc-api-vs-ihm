'use strict';

/**
 * Configuration du serveur mcp-api.
 *
 * Tout ce qui est specifique a l'org passe par l'environnement ou par le
 * `.env` partage a la racine du depot (voir .env.example) : les deux serveurs
 * (mcp-api, mcp-ihm) ciblent le meme org, c'est ce qui rend la comparaison
 * valide.
 */

const fs = require('fs');
const path = require('path');

// src/ -> mcp-api/ -> racine du depot : le .env est partage entre les deux serveurs.
const ROOT = path.resolve(__dirname, '..', '..');

function loadDotEnv(envPath = path.join(ROOT, '.env')) {
  try {
    if (!fs.existsSync(envPath)) return;
    for (const line of fs.readFileSync(envPath, 'utf-8').split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (!match) continue;
      const [, key, rawValue] = match;
      if (process.env[key] !== undefined) continue;
      process.env[key] = rawValue.replace(/^(['"])(.*)\1$/, '$2');
    }
  } catch {
    /* un .env illisible ne doit pas empecher le serveur de demarrer */
  }
}

loadDotEnv();

function intEnv(name, fallback) {
  const parsed = parseInt(process.env[name] || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const config = {
  root: ROOT,

  orgAlias: process.env.SF_ALIAS || process.env.SF_CLI_ORG || 'eu-cloud-trial',
  sfCliOrg: process.env.SF_CLI_ORG || 'eu-cloud-trial',

  // Nom distinct de SF_API_VERSION : cette derniere est lue par le CLI
  // Salesforce lui-meme (sf org display) pour sa propre version d'API, dans
  // un format sans "v" ("68.0"). La confondre fait echouer le CLI avec
  // "v68.0 is not a valid API version." - constate en pratique sur le trial.
  apiVersion: process.env.EPC_API_VERSION || 'v62.0',

  sfCliBin: process.env.SF_CLI_BIN || 'sf',
  sfCliDir: process.env.SF_CLI_DIR || '',
  sfCliTimeoutMs: intEnv('SF_CLI_TIMEOUT', 120_000),

  get sfCliLoginCommand() {
    return `sf org login web --alias ${this.sfCliOrg}`;
  },

  proxyUrl: process.env.EDF_PROXY !== undefined
    ? process.env.EDF_PROXY
    : (process.env.HTTPS_PROXY || 'http://vip-users.proxy.edf.fr:3131'),

  httpTimeoutMs: intEnv('SF_HTTP_TIMEOUT_MS', 30_000),

  debug: process.env.EPC_DEBUG === '1',
  debugLogPath: process.env.EPC_DEBUG_LOG || path.join(__dirname, '..', 'debug.log'),
};

module.exports = { config, loadDotEnv };
