'use strict';

/**
 * Client REST Salesforce minimal : GET authentifie, SOQL pagine, describe.
 *
 * Volontairement sans dependance a jsforce ou equivalent : la surface dont
 * cette demo a besoin (describe, query, get) tient en quelques appels GET.
 * Le proxy EDF est pose via undici (fetch global de Node ne lit pas
 * HTTP_PROXY/HTTPS_PROXY tout seul).
 */

const { config } = require('./config');
const { getSession } = require('./sf-cli');

let dispatcherReady = false;

function ensureProxyDispatcher() {
  if (dispatcherReady || !config.proxyUrl) return;
  const { ProxyAgent, setGlobalDispatcher } = require('undici');
  setGlobalDispatcher(new ProxyAgent(config.proxyUrl));
  dispatcherReady = true;
}

/** GET authentifie sur l'API REST, avec un seul retry si le jeton cache a expire. */
async function restGet(relativePath, { forceRefresh = false } = {}) {
  ensureProxyDispatcher();
  const session = getSession({ forceRefresh });
  const url = relativePath.startsWith('http')
    ? relativePath
    : `${session.instanceUrl}${relativePath}`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
    signal: AbortSignal.timeout(config.httpTimeoutMs),
  });

  if (response.status === 401 && !forceRefresh) {
    return restGet(relativePath, { forceRefresh: true });
  }

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const detail = Array.isArray(body) && body[0]
      ? `${body[0].errorCode}: ${body[0].message}`
      : JSON.stringify(body);
    throw new Error(`GET ${url} a echoue (HTTP ${response.status}) : ${detail}`);
  }

  return body;
}

/** Describe d'un sObject. Rend null (sans lever) si l'objet n'existe pas sur cet org. */
async function describeSObject(apiName) {
  try {
    return await restGet(`/services/data/${config.apiVersion}/sobjects/${apiName}/describe`);
  } catch (err) {
    if (/HTTP 404/.test(err.message) || /NOT_FOUND/.test(err.message)) return null;
    throw err;
  }
}

/**
 * SOQL pagine, borne par `maxRecords`. L'appelant garantit un SELECT : voir
 * le garde-fou dans server.js (ce client ne fait pas de distinction, il
 * execute ce qu'on lui donne).
 */
async function query(soql, { maxRecords = 500 } = {}) {
  let page = await restGet(`/services/data/${config.apiVersion}/query?q=${encodeURIComponent(soql)}`);
  const records = [...page.records];

  while (page.nextRecordsUrl && records.length < maxRecords) {
    page = await restGet(page.nextRecordsUrl);
    records.push(...page.records);
  }

  return {
    totalSize: page.totalSize,
    done: page.done && records.length >= page.totalSize,
    truncated: records.length < page.totalSize,
    records: records.slice(0, maxRecords),
  };
}

module.exports = { restGet, describeSObject, query };
