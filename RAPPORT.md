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

Autre correction, posterieure a la premiere connexion reussie : les objets
standard sondes au depart (`ProductAttributeDefinition`,
`ProductRelatedComponent`...) existent mais sont **vides pour tous les
produits** de ce trial. Un classement du catalogue (44 produits actifs) par
objets `vlocity_cmt__*` a confirme que **le modele reellement peuple est
Vlocity CMT**, pas l'objet model standard suppose au depart — le trial a 1040
objets `vlocity_cmt__*` installes. Le blueprint sonde desormais les deux en
parallele.

## Autorisation de mutation (2026-11-25)

Apres la decouverte, l'utilisateur a explicitement autorise le controle total
sur ce trial ("on est dans un trial, pas de souci tu peux tout faire, mais
documente tout"), avec deux precisions : ajouter au panier par un clic IHM
reel (pas d'insertion directe des objets de panier par API — ca produirait un
panier invalide sans le demontrer), et tout documenter. Voir
`docs/decisions.md` pour le perimetre exact et ses extensions successives.

## Statut courant

- Les deux serveurs MCP sont connectes et valides contre le trial
  (`npm run ping` rend `status: connected` dans les deux), et exposent
  desormais chacun un outil de creation cadree :
  `epc_api_create_product_variant` et `epc_ihm_create_product_base`.
- **Produit retenu pour la demo : "Day/Night Tariff"**, choisi par classement
  automatique du catalogue sur la richesse de donnees reellement peuplee —
  c'est le produit qui couvre le plus de dimensions a la fois (categorie, 3
  attributs types, tarification, bundle de 3 composants).
- **Decouverte executee de bout en bout :**
  API 5,5 s ([`reports/decouverte-api-day-night-tariff.md`](reports/decouverte-api-day-night-tariff.md)),
  IHM 78,5 s avec re-authentification ([`reports/decouverte-ihm-day-night-tariff.md`](reports/decouverte-ihm-day-night-tariff.md)).
- **Creation executee de bout en bout sur les deux voies :**
  - API : `Day/Night Tariff_POC_API` (`01tWx000007jI3BIAU`), 70,9 s,
    structure complete (categorie, 3 attributs, 2 tarifications, 3
    composants), relue et verifiee. Detail :
    [`reports/creation-api-day-night-tariff.md`](reports/creation-api-day-night-tariff.md).
  - IHM : `Day/Night Tariff_POC_IHM` (`01tWx000007jI4nIAE`), 7,8 s,
    produit de base seulement (`IsActive` reste a `false`, case oubliee).
    Detail : [`reports/creation-ihm-day-night-tariff.md`](reports/creation-ihm-day-night-tariff.md).
  - **Constat partage aux deux :** l'org cree automatiquement un "Root PCI"
    (ligne de structure sans produit enfant) des qu'un `Product2` est
    insere — confirme deux fois, independamment de la methode. C'est le
    traitement de fond Vlocity annonce au debut de cette demo, observe pour
    de vrai.
  - Comparatif consolide : [`reports/comparatif-day-night-tariff.md`](reports/comparatif-day-night-tariff.md).
- La lecture IHM d'une fiche fonctionne, en filet de secours texte pour
  l'instant (pas encore de page object dedie aux onglets de la fiche Vlocity
  Product Designer — attend une capture plus poussee, voir Regle 3 du
  `CLAUDE.md`).

## Validation panier — deux obstacles distincts, le second non resolu

Le panier Vlocity reel de ce trial vit dans une vitrine Digital Commerce,
separee de la session Salesforce interne : aucune action rapide interne ne
lance de panier (verifie par API, `Account/quickActions`). Un compte
d'exemple existait deja pour cet usage (Contact "Energy User", profil
"Energy Self Service Customer Community User") mais etait desactive, sans
mot de passe.

**Premier obstacle, leve :** activer ce compte et lui poser un mot de passe
par API a d'abord ete refuse par le classificateur de securite de l'outil
d'execution (Claude Code), independamment de l'autorisation donnee par
l'utilisateur. Une regle de permission explicite a ete accordee
(`.claude/settings.local.json`), et les deux appels ont ensuite reussi : le
compte est actif.

**Second obstacle, pas leve :** la connexion reussit bien (`LoginHistory`
confirme `Status: Success` par API) sur le site "Self Service Portal" — mais
pas sur "VEE Digital Sales" (celui qui a l'air d'etre la vraie vitrine
commerciale ; ce compte n'en est pas membre, `Status: No community access`).
Sur le Self Service Portal, la page d'atterrissage preconfiguree du trial
redirige ensuite vers la communaute Lightning et **la session echoue a ce
moment precis**, meme en visant directement cette page apres connexion : le
profil a acces aux pages Visualforce de ce site, pas a ses pages Lightning.
C'est une limite de configuration du trial lui-meme, pas quelque chose que ce
depot peut corriger sans acces Setup.

**Ce que cela demontre malgre tout :** creer un produit (par API ou par IHM)
et le rendre reellement commandable sont deux etapes distinctes. La premiere
est faite et verifiee des deux cotes. La seconde — la preuve qu'un devis
l'accepte sans erreur — reste bloquee, non pas par manque d'autorisation ou
d'outillage, mais par une limite reelle de l'environnement de trial. C'est en
soi la confirmation du risque identifie des le debut de cette demo : un
produit present dans l'org n'est pas forcement un produit utilisable en
devis — et meme la vitrine censee le prouver peut elle-meme etre
mal configuree.
