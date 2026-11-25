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

## Regle 1 — Lecture seule, strictement

Ce depot **ne mute rien** dans l'org : pas de creation, pas de modification,
pas de suppression de produit, d'attribut, de prix ou de categorie. La
decision est dans `docs/decisions.md` (question mutation) : tant qu'elle n'est
pas changee la, aucun outil MCP n'ecrit dans Salesforce.

Consequence directe sur la demo : on ne "cree pas un produit", on **decouvre
et documente** un produit existant (blueprint JSON + rapport Markdown), comme
si on preparait sa recreation. La creation elle-meme resterait un chantier
separe, avec sa propre decision explicite (liste d'operations autorisees,
simulation par defaut, relecture d'etat apres chaque appel).

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
