# Design — Raccourcis clavier & affichage du deck

**Date :** 2026-07-18
**Branche :** `feat_interaction-map`
**Statut :** Validé, prêt pour plan d'implémentation

## Besoin

Reproduire les raccourcis clavier de Wakfu pour sélectionner un sort, en freeplay comme
en création de timeline. En jeu, le deck compte 12 sorts (touches `1..6` puis `alt+1..6`)
suivis des sorts innés (`ctrl+1..n`, 3 pour le Xélor).

L'utilisateur doit donc avoir **deux chemins équivalents** : cliquer la carte du sort puis
la case, ou presser le raccourci puis cliquer la case.

Second besoin : rendre l'affichage des sorts cohérent entre les pages.

## Contexte technique existant

- **Le deck est `SpellBar.spells: (SpellReference | null)[]`** — 12 emplacements, les vides
  valant `null`. Les trous sont donc possibles (`addSpellToBar` écrit à un index précis).
- **Les sorts innés sont data-driven par classe** : `getInnateSpellIdsForClass()` renvoie
  `['XEL_DIAL', 'XEL_DISTO', 'XEL_VDT']` pour le Xélor — exactement 3, d'où `ctrl+1..3`.
- **La sélection sort → case existe déjà** : `board.component` porte un signal
  `selectedSpellId` et une méthode `onSelectSpell(spell)`. Un raccourci n'a donc rien de
  nouveau à lancer : il doit simplement **sélectionner**, comme le fait un clic.
- **L'affichage diverge aujourd'hui selon le mode** (`board.component`) : groupé par
  élément (`spellsByElement()`) en mode timeline, grille plate (`buildSpells()`) sinon.
- **`buildSpells()` écrase les emplacements vides** (`.filter(s => !!s)`) : l'index du
  tableau n'est donc **pas** le numéro d'emplacement du deck. C'est le piège central de
  cette feature.
- **`normalizeElement()` a un repli `'neutral'`** présent dans les groupes : aucun sort ne
  disparaît du tri par élément, quel que soit son élément.
- **`board.component.ts` fait 3253 lignes.** Toute logique nouvelle doit en sortir.
- Un seul écouteur clavier existe (`keydown.escape` sur un panneau) : aucun conflit avec
  les chiffres.

## Décisions de cadrage

| Sujet | Décision |
|-------|----------|
| Deck | `1..6` → emplacements 1-6, `alt+1..6` → emplacements 7-12 |
| Innés | `ctrl+1..3` **et** `shift+1..3` (les deux actifs) |
| Affichage **avec** build | 2 rangées de 6 dans l'ordre du deck + rangée innés, en freeplay **et** en timeline |
| Affichage **sans** build | tri par élément, comportement actuel inchangé |
| Trou dans le deck | case vide grisée conservée ; emplacements vides **de fin** non affichés |
| Raccourcis sans build | mappés sur l'ordre affiché |
| Effet du raccourci | **sélectionne** le sort ; la case reste choisie à la souris |
| Badge | chaque carte affiche son raccourci (`1`, `alt+4`, `ctrl+2`…) |

### Pourquoi `shift` en plus de `ctrl`

Dans un navigateur, `Ctrl+1..8` est réservé par Chrome et Firefox sous Windows et Linux
pour changer d'onglet, et une page web ne peut pas l'intercepter. Sur macOS ces touches
sont libres. Comme la majorité des joueurs Wakfu sont sous Windows, `ctrl` seul rendrait
les sorts innés injouables au clavier pour eux. Les deux combinaisons pointent donc les
mêmes sorts : `ctrl` par fidélité au jeu, `shift` comme repli universel.

### Approches écartées

- **Numéroter selon l'ordre affiché quand un build est sélectionné** : les numéros
  changeraient au moindre changement de tri et ne correspondraient plus au deck en jeu.
  Résolu autrement : l'affichage en 2 rangées de 6 **est** l'ordre du deck, donc l'ordre
  visuel et les touches coïncident par construction.
- **Compacter les trous du deck** : plus compact, mais `touche 5` ne viserait plus
  l'emplacement 5 dès qu'un emplacement est vide.
- **Mettre la logique clavier dans `board.component`** : le fichier fait déjà 3253 lignes
  et la logique de parsing y serait intestable isolément.

## Architecture

### 1. `frontend/src/app/utils/spell-shortcuts.utils.ts` (créer)

Logique pure, sans dépendance Angular ni connaissance des sorts. Traduit une frappe en
intention :

```typescript
export type SpellShortcut =
  | { kind: 'deck'; index: number }    // 0..11
  | { kind: 'innate'; index: number }; // 0..2

export function parseSpellShortcut(event: KeyboardEvent): SpellShortcut | null;
```

Règles :

| Frappe | Résultat |
|---|---|
| `1`..`6` sans modificateur | `{ kind: 'deck', index: 0..5 }` |
| `alt` + `1`..`6` | `{ kind: 'deck', index: 6..11 }` |
| `ctrl` + `1`..`3` | `{ kind: 'innate', index: 0..2 }` |
| `shift` + `1`..`3` | `{ kind: 'innate', index: 0..2 }` |
| `meta` (Cmd) enfoncé | `null` — on ne marche pas sur les raccourcis système |
| cible = `input`, `textarea`, `select`, `contenteditable` | `null` |
| tout le reste | `null` |

Le garde sur les champs de saisie n'est pas cosmétique : sans lui, renommer une timeline
déclencherait des sélections de sorts à chaque chiffre tapé.

### 2. `board.component` — ajouts minimaux

- Un computed **`shortcutSpells(): (Spell | null)[]`** (longueur ≤ 12), source unique de
  vérité partagée par l'affichage et les raccourcis :
  - **build sélectionné** → les emplacements du deck dans l'ordre, trous en `null`,
    emplacements vides de fin retirés ;
  - **sans build** → l'ordre affiché (groupes par élément aplatis), 12 premiers.
- Un `@HostListener('window:keydown')` qui appelle `parseSpellShortcut`, résout le sort
  via `shortcutSpells()` / `innateSpells()`, et délègue à la méthode **existante**
  `onSelectSpell(spell)`. Un emplacement vide ne sélectionne rien.

Aucun nouveau chemin de lancement : le raccourci et le clic aboutissent au même état.

### 3. Affichage

- **Build sélectionné** (freeplay et timeline) : deux rangées de 6 issues de
  `shortcutSpells()`, trous rendus en case vide grisée. La section « Sorts innés »
  existante est conservée telle quelle.
- **Sans build** : tri par élément, strictement inchangé.
- **Badge** sur chaque carte disposant d'un raccourci (`1`, `alt+4`, `ctrl+2`…). Sans lui,
  la deuxième rangée en `alt` est indevinable.

## Flux

1. L'utilisateur presse `alt+2`.
2. `parseSpellShortcut` renvoie `{ kind: 'deck', index: 7 }`.
3. `shortcutSpells()[7]` donne le sort de l'emplacement 8 — ou `null` s'il est vide,
   auquel cas il ne se passe rien.
4. `onSelectSpell(spell)` s'exécute : le sort passe en surbrillance, exactement comme au
   clic.
5. L'utilisateur clique une case : le lancement suit le chemin existant, inchangé.

## Gestion d'erreurs

Il n'y a pas d'erreur au sens réseau ici ; les cas limites se traitent en silence, sans
message :

- emplacement vide, sort absent du cache, deck plus court que l'index → aucune sélection ;
- frappe dans un champ de saisie → ignorée, le champ reçoit le caractère normalement ;
- `preventDefault()` n'est appelé **que** lorsqu'un raccourci a été reconnu, pour ne pas
  neutraliser des frappes qui ne nous concernent pas.

## Tests

- **`parseSpellShortcut`** (unitaire pur, sans TestBed) : les 6 touches simples, les 6 en
  `alt`, les 3 innés en `ctrl` **et** en `shift`, `meta` ignoré, frappe dans un `input`
  ignorée, touches hors périmètre ignorées.
- **`shortcutSpells()`** : trous préservés à leur position, emplacements vides de fin
  retirés, repli sur l'ordre affiché sans build.
- **Intégration `board.component`** : `1` sélectionne l'emplacement 1, `alt+1`
  l'emplacement 7, `ctrl+1` et `shift+1` le premier inné, un emplacement vide ne
  sélectionne rien.
- **Non-régression** : la suite existante (223 specs) reste verte.

### Prérequis d'exécution

```bash
cd frontend
export CHROME_BIN="$HOME/.cache/puppeteer/chrome-headless-shell/mac_arm-<version>/chrome-headless-shell-mac-arm64/chrome-headless-shell"
npx ng test --watch=false --browsers=ChromeHeadless
```

## Ce que ce lot ne fait pas

- **Pas de lancement au clavier** : la case cible reste choisie à la souris.
- **Pas de raccourci de déplacement** ni de fin de tour.
- **Pas de remappage configurable** des touches.
- **Aucune modification** du moteur de simulation, de la timeline ou du stockage.
