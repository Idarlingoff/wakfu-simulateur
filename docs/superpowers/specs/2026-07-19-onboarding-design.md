# Onboarding — visite guidée des nouveaux arrivants

**Date :** 2026-07-19
**Statut :** validé, prêt pour plan d'implémentation
**Périmètre :** frontend uniquement (Angular)

---

## Problème

L'accueil présente cinq cartes à plat — Builds, Timelines, Freeplay, Résultats,
Comparaison — comme si l'ordre n'avait pas d'importance. Il en a une : sans build muni de
sorts, Timelines et Résultats n'affichent rien d'exploitable. Rien ne signale cette
dépendance, et un nouvel arrivant peut donc commencer par l'écran qui ne lui montrera rien.

## Objectif

Une visite guidée interactive qui apprend **où cliquer**, déclenchée au premier passage et
rejouable à volonté.

## Public

Un joueur de Wakfu qui connaît déjà les sorts, les PA/PM/PW et sa classe. On explique
l'outil, pas le jeu. Aucune définition de mécanique de combat dans les textes d'étapes.

## Hors périmètre

- L'écran **Comparaison**. C'est aujourd'hui un `PlaceholderPageComponent` affichant
  « arrive dans une prochaine étape ». Y envoyer un nouvel arrivant détruirait la confiance
  que la visite vient d'établir.
- Toute pédagogie de theorycrafting (ce qu'est une maîtrise, comment optimiser un combo).
- La persistance de l'état « visite vue » côté compte. L'application s'utilise sans être
  connecté, et ce sont précisément les visiteurs non connectés qu'il faut accueillir.

---

## Architecture

Trois unités, chacune testable indépendamment.

### 1. `TourService` — la progression

Les étapes sont des **données**, pas du code :

```ts
interface TourStep {
  id: string;
  route: string;    // '/builds/nouveau'
  target: string;   // '[data-tour="deck-code"]'
  title: string;
  body: string;
  placement: 'top' | 'bottom' | 'left' | 'right';
}
```

Le service expose `active` et `stepIndex` en signaux, plus `start()`, `next()`,
`previous()`, `skip()` et `finish()`. Quand l'étape courante change, il navigue lui-même
vers `step.route`.

**Abandon par navigation.** Le service observe les changements de route. Si la route
devient différente de celle de l'étape courante alors que ce n'est pas lui qui vient de
naviguer, l'utilisateur est parti ailleurs de son propre chef : la visite se termine et la
clé de persistance est posée. Le suivi se fait par un drapeau interne levé le temps de la
navigation pilotée, plutôt qu'en comparant des URL — comparer laisserait les redirections
et les paramètres de requête fausser la détection.

**Ciblage par attribut `data-tour`, jamais par classe CSS.** Une classe comme `.deck-input`
peut être renommée au cours d'un restylage sans que personne ne pense à la visite ;
`data-tour="deck-code"` est un contrat explicite qu'on ne casse pas par accident. Chaque
élément visé reçoit cet attribut dans son composant.

### 2. `TourOverlayComponent` — l'affichage

Monté une seule fois dans la coquille de l'application, afin de survivre aux changements
de route. Il lit la position de la cible via `getBoundingClientRect()`, découpe un trou
dans le voile avec `clip-path`, et ancre la bulle selon `placement`.

**Semi-bloquant :** le voile intercepte les clics partout **sauf** sur la zone mise en
avant, qui reste utilisable. `Échap` et le bouton « Passer » quittent à tout moment.

**Cible absente.** L'élément peut ne pas être rendu — écran étroit, chargement asynchrone
en cours, composant conditionnel. C'est le mode de défaillance le plus courant d'une visite
guidée ; il se conçoit plutôt qu'il ne se découvre. Repli : la bulle se centre à l'écran
sans surbrillance et la visite continue. Jamais d'erreur, jamais de blocage.

### 3. `DemoDataService` — les données de démonstration

Un build Xélor niveau 200 nommé « Build de démo », rempli à partir du code deck de
référence, et une timeline de trois actions.

Ces objets portent un identifiant réservé, `__demo__`, et ne sont **jamais écrits**.
`BuildService.allBuilds` et `TimelineService.allTimelines` deviennent des superpositions :

```ts
public allBuilds = computed(() =>
  this.demo.active() ? [this.demo.build(), ...this.builds()] : this.builds(),
);
```

Conséquence recherchée : le nettoyage se réduit à repasser `active` à `false`. Si
l'utilisateur ferme l'onglet au milieu de la visite, la démonstration disparaît par
construction — il n'y a rien à nettoyer, donc rien qui puisse échouer.

**Écritures refusées.** `updateBuild`, `deleteBuild`, `updateTimeline` et `deleteTimeline`
retournent immédiatement `false` sur un identifiant `__demo__`, sans toucher au stockage.

**Actions masquées.** Tant que la visite est active, la carte du build de démo n'affiche ni
« Modifier » ni « Supprimer ». Ouvrir l'éditeur sur un build absent du stockage mènerait à
un écran incohérent ; l'interdire est plus simple et plus honnête que de le rattraper.

### Pourquoi cette approche plutôt qu'écrire puis supprimer

Créer un vrai build via `createBuild` puis le supprimer en fin de parcours est la lecture
littérale de « données temporaires », et c'est un piège. `BuildService.createBuild` passe
par `WakfuApiService`, qui écrit dans le localStorage si l'utilisateur est invité et **dans
Supabase s'il est connecté**. Un abandon en cours de visite laisserait un build orphelin
sur le compte, et la suppression échoue en silence via `saveError.reportFailure()`.

### Pourquoi l'écran Résultats ne demande aucun traitement particulier

`damage-summary.component.ts` dérive son affichage de `timelineService.currentTimeline()`,
de `buildService` et de `simulationService`. Dès lors que le build et la timeline de démo
sont visibles à travers les superpositions, l'écran Résultats se remplit de lui-même.
Aucun troisième réservoir de données à truquer.

---

## Le parcours

Cinq étapes. Le taux d'abandon d'une visite guidée grimpe fortement au-delà de quatre ou
cinq étapes ; couvrir chaque écran coûterait plus d'abandons que cela n'apporterait de
compréhension.

| # | Écran | Cible | Message |
| --- | --- | --- | --- |
| 1 | Accueil | Cartes de navigation | L'ordre à suivre : un build d'abord, le reste en découle |
| 2 | Builds | Bouton « Nouveau build » | C'est ici que vivent tes personnages |
| 3 | Éditeur | Carte « Code deck » | Colle ton code deck du jeu : sorts et passifs se remplissent d'un coup |
| 4 | Timelines | Zone de composition | Enchaîne des actions pour construire un tour |
| 5 | Résultats | Résumé des dégâts | Lis ce que ton tour a produit |

La dernière étape mentionne Freeplay en une phrase, sans y naviguer.

---

## Déclenchement et persistance

`localStorage['wakfu-onboarding-vu']`. Au premier chargement de l'accueil, si la clé est
absente, la visite démarre seule. Un bouton d'aide permanent dans l'en-tête la relance.

La clé est posée aussi bien à la fin qu'au « Passer ». Quelqu'un qui passe a exprimé un
choix ; le lui redemander à chaque visite serait du harcèlement.

---

## Gestion des erreurs

| Cas | Comportement |
| --- | --- |
| Cible introuvable dans le DOM | Bulle centrée, pas de surbrillance, la visite continue |
| `localStorage` indisponible | La visite ne démarre pas seule ; le bouton d'aide reste actif |
| Navigation vers une route hors parcours | La visite se termine, la clé est posée |
| Écriture tentée sur un objet `__demo__` | Refusée, aucun accès au stockage |
| Visite interrompue (onglet fermé, rechargement) | Rien à nettoyer, la superposition n'existe qu'en mémoire |

---

## Tests

**`tour.service.spec.ts`**

- Progression avant et arrière ; `next` sur la dernière étape termine la visite.
- Le changement d'étape déclenche la navigation vers `step.route`.
- `skip()` et `finish()` posent tous deux la clé de persistance.
- `start()` remet l'index à zéro lors d'une relecture.

**`demo-data.service.spec.ts`**

- Visite active : le build de démo apparaît en tête de `allBuilds`, la timeline dans
  `allTimelines`.
- Visite inactive : les deux listes sont strictement identiques aux données réelles.
- `updateBuild('__demo__', …)` et `deleteBuild('__demo__')` retournent `false` sans appeler
  `WakfuApiService`.

**`tour-overlay.component.spec.ts`**

- Cible présente : la bulle se positionne d'après le rectangle de l'élément.
- Cible absente : repli centré, aucune erreur levée, l'étape reste franchissable.
- `Échap` termine la visite.

**Non-régression**

- `BuildService.allBuilds` et `TimelineService.allTimelines` sont inchangés quand la visite
  est inactive.

Note : `ng test` exige `CHROME_BIN`. Le chemin littéral est
`/Users/lilia/.cache/puppeteer/chrome-headless-shell/mac_arm-150.0.7871.24/chrome-headless-shell-mac-arm64/chrome-headless-shell`
— `require('puppeteer')` ne se résout pas dans ce dépôt.

---

## Fichiers touchés

| Fichier | Nature |
| --- | --- |
| `frontend/src/app/services/tour.service.ts` | créé |
| `frontend/src/app/services/tour.service.spec.ts` | créé |
| `frontend/src/app/services/demo-data.service.ts` | créé |
| `frontend/src/app/services/demo-data.service.spec.ts` | créé |
| `frontend/src/app/components/tour-overlay.component.ts` | créé |
| `frontend/src/app/components/tour-overlay.component.spec.ts` | créé |
| `frontend/src/app/utils/tour-steps.ts` | créé — les cinq étapes en données |
| `frontend/src/app/services/build.service.ts` | modifié — superposition + refus d'écriture |
| `frontend/src/app/services/timeline.service.ts` | modifié — superposition + refus d'écriture |
| `frontend/src/app/layout/app-shell.component.ts` | modifié — montage de l'overlay, bouton d'aide |
| `frontend/src/app/pages/home.component.ts` | modifié — `data-tour` + démarrage au 1er passage |
| `frontend/src/app/pages/builds-list.component.ts` | modifié — `data-tour`, actions masquées sur la démo |
| `frontend/src/app/pages/build-editor.component.ts` | modifié — `data-tour` sur la carte Code deck |
| `frontend/src/app/pages/timeline-page.component.ts` | modifié — `data-tour` |
| `frontend/src/app/pages/resultats-page.component.ts` | modifié — `data-tour` |
