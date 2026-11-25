'use strict';

/**
 * Jeton de session via le CLI Salesforce.
 *
 * `sf org display --verbose --json` rend l'accessToken courant et
 * l'instanceUrl pour une org deja authentifiee (`sf org login web`). Pas de
 * saisie interactive ici : c'est ce qui rend ce mode utilisable aussi bien en
 * session de developpement qu'en script.
 *
 * Le jeton est garde en memoire pour la duree du process et rafraichi au
 * besoin (TTL court + retry sur 401 cote appelant) : interroger le CLI a
 * chaque appel d'outil couterait un spawn de process a chaque fois.
 */

const { execFileSync } = require('child_process');
const path = require('path');

const { config } = require('./config');

const CACHE_TTL_MS = 5 * 60 * 1000;

let cached = null;
let cachedAt = 0;

function cliEnv() {
  const env = { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' };

  // Le CLI Salesforce lit lui-meme SF_API_VERSION/SFDX_API_VERSION pour sa
  // propre version d'API (format "68.0", sans "v") : les retirer protege
  // d'une collision si l'environnement herite en porte une au format REST
  // ("v68.0") utilise par ce serveur. Constate en pratique sur le trial.
  delete env.SF_API_VERSION;
  delete env.SFDX_API_VERSION;

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

/** Session courante : jeton, instance, identite. Rafraichie si perimee ou sur demande. */
function getSession({ forceRefresh = false } = {}) {
  if (!forceRefresh && cached && Date.now() - cachedAt < CACHE_TTL_MS) {
    return cached;
  }

  const result = runSf(
    ['org', 'display', '--target-org', config.sfCliOrg, '--verbose'],
    `sf org display -o ${config.sfCliOrg}`
  );

  if (!result || !result.accessToken || !result.instanceUrl) {
    throw new Error(
      `sf org display -o ${config.sfCliOrg} n'a pas rendu de jeton ou d'instanceUrl.\n`
      + `Verifiez l'authentification : ${config.sfCliLoginCommand}`
    );
  }

  cached = {
    accessToken: result.accessToken,
    instanceUrl: result.instanceUrl.replace(/\/+$/, ''),
    username: result.username,
    alias: result.alias || config.sfCliOrg,
  };
  cachedAt = Date.now();
  return cached;
}

module.exports = { getSession };
