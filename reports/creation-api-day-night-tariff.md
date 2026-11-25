---
id: creation-api-day-night-tariff
type: rapport
title: "Creation API - Day/Night Tariff_POC_API"
status: active
---

# Creation par API — Day/Night Tariff_POC_API

- **Produit source :** Day/Night Tariff (`01tWx000007jGeUIAU`)
- **Produit cree :** Day/Night Tariff_POC_API (`01tWx000007jI3BIAU`, `PD_DAY_NIGHT_TARIFF_POC_API`)
- **Outil :** `epc_api_create_product_variant`
- **Duree :** 70,9 s (8 ecritures + 6 requetes de relecture, sequentielles)

## Ce qui a ete ecrit

| Etape | Objet | Resultat |
|---|---|---|
| produit | `Product2` | cree, `01tWx000007jI3BIAU` |
| categorie | `vlocity_cmt__CatalogProductRelationship__c` | 1 rattachement cree (Consumer Electricity Catalog) |
| attribut | `vlocity_cmt__AttributeAssignment__c` | 3 crees (Usage Attribute, Meter Type, Distribution Region) |
| tarification-vlocity | `vlocity_cmt__PriceListEntry__c` | 1 cree (Default Price List) |
| tarification-standard | `PricebookEntry` | 1 cree (Standard Price Book) |
| composant | `vlocity_cmt__ProductChildItem__c` | 3 crees (Unit Rate - Day, Standing Charges, Unit Rate - Night) |

## Relecture (constat, pas le seul retour d'appel)

```
attributs: 3
categories: 1
tarificationVlocityCmt: 1
tarificationStandard: 1
composants: 4   <- 4, pas 3
```

**Le decalage (4 composants relus pour 3 crees) est le constat le plus
interessant de cette etape.** Une relecture directe de
`vlocity_cmt__ProductChildItem__c` montre une quatrieme ligne, "Root PCI",
`vlocity_cmt__ChildProductId__c` null, `vlocity_cmt__ChildLineNumber__c`
"1", **creee automatiquement par l'org au moment de l'insertion du
Product2** (horodatage anterieur aux trois composants explicitement crees).

C'est exactement l'avertissement formule avant de commencer cette demo :
Vlocity declenche des traitements de fond a la creation d'un produit. Ici,
un item racine de structure est pose automatiquement — et parce que l'agent
ne le savait pas, les composants explicites ont reutilise le numero de ligne
"1" deja pris par ce Root PCI, un conflit qui n'aurait ete visible qu'en
relisant l'etat, jamais dans le message de succes des appels d'insertion.

## Ce que ceci demontre pour la comparaison API/IHM

Creer la structure complete d'un produit (categorie, 3 attributs, 2
tarifications, 3 composants) a pris **8 appels d'ecriture et 71 secondes**
par API, contre un parcours de clics bien plus long et bien moins fiable par
IHM (chaque related list a son propre formulaire, son propre lookup
d'enregistrement existant, sans garde-fou de coherence). Mais la rapidite ne
suffit pas a garantir un produit *valide* : le conflit de numero de ligne
ci-dessus montre qu'une creation par API sans connaissance du comportement de
fond de l'org peut laisser un produit incoherent — d'ou la necessite de la
relecture, et, plus loin, de la validation reelle dans le panier.
