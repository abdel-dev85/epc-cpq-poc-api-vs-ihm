---
id: decouverte-ihm-day-night-tariff
type: rapport
title: "Decouverte IHM - Day/Night Tariff"
status: active
---

# Decouverte IHM — Day/Night Tariff

- **Produit :** Day/Night Tariff, trouve via la vue de liste `AllProducts` sur `Product2`
- **URL :** `/lightning/r/Product2/01tWx000007jGeUIAU/view`
- **Org :** trial Energy & Utilities Cloud (`edf2.lightning.force.com`)
- **Duree totale :** 78 461 ms (recherche + authentification fraiche incluse —
  la session navigateur avait expire, le frontdoor sf-cli a du etre rejoue)
- **Appels d'outils :** 2 (`epc_ihm_search_record`, `epc_ihm_read_record`) + 1 capture

## Parcours suivi

1. `epc_ihm_search_record` ouvre `/lightning/o/Product2/list?filterName=AllProducts`
   (44 lignes, non tronquees) et filtre par "day/night tariff" : une
   correspondance, Id `01tWx000007jGeUIAU`.
2. `epc_ihm_read_record` ouvre la fiche et attend le chargement (header +
   reseau silencieux).
3. `epc_ihm_screenshot` capture l'ecran — [`reports/screenshots/ihm-day-night-tariff.png`](screenshots/ihm-day-night-tariff.png).

## Ce qui a ete lu

Aucun patron `data-label` sur cet ecran (c'est une fiche de detail, pas une
datatable) : l'outil est retombe sur son filet de secours, le texte visible
entier. Il porte neanmoins des informations structurelles reelles :

- **Produit Code :** `PD_DAY_NIGHT_TARIFF`, **Famille :** Electricity (coherent avec l'API)
- **L'app ouverte est "Vlocity Product Designer"**, confirmant le constat
  deja fait sur un autre produit (voir `docs/architecture.md`)
- **Les onglets de la fiche :** DETAILS, PRICING, STRUCTURE, ATTACHMENTS,
  ATTRIBUTE RULES, CONTEXT RULES, FULFILLMENT
- Aucun message/bandeau d'alerte sur cette fiche

## Ce que l'IHM montre que l'API n'a pas rendu

- **La structure en onglets** (PRICING, STRUCTURE, ATTRIBUTE RULES, CONTEXT
  RULES, FULFILLMENT comme sections distinctes) : l'API rend les memes
  donnees a plat (sections `tarificationVlocityCmt`, `composantsVlocityCmt`,
  `attributsVlocityCmt`...), sans cette organisation visuelle/navigationnelle.
  Cette organisation en onglets *est* potentiellement l'information utile
  pour quelqu'un qui doit reproduire la saisie a l'ecran.
- **La confirmation visuelle qu'aucun bandeau d'erreur ou de desynchronisation
  n'est affiche** sur cette fiche — chose que l'API ne peut pas constater par
  nature (elle n'a pas de notion de "bandeau affiche").
- Pour obtenir le detail des valeurs d'attributs, du prix ou des composants
  **par l'IHM**, il faudrait ouvrir chacun des onglets PRICING/STRUCTURE/
  ATTRIBUTE RULES individuellement : non fait ici (perimetre lecture seule de
  la fiche d'accueil), ce qui aurait rallonge encore la duree.

## Ce que l'API a rendu que cette lecture IHM n'a pas

Le detail structure des attributs (type, categorie d'attribut), de la
tarification (Price List, IsBasePrice) et des composants du bundle (3 produits
enfants nommes) — tout cela est reste dans les onglets non ouverts ici. C'est
la demonstration concrete de l'ecart de rapidite : l'API a lu en 5,5 s ce que
l'IHM aurait mis plusieurs dizaines de secondes de plus a obtenir onglet par
onglet.
