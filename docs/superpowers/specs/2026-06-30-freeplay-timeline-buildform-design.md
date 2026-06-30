# Design — Écrans Timeline/Freeplay distincts & éditeur de build plein écran

**Date :** 2026-06-30
**Branche :** `feat_new-ihm`
**Statut :** validé en brainstorming, prêt pour le plan d'implémentation.

## Contexte

Suite de la refonte UI (thème + coquille + écran Builds déjà livrés). Trois besoins exprimés :

1. **Écran Freeplay** : ne doit PAS afficher les boutons de simulation timeline (Lancer la simulation / Étape précédente / Étape suivante / Fin de tour / Réinitialiser). La gestion de tour du freeplay se fait déjà dans la session interactive (Freeplay Xel Rouage).
2. **Écran Timeline** : ne doit PAS afficher les boutons Freeplay.
3. **Écran Build** : refonte complète de l'interface de création/édition de build (actuellement une modale faite « à la va-vite »).

État actuel (constaté) :
- `/timelines` et `/freeplay` rendent le **même** `WorkspacePageComponent` → `<app-dashboard>` ; le dashboard ignore la route.
- **Tous** les boutons concernés vivent dans `board.component.ts`, proprement séparés en deux blocs : `.board-controls` (contrôles de simulation) et `.interactive-bar` (Freeplay sans build / Freeplay Xel Rouage + session interactive). Le board n'a aucun `@Input`.
- La création/édition de build se fait dans `BuildFormComponent` (modale), embarquée à la fois par `builds-list.component.ts` (écran Builds) et par `dashboard.component.ts` (menu déroulant « BUILD » de l'espace de travail).

## Décisions de conception (validées)

- **Différenciation Timeline/Freeplay : niveau 1** — en-tête identitaire (icône + titre + sous-titre) + boutons propres à chaque écran. **Accent violet partagé** (pas de couleur d'accent distincte par écran).
- **Éditeur de build : écran dédié plein écran** (pas une modale), mise en page **deux colonnes avec résumé live** (form à gauche, résumé sticky à droite).
- **Menu « BUILD » du dashboard** : « créer » / « éditer » **naviguent vers l'éditeur** plein écran puis reviennent ; le menu conserve la **sélection rapide** d'un build existant.

## Non-objectifs (hors périmètre)

- Aucune modification de la logique de simulation, du moteur, ni du rendu de jeu du board (cellules, entités, portées).
- Pas de système d'équipement : les stats restent en **saisie manuelle**.
- Écran Comparaison inchangé.
- Pas de refonte interne des sélecteurs sorts/passifs/sublimations (réutilisés tels quels).

---

## Partie A — Split Timeline / Freeplay

### Architecture

```
/timelines → TimelinePageComponent → en-tête "Timeline"  + <app-dashboard mode="timeline">
/freeplay  → FreeplayPageComponent → en-tête "Freeplay" + <app-dashboard mode="freeplay">
                                                 │
                                                 └─ <app-board [mode]="mode()">
```

Le `mode` (`'timeline' | 'freeplay'`) descend `page → dashboard → board` via des `input()`.

### Composants

| Fichier | Action | Rôle |
|---|---|---|
| `pages/timeline-page.component.ts` (+spec) | **créer** | En-tête identitaire Timeline + `<app-dashboard mode="timeline">`. |
| `pages/freeplay-page.component.ts` (+spec) | **créer** | En-tête identitaire Freeplay + `<app-dashboard mode="freeplay">`. |
| `pages/workspace-page.component.ts` | **supprimer** | Remplacé par les deux pages ci-dessus. |
| `app.routes.ts` | **modifier** | `timelines → TimelinePageComponent`, `freeplay → FreeplayPageComponent`. |
| `components/dashboard.component.ts` | **modifier** | Ajouter `mode = input<'timeline'\|'freeplay'>('timeline')` ; passer `[mode]="mode()"` à `<app-board>`. |
| `components/board.component.ts` | **modifier** | Ajouter `mode = input<'timeline'\|'freeplay'>('timeline')` ; `@if (mode()==='timeline')` autour de `.board-controls` ; `@if (mode()==='freeplay')` autour de `.interactive-bar` **et** des contrôles de session interactive (fin de tour / réinitialiser / passifs de la session). |

### En-tête identitaire (dans chaque page)

- **Timeline** : icône `clock` (`ui-icon`), titre « Timeline », sous-titre « Compose une suite d'actions et déroule la simulation. »
- **Freeplay** : icône `play`, titre « Freeplay », sous-titre « Teste librement sur la map, sans timeline. »
- Style tokenisé (`--app-*`), accent violet. L'en-tête se place au-dessus de `<app-dashboard>`.

### Comportement

- **Mode timeline** : `.board-controls` visibles (Lancer / Étape ◀ / Étape ▶ / Fin de tour / Réinitialiser) ; `.interactive-bar` masquée.
- **Mode freeplay** : `.interactive-bar` visible (Freeplay sans build / Freeplay Xel Rouage + session interactive) ; `.board-controls` masqués.
- **Aucune méthode de simulation modifiée** : on n'ajoute que des `@if` et un `input`. Les `onRunFull/onNextStep/onPreviousStep/onReset/...` restent intacts (simplement non déclenchables depuis le mode qui masque leur bouton).

### Risques / points de vigilance

- Le bloc « session interactive » du board (2ᵉ jeu de boutons : fin de tour, réinitialiser, badge passifs) appartient au **freeplay** → doit être sous le `@if(mode==='freeplay')`. À vérifier précisément à l'implémentation (placement exact des `@if` dans le template du board).
- Les sélecteurs « BUILD » / « TIMELINE » et le menu « Action » de l'en-tête du dashboard restent inchangés et présents dans les deux modes (le besoin ne portait que sur les boutons du board).

### Tests

- `timeline-page.spec` / `freeplay-page.spec` : rend l'en-tête (titre attendu) + un `<app-dashboard>` ; vérifie le `mode` passé.
- `board.spec` (créer si absent) : `mode='timeline'` → `.board-controls` présent, `.interactive-bar` absent ; `mode='freeplay'` → l'inverse. (Stubber les services lourds injectés par le board comme pour `builds-list`.)

---

## Partie B — Éditeur de build plein écran

### Architecture

```
/builds              → BuildsListComponent (grille ; "Nouveau"/"Modifier" naviguent vers l'éditeur)
/builds/nouveau      → BuildEditorComponent (mode création)
/builds/:id/edition  → BuildEditorComponent (mode édition)
```

### Composants

| Fichier | Action | Rôle |
|---|---|---|
| `pages/build-editor.component.ts` (+spec) | **créer** | Éditeur plein écran deux colonnes. |
| `app.routes.ts` | **modifier** | Ajouter `builds/nouveau` et `builds/:id/edition` → `BuildEditorComponent`. |
| `pages/builds-list.component.ts` (+spec) | **modifier** | Retirer l'embed `<app-build-form>` + le `viewChild` ; `createBuild()` → `router.navigate(['/builds/nouveau'])` ; `editBuild(b)` → `router.navigate(['/builds', b.id, 'edition'])`. |
| `components/dashboard.component.ts` | **modifier** | Menu « BUILD » : créer/éditer → `router.navigate` vers l'éditeur ; retirer l'embed `<app-build-form>` + `viewChild buildForm` + les appels `openNew/openEdit`. Conserver la sélection rapide. (`<app-timeline-form>` reste inchangé.) |
| `components/build-form.component.ts` (+spec) | **supprimer** | Plus aucune référence après les modifications ci-dessus. |

### Mise en page (option C — deux colonnes)

- **Colonne gauche (défile)**, sections empilées :
  1. **Identité** : Nom *, Classe * (select), Niveau * (select), Description.
  2. **Sorts** : `<app-spell-selector>` (mêmes `input`/`output` qu'aujourd'hui).
  3. **Passifs** : `<app-passive-selector>`.
  4. **Sublimations** : `<app-sublimation-selector>`.
  5. **Stats**, regroupées en 4 sous-sections :
     - *Maîtrises élémentaires* : Feu, Eau, Terre, Air.
     - *Offensif* : Dégâts infligés, Taux de critique (%), Maîtrise critique, Maîtrise secondaire, Maîtrise dos.
     - *Défense* : Résistance.
     - *Ressources & portée* : PA, PM, PW, Portée.
- **Colonne droite (sticky)** : **Résumé live** mis à jour en continu — nom du build, classe, niveau, PA/PM/PW, maîtrises élémentaires clés — + boutons **Enregistrer** / **Annuler**.
- Responsive : sous une largeur seuil, la colonne droite passe sous la gauche (empilement). Style tokenisé.

### Logique

- Injecte `ActivatedRoute` (lecture `:id`), `BuildService`, `Router` + `Location`.
- **Init** : si `:id` présent → `BuildService.getBuildById(id)` ; si introuvable → redirige vers `/builds`. Sinon → build vierge (valeurs par défaut, mêmes que l'ancien `openNew`).
- **État du formulaire** : objet `form` reprenant celui de `BuildFormComponent` (`name`, `classId`, `characterLevel`, `description`, `spells`, `passives`, `sublimations`, `stats{…}`). Le résumé live est `computed` à partir de cet état.
- **Enregistrer** : porte la logique existante de `BuildFormComponent.onSubmit` — `removeInnateSpellsFromSelection(classId, spells)` puis `createBuild` (id `build_${Date.now()}`) en création ou `updateBuild(id, …)` en édition. Puis retour (`Location.back()`, repli `/builds`).
- **Annuler** : retour sans sauvegarde (`Location.back()`, repli `/builds`).
- Validation minimale conservée (nom + classe requis) avant Enregistrer.

### Tests

- `build-editor.spec` : 
  - mode création → formulaire vierge ; Enregistrer appelle `createBuild`.
  - mode édition (`:id` fourni, build présent dans le stub) → champs préremplis ; Enregistrer appelle `updateBuild(id, …)`.
  - Annuler n'appelle ni create ni update.
  - Stubber `BuildService` + `ActivatedRoute` ; neutraliser les sélecteurs lourds (`overrideComponent` avec `template:''`, comme `builds-list`).
- `builds-list.spec` : mettre à jour les tests « création/édition » → vérifient `router.navigate(['/builds/nouveau'])` et `['/builds', id, 'edition']` (au lieu des appels au formulaire).

### Risques / points de vigilance

- `dashboard.component.ts` est volumineux : retirer proprement l'embed build-form + le viewChild + les handlers, sans casser le reste du menu BUILD (sélection rapide conservée).
- La logique `removeInnateSpellsFromSelection` et les valeurs par défaut du form doivent être **portées fidèlement** depuis `BuildFormComponent` avant sa suppression.
- Retour de navigation : `Location.back()` ramène à l'écran d'origine (Builds ou espace de travail) ; repli `/builds` si pas d'historique.

---

## Séquencement d'implémentation suggéré

1. **Partie A** (split Timeline/Freeplay) — autonome, faible risque.
2. **Partie B** (éditeur de build) — plus gros ; sous-étapes : créer `BuildEditorComponent` + routes → recâbler `builds-list` → recâbler le menu BUILD du dashboard → supprimer `BuildFormComponent`.

Chaque tâche : TDD quand applicable, `ng build` comme barrière (karma indisponible ici — pas de Chrome), un commit par tâche, branche `feat_new-ihm`.
