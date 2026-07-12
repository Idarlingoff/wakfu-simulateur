# Design — Création de timeline en jouant (fini le formulaire)

**Date :** 2026-07-03
**Branche :** `feat_new-ihm`
**Statut :** validé en brainstorming, prêt pour le plan d'implémentation.

## Contexte & problème

Aujourd'hui, créer une timeline passe par `timeline-form.component.ts` (modale, ~723 lignes) : pour chaque étape on choisit un type d'action, un sort, puis on **tape les coordonnées X/Y à la main sans voir la map**. C'est long, aveugle et rebutant.

Le plan interactif (Freeplay) permet déjà de jouer **visuellement** sur la map (cliquer un sort → cliquer une case → `castSpell(spellId, targetPosition)` / `move(targetPosition, via)`). Ces appels **construisent déjà** un `TimelineAction`/`TimelineStep` (`{ type, spellId, targetPosition }`) mais les **exécutent puis les jettent** — rien n'est accumulé.

## Décision (validée)

**On abandonne le formulaire. On crée les timelines en jouant.**

- Toute session interactive/Freeplay **enregistre** la séquence d'actions jouées (au fil de l'eau).
- Un bouton **« Sauvegarder en timeline »** convertit la séquence enregistrée (+ placement initial des entités + build courant) en `Timeline` sauvegardée.
- Deux points d'entrée, un seul mécanisme :
  1. **« Nouvelle timeline »** — démarre une session propre pour construire « sur commande ».
  2. **« Sauvegarder en timeline »** — disponible dès qu'il y a ≥ 1 action jouée, pour garder après coup une session Freeplay réussie.
- **Visuel/dynamique** : une bande « Timeline en cours » se remplit à chaque action (icône + case cible).
- **Le `timeline-form` est supprimé** (création ET édition par formulaire). Renommer/supprimer une timeline existante reste possible via le sélecteur.

## Non-objectifs

- Pas de fidélité fine des tours (une action = une étape ; « Fin de tour » n'est pas modélisée comme étape dans cette itération — voir Risques).
- Pas d'édition d'une timeline existante action-par-action (on rejoue/réenregistre).
- Aucun changement au moteur de simulation.

## Architecture

```
Session Freeplay/interactive (InteractivePlayService)
  castSpell()/move()  ── construisent un TimelineStep ──▶ recordedSteps (signal, accumulé)
                                                              │
  TimelineRecorderComponent (mode freeplay)  ◀── lit ────────┘
    ├─ bande « Timeline en cours » (recordedSteps)
    ├─ « Sauvegarder en timeline » ─▶ TimelineService.createTimeline(Timeline)
    └─ « Nouvelle timeline »        ─▶ reset session + recordedSteps
```

## Composants / fichiers

| Fichier | Action | Rôle |
|---|---|---|
| `services/interactive-play.service.ts` | **modifier** | Ajouter `recordedSteps = signal<TimelineStep[]>([])` ; `push` le step dans `castSpell()` et `move()` après exécution réussie ; **vider** au démarrage de chaque session (`startInteractive`/`startFreeplay`/`startXelorFreeplay`) et via `resetInteractiveMode()` ; exposer `recordedSteps` (readonly) + `recordedCount` (computed). Ajouter `clearRecording()`. |
| `components/timeline-recorder.component.ts` (+spec) | **créer** | Panneau affiché en **mode freeplay** : bande des `recordedSteps` (numéro + icône type + sort + case cible), bouton **« Sauvegarder en timeline »** (désactivé si 0 action) → demande un nom → construit la `Timeline` et appelle `TimelineService.createTimeline` → vide l'enregistrement + confirme ; bouton **« Nouvelle timeline »** → `resetInteractiveMode()` + `clearRecording()`. |
| `components/dashboard.component.ts` | **modifier** | Afficher `<app-timeline-recorder>` en mode freeplay (`@if (mode() === 'freeplay')`). Retirer l'embed `<app-timeline-form #timelineForm>`, le `@ViewChild('timelineForm')`, l'import, et l'entrée du décorateur. `onCreateTimeline()` (➕ du sélecteur) → `router.navigate(['/freeplay'])`. `onEditTimeline()` (✏️) → renommer via `window.prompt` puis `TimelineService.updateTimeline(id, { name })`. |
| `components/timeline-form.component.ts` | **supprimer** | Plus aucune référence après les changements ci-dessus. |

### Construction de la `Timeline` à la sauvegarde

À « Sauvegarder en timeline » :
- `name` : saisi par l'utilisateur (`window.prompt`, annulation = pas de sauvegarde).
- `buildId` : id du build sélectionné (`BuildService.selectedBuildA()?.id`) ou `''` si Freeplay sans build.
- `steps` : copie de `recordedSteps()` (déjà au format `TimelineStep[]`).
- `boardSetup` : positions/facings actuels des entités du board (via `BoardService`) → `{ entities: [...] }`, pour que la timeline soit rejouable.
- `id : \`timeline_${Date.now()}\``, `createdAt`/`updatedAt`.

## Flux utilisateur

1. Aller sur **Freeplay**, placer ses entités, activer une session (Freeplay / Xel Rouage).
2. Jouer : cliquer un sort → cliquer une case ; chaque action apparaît dans « Timeline en cours ».
3. **« Sauvegarder en timeline »** → nommer → la timeline est créée (visible dans le sélecteur Timeline, rejouable pas-à-pas en mode Timeline).
4. **« Nouvelle timeline »** repart d'une session propre.

## Tests

- `interactive-play.service.spec` : après `startFreeplay`, `recordedSteps()` est vide ; après un `castSpell` (moteur mocké renvoyant un résultat), `recordedSteps()` contient 1 step de type `CastSpell` avec le bon `spellId`/`targetPosition` ; `clearRecording()` vide.
- `timeline-recorder.component.spec` : stub `InteractivePlayService` (avec `recordedSteps` signal) + `TimelineService` + `BuildService` + `BoardService` ; bouton Save désactivé à 0 action ; avec des steps + un nom (prompt mocké), Save appelle `createTimeline` avec `steps`/`buildId` attendus ; « Nouvelle timeline » appelle reset + clear.

## Risques / points de vigilance

- **Tours** : « Fin de tour » n'est pas enregistrée comme étape ici. Si la relecture pas-à-pas doit rejouer les fins de tour, une itération ultérieure ajoutera un marqueur d'étape. MVP : séquence d'actions cast/move.
- **Build associé** : en Freeplay sans build, `buildId` est vide ; la timeline reste sauvegardable mais devra être associée à un build pour être rejouée utilement (à surveiller — éventuellement avertir).
- **`InteractivePlayService`** est volumineux : n'ajouter que l'enregistrement (signal + push + clear), sans toucher à la logique d'exécution.
- **Suppression du form** : vérifier qu'aucune autre partie (hors dashboard) n'importe `TimelineFormComponent`.

## Séquencement suggéré

1. Enregistrement dans `InteractivePlayService` (+ spec).
2. `TimelineRecorderComponent` (+ spec) et affichage en mode freeplay.
3. Retrait du `timeline-form` + recâblage du sélecteur (create→freeplay, edit→rename).

Chaque tâche : TDD quand applicable, `ng build` comme barrière (karma indisponible — pas de Chrome), un commit par tâche, branche `feat_new-ihm`.
