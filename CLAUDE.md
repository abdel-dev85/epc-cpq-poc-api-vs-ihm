# Regles de travail sur ce depot

Ce depot est une **demonstration comparative** : decouvrir un produit EPC/CPQ
existant dans un org Salesforce (trial Energy & Utilities Cloud) de deux
manieres — par API et par pilotage de l'IHM — pour comparer vitesse,
robustesse et ce que chaque methode laisse voir. Ce n'est pas un outil de
production, et ce n'est pas un chantier de creation de catalogue.

Ce depot est independant de `mcp-epc-cpq-agentic` (meme auteur, meme
methodologie, org et perimetre differents). Ne pas copier de code depuis ce
depot voisin : s'en inspirer, recrire ici.

## Decisions deja prises — a lire avant tout

`docs/decisions.md` fige les reponses aux questions qui changent la
conception (org cible, authentification, perimetre lecture/mutation). Une
decision qui y est ecrite ne se rediscute pas sans la faire evoluer
explicitement dans ce fichier.

## Regle 1 — Mutation cadree, pas de lecture seule par defaut

La decision initiale ("lecture seule, strictement") a ete revisee le
2026-11-25 : la mutation est autorisee, mais **strictement au perimetre ecrit
dans `docs/decisions.md`** (section "Lecture seule ou mutation") — un produit
candidat, ses deux variantes `_POC_API`/`_POC_IHM`, et le panier qui les
valide. Rien en dehors de ce perimetre ne se cree, ne se modifie, ni ne se
supprime. Toute extension du perimetre se fait en modifiant `docs/decisions.md`
d'abord, pas en l'ecrivant au fil du code.

Deux invariants valent pour toute mutation, independamment du perimetre
autorise :

1. **Un retour d'appel n'est pas une conclusion.** Apres toute ecriture
   (creation, ajout au panier), on relit l'etat par API pour constater —
   jamais se fier a un message de succes seul.
2. **Chaque mutation se documente** dans `reports/` : ce qui a ete cree, par
   quel moyen, en combien de temps, et le resultat de la relecture.

## Regle 2 — IHM ou API : l'arbitrage se fait avant d'ecrire du code

EPC/CPQ a une surface API large. **Toute lecture de donnee de catalogue**
(produit, attributs, categories, tarification) se fait par API — REST,
Tooling, SOQL — jamais par le navigateur, parce que c'est plus rapide, plus
complet et plus stable.

Le pilotage du navigateur (`mcp-ihm/`) ne se justifie que pour **simuler le
parcours d'un utilisateur dans l'IHM** : c'est le point de comparaison de la
demo, pas un moyen alternatif de lire la donnee. `mcp-ihm/` ne doit jamais
devenir un moyen plus pratique d'obtenir une donnee que `mcp-api/` obtiendrait
mieux : si un outil IHM se met a servir de source de verite sur un attribut
ou un prix, c'est un outil API qu'il fallait ecrire.

## Regle 3 — Les selecteurs ne se devinent pas

Avant d'ecrire un page object specifique a un ecran du trial (fiche produit
Vlocity Product Designer, configurateur, panier), il faut une capture reelle
de cet ecran et son `page.content()`, relevees contre l'org trial. Pas de
selecteur suppose a partir d'une documentation Salesforce generique : les
composants EPC/CPQ different d'une release et d'une variante a l'autre.

Les primitives generiques deja eprouvees sur un org Lightning reel
(`records-record-banner`, bandeaux `[role=alert]`, cellules `[data-label]`,
traversee du shadow DOM) peuvent se reprendre sans nouvelle capture : elles ne
sont pas specifiques a un ecran.

## Regle 4 — Invariants d'un serveur MCP stdio

Valables pour `mcp-api/` et `mcp-ihm/` :

1. **Rien sur stdout.** Le debug va dans un fichier, sous drapeau
   d'environnement (`EPC_DEBUG=1`).
2. **`inputSchema` strict** (`z.strictObject`, `additionalProperties: false`)
   et description redigee pour le LLM.
3. **Messages d'erreur qui nomment la commande de remediation.**
4. Pour `mcp-ihm/` specifiquement : mutex sur la page partagee, lazy launch,
   idle timeout, capture d'ecran attachee a toute erreur, attente de
   conditions observables (jamais `waitForTimeout`).

## Regle 5 — Donnees et secrets

- Les fichiers de session (`mcp-ihm/.auth/`) contiennent des jetons vivants :
  jamais dans le depot, jamais dans une reponse.
- Le trial porte des donnees d'exemple (pas de donnees client reelles), mais
  les captures d'ecran et rapports generes restent hors du depot par defaut
  (`reports/*.md` est ignore sauf le gabarit) : un rapport de demo se partage
  explicitement, il ne se commite pas par defaut.
- Pas de nom d'org trial personnel ni d'identifiant en dur dans le code :
  `.env` local, non versionne.

## Conventions de redaction

- Documents et commits en francais. Conventional Commits, avec la ligne
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- Les documents disent l'etat des choses et les decisions prises, pas un
  journal de session.
