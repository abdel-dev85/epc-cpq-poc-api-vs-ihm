---
id: decisions
type: reference
title: "Decisions figees pour la demo API vs IHM"
status: active
---

# Decisions

Ce document fige les reponses aux questions qui changent la conception. Une
reponse ecrite ici est une decision prise, pas une hypothese — si elle change,
ce fichier change avec elle, il ne garde pas de trace de l'ancienne reponse.

## Org cible

Le trial Salesforce **"Energy & Utilities Cloud Free Trial - Managed Package
Apps"** (30 jours), cree pour cette demo. `mcp-epc-cpq-agentic` (depot voisin)
continue de cibler `canopee-edf--devlorean.sandbox` pour son propre chantier ;
les deux ne se melangent pas.

**Raison :** le backpromote du socle EPC/CPQ sur le sandbox Canopee prend
plusieurs jours/semaines. Le trial vient preconfigure avec un catalogue
Energy & Utilities Cloud et des donnees d'exemple : il permet de demarrer la
demo sans attendre.

**Consequence :** la variante EPC/CPQ installee (namespace, objets) reste a
etablir par decouverte sur ce trial precis — ce sera le premier livrable de
l'agent de decouverte API, pas une hypothese posee ici.

## Authentification

CLI Salesforce (`sf org login web`), le meme mecanisme sf-cli que documente
dans `mcp-epc-cpq-agentic/docs/exploitation.md`. Interactif, poste de
developpeur.

**Raison :** le trial n'a pas d'Auth Provider Gardian/EDF configure dessus —
c'est un org personnel de trial, pas un org EDF. Le mode `sf-cli` n'exige
aucune saisie une fois l'org authentifiee une fois, et fonctionne identique
pour `mcp-api/` (jeton REST via `sf org display`) et `mcp-ihm/` (frontdoor via
`sf org open --url-only`).

**Consequence :** pas de script Python Gardian dans ce depot. Un seul chemin
d'authentification, dans les deux serveurs.

## Lecture seule ou mutation

**Mutation autorisee, perimetre trial uniquement.** Revision de la decision
initiale (ci-dessous, gardee pour memoire) : une fois la decouverte (lecture
seule) faite et un produit candidat complet identifie (`Day/Night Tariff`),
l'utilisateur a explicitement autorise la creation reelle — "tu as le
controle total ... on est dans un trial, pas de souci tu peux tout faire,
mais documente tout" (confirme le 2026-11-25).

**Perimetre autorise :**

- Creer une variante du produit candidat par **API** (Product2 +
  rattachements `vlocity_cmt__*` : attributs, tarification, categorie,
  composants de bundle), suffixee `_POC_API`.
- Creer la meme offre par **IHM** (pilotage Playwright, clics reels dans
  Lightning / Vlocity Product Designer), suffixee `_POC_IHM`.
- Ajouter le produit resultant a un panier Vlocity, par un clic "Add to
  Cart" dans l'IHM (pas d'insertion directe de `vlocity_cmt__Cart__c` /
  `vlocity_cmt__CartItem__c` par API : Vlocity recalcule prix et regles via
  ses propres services, une insertion brute produirait un panier invalide
  sans le demontrer).
- Relire l'etat obtenu par API apres chaque etape pour constater — jamais se
  fier a un message de succes seul : c'est la convention EDF de ce depot.

**Hors perimetre, meme avec ce controle total :** rien en dehors de ce
produit et de ce panier. Pas de suppression, pas de modification d'un
produit ou d'un panier existant autre que ceux crees par cette demo.

**Extension du 2026-11-25, autorisee mais non executee :** le panier reel de
ce trial vit dans la vitrine Digital Commerce "VEE Digital Sales"
(`edf2.my.site.com/cam`), separee de la session Salesforce interne — aucune
action rapide interne (Account/quickActions, verifie par API) ne lance un
panier. L'atteindre demande un identifiant de portail. L'utilisateur a
autorise explicitement l'activation du compte d'exemple deja present et
desactive (Contact "Energy User", `User` de profil "Energy Self Service
Customer Community User") et la pose d'un mot de passe par API, pour ce seul
usage de connexion a la vitrine.

**Non realise :** l'appel `PATCH /sobjects/User/{id}` (activation) et
`POST /sobjects/User/{id}/password` ont ete **refuses par le classificateur
de securite de l'outil d'execution** (Claude Code), independamment de
l'autorisation donnee dans la conversation — un garde-fou outil, pas une
decision de ce depot. Le compte "Energy User" reste donc desactive, sans mot
de passe pose. Reste a faire si cette validation est reprise : executer ces
deux appels depuis un terminal utilisateur (hors de l'automatisation), ou
accorder une regle de permission explicite.

**Trace :** chaque creation est documentee dans `reports/` (ce qui a ete
cree, par quel moyen, en combien de temps, et le resultat de la relecture),
et `RAPPORT.md` tient le fil de ce qui a ete fait.

**Raison du changement :** l'org est un trial jetable (30 jours, donnees
d'exemple, aucune donnee client reelle) — le risque d'une mutation y est nul
au-dela de "salir" un catalogue de demo. Le constat de Copilot qui a motive
la prudence initiale reste vrai (une mutation mal sequencee laisse un produit
present mais inutilisable en devis) : c'est precisement ce que la validation
panier doit demontrer ou infirmer, pas une raison de ne pas creer.

<details>
<summary>Decision initiale (remplacee, gardee pour memoire)</summary>

**Lecture seule.** Aucun outil MCP de ce depot ne cree, modifie ou supprime
quoi que ce soit dans l'org. La demo "cree un produit de A a Z" demandee au
depart est reduite a : **decouvrir et documenter** un produit existant du
trial, par les deux methodes, et produire un blueprint qui *pourrait* servir a
une creation — sans l'executer.

**Raison :** une mutation sur un catalogue EPC/CPQ (Vlocity) declenche des
traitements de fond (cache, indexation, validations de cardinalite,
propagation d'attributs) ; une creation mal sequencee laisse un produit
present mais non utilisable en devis. Valider cela correctement demande une
sequence d'ecriture, une liste d'operations autorisees et une verification
d'etat par relecture — un chantier a part entiere, pas un prealable a une
demo de comparaison API/IHM.

</details>

## Perimetre des donnees exposees

Le trial contient des donnees d'exemple Salesforce (pas de donnees client
EDF). Les captures d'ecran et rapports generes ne sont pas versionnes par
defaut (`reports/*.md`, `reports/*.json` ignores sauf le gabarit) : un rapport
de demo se partage explicitement s'il doit sortir du poste.
