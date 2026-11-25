'use strict';

/**
 * URL frontdoor via le CLI Salesforce, repris de mcp-epc-cpq-agentic/src/auth/sf-cli.js
 * (depot voisin), simplifie : ce depot n'a qu'un seul mode d'authentification.
 *
 * **L'URL rendue porte un identifiant de session.** Elle va directement dans
 * `page.goto()`, jamais dans un journal ni une reponse d'outil.
 */

const { execFileSync } = require('child_process');
const path = require('path');

const { config } = require('../config');

function cliEnv() {
  const env = { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' };

  if (config.proxyUrl) {
    env.HTTP_PROXY = env.HTTP_PROXY || config.proxyUrl;
    env.HTTPS_PROXY = env.HTTPS_PROXY || config.proxyUrl;
    env.NO_PROXY = env.NO_PROXY || '.edf.fr,localhost,127.0.0.1';
  }

  if (config.sfCliDir) {
    env.PATH = `${config.sfCliDir}${path.delimiter}${env.PATH || ''}`;
  }

  return env;
}

function runSf(args, what) {
  let raw;
  try {
    raw = execFileSync(config.sfCliBin, [...args, '--json'], {
      encoding: 'utf-8',
      timeout: config.sfCliTimeoutMs,
      env: cliEnv(),
      windowsHide: true,
      shell: process.platform === 'win32',
    });
  } catch (err) {
    const payload = (err.stdout || '').trim();
    if (payload) {
      try {
        const parsed = JSON.parse(payload);
        throw new Error(
          `${what} a echoue (status ${parsed.status}) : ${parsed.message || 'sans message'}\n`
          + `Relancez : ${config.sfCliLoginCommand}`
        );
      } catch (parseErr) {
        if (!(parseErr instanceof SyntaxError)) throw parseErr;
      }
    }
    if (err.code === 'ENOENT') {
      throw new Error(
        `CLI Salesforce introuvable : "${config.sfCliBin}" n'est pas dans le PATH.\n`
        + 'Installez-le, ou pointez son dossier avec SF_CLI_DIR.'
      );
    }
    throw new Error(`${what} a echoue : ${err.message}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(raw.trim());
  } catch {
    throw new Error(`${what} n'a pas rendu du JSON. Sortie : ${raw.slice(0, 300)}`);
  }

  if (parsed.status !== 0) {
    throw new Error(
      `${what} a echoue (status ${parsed.status}) : ${parsed.message || 'sans message'}\n`
      + `Relancez : ${config.sfCliLoginCommand}`
    );
  }

  return parsed.result;
}

/** URL frontdoor portant une session pour l'org du trial. */
function getFrontdoorUrl(orgAlias = config.sfCliOrg) {
  const result = runSf(['org', 'open', '--target-org', orgAlias, '--url-only'], {
    what: `sf org open -o ${orgAlias}`,
  });

  if (!result || !result.url) {
    throw new Error(`sf org open -o ${orgAlias} n'a pas rendu d'URL.`);
  }
  return result.url;
}

module.exports = { getFrontdoorUrl };
