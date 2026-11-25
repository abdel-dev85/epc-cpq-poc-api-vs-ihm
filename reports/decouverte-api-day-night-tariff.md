---
id: decouverte-api-day-night-tariff
type: rapport
title: "Decouverte API - Day/Night Tariff"
status: active
---

# Decouverte API — Day/Night Tariff

- **Produit :** Day/Night Tariff (`PD_DAY_NIGHT_TARIFF`), Id `01tWx000007jGeUIAU`
- **Org :** trial Energy & Utilities Cloud (`edf2.my.salesforce.com`)
- **Duree totale :** 5 525 ms
- **Appels d'outils :** 1 (`epc_api_get_product_blueprint`, qui sonde en interne 9 objets candidats)

Retenu apres classement du catalogue par richesse de donnees (`vlocity_cmt__AttributeAssignment__c`,
`vlocity_cmt__PriceListEntry__c`, `vlocity_cmt__CatalogProductRelationship__c`,
`vlocity_cmt__ProductChildItem__c` groupes par produit) : c'est le produit qui
couvre le plus de dimensions a la fois (attributs, tarification, categorie,
composants), devant une dizaine de tarifs comparables.

## Ce qui a ete trouve

**Fiche** — "Day/Night Tariff energy plan giving you a cheaper electricity
rate at night.", famille Electricity, actif.

**Categorie** (`vlocity_cmt__CatalogProductRelationship__c`) — rattache au
catalogue "Consumer Electricity Catalog".

**Attributs** (`vlocity_cmt__AttributeAssignment__c`, 3) :

| Attribut | Type | Categorie d'attribut |
|---|---|---|
| Usage Attribute (`ATT_USAGE`) | Number | Usage Pricing |
| Meter Type (`ATT_METER_TYPE`) | Picklist | Commodity Commercial Offers |
| Distribution Region (`ATT_DISTRIBUTION_REGION`) | Picklist | Commodity Cost Components |

**Tarification** — une entree dans le Pricebook standard (`UnitPrice: 0`,
donnee de trial non valorisee) et une entree dans la Price List Vlocity
("Default Price List", pas de prix de base marque `IsBasePrice`).

**Composants** (`vlocity_cmt__ProductChildItem__c`, bundle) :

- Unit Rate - Day
- Unit Rate - Night
- Standing Charges
- une quatrieme ligne sans `ChildProductId` resolu (composant orphelin ou
  reference a un produit inactif/supprime — a noter, pas a masquer)

## Ce qui a ete omis, et pourquoi

| Section | Objet | Raison |
|---|---|---|
| categories (standard) | `ProductCategoryProduct` | champ `IsPrimaryCategory` absent de cette edition |
| tarification (standard) | `PricebookEntry` | champ `CurrencyIsoCode` absent (multi-devise non active) |
| attributs (standard) | `ProductAttributeDefinition` | objet present mais vide — l'org utilise l'objet model Vlocity CMT, pas le standard |
| modelesDeVente | `ProductSellingModelOption` | vide sur ce produit |
| composants (standard) | `ProductRelatedComponent` | vide — la structure reelle est dans `vlocity_cmt__ProductChildItem__c` |

Ce dernier point est le constat le plus important de cette decouverte : **la
variante installee sur ce trial est Vlocity CMT**, pas l'objet model standard
Salesforce. Voir `docs/architecture.md`, section "Constate sur le trial".

## Blueprint complet

[`reports/blueprint-day-night-tariff.json`](blueprint-day-night-tariff.json)
