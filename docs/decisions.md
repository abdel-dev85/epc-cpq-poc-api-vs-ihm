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

**Consequence :** si la creation effective entre un jour au perimetre, elle
reprend ce document avec une nouvelle section : liste d'operations autorisees,
mode simulation par defaut, et une trace de chaque appel. D'ici la, tout outil
d'ecriture est hors de ce depot.

## Perimetre des donnees exposees

Le trial contient des donnees d'exemple Salesforce (pas de donnees client
EDF). Les captures d'ecran et rapports generes ne sont pas versionnes par
defaut (`reports/*.md`, `reports/*.json` ignores sauf le gabarit) : un rapport
de demo se partage explicitement s'il doit sortir du poste.
