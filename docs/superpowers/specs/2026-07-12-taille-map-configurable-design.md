# Design — Taille de map configurable

**Date :** 2026-07-12
**Branche :** `feat_upgrade-map-settings`
**Statut :** Validé, prêt pour plan d'implémentation

## Besoin

Permettre à l'utilisateur de maîtriser la taille de la map de combat : choisir
la **largeur** et la **hauteur** indépendamment, exprimées en nombre de cases.

## Contexte technique existant

Incohérence actuelle à corriger :
- L'état interne déclare une map **13×13** (`board.service.ts`, `cols: 13, rows: 13`),
  mais ces valeurs ne servent qu'au bornage (validation de position).
- Le rendu réel est figé à **10×10** : la boucle `boardCells` va de 0 à 9
  (`board.component.ts:2161`) et le CSS de la grille est `repeat(10, 44px)`
  (`board.component.ts:1058`).

La feature impose d'unifier ça autour d'une **source de vérité unique** pour
`cols`/`rows`, avec un défaut de **10×10** (la taille réellement jouable
aujourd'hui, et non le 13×13 d'état jamais affiché).

## Décisions de cadrage

| Sujet | Décision |
|-------|----------|
| Persistance | **Hybride** : par timeline (dans `TimelineBoardSetup`) **+** cache localStorage pour la continuité de navigation |
| UI de réglage | Bouton ⚙ dans la barre d'outils → petit popover (Largeur, Hauteur, Appliquer) |
| Rendu | Le `.board` grandit dans `.board-wrapper` **sans le redimensionner** ; la taille des cases devient dynamique (elles rétrécissent pour rester contenues) |
| Limites | **10 à 20** cases par côté ; défaut **10×10** |
| Réduction | Recaler les entités et rouages manuels hors-bornes sur la case valide la plus proche |
| Stratégie de rendu | **Approche B** : taille de case calculée en px (variable CSS `--cell-size`), pour préserver les enfants dimensionnés en px |

## Architecture

### 1. Modèle d'état & source de vérité unique

`board.service.ts` :
- `cols`/`rows` deviennent la **seule** source de vérité, défaut **10×10**.
- Signal public `gridSize = computed(() => ({ cols, rows }))`.
- Méthode `setGridSize(cols, rows)` :
  - clampe les valeurs entre 10 et 20 ;
  - recale les entités et rouages manuels hors des nouvelles bornes ;
  - écrit la taille courante dans le cache localStorage.

`board.component.ts` :
- `boardCells` boucle sur `cols()/rows()` du service au lieu de `< 10` en dur.
- Le bornage existant (déjà basé sur `state.cols/state.rows`) devient correct
  automatiquement.

### 2. Rendu (approche B — case en px dynamique)

- Un `ResizeObserver` sur `.board-wrapper` mesure l'espace intérieur disponible.
- Calcul :
  `cellPx = clamp(minCell, floor((min(dispoW, dispoH) − gaps − padding) / max(cols, rows)), 44)`
  — cases carrées, grille toujours contenue dans le wrapper sans le redimensionner.
- Exposé en variable CSS `--cell-size` sur `.board`.
- La grille passe à `grid-template-columns: repeat(var(--cols), var(--cell-size))`
  (idem rows). Le `--cols`/`--rows` sont aussi posés en variables CSS.
- Le `.board-wrapper` garde sa taille fixe (58% / min-height 420px) ;
  son `overflow` passe de `auto` à `hidden` puisque la grille ne débordera plus.
- `minCell` (≈16px) garantit que même à 20×20 les cases restent cliquables.

### 3. UI de réglage

- Nouveau bouton ⚙ « Taille de la map » dans la barre d'outils de
  `dashboard.component.ts` (à côté des autres `tool-btn`), visible dans les deux
  modes (Freeplay et Timeline).
- Petit popover (même pattern que le menu passifs existant) :
  - deux champs numériques **Largeur** et **Hauteur** (min 10, max 20),
    pré-remplis avec la taille courante ;
  - bouton **Appliquer** ;
  - validation inline si hors bornes.

### 4. Persistance (hybride)

**Par timeline :**
- Ajout de `cols`/`rows` optionnels à `TimelineBoardSetup`.
- `exportCurrentSetup()` les écrit ; `applyTimelineSetup()` les applique au
  chargement (fallback 10×10 pour les anciennes timelines sans taille).
- S'intègre au bouton « Sauvegarder la map » déjà en place.

**Cache localStorage :**
- À chaque `setGridSize`, écriture de la taille courante dans localStorage
  (clé dédiée, ex. `wakfu.mapSize`).
- Au démarrage du service, lecture de cette valeur → les allers-retours
  Freeplay ↔ Résultats/Build conservent la taille.
- Le chargement d'une timeline **prime** sur le cache (la timeline restaure sa
  propre taille).

### 5. Réduction → recalage

- `setGridSize` (et `applyTimelineSetup`) recalent toute entité et **rouage
  manuel** hors des nouvelles bornes sur la case valide la plus proche :
  `x = min(x, cols−1)`, `y = min(y, rows−1)`.
- Si deux éléments se retrouvent sur la même case, comportement existant
  conservé (superposition tolérée, pas de blocage).
- Le cadran/heures et mécanismes générés par sorts sont recalculés au run,
  donc non concernés hors session.

## Tests

`board.service.spec` :
- `setGridSize` clampe à 10–20.
- Recalage des entités/rouages manuels hors bornes.
- `exportCurrentSetup`/`applyTimelineSetup` : round-trip avec `cols`/`rows`,
  fallback 10×10 pour timeline sans taille.
- Lecture/écriture du cache localStorage.

Pas de test du `ResizeObserver` (comportement navigateur) — vérification
visuelle via le serveur de dev.

## Hors périmètre (YAGNI)

- Pas de map non rectangulaire ni de cases masquées/obstacles.
- Pas de zoom/pan manuel indépendant de la taille de grille.
- Pas de migration du 13×13 historique : on part sur un défaut 10×10 propre.
