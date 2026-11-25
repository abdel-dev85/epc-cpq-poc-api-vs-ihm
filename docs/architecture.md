---
id: architecture
type: reference
title: "Architecture de la demo API vs IHM"
status: active
---

# Architecture

## Vue d'ensemble

```
                      ┌──────────────────────────┐
                      │   Produit existant du     │
                      │   catalogue du trial       │
                      └─────────────┬────────────┘
                                     │
                 ┌───────────────────┴───────────────────┐
                 │                                        │
          decouverte API                           decouverte IHM
                 │                                        │
        skills/product-discovery-api          skills/product-discovery-ihm
                 │                                        │
          serveur MCP mcp-api/                     serveur MCP mcp-ihm/
     (REST + Tooling API + SOQL, lecture)   (Playwright sur Lightning, lecture)
                 │                                        │
                 └───────────────────┬───────────────────┘
                                     │
                          reports/ (blueprint + rapport,
                          duree, completude, ecarts)
```

Les deux chemins lisent le **meme produit**, dans le **meme org**. Seule la
methode change. C'est ce qui rend la comparaison valide.

## `mcp-api/` — serveur MCP, REST/Tooling/SOQL

Outils (tous en lecture) :

| Outil | Role |
|---|---|
| `epc_api_ping` | verifie l'authentification (org, instance, version d'API) |
| `epc_api_describe_object` | `describe` d'un sObject : champs, types, record types, picklists |
| `epc_api_search_product` | SOSL/SOQL — trouve des produits par nom ou mot-cle |
| `epc_api_get_product_blueprint` | assemble un blueprint JSON pour un produit : fiche, attributs, tarification, categories — en sondant un ensemble d'objets candidats et en ignorant ceux absents de l'org |
| `epc_api_run_soql` | SOQL libre, **SELECT uniquement** (garde-fou lecture seule applicatif) |

Authentification : jeton + `instanceUrl` obtenus via `sf org display --json`
(CLI deja authentifie, voir `docs/decisions.md`). Pas de session navigateur.

## `mcp-ihm/` — serveur MCP, Playwright sur Lightning

Outils (tous en lecture) :

| Outil | Role |
|---|---|
| `epc_ihm_ping` | lance le navigateur, authentifie (frontdoor sf-cli), verifie que Lightning charge |
| `epc_ihm_screenshot` | capture pleine page |
| `epc_ihm_search_record` | tape dans la recherche globale Lightning, releve les resultats proposes |
| `epc_ihm_read_record` | ouvre une fiche (Id ou chemin) et releve ce qu'elle **affiche** : panneau d'en-tete, listes associees visibles, messages/bandeaux |

`epc_ihm_read_record` s'appuie sur des primitives generiques Lightning
(`records-record-banner`, `[data-label]`, traversee du shadow DOM) deja
eprouvees sur un org reel par le depot voisin. Un page object specifique a un
ecran Vlocity Product Designer attend une capture sur le trial — voir Regle 3
du `CLAUDE.md` de ce depot.

## `.claude/skills/`

Deux skills, meme forme de sortie, methode differente :

- `product-discovery-api` — utilise `mcp-api` pour batir le blueprint,
  chronometre, ecrit `reports/decouverte-api-<produit>.md` et
  `reports/blueprint-<produit>.json`.
- `product-discovery-ihm` — utilise `mcp-ihm` pour naviguer et lire la meme
  fiche, chronometre, ecrit `reports/decouverte-ihm-<produit>.md` et les
  captures associees.

Un troisieme temps (manuel, ou skill de synthese ulterieur) compare les deux
rapports : duree, ce que chaque methode a vu que l'autre a manque, robustesse.
Gabarit : `reports/gabarit-rapport.md`.

## Pourquoi deux serveurs et pas un seul avec deux familles d'outils

Pour que le dependance-tracking et le cout d'appel restent visibles separement
(c'est explicitement **le sujet de la demo**), et parce que `mcp-ihm/`
embarque Playwright + Chromium alors que `mcp-api/` n'a besoin que d'un client
HTTP : les coupler ferait porter le poids du navigateur a tous les appels.
