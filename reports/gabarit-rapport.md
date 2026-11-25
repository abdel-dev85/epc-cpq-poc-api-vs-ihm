---
id: gabarit-rapport
type: gabarit
title: "Gabarit de rapport comparatif API vs IHM"
status: active
---

# Rapport comparatif — [nom du produit]

## Produit source

- **Nom :** …
- **Id :** …
- **Org :** trial Energy & Utilities Cloud
- **Date :** …

## Decouverte API

- **Duree :** … s
- **Outils appeles :** …
- **Ce qui a ete lu :** fiche produit / attributs / tarification / categories
  / regles (rayer ce qui ne s'applique pas, avec le nom d'objet reel trouve
  sur l'org)
- **Blueprint :** `reports/blueprint-<produit>.json`

## Decouverte IHM

- **Duree :** … s
- **Parcours suivi :** vue de liste -> fiche -> onglets ouverts
- **Ce qui a ete lu :** …
- **Ce que l'IHM montre que l'API n'a pas rendu :** … (messages de validation,
  options grisees, mise en page — ou "rien" si c'est le cas)
- **Captures :** `reports/screenshots/…`

## Comparaison

| Critere | API | IHM |
|---|---|---|
| Duree | | |
| Completude (vs. ce qui existe reellement sur la fiche) | | |
| Resilience a un changement d'ecran | | |
| Donnees obtenues qu'aucune des deux methodes n'avait | | |

## Constat

[Une conclusion factuelle, pas un chiffre de style : qu'est-ce que chaque
methode a effectivement permis, pour ce produit precis, dans cet org precis.]
