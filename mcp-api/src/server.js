'use strict';

/**
 * Serveur MCP (stdio) de decouverte EPC/CPQ par API Salesforce.
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

dbg('=== DEMARRAGE mcp-api ===');

const { z } = require('zod');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');

const { getSession } = require('./sf-cli');
const { restGet, describeSObject, query } = require('./sf-rest-client');
const { buildProductBlueprint, escapeSoql } = require('./blueprint');

function textResult(payload) {
  return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
}

function guarded(toolName, handler) {
  return async (...args) => {
    dbg(`OUTIL ${toolName} args=${JSON.stringify(args[0] || {})}`);
    try {
      return await handler(...args);
    } catch (err) {
      dbg(`ERREUR ${toolName}: ${err.message}\n${err.stack}`);
      return { content: [{ type: 'text', text: `Erreur : ${err.message}` }], isError: true };
    }
  };
}

const server = new McpServer({
  name: 'epc-cpq-poc-api',
  version: require('../package.json').version,
});

server.registerTool(
  'epc_api_ping',
  {
    title: "Verifier la connexion a l'org (API)",
    description:
      "Obtient un jeton via le CLI Salesforce (sf org display) et appelle l'endpoint /limits "
      + "pour verifier que l'API REST repond. A appeler en premier pour diagnostiquer un "
      + "probleme d'authentification avant tout autre outil.",
    inputSchema: z.strictObject({}),
  },
  guarded('epc_api_ping', async () => {
    const start = Date.now();
    const session = getSession();
    await restGet(`/services/data/${config.apiVersion}/limits`);
    return textResult({
      status: 'connected',
      orgAlias: config.orgAlias,
      username: session.username,
      instanceUrl: session.instanceUrl,
      apiVersion: config.apiVersion,
      durationMs: Date.now() - start,
    });
  })
);

server.registerTool(
  'epc_api_describe_object',
  {
    title: "Decrire un objet (sObject describe)",
    description:
      "Rend les champs, types, picklists et record types d'un objet, via l'API REST describe. "
      + "Rend isError si l'objet n'existe pas sur cet org : c'est une information utile, pas "
      + "un echec a masquer (variante EPC/CPQ installee inconnue a l'avance sur ce trial).",
    inputSchema: z.strictObject({
      objectApiName: z.string().describe("Nom d'API de l'objet, par exemple Product2 ou AttributeDefinition"),
    }),
  },
  guarded('epc_api_describe_object', async ({ objectApiName }) => {
    const describe = await describeSObject(objectApiName);
    if (!describe) {
      return {
        content: [{ type: 'text', text: `Objet "${objectApiName}" absent de cet org (describe a rendu 404).` }],
        isError: true,
      };
    }
    return textResult({
      name: describe.name,
      label: describe.label,
      keyPrefix: describe.keyPrefix,
      fields: describe.fields.map(f => ({
        name: f.name,
        label: f.label,
        type: f.type,
        referenceTo: f.referenceTo,
        picklistValues: f.type === 'picklist' ? f.picklistValues.map(p => p.value) : undefined,
      })),
      recordTypeInfos: describe.recordTypeInfos.map(r => ({
        name: r.name,
        recordTypeId: r.recordTypeId,
        active: r.active,
      })),
    });
  })
);

server.registerTool(
  'epc_api_search_product',
  {
    title: 'Rechercher un produit',
    description:
      'Recherche des Product2 par nom (LIKE). Rend Id, Name, ProductCode, IsActive, Family. '
      + 'Premiere etape avant epc_api_get_product_blueprint quand on ne connait pas encore l\'Id.',
    inputSchema: z.strictObject({
      term: z.string().describe('Terme a rechercher dans le nom du produit'),
      maxRecords: z.number().int().min(1).max(200).optional().describe('Defaut 20'),
    }),
  },
  guarded('epc_api_search_product', async ({ term, maxRecords = 20 }) => {
    const escaped = escapeSoql(term);
    const result = await query(
      `SELECT Id, Name, ProductCode, IsActive, Family FROM Product2
       WHERE Name LIKE '%${escaped}%' ORDER BY Name LIMIT ${maxRecords}`
    );
    return textResult({ term, count: result.records.length, products: result.records });
  })
);

server.registerTool(
  'epc_api_get_product_blueprint',
  {
    title: 'Assembler le blueprint d\'un produit',
    description:
      "Pour un Id ou un nom de produit (univoque), assemble un blueprint JSON : fiche produit, "
      + "categories, attributs, modeles de vente, tarification, composants - en sondant l'objet "
      + "model Industries CPQ standard et en omettant proprement ce qui n'existe pas sur cet org "
      + "(section 'omis', avec la raison). C'est l'outil de decouverte principal du cote API.",
    inputSchema: z.strictObject({
      productIdOrName: z.string().describe('Id Salesforce (15/18) ou nom exact/partiel univoque du produit'),
    }),
  },
  guarded('epc_api_get_product_blueprint', async ({ productIdOrName }) => {
    const start = Date.now();
    const blueprint = await buildProductBlueprint(productIdOrName);
    blueprint.durationMs = Date.now() - start;
    return textResult(blueprint);
  })
);

server.registerTool(
  'epc_api_run_soql',
  {
    title: 'Executer une requete SOQL (lecture seule)',
    description:
      'Execute une requete SOQL libre et pagine les resultats jusqu\'a maxRecords. '
      + 'SELECT uniquement : ce depot est en lecture seule (voir docs/decisions.md), '
      + 'toute autre requete est refusee avant meme d\'atteindre l\'org.',
    inputSchema: z.strictObject({
      soql: z.string().describe('Requete SOQL, doit commencer par SELECT'),
      maxRecords: z.number().int().min(1).max(2000).optional().describe('Defaut 500'),
    }),
  },
  guarded('epc_api_run_soql', async ({ soql, maxRecords = 500 }) => {
    if (!/^\s*select\b/i.test(soql)) {
      return {
        content: [{ type: 'text', text: 'Requete refusee : seules les requetes SELECT sont autorisees (serveur en lecture seule).' }],
        isError: true,
      };
    }
    const result = await query(soql, { maxRecords });
    return textResult(result);
  })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  dbg('Serveur pret, en attente de messages JSON-RPC sur stdin');
}

main().catch((err) => {
  dbg(`FATAL: ${err.message}\n${err.stack}`);
  process.exit(1);
});
