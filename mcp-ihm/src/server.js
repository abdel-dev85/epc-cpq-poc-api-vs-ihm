'use strict';

/**
 * Serveur MCP (stdio) de decouverte EPC/CPQ par pilotage de l'IHM Lightning.
 *
 * Lecture seule, strictement : aucun outil n'ecrit dans l'org (voir
 * docs/decisions.md a la racine du depot). Rien sur stdout en dehors du
 * protocole MCP ; le journal de debug va dans un fichier, sous EPC_DEBUG=1.
 */

const fs = require('fs');

const { config } = require('./config');

if (config.debug) {
  try { fs.writeFileSync(config.debugLogPath, ''); } catch { /* non bloquant */ }
}

function dbg(message) {
  if (!config.debug) return;
  try {
    fs.appendFileSync(config.debugLogPath, `[${new Date().toISOString()}] ${message}\n`);
  } catch { /* non bloquant */ }
}

dbg('=== DEMARRAGE mcp-ihm ===');

const { z } = require('zod');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { BrowserManager } = require('./browser-manager');

const browser = new BrowserManager({ dbg });

function textResult(payload) {
  return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
}

function imageResult(base64) {
  return { content: [{ type: 'image', data: base64, mimeType: 'image/png' }] };
}

let received = 0;
let completed = 0;
const inFlight = () => received - completed;

/** En cas d'echec, rend le message ET une capture de la page ou il s'est produit. */
function guarded(toolName, handler) {
  return async (...args) => {
    dbg(`OUTIL ${toolName} args=${JSON.stringify(args[0] || {})}`);
    try {
      return await handler(...args);
    } catch (err) {
      dbg(`ERREUR ${toolName}: ${err.message}\n${err.stack}`);

      const content = [{
        type: 'text',
        text: `Erreur : ${err.message}\n\nURL de la page : ${browser.currentUrl || 'N/A'}`,
      }];

      try {
        const shot = await browser.screenshot();
        if (shot) content.push({ type: 'image', data: shot, mimeType: 'image/png' });
      } catch { /* la capture est un bonus, jamais une cause d'echec */ }

      return { content, isError: true };
    } finally {
      completed++;
    }
  };
}

const server = new McpServer({
  name: 'epc-cpq-poc-ihm',
  version: require('../package.json').version,
});

server.registerTool(
  'epc_ihm_ping',
  {
    title: "Verifier la connexion a l'org (IHM)",
    description:
      'Lance le navigateur, authentifie la session Salesforce (frontdoor CLI) et verifie que '
      + 'Lightning se charge. A appeler en premier pour diagnostiquer un probleme avant tout '
      + 'autre outil.',
    inputSchema: z.strictObject({}),
  },
  guarded('epc_ihm_ping', async () => {
    const start = Date.now();
    const result = await browser.withPage(async (page) => ({
      status: 'connected',
      browserRunning: browser.isRunning,
      currentUrl: page.url(),
      baseUrl: config.baseUrl,
      orgAlias: config.orgAlias,
      sessionSource: browser.lastAuth ? browser.lastAuth.source : 'deja-authentifie',
    }));
    result.durationMs = Date.now() - start;
    return textResult(result);
  })
);

server.registerTool(
  'epc_ihm_screenshot',
  {
    title: "Capturer l'ecran courant",
    description:
      'Prend une capture pleine page. Avec navigateTo, navigue d\'abord vers un chemin relatif '
      + "de l'org (par exemple /lightning/page/home). Sert a constater ce qui s'affiche reellement.",
    inputSchema: z.strictObject({
      navigateTo: z.string().describe("Chemin relatif a ouvrir avant la capture").optional(),
    }),
  },
  guarded('epc_ihm_screenshot', async (args = {}) => {
    const base64 = await browser.screenshot(args.navigateTo);
    return imageResult(base64);
  })
);

server.registerTool(
  'epc_ihm_search_record',
  {
    title: 'Rechercher via une vue de liste Lightning',
    description:
      "Ouvre la vue de liste d'un objet et filtre les lignes affichees par un terme (sous-chaine, "
      + "insensible a la casse, sur n'importe quel champ visible). Equivalent cote navigateur de "
      + 'epc_api_search_product cote API. La recherche globale de ce trial ouvre sur une page '
      + "d'accueil specifique (splash d'onboarding, pas la recherche Lightning standard) - voir "
      + 'docs/decisions.md - la vue de liste est le parcours retenu, deja eprouve sur un org reel.',
    inputSchema: z.strictObject({
      term: z.string().describe('Terme a rechercher parmi les lignes affichees'),
      object: z.string().optional().describe("Nom d'API de l'objet (defaut Product2)"),
      listView: z.string().optional().describe('Nom developpeur de la vue (defaut : vue courante)'),
    }),
  },
  guarded('epc_ihm_search_record', async ({ term, object = 'Product2', listView }) => {
    const { ListViewPage } = require('./pages/list-view-page');
    const result = await browser.withPage(async (page) => {
      const view = new ListViewPage(page);
      await view.open(object, listView);
      return view.extractData();
    });

    const needle = term.toLowerCase();
    const matches = result.rows.filter(row =>
      Object.values(row.fields).some(v => String(v).toLowerCase().includes(needle))
    );

    return textResult({
      term, object, url: result.url, viewName: result.viewName,
      rowCount: result.rowCount, truncated: result.truncated, messages: result.messages,
      matches,
    });
  })
);

server.registerTool(
  'epc_ihm_read_record',
  {
    title: "Lire une fiche d'enregistrement",
    description:
      "Ouvre une fiche (Id Salesforce ou chemin relatif /lightning/r/.../view) et releve ce "
      + "qu'elle affiche : titre, messages/bandeaux, lignes de donnees des listes associees "
      + "(patron data-label), et a defaut le texte visible entier. Aucun champ specifique a un "
      + 'ecran EPC/CPQ : un page object dedie attend une capture reelle (Regle 3 du CLAUDE.md).',
    inputSchema: z.strictObject({
      idOrPath: z.string().describe('Id Salesforce (15/18) ou chemin relatif, par exemple /lightning/r/01t.../view'),
    }),
  },
  guarded('epc_ihm_read_record', async ({ idOrPath }) => {
    const { RecordPage } = require('./pages/record-page');
    const result = await browser.withPage(async (page) => {
      const record = new RecordPage(page);
      await record.open(idOrPath);
      return record.extractData();
    });
    return textResult(result);
  })
);

const SHUTDOWN_GRACE_MS = parseInt(process.env.EPC_SHUTDOWN_GRACE || '30000', 10);
let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  dbg(`Arret (${signal}), ${inFlight()} appel(s) en vol`);

  let lastCompleted = completed;
  let deadline = Date.now() + SHUTDOWN_GRACE_MS;

  while (inFlight() > 0 && Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 50));
    if (completed !== lastCompleted) {
      lastCompleted = completed;
      deadline = Date.now() + SHUTDOWN_GRACE_MS;
    }
  }

  if (inFlight() > 0) {
    dbg(`Aucun appel termine depuis ${SHUTDOWN_GRACE_MS} ms, ${inFlight()} encore en vol`);
  }

  await browser.close().catch(() => {});
  process.exit(0);
}

process.on('SIGINT', () => { shutdown('SIGINT'); });
process.on('SIGTERM', () => { shutdown('SIGTERM'); });
process.stdin.on('end', () => { shutdown('stdin termine'); });
process.stdin.on('close', () => { shutdown('stdin ferme'); });

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  const forward = transport.onmessage?.bind(transport);
  transport.onmessage = (message, extra) => {
    if (message && message.method === 'tools/call') received++;
    return forward ? forward(message, extra) : undefined;
  };

  dbg('Serveur pret, en attente de messages JSON-RPC sur stdin');
}

main().catch((err) => {
  dbg(`FATAL: ${err.message}\n${err.stack}`);
  process.exit(1);
});
