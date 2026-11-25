---
id: rapport
type: compte-rendu
title: "Ce qui a ete fait sur cette demo"
status: active
---

# Rapport — demo agentique EPC/CPQ, API vs IHM

Ce document raconte la demarche et ce qui a ete construit et constate, pour
qui n'a pas suivi la conversation qui l'a produit. Contrairement aux autres
documents de ce depot (`docs/decisions.md`, `docs/architecture.md`), qui
disent l'etat actuel, celui-ci garde la trace du cheminement : c'est la
version destinee a etre montree.

## Le contexte

L'equipe doit demontrer une approche agentique (Claude + MCP) sur Salesforce
EPC/CPQ (Energy & Utilities Cloud), et comparer deux facons de piloter
l'agent : par **API** et par **pilotage de l'IHM** (robotique navigateur).
Un sandbox EDF existe mais son backpromote du socle EPC/CPQ (objets,
attributs, catalogue) prend plusieurs jours/semaines — trop long pour une
demo. Un **trial Salesforce "Energy & Utilities Cloud Free Trial - Managed
Package Apps"** (30 jours, catalogue d'exemple preconfigure) a ete choisi
pour demarrer sans attendre.

Decision volontaire prise au depart : ne pas se contenter d'un clone de
produit. L'objectif est de **simuler la decouverte et la (re)creation d'un
produit comme si c'etait la premiere fois**, en prenant un produit existant
comme documentation de reference — ce qui est plus credible devant des
architectes Salesforce Industries qu'un simple clone de Product2.

## Ce qui a ete decide avant d'ecrire du code

Quatre questions ont ete tranchees avant toute ligne de code (methode reprise
du depot voisin `mcp-epc-cpq-agentic`, qui impose cette discipline) :

| Question | Reponse |
|---|---|
| Depot | Nouveau depot independant, pas une extension de `mcp-epc-cpq-agentic` |
| Org cible | Le trial E&U Cloud uniquement (le sandbox EDF reste un chantier separe) |
| Authentification | CLI Salesforce (`sf org login web`), pas de SSO Gardian sur un trial personnel |
| Mutation | Lecture seule au depart — voir plus bas, cette reponse a ete revisee |

Detail et raisons : [`docs/decisions.md`](docs/decisions.md).

## Ce qui a ete construit

Deux serveurs MCP independants, chacun avec son propre `package.json` :

- **`mcp-api/`** — client REST Salesforce minimal (sans jsforce), jeton
  obtenu via `sf org display`. Outils : `ping`, `describe_object`,
  `search_product`, `get_product_blueprint`, `run_soql` (garde-fou
  SELECT uniquement).
- **`mcp-ihm/`** — pilotage Playwright de Lightning, authentification par
  frontdoor CLI. Outils : `ping`, `screenshot`, `search_record` (vue de
  liste filtree), `read_record` (lecture generique d'une fiche).

Plus deux skills Claude Code (`.claude/skills/`) qui orchestrent chacun un
des deux serveurs sur le meme produit, chronometrent, et ecrivent un rapport
dans `reports/`.

La plomberie (gestion du navigateur, mutex, authentification, lecture
generique du shadow DOM) est reprise du depot voisin, deja eprouvee sur un
org Salesforce reel, et adaptee a ce trial — pas reinventee.

## Ce qui a ete constate en le faisant tourner pour de vrai

Le jalon methodologique applique partout dans ce depot : **on ne declare rien
qui marche sans l'avoir fait tourner contre l'org reel**. Quatre defauts
reels ont ete trouves de cette facon, et corriges :

1. **Collision de nom de variable d'environnement.** `SF_API_VERSION` etait
   lue a la fois par ce serveur (format `v68.0`) et par le CLI Salesforce
   lui-meme (format `68.0`) — la collision faisait echouer l'authentification
   CLI. Renommee `EPC_API_VERSION`.
2. **Le `fetch` global de Node n'utilise pas le proxy EDF** pose via
   `setGlobalDispatcher()` du paquet `undici` : deux instances d'`undici`
   coexistent (celle de Node, celle du paquet npm), et les appels REST
   tentaient une connexion directe, bloquee par le reseau EDF. Remplace par
   un appel `undici.request()` avec un `ProxyAgent` explicite.
3. **Deux champs SOQL supposes universels n'existent pas sur cette
   edition** du trial (`ProductCategoryProduct.IsPrimaryCategory`,
   `PricebookEntry.CurrencyIsoCode` — pas de multi-devise active). Le
   blueprint degradait la section entiere en echec. Corrige par un mecanisme
   de repli : un champ invalide signale par l'erreur SOQL de Salesforce est
   retire, la requete est retentee, et l'omission est tracee plutot que tue.
4. **La recherche globale Lightning de ce trial n'est pas la recherche
   standard.** Elle ouvre une page d'accueil specifique a l'onboarding du
   trial (widget `splashPage-*`), pas `.slds-global-header`. Conformement a
   la regle de ce depot (pas de selecteur devine, on capture le DOM reel
   avant d'ecrire un page object), l'outil `search_record` a ete reecrit pour
   s'appuyer sur la **vue de liste** — un patron deja valide sur un org reel
   par le depot voisin — plutot que de deviner un nouveau selecteur.

Un constat produit, pas une hypothese : la fiche produit Lightning de ce
trial s'ouvre dans l'app **"Vlocity Product Designer"**, avec des onglets
DETAILS / PRICING / STRUCTURE / ATTACHMENTS / ATTRIBUTE RULES / CONTEXT
RULES / FULFILLMENT. C'est precisement le genre d'information que la lecture
IHM donne et que l'API ne rend pas sous cette forme — la comparaison que
cette demo est censee faire.

## Statut courant

- Les deux serveurs MCP sont connectes et valides contre le trial
  (`npm run ping` rend `status: connected` dans les deux).
- Le blueprint API a ete valide sur un vrai produit (`Solar Panel Starter
  kit`) : fiche, tarification lues, attributs/categories/composants absents
  pour ce produit precis (pas une erreur — ce produit n'en a pas).
- La lecture IHM d'une fiche fonctionne, en filet de secours texte pour
  l'instant (pas encore de page object dedie a l'app Vlocity Product
  Designer — attend une capture plus poussee, voir Regle 3 du `CLAUDE.md`).

## Et apres : la validation panier (Vlocity cart)

Aller jusqu'a la validation dans le panier Vlocity CPQ (ajouter le produit,
constater qu'il s'y configure sans erreur) **sort du perimetre "lecture
seule" initial** : ajouter un produit a un panier cree au minimum un devis ou
une commande brouillon dans l'org. Si cette etape est engagee, elle reprend
`docs/decisions.md` avec une liste d'operations explicitement autorisees
(creer un panier, y ajouter une ligne — rien d'autre), et applique la
convention EDF du depot : un retour d'appel n'est pas une conclusion, on
relit l'etat du panier pour constater qu'il est valide.
