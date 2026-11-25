---
name: product-discovery-api
description: Decouvre un produit EPC/CPQ existant par l'API Salesforce (serveur MCP epc-api) et ecrit un rapport chronometre. Usage - "/product-discovery-api <nom ou Id du produit>".
---

# Decouverte d'un produit par API

Decouvre un produit existant du trial Energy & Utilities Cloud par l'API
Salesforce (serveur MCP `epc-api`), et documente ce qui a ete trouve. **Ce
skill ne cree, ne modifie et ne supprime rien** (voir `docs/decisions.md` a la
racine du depot : ce depot est en lecture seule).

## Entree

Un nom ou un Id de produit, passe en argument. S'il manque, le demander.

## Deroule

1. **Verifier la connexion** : appeler `epc_api_ping`. Si l'outil echoue,
   lire le message — il nomme la commande de remediation (typiquement
   `sf org login web --alias <alias>`) — et s'arreter la, pas de tentative de
   contournement.
2. Chronometrer a partir d'ici (c'est la duree qui compte dans la demo).
3. **Resoudre le produit** :
   - si l'entree ressemble a un Id Salesforce (15/18 caracteres), appeler
     directement `epc_api_get_product_blueprint` avec cet Id ;
   - sinon, appeler `epc_api_search_product` avec le terme. S'il y a plusieurs
     resultats, les presenter et demander lequel choisir plutot que d'en
     deviner un. S'il n'y en a qu'un, continuer avec son Id.
4. Appeler `epc_api_get_product_blueprint` avec l'Id retenu.
5. Si le blueprint porte une section `omis` non vide, la lire et la
   mentionner dans le rapport : c'est une information sur la variante
   EPC/CPQ installee sur ce trial, pas un echec a cacher.
6. Si une section interessante manque et qu'on soupconne un autre nom
   d'objet sur cette variante, utiliser `epc_api_describe_object` pour
   verifier avant de conclure a une absence.

## Sortie

Deux fichiers dans `reports/` (creer le dossier s'il n'existe pas) :

- `reports/blueprint-<slug-du-produit>.json` — le blueprint complet tel que
  rendu par `epc_api_get_product_blueprint`.
- `reports/decouverte-api-<slug-du-produit>.md` — un rapport court :
  - produit (nom, Id, org)
  - duree totale (du premier appel au dernier)
  - nombre d'appels d'outils
  - ce qui a ete trouve, section par section
  - ce qui a ete omis, et pourquoi (section `omis` du blueprint)

`<slug-du-produit>` : le nom du produit en minuscules, espaces remplaces par
des tirets.

Ne pas remplir le gabarit de comparaison (`reports/gabarit-rapport.md`) dans
ce skill : il se remplit une fois que la decouverte IHM (`product-discovery-ihm`)
a aussi tourne sur le meme produit.

## Ce que ce skill ne fait pas

Il ne devine pas de donnee absente du blueprint, et il n'appelle aucun outil
d'ecriture (il n'en existe pas dans ce depot). Si le produit n'existe pas sur
l'org, le rapport le dit, il ne propose pas de "corriger" en en creant un.
