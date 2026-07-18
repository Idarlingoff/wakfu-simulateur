# Raccourcis clavier & affichage du deck — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sélectionner un sort au clavier comme dans Wakfu (`1..6`, `alt+1..6` pour le deck, `ctrl`/`shift+1..3` pour les innés), et afficher le deck en 2 rangées de 6 quand un build est sélectionné.

**Architecture:** Toute la logique (parsing des touches, calcul des emplacements, résolution du sort, libellé du badge) vit dans un fichier **pur** `spell-shortcuts.utils.ts`, testé sans Angular. `board.component` ne reçoit qu'un `@HostListener` et deux `computed` triviaux qui délèguent — parce qu'il fait déjà 3253 lignes et n'a aucun harnais de test.

**Tech Stack:** Angular 20.3 (standalone, signals), tests Karma/Jasmine.

**Spec de référence :** `docs/superpowers/specs/2026-07-18-raccourcis-clavier-deck-design.md`

---

## Prérequis d'exécution

Depuis `frontend/` :

```bash
export CHROME_BIN="$HOME/.cache/puppeteer/chrome-headless-shell/mac_arm-150.0.7871.24/chrome-headless-shell-mac-arm64/chrome-headless-shell"
```

**Baseline : `TOTAL: 223 SUCCESS`.** Doit rester verte à chaque tâche.

Hygiène git : ne jamais commiter `.claude/`, `CLAUDE.md`, `.backend.pid`, `.frontend.pid`, `frontend/.gitignore`, `frontend/.env`, `frontend/src/environments/environment.ts`. Jamais `git add -A` ni `git add .`. Vérifier chaque commit avec `git show --stat`. Lancer les `git add` **depuis la racine du dépôt** avec les chemins `frontend/src/...`.

## Note de testabilité — à lire avant de commencer

`board.component.ts` fait **3253 lignes**, n'a **aucun fichier de test**, et dépend de
`BoardService`, `BuildService`, `TimelineService`, `InteractivePlayService`,
`DataCacheService`, `SimulationService`… Le monter dans un `TestBed` demanderait un
harnais de mocks conséquent, hors périmètre de cette feature.

**Conséquence assumée :** les tâches 1 et 2 mettent 100 % de la logique dans un module pur
entièrement testé. La tâche 3 ne fait que du câblage (≈ 12 lignes sans branche métier) et
la tâche 4 est de l'affichage. Ces deux dernières sont vérifiées **manuellement dans le
navigateur** (tâche 5), pas par test unitaire. C'est explicite et voulu : on ne crée pas un
harnais pour un composant de 3253 lignes au détour d'une feature clavier.

## Structure des fichiers

| Fichier | Responsabilité |
|---|---|
| `frontend/src/app/utils/spell-shortcuts.utils.ts` (créer) | Logique pure : parsing des touches, emplacements du deck, résolution, libellés. |
| `frontend/src/app/utils/spell-shortcuts.utils.spec.ts` (créer) | Tests de la logique pure. |
| `frontend/src/app/components/board.component.ts` (modifier) | Câblage : `@HostListener`, 3 computed délégants, template deck + badges, styles. |

---

### Task 1 : Parsing des touches (`parseSpellShortcut`, `shortcutLabel`)

**Files:**
- Create: `frontend/src/app/utils/spell-shortcuts.utils.ts`
- Test: `frontend/src/app/utils/spell-shortcuts.utils.spec.ts`

- [ ] **Step 1 : Écrire les tests qui échouent**

Créer `frontend/src/app/utils/spell-shortcuts.utils.spec.ts` :

```typescript
import { parseSpellShortcut, shortcutLabel } from './spell-shortcuts.utils';

/**
 * Fabrique un faux KeyboardEvent a partir du CODE physique de la touche.
 *
 * On lit `event.code` et jamais `event.key` : sur un AZERTY francais, la rangee du haut
 * sans Shift produit `&é"'(§` et non `1..6`, et sur un QWERTY `Shift+1` produit `!`.
 * `code` ('Digit1') identifie la touche physique quelle que soit la disposition.
 */
function code(
  c: string,
  mods: { alt?: boolean; ctrl?: boolean; shift?: boolean; meta?: boolean } = {},
  target: unknown = document.createElement('div'),
): KeyboardEvent {
  return {
    code: c,
    key: 'peu importe',
    altKey: !!mods.alt,
    ctrlKey: !!mods.ctrl,
    shiftKey: !!mods.shift,
    metaKey: !!mods.meta,
    target,
  } as unknown as KeyboardEvent;
}

/** Raccourci de lecture : `key('1')` vise la touche physique Digit1. */
function key(
  digit: string,
  mods: { alt?: boolean; ctrl?: boolean; shift?: boolean; meta?: boolean } = {},
  target: unknown = document.createElement('div'),
): KeyboardEvent {
  return code(`Digit${digit}`, mods, target);
}

describe('parseSpellShortcut', () => {
  it('mappe 1..6 sur les emplacements 0..5 du deck', () => {
    expect(parseSpellShortcut(key('1'))).toEqual({ kind: 'deck', index: 0 });
    expect(parseSpellShortcut(key('6'))).toEqual({ kind: 'deck', index: 5 });
  });

  it('mappe alt+1..6 sur les emplacements 6..11 du deck', () => {
    expect(parseSpellShortcut(key('1', { alt: true }))).toEqual({ kind: 'deck', index: 6 });
    expect(parseSpellShortcut(key('6', { alt: true }))).toEqual({ kind: 'deck', index: 11 });
  });

  it('mappe ctrl+1..3 sur les sorts innes', () => {
    expect(parseSpellShortcut(key('1', { ctrl: true }))).toEqual({ kind: 'innate', index: 0 });
    expect(parseSpellShortcut(key('3', { ctrl: true }))).toEqual({ kind: 'innate', index: 2 });
  });

  // Ctrl+1..8 est confisque par Chrome/Firefox sous Windows et Linux : sans ce repli,
  // les sorts innes seraient injouables au clavier pour la majorite des joueurs.
  it('mappe aussi shift+1..3 sur les sorts innes', () => {
    expect(parseSpellShortcut(key('1', { shift: true }))).toEqual({ kind: 'innate', index: 0 });
    expect(parseSpellShortcut(key('3', { shift: true }))).toEqual({ kind: 'innate', index: 2 });
  });

  it('ignore les chiffres hors 1..6 pour le deck', () => {
    expect(parseSpellShortcut(key('7'))).toBeNull();
    expect(parseSpellShortcut(key('0'))).toBeNull();
  });

  it('ignore ctrl/shift au-dela de 3 (le Xelor n a que 3 innes)', () => {
    expect(parseSpellShortcut(key('4', { ctrl: true }))).toBeNull();
    expect(parseSpellShortcut(key('4', { shift: true }))).toBeNull();
  });

  it('ignore toute frappe avec Cmd, pour ne pas marcher sur les raccourcis systeme', () => {
    expect(parseSpellShortcut(key('1', { meta: true }))).toBeNull();
    expect(parseSpellShortcut(key('1', { meta: true, alt: true }))).toBeNull();
  });

  it('ignore les touches non numeriques', () => {
    expect(parseSpellShortcut(code('KeyA'))).toBeNull();
    expect(parseSpellShortcut(code('Enter'))).toBeNull();
  });

  // Sur AZERTY, la touche physique 1 tape '&' : lire event.key casserait tout.
  it('fonctionne quel que soit le caractere produit par la disposition', () => {
    const azerty = { code: 'Digit1', key: '&', altKey: false, ctrlKey: false,
      shiftKey: false, metaKey: false, target: document.createElement('div') };
    expect(parseSpellShortcut(azerty as unknown as KeyboardEvent))
      .toEqual({ kind: 'deck', index: 0 });
  });

  // Sur QWERTY, Shift+1 tape '!' : la aussi, seul le code physique est fiable.
  it('reconnait shift+1 meme quand la frappe produit un symbole', () => {
    const qwerty = { code: 'Digit1', key: '!', altKey: false, ctrlKey: false,
      shiftKey: true, metaKey: false, target: document.createElement('div') };
    expect(parseSpellShortcut(qwerty as unknown as KeyboardEvent))
      .toEqual({ kind: 'innate', index: 0 });
  });

  it('accepte aussi le pave numerique', () => {
    expect(parseSpellShortcut(code('Numpad1'))).toEqual({ kind: 'deck', index: 0 });
  });

  // Sans ce garde, renommer une timeline lancerait des selections a chaque chiffre tape.
  it('ignore les frappes dans un champ de saisie', () => {
    expect(parseSpellShortcut(key('1', {}, document.createElement('input')))).toBeNull();
    expect(parseSpellShortcut(key('1', {}, document.createElement('textarea')))).toBeNull();
    expect(parseSpellShortcut(key('1', {}, document.createElement('select')))).toBeNull();
  });

  it('ignore les frappes dans un element contenteditable', () => {
    const editable = document.createElement('div');
    editable.setAttribute('contenteditable', 'true');
    expect(parseSpellShortcut(key('1', {}, editable))).toBeNull();
  });
});

describe('shortcutLabel', () => {
  it('libelle les 6 premiers emplacements sans modificateur', () => {
    expect(shortcutLabel({ kind: 'deck', index: 0 })).toBe('1');
    expect(shortcutLabel({ kind: 'deck', index: 5 })).toBe('6');
  });

  it('libelle les emplacements 7..12 avec alt', () => {
    expect(shortcutLabel({ kind: 'deck', index: 6 })).toBe('alt+1');
    expect(shortcutLabel({ kind: 'deck', index: 11 })).toBe('alt+6');
  });

  it('libelle les innes avec ctrl', () => {
    expect(shortcutLabel({ kind: 'innate', index: 0 })).toBe('ctrl+1');
  });

  it('ne libelle rien au-dela du deck', () => {
    expect(shortcutLabel({ kind: 'deck', index: 12 })).toBe('');
  });
});
```

- [ ] **Step 2 : Lancer, vérifier l'échec**

```bash
npx ng test --include='**/spell-shortcuts.utils.spec.ts' --watch=false --browsers=ChromeHeadless
```
Attendu : ÉCHEC — `Cannot find module './spell-shortcuts.utils'`.

- [ ] **Step 3 : Implémenter**

Créer `frontend/src/app/utils/spell-shortcuts.utils.ts` :

```typescript
/**
 * Raccourcis clavier de selection de sort, calques sur Wakfu.
 *
 * Deck (12 emplacements) : 1..6 puis alt+1..6.
 * Sorts innes : ctrl+1..3 ET shift+1..3.
 *
 * Le repli shift n'est pas cosmetique : Ctrl+1..8 est reserve par Chrome et Firefox
 * sous Windows et Linux pour changer d'onglet, et une page web ne peut pas
 * l'intercepter. Sans shift, les innes seraient injouables au clavier hors macOS.
 */

/** Nombre d'emplacements du deck (6 sans modificateur + 6 avec alt). */
export const DECK_SLOT_COUNT = 12;

/** Nombre maximum de sorts innes adressables au clavier (3 pour le Xelor). */
export const INNATE_SHORTCUT_COUNT = 3;

export type SpellShortcut =
  | { kind: 'deck'; index: number }
  | { kind: 'innate'; index: number };

function isTextEntry(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || typeof el.tagName !== 'string') {
    return false;
  }
  const tag = el.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') {
    return true;
  }
  return el.isContentEditable === true || el.getAttribute?.('contenteditable') === 'true';
}

/**
 * Extrait le chiffre de la touche PHYSIQUE ('Digit1' / 'Numpad1' -> 1), ou null.
 *
 * On lit `event.code` et jamais `event.key` : sur un AZERTY francais la rangee du haut
 * sans Shift produit `&é"'(§`, et sur un QWERTY `Shift+1` produit `!`. Se fier au
 * caractere tape rendrait les raccourcis inoperants hors QWERTY, et le repli shift
 * inoperant partout.
 */
function physicalDigit(code: string | undefined): number | null {
  const match = /^(?:Digit|Numpad)([0-9])$/.exec(code ?? '');
  return match ? Number(match[1]) : null;
}

/** Traduit une frappe en intention, ou null si elle ne nous concerne pas. */
export function parseSpellShortcut(event: KeyboardEvent): SpellShortcut | null {
  // Cmd : on ne marche jamais sur les raccourcis systeme / navigateur.
  if (event.metaKey) {
    return null;
  }
  if (isTextEntry(event.target)) {
    return null;
  }

  const digit = physicalDigit(event.code);
  if (digit === null || digit < 1) {
    return null;
  }

  if (event.ctrlKey || event.shiftKey) {
    return digit <= INNATE_SHORTCUT_COUNT ? { kind: 'innate', index: digit - 1 } : null;
  }

  if (digit > 6) {
    return null;
  }
  return { kind: 'deck', index: event.altKey ? digit + 5 : digit - 1 };
}

/** Libelle affiche sur la carte ('1', 'alt+4', 'ctrl+2'). Vide si hors perimetre. */
export function shortcutLabel(shortcut: SpellShortcut): string {
  if (shortcut.kind === 'innate') {
    return shortcut.index < INNATE_SHORTCUT_COUNT ? `ctrl+${shortcut.index + 1}` : '';
  }
  if (shortcut.index < 6) {
    return `${shortcut.index + 1}`;
  }
  if (shortcut.index < DECK_SLOT_COUNT) {
    return `alt+${shortcut.index - 5}`;
  }
  return '';
}
```

- [ ] **Step 4 : Lancer, vérifier le succès**

Attendu : `TOTAL: 17 SUCCESS` sur ce spec (13 pour `parseSpellShortcut`, 4 pour `shortcutLabel`).

- [ ] **Step 5 : Commit**

```bash
git add frontend/src/app/utils/spell-shortcuts.utils.ts frontend/src/app/utils/spell-shortcuts.utils.spec.ts
git commit -m "feat(shortcuts): parsing des raccourcis clavier de selection de sort"
```

---

### Task 2 : Emplacements du deck et résolution (`deckSlotSpells`, `resolveShortcutSpell`)

**Files:**
- Modify: `frontend/src/app/utils/spell-shortcuts.utils.ts`
- Modify: `frontend/src/app/utils/spell-shortcuts.utils.spec.ts`

C'est ici que se joue le piège central : `buildSpells()` (dans `board.component`) écrase les
emplacements vides, donc l'index du tableau n'est **pas** le numéro d'emplacement. Cette
fonction préserve les trous.

- [ ] **Step 1 : Écrire les tests qui échouent**

Compléter **l'import existant** en tête de
`frontend/src/app/utils/spell-shortcuts.utils.spec.ts` (ne pas créer un second `import`
du même module) :

```typescript
import {
  parseSpellShortcut,
  shortcutLabel,
  deckSlotSpells,
  resolveShortcutSpell,
} from './spell-shortcuts.utils';
```

Puis ajouter à la fin du fichier :

```typescript
interface FakeSpell { id: string; name: string; }

const ref = (spellId: string) => ({ spellId }) as { spellId: string };
const spell = (id: string): FakeSpell => ({ id, name: `sort ${id}` });

/** Resolveur : rend le sort si connu du cache, sinon undefined. */
function resolverFor(ids: string[]) {
  const cache = new Map(ids.map(id => [id, spell(id)]));
  return (id: string) => cache.get(id);
}

describe('deckSlotSpells', () => {
  it('rend les sorts dans l ordre des emplacements', () => {
    const deck = [ref('a'), ref('b'), ref('c')];
    const result = deckSlotSpells(deck, resolverFor(['a', 'b', 'c'])) as FakeSpell[];
    expect(result.map(s => s.id)).toEqual(['a', 'b', 'c']);
  });

  // Sans ca, la touche 3 ne viserait plus l'emplacement 3.
  it('preserve un trou au milieu du deck', () => {
    const deck = [ref('a'), null, ref('c')];
    const result = deckSlotSpells(deck, resolverFor(['a', 'c']));
    expect(result.length).toBe(3);
    expect(result[0]?.id).toBe('a');
    expect(result[1]).toBeNull();
    expect(result[2]?.id).toBe('c');
  });

  it('retire les emplacements vides de fin', () => {
    const deck = [ref('a'), null, null, null];
    expect(deckSlotSpells(deck, resolverFor(['a'])).length).toBe(1);
  });

  it('rend une liste vide pour un deck entierement vide', () => {
    expect(deckSlotSpells([null, null], resolverFor([]))).toEqual([]);
  });

  it('traite un sort introuvable dans le cache comme un emplacement vide', () => {
    const deck = [ref('a'), ref('inconnu'), ref('c')];
    const result = deckSlotSpells(deck, resolverFor(['a', 'c']));
    expect(result[1]).toBeNull();
    expect(result[2]?.id).toBe('c');
  });

  it('ne depasse jamais 12 emplacements', () => {
    const deck = Array.from({ length: 20 }, (_, i) => ref(`s${i}`));
    const ids = deck.map(d => d.spellId);
    expect(deckSlotSpells(deck, resolverFor(ids)).length).toBe(12);
  });
});

describe('resolveShortcutSpell', () => {
  const deck = [spell('a'), null, spell('c')];
  const innates = [spell('i1'), spell('i2')];

  it('resout un emplacement de deck', () => {
    expect(resolveShortcutSpell({ kind: 'deck', index: 2 }, deck, innates)?.id).toBe('c');
  });

  it('rend null sur un emplacement vide', () => {
    expect(resolveShortcutSpell({ kind: 'deck', index: 1 }, deck, innates)).toBeNull();
  });

  it('rend null hors des bornes', () => {
    expect(resolveShortcutSpell({ kind: 'deck', index: 9 }, deck, innates)).toBeNull();
  });

  it('resout un sort inne', () => {
    expect(resolveShortcutSpell({ kind: 'innate', index: 1 }, deck, innates)?.id).toBe('i2');
  });

  it('rend null si l inne n existe pas pour cette classe', () => {
    expect(resolveShortcutSpell({ kind: 'innate', index: 2 }, deck, innates)).toBeNull();
  });
});
```

- [ ] **Step 2 : Lancer, vérifier l'échec**

```bash
npx ng test --include='**/spell-shortcuts.utils.spec.ts' --watch=false --browsers=ChromeHeadless
```
Attendu : ÉCHEC — `deckSlotSpells is not exported` / module introuvable.

- [ ] **Step 3 : Implémenter**

Ajouter à la fin de `frontend/src/app/utils/spell-shortcuts.utils.ts` :

```typescript
/** Reference minimale d'un emplacement de deck (structurellement compatible avec SpellReference). */
interface DeckSlotRef {
  spellId: string;
}

/**
 * Convertit les emplacements du deck en sorts, EN PRESERVANT LES TROUS.
 *
 * Indispensable : la liste habituelle des sorts du build ecrase les emplacements vides,
 * si bien que l'index du tableau ne correspond plus au numero d'emplacement. Ici,
 * result[i] est le sort de l'emplacement i, ou null. Les emplacements vides de FIN sont
 * retires, pour ne pas afficher de cases vides inutiles.
 */
export function deckSlotSpells<T>(
  deck: ReadonlyArray<DeckSlotRef | null | undefined>,
  resolve: (spellId: string) => T | undefined,
): (T | null)[] {
  const slots: (T | null)[] = [];
  for (let i = 0; i < Math.min(deck.length, DECK_SLOT_COUNT); i++) {
    const entry = deck[i];
    slots.push(entry ? resolve(entry.spellId) ?? null : null);
  }
  while (slots.length > 0 && slots[slots.length - 1] === null) {
    slots.pop();
  }
  return slots;
}

/** Resout l'intention en sort concret, ou null si l'emplacement est vide/inexistant. */
export function resolveShortcutSpell<T>(
  shortcut: SpellShortcut,
  deckSpells: ReadonlyArray<T | null>,
  innateSpells: ReadonlyArray<T>,
): T | null {
  if (shortcut.kind === 'innate') {
    return innateSpells[shortcut.index] ?? null;
  }
  return deckSpells[shortcut.index] ?? null;
}
```

- [ ] **Step 4 : Lancer, vérifier le succès**

Attendu : `TOTAL: 28 SUCCESS` sur ce spec (17 + 11), puis suite complète `TOTAL: 251 SUCCESS` (223 + 28).

- [ ] **Step 5 : Commit**

```bash
git add frontend/src/app/utils/spell-shortcuts.utils.ts frontend/src/app/utils/spell-shortcuts.utils.spec.ts
git commit -m "feat(shortcuts): emplacements du deck avec trous preserves et resolution"
```

---

### Task 3 : Câblage clavier dans `board.component`

**Files:**
- Modify: `frontend/src/app/components/board.component.ts`

Câblage uniquement : aucune branche métier n'est ajoutée ici, tout est délégué au module pur.

- [ ] **Step 1 : Ajouter les imports**

Dans `frontend/src/app/components/board.component.ts`, ajouter `HostListener` à l'import
Angular existant (garder tout ce qui y est déjà) :

```typescript
import { Component, computed, effect, inject, signal, HostListener } from '@angular/core';
```

> Lire la ligne d'import réelle avant de la remplacer : elle contient déjà plusieurs
> symboles (`Component`, `computed`, `signal`, `inject`, `effect`, `ViewChild`…).
> N'ajouter que `HostListener`, ne rien retirer.

Ajouter l'import du module pur, à côté des autres imports d'utils :

```typescript
import {
  parseSpellShortcut,
  resolveShortcutSpell,
  shortcutLabel,
  deckSlotSpells,
  DECK_SLOT_COUNT,
} from '../utils/spell-shortcuts.utils';
```

- [ ] **Step 2 : Ajouter les computed**

Ajouter juste après le computed `innateSpells` existant (repérable par
`innateSpells = computed(() => {`) :

```typescript
  /**
   * Les sorts adressables au clavier, dans l'ordre des raccourcis.
   * Avec un build : les emplacements du deck, trous preserves (index = numero
   * d'emplacement). Sans build : l'ordre affiche, limite a 12.
   */
  shortcutSpells = computed<(Spell | null)[]>(() => {
    const build = this.buildService.selectedBuildA();
    const cache = this.spellsCache();
    if (build) {
      return deckSlotSpells(build.spellBar.spells, (id: string) => cache.get(id));
    }
    return this.buildSpells().slice(0, DECK_SLOT_COUNT);
  });

  /** Le deck decoupe en rangees de 6, pour l'affichage facon barre de sorts. */
  deckRows = computed<(Spell | null)[][]>(() => {
    const slots = this.shortcutSpells();
    const rows: (Spell | null)[][] = [];
    for (let i = 0; i < slots.length; i += 6) {
      rows.push(slots.slice(i, i + 6));
    }
    return rows;
  });

  /** spellId -> libelle du raccourci ('1', 'alt+4', 'ctrl+2'), pour les badges. */
  shortcutLabels = computed<Map<string, string>>(() => {
    const labels = new Map<string, string>();
    this.shortcutSpells().forEach((spell, index) => {
      if (spell) {
        labels.set(spell.id, shortcutLabel({ kind: 'deck', index }));
      }
    });
    this.innateSpells().forEach((spell, index) => {
      labels.set(spell.id, shortcutLabel({ kind: 'innate', index }));
    });
    return labels;
  });

  /** Libelle du raccourci d'un emplacement du deck, y compris vide. */
  deckSlotLabel(rowIndex: number, colIndex: number): string {
    return shortcutLabel({ kind: 'deck', index: rowIndex * 6 + colIndex });
  }
```

- [ ] **Step 3 : Ajouter l'écouteur clavier**

Ajouter juste avant la méthode `onSelectSpell` existante :

```typescript
  /**
   * Raccourcis clavier facon Wakfu : selectionne le sort, exactement comme un clic sur
   * sa carte. La case cible reste choisie a la souris — aucun nouveau chemin de lancement.
   */
  @HostListener('window:keydown', ['$event'])
  onSpellShortcut(event: KeyboardEvent): void {
    const shortcut = parseSpellShortcut(event);
    if (!shortcut) {
      return;
    }
    const spell = resolveShortcutSpell(shortcut, this.shortcutSpells(), this.innateSpells());
    if (!spell) {
      return;
    }
    // preventDefault seulement quand un raccourci a ete reconnu ET resolu, pour ne pas
    // neutraliser des frappes qui ne nous concernent pas.
    event.preventDefault();
    this.onSelectSpell(spell);
  }
```

- [ ] **Step 4 : Vérifier la compilation**

```bash
npx ng build --configuration development
```
Attendu : `Application bundle generation complete`, sans erreur.

- [ ] **Step 5 : Lancer la suite complète**

Attendu : `TOTAL: 251 SUCCESS`, zéro échec (aucun test existant ne monte ce composant).

- [ ] **Step 6 : Commit**

```bash
git add frontend/src/app/components/board.component.ts
git commit -m "feat(shortcuts): cablage clavier de la selection de sort dans le board"
```

---

### Task 4 : Affichage du deck en 2 rangées + badges

**Files:**
- Modify: `frontend/src/app/components/board.component.ts`

- [ ] **Step 1 : Remplacer le bloc d'affichage des sorts**

Dans le template de `board.component.ts`, repérer le bloc commençant par
`<!-- Sorts du build : groupés par élément en mode timeline, grille plate sinon -->`
et le remplacer **intégralement** (jusqu'au `}` fermant du `@else` de `noSpells`) par :

```html
          <!-- Avec un build : la barre de sorts (2 rangees de 6, ordre du deck), pour que
               l'ordre visuel et les raccourcis coincident. Sinon : tri par element. -->
          @if (deckRows().length > 0) {
            <div class="deck-rows">
              @for (row of deckRows(); track $index; let r = $index) {
                <div class="spell-grid deck-row">
                  @for (slot of row; track $index; let c = $index) {
                    @if (slot) {
                      <ng-container
                        *ngTemplateOutlet="spellCard; context: { $implicit: slot, shortcut: deckSlotLabel(r, c) }"
                      ></ng-container>
                    } @else {
                      <div class="spell-icon-card empty-slot" title="Emplacement vide">
                        <span class="shortcut-badge">{{ deckSlotLabel(r, c) }}</span>
                      </div>
                    }
                  }
                </div>
              }
            </div>
          } @else if (buildSpells().length > 0) {
            <div class="spell-group" *ngFor="let group of spellsByElement()">
              <div class="spell-group-label">{{ group.label }}</div>
              <div class="spell-grid">
                <ng-container *ngFor="let spell of group.spells">
                  <ng-container
                    *ngTemplateOutlet="spellCard; context: { $implicit: spell, shortcut: shortcutLabels().get(spell.id) }"
                  ></ng-container>
                </ng-container>
              </div>
            </div>
          } @else {
            <ng-container *ngTemplateOutlet="noSpells"></ng-container>
          }
```

- [ ] **Step 2 : Ajouter le badge au template de carte**

Remplacer la ligne d'ouverture du template `#spellCard` :

```html
          <ng-template #spellCard let-spell>
```

par :

```html
          <ng-template #spellCard let-spell let-shortcut="shortcut">
```

puis, dans ce même template, juste **après** la ligne
`<div class="selected-ring" *ngIf="selectedSpellId() === spell.id"></div>`, ajouter :

```html
              <span class="shortcut-badge" *ngIf="shortcut">{{ shortcut }}</span>
```

- [ ] **Step 3 : Ajouter le badge aux cartes de sorts innés**

Dans le bloc `<!-- Sorts innés de la classe -->`, remplacer :

```html
                <div class="selected-ring" *ngIf="selectedSpellId() === spell.id"></div>
              </div>
            </div>
          </div>
```

par :

```html
                <div class="selected-ring" *ngIf="selectedSpellId() === spell.id"></div>
                <span class="shortcut-badge" *ngIf="shortcutLabels().get(spell.id)">{{ shortcutLabels().get(spell.id) }}</span>
              </div>
            </div>
          </div>
```

- [ ] **Step 4 : Ajouter les styles**

Ajouter dans le tableau `styles` de `board.component.ts`, juste après la règle
`.innate-spell-card.selected .selected-ring { ... }` :

```css
    .deck-rows { display: flex; flex-direction: column; gap: 8px; }
    .deck-row { display: flex; gap: 6px; }
    .empty-slot {
      opacity: 0.35;
      border: 1px dashed var(--app-border);
      background: transparent;
      cursor: default;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .spell-icon-card { position: relative; }
    .shortcut-badge {
      position: absolute;
      top: 2px;
      left: 2px;
      padding: 0 4px;
      border-radius: 4px;
      background: rgba(0, 0, 0, 0.65);
      color: #fff;
      font-size: 10px;
      line-height: 1.5;
      pointer-events: none;
    }
    .empty-slot .shortcut-badge { position: static; background: none; opacity: 0.8; }
```

> Si `.spell-icon-card` déclare déjà `position`, ne pas dupliquer la règle : garder celle
> qui existe et s'assurer qu'elle vaut `relative` (sinon le badge se positionnerait par
> rapport à la page).

- [ ] **Step 5 : Vérifier la compilation et la suite**

```bash
npx ng build --configuration development
npx ng test --watch=false --browsers=ChromeHeadless
```
Attendu : build complet sans erreur, `TOTAL: 251 SUCCESS`.

- [ ] **Step 6 : Commit**

```bash
git add frontend/src/app/components/board.component.ts
git commit -m "feat(shortcuts): barre de sorts en 2 rangees de 6 et badges de raccourci"
```

---

### Task 5 : Vérification finale

- [ ] **Step 1 : Suite complète**

```bash
npx ng test --watch=false --browsers=ChromeHeadless
```
Attendu : `TOTAL: 251 SUCCESS` (223 de baseline + 28 ajoutés), zéro échec.

- [ ] **Step 2 : Build de production**

```bash
npx ng build --configuration production
```
Attendu : `Application bundle generation complete`. Un avertissement de budget sur le
bundle initial (~1 Mo) est attendu et non bloquant ; le seuil d'erreur est à 2 Mo.

- [ ] **Step 3 : Vérification manuelle — affichage avec build**

`npm start`, puis sélectionner un build Xélor et aller sur **Freeplay** :
1. Les sorts s'affichent en **2 rangées de 6** (ou moins), dans l'ordre du deck.
2. Chaque carte porte son badge : `1`..`6` sur la 1ʳᵉ rangée, `alt+1`..`alt+6` sur la 2ᵉ.
3. La rangée « Sorts innés » affiche `ctrl+1`, `ctrl+2`, `ctrl+3`.
4. Aller sur **Timelines** : le même affichage en 2 rangées (plus de tri par élément).

- [ ] **Step 4 : Vérification manuelle — raccourcis**

Sur la page Freeplay, build sélectionné :
1. Presser `1` → le 1ᵉʳ sort du deck se met en surbrillance (comme un clic).
2. Cliquer une case → le sort part, comme d'habitude.
3. Presser `alt+1` → le 7ᵉ emplacement se sélectionne.
4. Presser `ctrl+1` **puis** `shift+1` → les deux sélectionnent le 1ᵉʳ sort inné.
5. Si le deck a un trou, presser la touche de cet emplacement → **rien** ne se sélectionne.

- [ ] **Step 5 : Vérification manuelle — le garde de saisie**

Ouvrir un champ texte de l'application (renommer une timeline, ou le nom d'un build) et
taper `1`, `2`, `3`.

Attendu : les chiffres s'écrivent normalement dans le champ et **aucun sort ne se
sélectionne**. C'est le garde qui empêche le clavier de détourner la saisie.

- [ ] **Step 6 : Vérification manuelle — sans build**

Retirer le build sélectionné, rester sur Freeplay :
1. Les sorts reviennent au **tri par élément** (Feu, Eau, Terre, Air, Neutre).
2. Les badges sont présents sur les 12 premières cartes et les raccourcis les visent.

- [ ] **Step 7 : Commit final si ajustements**

```bash
git add -A -- frontend/src
git commit -m "chore(shortcuts): ajustements suite a la verification manuelle"
```

---

## Ce que ce lot ne fait pas

- **Pas de lancement au clavier** : la case cible reste choisie à la souris.
- **Pas de raccourci de déplacement**, de fin de tour, ni de remappage configurable.
- **Aucune modification** du moteur de simulation, de la timeline ou du stockage.
- **Pas de harnais de test pour `board.component`** : le câblage (tâche 3) et l'affichage
  (tâche 4) sont vérifiés manuellement, la logique étant intégralement couverte par les
  tests du module pur.
