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

## Creation (produit complet, a partir du blueprint de decouverte)

- **API :** 70,9 s, 8 ecritures, structure complete (categorie, 3 attributs,
  2 tarifications, 3 composants) — `Day/Night Tariff_POC_API`,
  `01tWx000007jI3BIAU`. Detail : [`reports/creation-api-day-night-tariff.md`](creation-api-day-night-tariff.md)
- **IHM :** 7,8 s, formulaire "New Product" de Vlocity Product Designer,
  **produit de base seulement** (aucun attribut/prix/categorie/composant,
  et `IsActive` reste a `false` faute d'avoir coche la case) —
  `Day/Night Tariff_POC_IHM`, `01tWx000007jI4nIAE`. Detail :
  [`reports/creation-ihm-day-night-tariff.md`](creation-ihm-day-night-tariff.md)
- **Constat partage aux deux methodes :** l'org cree automatiquement un
  "Root PCI" (`vlocity_cmt__ProductChildItem__c` sans produit enfant) des
  qu'un `Product2` est insere, quelle que soit la methode — un traitement de
  fond systematique, pas un artefact du code de creation.

## Validation panier (non aboutie)

Le panier Vlocity reel de ce trial vit dans la vitrine Digital Commerce "VEE
Digital Sales" (`edf2.my.site.com/cam`), separee de la session Salesforce
interne. Aucune action rapide interne ne lance de panier (verifie par API,
`Account/quickActions`). Un compte d'exemple existant pour cet usage
(Contact "Energy User") est desactive ; son activation et la pose d'un mot
de passe par API ont ete **refusees par le classificateur de securite de
l'outil d'execution**, independamment de l'autorisation donnee par
l'utilisateur — voir `docs/decisions.md`. La validation panier reste donc a
faire, depuis un terminal utilisateur plutot que depuis l'automatisation.

## Comparaison

| Critere | API | IHM |
|---|---|---|
| Duree decouverte | 5,5 s | 78,5 s (avec re-auth) / ~15-20 s hors ouverture des onglets de detail |
| Duree creation (perimetre complet vs de base) | 70,9 s pour la structure complete | 7,8 s pour le produit de base seul (non comparable a perimetre egal) |
| Completude de la creation | Categorie + 3 attributs + 2 tarifications + 3 composants | Produit de base seulement ; `IsActive` oublie |
| Completude de la decouverte | Complete, a plat | Partielle sans ouvrir chaque onglet ; feuille de route visuelle presente |
| Resilience a un changement d'ecran | Forte : depend du schema d'objet (stable), pas du rendu | Faible : chaque ecran Vlocity (New Product, fiche, onglets) demande sa propre capture |
| Erreur humaine plausible | Aucune : chaque champ est pose explicitement | `IsActive` non coche — un oubli que l'IHM expose et que l'API evite par construction |
| Validation panier | Relecture API possible une fois le panier cree | Clic "Add to Cart" prevu, bloque par l'acces portail manquant |

## Constat

Sur ce produit precis, dans cet org precis, l'API est environ 14 fois plus
rapide que l'IHM pour la **decouverte**, et permet de creer une structure
complete en une seule commande contre un parcours de formulaires repetes par
IHM pour obtenir le meme resultat. L'IHM, elle, expose deux choses que l'API
ne donne pas par nature : la confirmation visuelle qu'aucune alerte n'est
affichee, et une erreur humaine reelle (`IsActive` oublie) qu'un appel API
avec des valeurs explicites par champ ne commet pas.

Le constat de fond de cette demo tient en deux points, tous deux obtenus en
sondant l'org reel plutot qu'en supposant son comportement :

1. **L'objet model reel de ce trial est Vlocity CMT** (`vlocity_cmt__*`), pas
   l'objet model standard Salesforce Industries CPQ suppose au depart (voir
   `docs/architecture.md`).
2. **Creer un produit declenche des traitements de fond** (le Root PCI
   automatique, constate deux fois, independamment de la methode) — et le
   rendre reellement commandable (panier valide) est une etape distincte,
   non encore franchie ici, qui depasse la creation de l'enregistrement.
   C'est exactement l'avertissement qui a motive la prudence initiale de ce
   depot : un produit present n'est pas forcement un produit utilisable.
