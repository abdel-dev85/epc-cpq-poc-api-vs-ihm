---
id: epc-cpq-poc-api-vs-ihm-readme
type: index
title: "epc-cpq-poc-api-vs-ihm — demo comparative API vs IHM sur EPC/CPQ"
status: active
---

# epc-cpq-poc-api-vs-ihm

Demonstration agentique : decouvrir un produit EPC/CPQ existant dans un trial
Salesforce **Energy & Utilities Cloud**, par deux methodes — API et pilotage
de l'IHM — et comparer vitesse, robustesse et ce que chaque methode laisse
voir.

> **Lecture seule.** Ce depot ne cree, ne modifie et ne supprime rien dans
> l'org. Voir [`docs/decisions.md`](docs/decisions.md).

Depot independant de `mcp-epc-cpq-agentic` (meme methodologie, org et
perimetre differents — ne pas copier de code entre les deux, voir
[`CLAUDE.md`](CLAUDE.md)).

## Contenu

```
epc-cpq-poc-api-vs-ihm/
├── mcp-api/        <- serveur MCP : REST/Tooling API + SOQL, lecture seule
├── mcp-ihm/        <- serveur MCP : Playwright sur Lightning, lecture seule
├── skills/
│   ├── product-discovery-api/
│   └── product-discovery-ihm/
├── reports/        <- gabarit versionne ; les rapports generes ne le sont pas
└── docs/
    ├── decisions.md     <- org, auth, perimetre : ce qui est tranche
    └── architecture.md  <- comment les pieces s'assemblent
```

## Par ou commencer

| Vous voulez | Lisez |
|---|---|
| savoir ce qui est decide (org, auth, lecture seule) | [`docs/decisions.md`](docs/decisions.md) |
| comprendre l'assemblage | [`docs/architecture.md`](docs/architecture.md) |
| les regles durables du depot | [`CLAUDE.md`](CLAUDE.md) |

## Demarrage

### 1. Creer le trial et authentifier le CLI

1. Activer le trial **"Energy & Utilities Cloud Free Trial - Managed Package
   Apps"** depuis Salesforce.
2. `sf org login web --alias eu-cloud-trial` (ouvre un navigateur, une fois).
3. `sf org display --target-org eu-cloud-trial --json` pour lire
   `instanceUrl`, puis en deduire la racine Lightning (remplacer
   `.my.salesforce.com` par `.lightning.force.com`).
4. `cp .env.example .env` puis renseigner `SF_BASE_URL` avec cette racine.

### 2. Installer les deux serveurs

Deux projets npm independants, deux `node_modules` :

```bash
cd mcp-api  && npm install
cd mcp-ihm  && npm install && npx playwright install chromium chromium-headless-shell
```

### 3. Verifier chaque serveur

```bash
cd mcp-api && npm run ping   # authentification REST (jeton via sf org display)
cd mcp-ihm && npm run ping   # authentification navigateur (frontdoor sf-cli)
```

Tant que les deux ne rendent pas un etat connecte, inutile de lancer les
skills.

### 4. Lancer la decouverte comparative

Dans Claude Code, une fois les deux serveurs MCP declares (`.mcp.json`, a la
racine) :

```
/product-discovery-api  <nom ou Id du produit>
/product-discovery-ihm  <nom ou Id du produit>
```

Chaque skill ecrit son rapport dans `reports/`. Le gabarit de synthese est
[`reports/gabarit-rapport.md`](reports/gabarit-rapport.md).

## Ce que cette demo ne fait pas

Elle ne cree pas de produit, n'en modifie aucun, et ne le rend pas
commandable dans un devis CPQ. Elle documente un produit existant comme s'il
fallait le recreer — la creation effective est un chantier separe, qui
commence par mettre a jour `docs/decisions.md` (section mutation) avec une
liste d'operations autorisees et une verification d'etat par relecture.
