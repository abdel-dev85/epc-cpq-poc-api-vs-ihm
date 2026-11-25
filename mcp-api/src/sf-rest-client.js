'use strict';

/**
 * Client REST Salesforce minimal : GET authentifie, SOQL pagine, describe.
 *
 * Volontairement sans dependance a jsforce ou equivalent : la surface dont
 * cette demo a besoin (describe, query, get) tient en quelques appels GET.
 *
 * Le proxy EDF est pose via un dispatcher undici explicite (`request()` avec
 * `dispatcher`), pas via `setGlobalDispatcher` + `fetch` global : constate en
 * pratique, le `fetch` natif de Node n'utilise pas le dispatcher pose par le
 * paquet `undici` installe (deux instances d'undici distinctes, l'une interne
 * a Node, l'autre le paquet npm) et tente une connexion directe, bloquee par
 * le reseau EDF en dehors du proxy.
 */

const { request, ProxyAgent, Agent } = require('undici');

const { config } = require('./config');
const { getSession } = require('./sf-cli');

const dispatcher = config.proxyUrl ? new ProxyAgent(config.proxyUrl) : new Agent();

/** GET authentifie sur l'API REST, avec un seul retry si le jeton cache a expire. */
async function restGet(relativePath, { forceRefresh = false } = {}) {
  const session = getSession({ forceRefresh });
  const url = relativePath.startsWith('http')
    ? relativePath
    : `${session.instanceUrl}${relativePath}`;

  const { statusCode, body: responseBody } = await request(url, {
    dispatcher,
    headers: { Authorization: `Bearer ${session.accessToken}` },
    headersTimeout: config.httpTimeoutMs,
    bodyTimeout: config.httpTimeoutMs,
  });

  if (statusCode === 401 && !forceRefresh) {
    await responseBody.text().catch(() => {});
    return restGet(relativePath, { forceRefresh: true });
  }

  const raw = await responseBody.text();
  const body = raw ? JSON.parse(raw) : null;

  if (statusCode < 200 || statusCode >= 300) {
    const detail = Array.isArray(body) && body[0]
      ? `${body[0].errorCode}: ${body[0].message}`
      : JSON.stringify(body);
    throw new Error(`GET ${url} a echoue (HTTP ${statusCode}) : ${detail}`);
  }

  return body;
}

/**
 * POST/PATCH authentifie, meme logique de retry/erreur que `restGet`.
 * Reserve aux outils de mutation explicitement autorises (docs/decisions.md).
 */
async function restWrite(method, relativePath, jsonBody, { forceRefresh = false } = {}) {
  const session = getSession({ forceRefresh });
  const url = `${session.instanceUrl}${relativePath}`;

  const { statusCode, body: responseBody } = await request(url, {
    method,
    dispatcher,
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(jsonBody),
    headersTimeout: config.httpTimeoutMs,
    bodyTimeout: config.httpTimeoutMs,
  });

  if (statusCode === 401 && !forceRefresh) {
    await responseBody.text().catch(() => {});
    return restWrite(method, relativePath, jsonBody, { forceRefresh: true });
  }

  const raw = await responseBody.text();
  const body = raw ? JSON.parse(raw) : null;

  if (statusCode < 200 || statusCode >= 300) {
    const detail = Array.isArray(body) && body[0]
      ? `${body[0].errorCode}: ${body[0].message}`
      : JSON.stringify(body);
    throw new Error(`${method} ${url} a echoue (HTTP ${statusCode}) : ${detail}`);
  }

  return body;
}

/** Cree un enregistrement. Rend { id, created: true } ou leve avec le detail Salesforce. */
async function sobjectCreate(objectName, fields) {
  const result = await restWrite('POST', `/services/data/${config.apiVersion}/sobjects/${objectName}`, fields);
  return { id: result.id, created: Boolean(result.success) };
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

module.exports = { restGet, restWrite, sobjectCreate, describeSObject, query };
