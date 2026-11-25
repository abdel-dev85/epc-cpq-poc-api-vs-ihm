'use strict';

/**
 * Configuration du serveur mcp-ihm.
 *
 * Le .env est partage avec mcp-api/ (racine du depot) : les deux serveurs
 * ciblent le meme org, c'est ce qui rend la comparaison valide. Un seul mode
 * d'authentification ici (sf-cli) : le trial n'a pas de SSO Gardian/EDF
 * configure dessus (voir docs/decisions.md).
 */

const fs = require('fs');
const path = require('path');

// src/ -> mcp-ihm/ -> racine du depot.
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

  baseUrl: (process.env.SF_BASE_URL || '').replace(/\/+$/, ''),

  sfCliBin: process.env.SF_CLI_BIN || 'sf',
  sfCliDir: process.env.SF_CLI_DIR || '',
  sfCliTimeoutMs: intEnv('SF_CLI_TIMEOUT', 120_000),

  get sfCliLoginCommand() {
    return `sf org login web --alias ${this.sfCliOrg}`;
  },

  proxyUrl: process.env.EDF_PROXY !== undefined
    ? process.env.EDF_PROXY
    : (process.env.HTTPS_PROXY || 'http://vip-users.proxy.edf.fr:3131'),

  headless: process.env.EPC_HEADLESS !== '0',
  ignoreHttpsErrors: process.env.EPC_IGNORE_HTTPS_ERRORS === '1',
  idleTimeoutMs: intEnv('EPC_IDLE_TIMEOUT', 600_000),
  navigationTimeoutMs: intEnv('EPC_NAV_TIMEOUT', 60_000),

  debug: process.env.EPC_DEBUG === '1',
  debugLogPath: process.env.EPC_DEBUG_LOG || path.join(__dirname, '..', 'debug.log'),

  get authStatePath() {
    const host = (() => {
      try { return new URL(this.baseUrl).hostname; } catch { return 'org'; }
    })();
    return path.join(__dirname, '..', '.auth', `${host}.json`);
  },
};

module.exports = { config, loadDotEnv };
