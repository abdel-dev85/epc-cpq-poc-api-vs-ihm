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
| `epc_api_get_product_blueprint` | assemble un blueprint JSON pour un produit : fiche, attributs, tarification, categories, composants — en sondant a la fois l'objet model standard et l'objet model Vlocity CMT (`vlocity_cmt__*`), et en ignorant ce qui est absent de l'org |
| `epc_api_run_soql` | SOQL libre, **SELECT uniquement** (garde-fou lecture seule applicatif) |

Authentification : jeton + `instanceUrl` obtenus via `sf org display --json`
(CLI deja authentifie, voir `docs/decisions.md`). Pas de session navigateur.

## `mcp-ihm/` — serveur MCP, Playwright sur Lightning

Outils (tous en lecture) :

| Outil | Role |
|---|---|
| `epc_ihm_ping` | lance le navigateur, authentifie (frontdoor sf-cli), verifie que Lightning charge |
| `epc_ihm_screenshot` | capture pleine page |
| `epc_ihm_search_record` | ouvre la vue de liste d'un objet et filtre les lignes affichees par un terme |
| `epc_ihm_read_record` | ouvre une fiche (Id ou chemin) et releve ce qu'elle **affiche** : panneau d'en-tete, listes associees visibles, messages/bandeaux |

`epc_ihm_read_record` s'appuie sur des primitives generiques Lightning
(`records-record-banner`, `[data-label]`, traversee du shadow DOM) deja
eprouvees sur un org reel par le depot voisin. Un page object specifique a un
ecran Vlocity Product Designer attend une capture sur le trial — voir Regle 3
du `CLAUDE.md` de ce depot.

### Constate sur le trial

- **L'objet model reellement peuple est Vlocity CMT (`vlocity_cmt__*`), pas
  l'objet model standard.** `vlocity_cmt__AttributeAssignment__c`,
  `vlocity_cmt__PriceListEntry__c`, `vlocity_cmt__CatalogProductRelationship__c`
  et `vlocity_cmt__ProductChildItem__c` portent des donnees reelles sur tous
  les produits sondes ; les objets standard (`ProductAttributeDefinition`,
  `PricebookEntry` mis a part, `ProductRelatedComponent`...) existent mais
  sont vides. `epc_api_get_product_blueprint` sonde desormais les deux objet
  models en parallele (sections `*VlocityCmt`) plutot que de ne couvrir que
  le standard.
- **La recherche globale de ce trial n'est pas la recherche Lightning
  standard.** La home ouvre sur une page d'accueil propre au trial
  (`id="global-search-01"`, classes `splashPage-*` : un widget d'onboarding du
  parcours "feature discoverability", pas `.slds-global-header`).
  `epc_ihm_search_record` s'appuie donc sur la vue de liste (`ListViewPage`,
  deja eprouvee sur canopee-edf par le depot voisin) plutot que sur un
  selecteur devine pour cet ecran specifique au trial.
- **La fiche produit s'ouvre dans l'app "Vlocity Product Designer"**, avec des
  onglets DETAILS / PRICING / STRUCTURE / ATTACHMENTS / ATTRIBUTE RULES /
  CONTEXT RULES / FULFILLMENT — une structure que `epc_ihm_read_record` rend
  aujourd'hui en texte visible brut (aucun patron `data-label` sur cet
  ecran) : c'est une information que l'IHM donne et que l'API ne rend pas sous
  cette forme (la notion d'onglet n'existe pas cote donnees), a mentionner
  dans le rapport comparatif plutot qu'a ignorer.

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
