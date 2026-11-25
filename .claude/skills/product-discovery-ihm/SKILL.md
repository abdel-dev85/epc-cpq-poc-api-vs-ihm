---
name: product-discovery-ihm
description: Decouvre un produit EPC/CPQ existant en pilotant l'IHM Lightning (serveur MCP epc-ihm), comme le ferait un utilisateur, et ecrit un rapport chronometre. Usage - "/product-discovery-ihm <nom du produit>".
---

# Decouverte d'un produit par l'IHM

Decouvre un produit existant du trial Energy & Utilities Cloud en pilotant le
navigateur (serveur MCP `epc-ihm`), comme le ferait un utilisateur qui
cherche une fiche. **Ce skill ne cree, ne modifie et ne supprime rien**
(voir `docs/decisions.md` a la racine du depot : ce depot est en lecture
seule).

C'est l'equivalent IHM de `product-discovery-api`, sur le **meme produit** :
la comparaison n'a de sens que si les deux skills documentent la meme fiche.

## Entree

Un nom de produit, passe en argument. S'il manque, le demander.

## Deroule

1. **Verifier la connexion** : appeler `epc_ihm_ping`. Si l'outil echoue, lire
   le message d'erreur — il porte une capture d'ecran de la ou ca a echoue
   (consentement, MFA, splash de release) — et le message nomme la commande
   de remediation si c'est un probleme d'authentification.
2. Chronometrer a partir d'ici.
3. Appeler `epc_ihm_search_record` avec le nom du produit.
   - Si `rows` contient des resultats exploitables, identifier la ligne qui
     correspond au produit et son `recordId` ou son lien.
   - Si seul `visibleText` est rendu (pas de patron `data-label` sur cet
     ecran de resultats), lire ce texte pour y trouver la correspondance —
     ne pas deviner un Id qui n'apparait pas explicitement.
4. Appeler `epc_ihm_read_record` avec l'Id ou le chemin trouve.
5. Si le resultat ne porte que `visibleText` (pas de `dataLabelRows`), le lire
   tel quel : c'est le filet de secours honnete de ce serveur pour un ecran
   non encore capture, pas une absence de donnee. Le rapport doit le dire
   explicitement plutot que presenter ce texte comme une extraction
   structuree.
6. Noter les `messages` releves : un bandeau de validation ou d'etat
   desynchronise compte comme un resultat de la decouverte, pas comme du
   bruit a ignorer.
7. Prendre une capture avec `epc_ihm_screenshot` de la fiche ouverte, pour
   `reports/screenshots/`.

## Sortie

- `reports/screenshots/ihm-<slug-du-produit>.png` — la capture de l'etape 7.
- `reports/decouverte-ihm-<slug-du-produit>.md` — un rapport court :
  - produit (nom, URL/Id trouve, org)
  - duree totale (du premier appel au dernier)
  - parcours suivi (recherche globale -> fiche -> ce qui a ete lu)
  - ce que l'ecran a montre que le rapport API ne contient pas (s'il existe
    deja : messages de validation, mise en page, elements visibles non
    structures) — sinon, le dire aussi : "rien de plus que l'API" est un
    resultat valide.

Ne pas remplir le gabarit de comparaison (`reports/gabarit-rapport.md`) dans
ce skill : il se remplit une fois les deux decouvertes faites sur le meme
produit.

## Ce que ce skill ne fait pas

Il ne clique sur aucun bouton d'action (Nouveau, Modifier, Cloner,
Supprimer) : seule la lecture de ce qui s'affiche est en perimetre. Il ne
devine pas de selecteur specifique a un ecran EPC/CPQ non capture — voir
Regle 3 du `CLAUDE.md` de ce depot.
