# Conversion des ratios en dégâts/soins/boucliers — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir les ratios des sorts en valeurs réelles (dégâts, soins, boucliers) via le moteur de formules Wakfu existant, de façon déterministe (normal/critique/moyenne), avec les stats du lanceur.

**Architecture:** Un résolveur de maîtrises **pur** (`applicable-mastery.ts`) centralise la logique « somme des maîtrises applicables ». Un point de calcul unique `computeEffectValues` (dans `DamageCalculatorService`) produit `{ normal, crit, average }` sans tirage aléatoire, réutilisé par le chemin de simulation générique ET les sites de dégâts Xélor (explosion Rouage, soin Sinistro, effets différés). La page Résultats affiche la moyenne + le détail normal/crit.

**Tech Stack:** Angular 19, TypeScript, Jasmine/Karma (`ng test`). Navigateur de test : Chrome-for-Testing via `CHROME_BIN` (déjà installé sous `frontend/chrome/...`).

**Rappel test env :**
```bash
export CHROME_BIN="/Users/lilia/IdeaProjects/WakfuApp/wakfu-simulateur/frontend/chrome/mac_arm-150.0.7871.115/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"
```
Tests : `cd frontend && npx ng test --watch=false --browsers=ChromeHeadless --include='<glob>'`

**Fait avéré (donnée) — multiplicateur critique :** les breakpoints ont des ratios `NORMAL` et `CRIT` distincts, et **le ratio CRIT inclut déjà le ×1.25** (ex. Désynchronisation : NORMAL 84 → CRIT 105 = ×1.25 ; Horloge : 150 → 187). Donc pour la valeur critique d'un DEAL_DAMAGE, on utilise la base CRIT **sans** réappliquer le ×1.25 (on ajoute seulement la maîtrise critique). Pour les soins/boucliers (pas de breakpoint CRIT), le crit applique ×1.25 sur la base normale.

---

## File Structure

- **Create** `frontend/src/app/domain/combat-resolution/applicable-mastery.ts` — fonction pure `resolveApplicableMasterySum`.
- **Create** `frontend/src/app/domain/combat-resolution/applicable-mastery.spec.ts` — tests du résolveur.
- **Modify** `frontend/src/app/models/build.model.ts` — `masteryMelee`/`masteryDistance`/`masteryHealing` sur `BuildStats`.
- **Modify** `frontend/src/app/services/calculators/stats-calculator.service.ts` — mapping vers `TotalStats`.
- **Modify** `frontend/src/app/pages/build-editor.component.ts` — trois champs de saisie.
- **Modify** `frontend/src/app/services/calculators/damage-calculator.service.ts` — `computeEffectValues` (+ tests).
- **Create** `frontend/src/app/services/calculators/damage-calculator.service.spec.ts` — tests du calcul déterministe.
- **Modify** `frontend/src/app/services/calculators/simulation-engine.service.ts` — `SpellEffectResult`/`SimulationActionResult` étendus ; `computeSpellEffect` déterministe ; distance.
- **Modify** `frontend/src/app/services/simulation.service.ts` — agrégation (moyenne).
- **Modify** `frontend/src/app/services/strategies/xelor-stragegy/xelor-mechanisms.service.ts` — Rouage/Sinistro via `computeEffectValues`.
- **Modify** `frontend/src/app/services/strategies/xelor-stragegy/xelor-execute-effect.service.ts` — TODO différés.
- **Modify** `frontend/src/app/components/damage-summary.component.ts` — affichage moyenne + détail.

**Conventions repo :** services `providedIn:'root'` ; tests `TestBed` + `describe/it` Jasmine ; fonctions pures dans `domain/`.

---

## Task 1: Résolveur de maîtrises applicables (fonction pure, TDD)

**Files:**
- Create: `frontend/src/app/domain/combat-resolution/applicable-mastery.ts`
- Create: `frontend/src/app/domain/combat-resolution/applicable-mastery.spec.ts`

- [ ] **Step 1: Écrire les tests qui échouent**

Créer `frontend/src/app/domain/combat-resolution/applicable-mastery.spec.ts` :

```ts
import { resolveApplicableMasterySum, ApplicableMasteryStats } from './applicable-mastery';

const baseStats: ApplicableMasteryStats = {
  masteryFire: 100, masteryWater: 200, masteryEarth: 300, masteryAir: 400,
  masteryMelee: 50, masteryDistance: 70, backMastery: 30, critMastery: 40, masteryHealing: 60,
};

describe('resolveApplicableMasterySum', () => {
  it('prend la maitrise elementaire de l element du sort', () => {
    expect(resolveApplicableMasterySum({ element: 'FIRE', stats: baseStats, distanceCases: 1, orientation: 'front', isCritical: false, isHeal: false }))
      .toBe(100 + 50); // feu + melee (distance 1)
  });

  it('prend la plus haute elementaire pour LIGHT', () => {
    expect(resolveApplicableMasterySum({ element: 'LIGHT', stats: baseStats, distanceCases: 3, orientation: 'front', isCritical: false, isHeal: false }))
      .toBe(400 + 70); // plus haute (air) + distance (distance 3)
  });

  it('applique melee si distance <= 2 et distance si >= 3', () => {
    const meleeSum = resolveApplicableMasterySum({ element: 'AIR', stats: baseStats, distanceCases: 2, orientation: 'front', isCritical: false, isHeal: false });
    const distSum = resolveApplicableMasterySum({ element: 'AIR', stats: baseStats, distanceCases: 3, orientation: 'front', isCritical: false, isHeal: false });
    expect(meleeSum).toBe(400 + 50);
    expect(distSum).toBe(400 + 70);
  });

  it('ajoute la maitrise dos si orientation back', () => {
    expect(resolveApplicableMasterySum({ element: 'FIRE', stats: baseStats, distanceCases: 1, orientation: 'back', isCritical: false, isHeal: false }))
      .toBe(100 + 50 + 30);
  });

  it('ajoute la maitrise critique si isCritical', () => {
    expect(resolveApplicableMasterySum({ element: 'FIRE', stats: baseStats, distanceCases: 1, orientation: 'front', isCritical: true, isHeal: false }))
      .toBe(100 + 50 + 40);
  });

  it('ajoute la maitrise soin si isHeal', () => {
    expect(resolveApplicableMasterySum({ element: 'FIRE', stats: baseStats, distanceCases: 1, orientation: 'front', isCritical: false, isHeal: true }))
      .toBe(100 + 50 + 60);
  });
});
```

- [ ] **Step 2: Lancer le test → échec (module absent)**

Run: `cd frontend && npx ng test --watch=false --browsers=ChromeHeadless --include='**/applicable-mastery.spec.ts'`
Expected: FAIL — module `./applicable-mastery` introuvable.

- [ ] **Step 3: Implémenter le résolveur**

Créer `frontend/src/app/domain/combat-resolution/applicable-mastery.ts` :

```ts
import { resolveElementalMastery } from '../../utils/mastery-utils';

export interface ApplicableMasteryStats {
  masteryFire: number;
  masteryWater: number;
  masteryEarth: number;
  masteryAir: number;
  masteryMelee?: number;
  masteryDistance?: number;
  backMastery?: number;
  critMastery?: number;
  masteryHealing?: number;
}

export interface ApplicableMasteryInput {
  element?: string;
  stats: ApplicableMasteryStats;
  distanceCases: number;
  orientation: 'front' | 'side' | 'back';
  isCritical: boolean;
  isHeal: boolean;
}

/**
 * Somme des maîtrises applicables (formule Wakfu), stats du lanceur uniquement.
 * - élémentaire de l'élément du sort (la plus haute pour Lumière/Stasis via resolveElementalMastery) ;
 * - mêlée si distance <= 2, distance si >= 3 ;
 * - dos si orientation 'back' ; critique si coup critique ; soin si effet de soin.
 * Berserk non appliqué (pas de PV disponible).
 */
export function resolveApplicableMasterySum(input: ApplicableMasteryInput): number {
  const { stats } = input;
  let sum = resolveElementalMastery(stats, input.element);

  sum += input.distanceCases <= 2 ? (stats.masteryMelee ?? 0) : (stats.masteryDistance ?? 0);
  if (input.orientation === 'back') sum += stats.backMastery ?? 0;
  if (input.isCritical) sum += stats.critMastery ?? 0;
  if (input.isHeal) sum += stats.masteryHealing ?? 0;

  return sum;
}
```

- [ ] **Step 4: Lancer les tests → vert**

Run: `cd frontend && npx ng test --watch=false --browsers=ChromeHeadless --include='**/applicable-mastery.spec.ts'`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/lilia/IdeaProjects/WakfuApp/wakfu-simulateur
git add frontend/src/app/domain/combat-resolution/applicable-mastery.ts frontend/src/app/domain/combat-resolution/applicable-mastery.spec.ts
git commit -m "feat(combat): resolveur pur des maitrises applicables"
```

---

## Task 2: Étendre le build (mêlée / distance / soin)

**Files:**
- Modify: `frontend/src/app/models/build.model.ts`
- Modify: `frontend/src/app/services/calculators/stats-calculator.service.ts`
- Modify: `frontend/src/app/pages/build-editor.component.ts`

- [ ] **Step 1: Ajouter les champs au modèle**

Dans `frontend/src/app/models/build.model.ts`, dans `interface BuildStats`, après `backMastery: number;` (ligne 43), ajouter :

```ts
  masteryMelee: number;
  masteryDistance: number;
  masteryHealing: number;
```

- [ ] **Step 2: Propager dans TotalStats (stats-calculator)**

Ouvrir `frontend/src/app/services/calculators/stats-calculator.service.ts`. `TotalStats` déclare déjà `meleeMastery?`, `distanceMastery?`, `healingMastery?`. Dans la construction de l'objet `TotalStats` retourné par `calculateTotalStats` (chercher le `return { ... }` principal, autour des champs `masterySecondary`, `backMastery`), ajouter le mapping depuis le build :

```ts
      meleeMastery: build.stats.masteryMelee ?? 0,
      distanceMastery: build.stats.masteryDistance ?? 0,
      healingMastery: build.stats.masteryHealing ?? 0,
```

(Adapter le nom de la variable du build si différent ; utiliser la même source que `masterySecondary`.)

- [ ] **Step 3: Ajouter les 3 champs à l'éditeur de build**

Dans `frontend/src/app/pages/build-editor.component.ts`, repérer les champs de saisie des maîtrises existants (`masterySecondary`, `backMastery`) et ajouter trois champs numériques calqués dessus, liés à `masteryMelee`, `masteryDistance`, `masteryHealing` du build édité (mêmes `[(ngModel)]`/handlers que les autres stats). Libellés : « Maîtrise mêlée », « Maîtrise distance », « Maîtrise soin ».

- [ ] **Step 4: Vérifier compilation + build**

Run: `cd frontend && npx tsc --noEmit -p tsconfig.app.json`
Expected: aucune erreur.
Run: `cd frontend && npx ng build 2>&1 | grep -iE "error|bundle generation complete" | tail -3`
Expected: bundle generation complete, pas d'ERROR.

- [ ] **Step 5: Commit**

```bash
cd /Users/lilia/IdeaProjects/WakfuApp/wakfu-simulateur
git add frontend/src/app/models/build.model.ts frontend/src/app/services/calculators/stats-calculator.service.ts frontend/src/app/pages/build-editor.component.ts
git commit -m "feat(build): maitrises melee/distance/soin (modele + stats + editeur)"
```

---

## Task 3: Calcul d'effet déterministe (normal/crit/moyenne) — cœur

**Files:**
- Modify: `frontend/src/app/services/calculators/damage-calculator.service.ts`
- Create: `frontend/src/app/services/calculators/damage-calculator.service.spec.ts`

Ce point de calcul est réutilisé par le moteur générique (Task 4bis) et les sites Xélor (Task 4). Il ne tire pas le critique au hasard.

- [ ] **Step 1: Écrire les tests qui échouent**

Créer `frontend/src/app/services/calculators/damage-calculator.service.spec.ts` :

```ts
import { DamageCalculatorService } from './damage-calculator.service';

describe('DamageCalculatorService.computeEffectValues', () => {
  let svc: DamageCalculatorService;
  beforeEach(() => { svc = new DamageCalculatorService(); });

  const stats = {
    masteryFire: 100, masteryWater: 0, masteryEarth: 0, masteryAir: 0,
    masteryMelee: 0, masteryDistance: 0, backMastery: 0, critMastery: 0, masteryHealing: 0,
    dommageInflict: 0, critRate: 0,
  };

  it('degats: base normale, pas de resistance, mastery 100% double la base', () => {
    const r = svc.computeEffectValues({
      effectType: 'DEAL_DAMAGE', normalBase: 100, critBase: 125,
      element: 'FIRE', stats, distanceCases: 1, orientation: 'front',
    });
    // normal: 100 * (1 + 100/100) = 200
    expect(r.normal).toBe(200);
  });

  it('degats crit: utilise critBase SANS reappliquer x1.25 (critBase inclut deja le x1.25)', () => {
    const r = svc.computeEffectValues({
      effectType: 'DEAL_DAMAGE', normalBase: 100, critBase: 125,
      element: 'FIRE', stats, distanceCases: 1, orientation: 'front',
    });
    // crit: 125 * (1 + 100/100) = 250  (et NON 125 * 2 * 1.25)
    expect(r.crit).toBe(250);
  });

  it('moyenne ponderee par critRate', () => {
    const r = svc.computeEffectValues({
      effectType: 'DEAL_DAMAGE', normalBase: 100, critBase: 125,
      element: 'FIRE', stats: { ...stats, critRate: 50 }, distanceCases: 1, orientation: 'front',
    });
    // normal 200, crit 250 -> moyenne = 200*0.5 + 250*0.5 = 225
    expect(r.average).toBe(225);
  });

  it('soin sans critBase: le crit applique x1.25 sur la base normale', () => {
    const r = svc.computeEffectValues({
      effectType: 'HEAL', normalBase: 100,
      element: 'FIRE', stats: { ...stats, masteryHealing: 0 }, distanceCases: 1, orientation: 'front',
    });
    // normal: 100 ; crit: 100 * 1.25 = 125
    expect(r.normal).toBe(100);
    expect(r.crit).toBe(125);
  });
});
```

- [ ] **Step 2: Lancer → échec (`computeEffectValues` absente)**

Run: `cd frontend && npx ng test --watch=false --browsers=ChromeHeadless --include='**/damage-calculator.service.spec.ts'`
Expected: FAIL — `computeEffectValues is not a function`.

- [ ] **Step 3: Implémenter `computeEffectValues`**

Dans `frontend/src/app/services/calculators/damage-calculator.service.ts`, ajouter l'import en tête :

```ts
import { resolveApplicableMasterySum, ApplicableMasteryStats } from '../../domain/combat-resolution/applicable-mastery';
```

Ajouter les types (près des autres interfaces) :

```ts
export interface EffectValueStats extends ApplicableMasteryStats {
  dommageInflict: number;
  critRate: number;
}

export interface EffectValueInput {
  effectType: 'DEAL_DAMAGE' | 'HEAL' | 'GIVE_ARMOR';
  normalBase: number;
  /** Base critique (pour DEAL_DAMAGE : ratio CRIT, qui inclut déjà le ×1.25). Absent = crit dérivé de normalBase. */
  critBase?: number;
  element?: string;
  stats: EffectValueStats;
  distanceCases: number;
  orientation: 'front' | 'side' | 'back';
}

export interface EffectValues {
  normal: number;
  crit: number;
  average: number;
}
```

Ajouter la méthode dans la classe :

```ts
  /**
   * Calcule les valeurs déterministes { normal, crit, average } d'un effet.
   * - Pas de tirage aléatoire.
   * - DEAL_DAMAGE avec critBase : la base CRIT inclut déjà le ×1.25 → on n'ajoute PAS le
   *   multiplicateur critique de la formule (seulement la maîtrise critique).
   * - Sans critBase (soin/bouclier) : le crit applique ×1.25 sur la base normale.
   * - Résistance / parade / barrière = 0 (stats cible non disponibles).
   */
  computeEffectValues(input: EffectValueInput): EffectValues {
    const isHeal = input.effectType === 'HEAL';
    const masteryNormal = resolveApplicableMasterySum({
      element: input.element, stats: input.stats, distanceCases: input.distanceCases,
      orientation: input.orientation, isCritical: false, isHeal,
    });
    const masteryCrit = resolveApplicableMasterySum({
      element: input.element, stats: input.stats, distanceCases: input.distanceCases,
      orientation: input.orientation, isCritical: true, isHeal,
    });

    const di = input.stats.dommageInflict ?? 0;

    const normal = this.calculator.calculateDirectDamage({
      baseValue: input.normalBase,
      applicableMasterySum: masteryNormal,
      damageInflictedBonusSum: di,
      resistancePercent: 0,
      isCritical: false,
      orientation: input.orientation,
    }).value;

    const hasCritBase = typeof input.critBase === 'number';
    const crit = this.calculator.calculateDirectDamage({
      baseValue: hasCritBase ? input.critBase! : input.normalBase,
      applicableMasterySum: masteryCrit,
      damageInflictedBonusSum: di,
      resistancePercent: 0,
      // Si critBase fournie, elle inclut déjà le ×1.25 → ne pas le réappliquer.
      isCritical: !hasCritBase,
      orientation: input.orientation,
    }).value;

    const critRate = Math.min(100, Math.max(0, input.stats.critRate ?? 0)) / 100;
    const average = Math.round(normal * (1 - critRate) + crit * critRate);

    return { normal, crit, average };
  }
```

Note : `this.calculator` (WakfuCombatCalculator) est déjà un champ privé. `calculateDirectDamage` applique orientation/DI/mastery/résistance/(crit ×1.25 si isCritical). Pour les soins/boucliers on réutilise volontairement `calculateDirectDamage` avec résistance 0 : la formule de dégâts sans résistance ni barrière ni parade est équivalente à base×mastery×crit×DI, ce qui suffit pour l'affichage « valeur » de soin/bouclier avant termes cible. (Les soins/boucliers passent `isHeal` pour la maîtrise soin.)

- [ ] **Step 4: Lancer → vert**

Run: `cd frontend && npx ng test --watch=false --browsers=ChromeHeadless --include='**/damage-calculator.service.spec.ts'`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/lilia/IdeaProjects/WakfuApp/wakfu-simulateur
git add frontend/src/app/services/calculators/damage-calculator.service.ts frontend/src/app/services/calculators/damage-calculator.service.spec.ts
git commit -m "feat(combat): computeEffectValues deterministe (normal/crit/moyenne)"
```

---

## Task 4: Étendre les résultats + brancher le moteur générique

**Files:**
- Modify: `frontend/src/app/services/calculators/simulation-engine.service.ts`
- Modify: `frontend/src/app/services/simulation.service.ts`

- [ ] **Step 1: Étendre les types de résultat**

Dans `simulation-engine.service.ts`, `interface SpellEffectResult` (≈ ligne 106) : ajouter les champs déterministes :

```ts
export interface SpellEffectResult {
  effectType: string;
  element?: string;
  damage?: number;
  heal?: number;
  shield?: number;
  isCritical?: boolean;
  breakdown?: any;
  normalValue?: number;
  critValue?: number;
  averageValue?: number;
}
```

Dans `interface SimulationActionResult` (≈ ligne 116), ajouter :

```ts
  averageDamage?: number;
  averageHeal?: number;
  averageShield?: number;
```

- [ ] **Step 2: Rendre `computeSpellEffect` déterministe via `computeEffectValues`**

Le `computeSpellEffect` actuel (≈ ligne 899) reçoit `(effect, stats, isCritical, orientation)` et n'a qu'une base. On veut normal/crit/moyenne. La base critique doit venir du breakpoint CRIT. Modifier la boucle appelante (≈ lignes 715-733) pour extraire les effets NORMAL **et** CRIT et fournir `normalBase`/`critBase` :

Remplacer le bloc d'extraction/boucle (≈ 715-733) par :

```ts
    const normalEffects = this.extractSpellEffects(spell, 'NORMAL');
    const critEffects = this.extractSpellEffects(spell, 'CRIT');

    const effectResults: SpellEffectResult[] = [];
    let totalDamage = 0, totalHeal = 0, totalShield = 0;
    let avgDamage = 0, avgHeal = 0, avgShield = 0;

    const targetEntity = this.boardService.getEntityAtPosition(targetPosition);
    const orientation = this.resolveOrientation(targetEntity?.facing?.direction) as 'front' | 'side' | 'back';
    const distanceCases = this.manhattanDistanceToTarget(context, targetPosition);

    for (let i = 0; i < normalEffects.length; i++) {
      const eff = normalEffects[i];
      const critBase = critEffects[i]?.type === eff.type ? critEffects[i].baseValue : undefined;
      const values = this.damageCalculator.computeEffectValues({
        effectType: eff.type as 'DEAL_DAMAGE' | 'HEAL' | 'GIVE_ARMOR',
        normalBase: eff.baseValue,
        critBase,
        element: eff.element,
        stats: contextualStats as any,
        distanceCases,
        orientation,
      });

      const result: SpellEffectResult = {
        effectType: eff.type, element: eff.element,
        normalValue: values.normal, critValue: values.crit, averageValue: values.average,
      };
      if (eff.type === 'DEAL_DAMAGE') { result.damage = values.normal; totalDamage += values.normal; avgDamage += values.average; }
      else if (eff.type === 'HEAL') { result.heal = values.normal; totalHeal += values.normal; avgHeal += values.average; }
      else if (eff.type === 'GIVE_ARMOR') { result.shield = values.normal; totalShield += values.normal; avgShield += values.average; }
      effectResults.push(result);
    }
```

Puis, là où l'objet `SimulationActionResult` du sort est construit (chercher le `return { ... damage: totalDamage ... }` de cette méthode d'exécution de sort), ajouter :

```ts
      averageDamage: Math.round(avgDamage),
      averageHeal: Math.round(avgHeal),
      averageShield: Math.round(avgShield),
```

Supprimer l'ancien tirage `isCritical` par `calculateDamage({ baseDamage: 0, ... }).isCritical` (≈ lignes 706-716) devenu inutile pour l'affichage (le déterminisme remplace le hasard). Si `contextualStats` n'a pas les champs `masteryMelee`/`masteryDistance`/`masteryHealing`, ils valent `undefined` → 0 dans le résolveur (OK).

- [ ] **Step 3: Ajouter le helper de distance Manhattan**

Dans `simulation-engine.service.ts`, ajouter (près de `resolveOrientation`) :

```ts
  private manhattanDistanceToTarget(context: SimulationContext, target: { x: number; y: number }): number {
    const p = context.playerPosition ?? context.currentPosition;
    if (!p) return 1;
    return Math.abs(p.x - target.x) + Math.abs(p.y - target.y);
  }
```

- [ ] **Step 4: Agréger la moyenne dans simulation.service**

Dans `frontend/src/app/services/simulation.service.ts`, dans `aggregateStepTotals` (≈ ligne 138) et `buildStatsFromSteps` (≈ ligne 341), là où on somme `action.damage || 0`, ajouter la somme parallèle des moyennes. Ajouter au type `SimulationResult`/`SimulationStats` (ligne 18 et voisines) un champ `averageDamage: number` et sommer `action.averageDamage || action.damage || 0`. (Suivre exactement le motif existant de `totalDamage`.)

- [ ] **Step 5: tsc + suite ciblée**

Run: `cd frontend && npx tsc --noEmit -p tsconfig.app.json`
Expected: aucune erreur.
Run: `cd frontend && export CHROME_BIN="…/Google Chrome for Testing" && npx ng test --watch=false --browsers=ChromeHeadless --include='**/simulation*.spec.ts'`
Expected: PASS (les specs existantes ne régressent pas).

- [ ] **Step 6: Commit**

```bash
cd /Users/lilia/IdeaProjects/WakfuApp/wakfu-simulateur
git add frontend/src/app/services/calculators/simulation-engine.service.ts frontend/src/app/services/simulation.service.ts
git commit -m "feat(sim): degats deterministes normal/crit/moyenne dans le chemin generique"
```

---

## Task 5: Brancher les sites de dégâts Xélor

**Files:**
- Modify: `frontend/src/app/services/strategies/xelor-stragegy/xelor-mechanisms.service.ts`
- Modify: `frontend/src/app/services/strategies/xelor-stragegy/xelor-execute-effect.service.ts`

Les sites Xélor produisent une **base** brute (charges×17 pour Rouage, montant pour Sinistro/différés). On la fait passer par `computeEffectValues` avec les stats du lanceur.

- [ ] **Step 1: Récupérer les stats du lanceur dans le contexte**

Le `SimulationContext` porte déjà `activePassiveIds`, positions, etc. Vérifier comment les autres calculs Xélor accèdent aux stats (chercher `TotalStats` / `statsCalculator` / `stats` dans le contexte). Si le contexte ne porte pas les stats, injecter `DamageCalculatorService` dans `xelor-mechanisms.service.ts` et utiliser les stats déjà disponibles pour le lanceur (mêmes stats que `computeSpellEffect`). **Étape de vérification** : lire comment `computeSpellEffect` obtient `contextualStats` et reproduire la même source pour le Rouage.

- [ ] **Step 2: Rouage — convertir la base en valeurs via `computeEffectValues`**

Dans `applyRouageDamage` (≈ ligne 263), `damage = effectiveCharges * perChargeAmount` est la **base**. Remplacer l'assignation `damage` du `SimulationActionResult` par les valeurs calculées :

```ts
const values = this.damageCalculator.computeEffectValues({
  effectType: 'DEAL_DAMAGE',
  normalBase: damage,
  element: XelorMechanismsService.ROUAGE_STATUS_EFFECT_CONFIG.element, // 'Light'
  stats: casterStats as any,
  distanceCases: 3,        // explosion de zone : distance non pertinente -> distance par défaut
  orientation: 'front',
});
```

et dans l'objet `explosionResult`, remplacer `damage,` par :

```ts
  damage: values.normal,
  averageDamage: values.average,
```

Ajouter `element: 'Light'` est déjà géré via `resolveElementalMastery` (défaut = plus haute élémentaire, car 'light' tombe dans le `default`). `casterStats` : issu de l'étape 1.

- [ ] **Step 3: Sinistro — même conversion (soin)**

Dans `applySinistroHealing` (≈ ligne 348), identifier la valeur de soin de base et la faire passer par `computeEffectValues({ effectType: 'HEAL', normalBase: <base>, element: 'Light', stats: casterStats, distanceCases: 1, orientation: 'front' })`, puis enregistrer `heal: values.normal` + `averageHeal: values.average` dans le `SimulationActionResult` produit.

- [ ] **Step 4: Effets différés — remplacer les TODO**

Dans `xelor-execute-effect.service.ts`, `executeDealDamage` (≈ ligne 83) et `executeHeal` (≈ ligne 96) : remplacer le `// TODO` par un appel à `computeEffectValues` (base = `effect.params['amount']`, élément = `effect.params['element']`) et enregistrer le résultat dans le canal de résultats utilisé par ce service (chercher comment les autres effets de ce service remontent un résultat / `triggeredActions`). **Étape de vérification** : lire comment un effet exécuté ici est rattaché à un `SimulationActionResult`.

- [ ] **Step 5: tsc + build + suite complète**

Run: `cd frontend && npx tsc --noEmit -p tsconfig.app.json`
Run: `cd frontend && export CHROME_BIN="…/Google Chrome for Testing" && npx ng test --watch=false --browsers=ChromeHeadless`
Expected: toute la suite verte.

- [ ] **Step 6: Commit**

```bash
cd /Users/lilia/IdeaProjects/WakfuApp/wakfu-simulateur
git add frontend/src/app/services/strategies/xelor-stragegy/xelor-mechanisms.service.ts frontend/src/app/services/strategies/xelor-stragegy/xelor-execute-effect.service.ts
git commit -m "feat(xelor): degats/soins Rouage-Sinistro-differes via computeEffectValues"
```

---

## Task 6: Affichage moyenne + détail normal/crit (page Résultats)

**Files:**
- Modify: `frontend/src/app/components/damage-summary.component.ts`

- [ ] **Step 1: Afficher la moyenne par action + détail normal/crit**

Dans `damage-summary.component.ts`, là où chaque action affiche `action.damage`, afficher `action.averageDamage ?? action.damage` comme valeur principale, et ajouter une sous-ligne/tooltip avec le détail normal/crit issu de `action.effects` (`normalValue`/`critValue`). Le total (`totalDamage()`) doit refléter la somme des moyennes (déjà agrégée en Task 4). Suivre le style existant des `step-card`/`action-row`.

- [ ] **Step 2: Vérification visuelle (preview)**

Démarrer le serveur (`preview_start`), ouvrir la page Résultats après avoir joué quelques sorts en Freeplay Xel Rouage, et vérifier :
1. Les dégâts affichés ne sont plus les ratios bruts mais des valeurs calculées (≥ base quand des maîtrises > 0).
2. La moyenne est mise en avant, le détail normal/crit visible.
3. Aucune erreur console.
Fournir une capture (`preview_screenshot`).

- [ ] **Step 3: Commit**

```bash
cd /Users/lilia/IdeaProjects/WakfuApp/wakfu-simulateur
git add frontend/src/app/components/damage-summary.component.ts
git commit -m "feat(ui): page Resultats affiche moyenne + detail normal/crit"
```

---

## Notes de vérification du plan (self-review)

- **Couverture spec :** résolveur maîtrises pur (T1), extension build mêlée/distance/soin (T2), calcul déterministe normal/crit/moyenne avec ×1.25 correct (T3), types résultat + chemin générique + distance (T4), câblage Xélor Rouage/Sinistro/différés (T5), UI moyenne+détail (T6). Cible neutre (0) : appliqué partout (résistance 0). ✅
- **Cohérence des noms :** `resolveApplicableMasterySum`, `computeEffectValues`, `EffectValues`, `normalValue/critValue/averageValue`, `averageDamage/averageHeal/averageShield`, `manhattanDistanceToTarget` — cohérents entre tâches. ✅
- **Points à vérifier à l'exécution (signalés dans les étapes) :** source exacte des `casterStats` côté Xélor (T5 step 1) et canal de résultat des effets différés (T5 step 4) — étapes de vérification explicites car dépendantes de code non figé ici. Le multiplicateur ×1.25 est tranché par la donnée (ratio CRIT inclut déjà le ×1.25).
- **Détail :** `element: 'Light'` du Rouage passe par le `default` de `resolveElementalMastery` (plus haute élémentaire) — conforme au « Lumière = plus haute ».
