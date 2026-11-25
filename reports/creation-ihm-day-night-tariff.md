---
id: creation-ihm-day-night-tariff
type: rapport
title: "Creation IHM - Day/Night Tariff_POC_IHM"
status: active
---

# Creation par IHM — Day/Night Tariff_POC_IHM

- **Produit cree :** Day/Night Tariff_POC_IHM (`01tWx000007jI4nIAE`, `PD_DAY_NIGHT_TARIFF_POC_IHM`)
- **Outil :** `epc_ihm_create_product_base`
- **Duree :** 7,8 s
- **Parcours :** `/lightning/o/Product2/new` (formulaire "New Product" de Vlocity
  Product Designer — une page propre a Vlocity, pas la modale Lightning
  standard) -> remplir Name, Product Code, Product Description -> Save

## Ce qui a ete cree

Seul l'enregistrement de base. Relecture par API
(`epc_api_get_product_blueprint`) :

```
IsActive: false     <- la case "Active" n'a pas ete cochee dans le formulaire
Family: null
categories: 0
attributs: 0
tarification: 0
composants: 0 (hors le Root PCI automatique)
```

**`IsActive` est a `false`.** La creation API avait explicitement pose
`IsActive: true` ; la creation IHM a reproduit un oubli plausible — le
formulaire a bien une case "Active" (visible sur la capture de l'ecran de
creation), simplement non cochee ici. C'est exactement le genre d'erreur
humaine qu'un parcours clic-par-clic expose et qu'un appel API avec des
valeurs explicites par champ evite par construction.

**Le meme "Root PCI" automatique que cote API** a ete pose par l'org a la
creation du produit (`vlocity_cmt__ProductChildItem__c` sans
`ChildProductId`, numero de ligne "1"). Deux creations independantes, deux
methodes, le meme comportement de fond — ce n'est donc pas un artefact du
code de creation, c'est un comportement systematique de l'org a la creation
de tout `Product2`.

## Ce qui n'a pas ete reproduit, et pourquoi

Aucun attribut, aucune tarification, aucune categorie, aucun composant de
bundle. Les reproduire par clics demanderait un page object par onglet
(ATTRIBUTE RULES, PRICING, STRUCTURE de la fiche Vlocity Product Designer),
chacun avec son propre formulaire et son propre lookup d'enregistrement
existant (attribut, liste de prix, produit enfant) — non captures dans le
temps de cette demo (Regle 3 du CLAUDE.md : un page object specifique
attend une capture reelle, pas une supposition).

## Comparaison avec la creation API

| | API (`creation-api-day-night-tariff.md`) | IHM |
|---|---|---|
| Duree | 70,9 s (structure complete) | 7,8 s (produit de base seul) |
| Categorie | creee | absente |
| Attributs | 3 crees | 0 |
| Tarification | 2 creees (standard + Vlocity) | 0 |
| Composants | 3 crees + 1 automatique | 0 + 1 automatique |
| `IsActive` | `true` (pose explicitement) | `false` (case oubliee) |

La comparaison brute de duree ("7,8 s contre 70,9 s") serait trompeuse :
l'IHM n'a cree qu'une fraction de ce que l'API a produit. Ramene a
perimetre egal — juste le `Product2` — l'IHM (7,8 s pour naviguer, remplir
trois champs et sauvegarder) n'est pas plus lente que l'insertion API seule
pour ce meme enregistrement. L'ecart se creuse sur tout ce qui suit : l'API
enchaine 7 ecritures supplementaires en quelques secondes chacune, l'IHM
demanderait de repeter un parcours de formulaire complet, avec recherche
d'enregistrement existant, pour chaque attribut et chaque composant.
