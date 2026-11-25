---
id: comparatif-day-night-tariff
type: rapport
title: "Rapport comparatif API vs IHM - Day/Night Tariff"
status: active
---

# Rapport comparatif — Day/Night Tariff

## Produit source

- **Nom :** Day/Night Tariff
- **Id :** `01tWx000007jGeUIAU`
- **Org :** trial Energy & Utilities Cloud
- **Date :** 2026-11-25

Choisi par classement automatique du catalogue (44 produits actifs) sur le
nombre de dimensions renseignees (categorie, attributs, tarification,
composants) : c'est le produit qui en couvre le plus a la fois.

## Decouverte API

- **Duree :** 5,5 s
- **Outils appeles :** 1 (`epc_api_get_product_blueprint`, qui sonde 9 objets en interne)
- **Ce qui a ete lu :** fiche, categorie (Vlocity CMT), 3 attributs (Vlocity
  CMT), tarification (Pricebook standard + Price List Vlocity CMT), 3
  composants de bundle (Vlocity CMT)
- **Blueprint :** [`reports/blueprint-day-night-tariff.json`](blueprint-day-night-tariff.json)
- Detail : [`reports/decouverte-api-day-night-tariff.md`](decouverte-api-day-night-tariff.md)

## Decouverte IHM

- **Duree :** 78,5 s (inclut une re-authentification complete ; sans elle,
  l'ordre de grandeur reste tout de meme la dizaine de secondes pour la seule
  recherche + ouverture de fiche, sans ouvrir les onglets de detail)
- **Parcours suivi :** vue de liste `AllProducts` -> filtrage par terme -> fiche
- **Ce qui a ete lu :** fiche (code produit, famille), app "Vlocity Product
  Designer", structure en onglets (DETAILS/PRICING/STRUCTURE/ATTACHMENTS/
  ATTRIBUTE RULES/CONTEXT RULES/FULFILLMENT), absence de bandeau d'alerte
- **Ce que l'IHM montre que l'API n'a pas rendu :** l'organisation en onglets
  elle-meme, et la confirmation visuelle qu'aucun bandeau d'erreur n'est
  affiche
- Detail : [`reports/decouverte-ihm-day-night-tariff.md`](decouverte-ihm-day-night-tariff.md)
- Capture : [`reports/screenshots/ihm-day-night-tariff.png`](screenshots/ihm-day-night-tariff.png)

## Comparaison

| Critere | API | IHM |
|---|---|---|
| Duree | 5,5 s | 78,5 s (avec re-auth) / ~15-20 s hors ouverture des onglets de detail |
| Completude (attributs, prix, composants, nommes et types) | Complete, a plat | Partielle sans ouvrir chaque onglet ; feuille de route visuelle presente |
| Resilience a un changement d'ecran | Forte : depend du schema d'objet (stable), pas du rendu | Faible : la fiche n'a pas encore de page object dedie (Regle 3), le texte visible est un filet de secours qui bouge avec le rendu |
| Donnees obtenues qu'aucune des deux methodes n'avait | Aucune : les deux methodes se recoupent sur ce qui a ete lu | — |

## Constat

Sur ce produit precis, dans cet org precis, l'API est environ 14 fois plus
rapide que l'IHM pour obtenir une image structuree et complete du produit
(attributs types, composants nommes, tarification), et le reste sans
degradation si l'ecran Lightning change de mise en page — seul le schema
d'objet compte. L'IHM, en l'etat actuel de ce serveur (pas de page object
dedie a l'app Vlocity Product Designer), rend une vue moins structuree
(texte visible brut) mais apporte deux choses que l'API ne donne pas par
nature : la confirmation visuelle qu'aucune alerte n'est affichee, et
l'organisation en onglets qui refleterait la saisie a reproduire si l'objectif
etait de recreer ce produit a l'ecran plutot que par API.

Le constat de fond de cette demo : **l'objet model reel de ce trial est
Vlocity CMT** (`vlocity_cmt__*`), pas l'objet model standard Salesforce
Industries CPQ suppose au depart — une decouverte qui n'aurait pas ete faite
sans sonder l'org reel (voir `docs/architecture.md`, section "Constate sur le
trial").
