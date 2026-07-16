# Design — Conversion des ratios en dégâts / soins / boucliers

**Date :** 2026-07-15
**Branche :** à créer (`feat_degats-formules` proposée)
**Statut :** Validé, prêt pour plan d'implémentation

## Besoin

La page Résultats n'affiche aujourd'hui que les **ratios** des sorts. On veut
convertir ces ratios en **valeurs réelles** (dégâts, soins, boucliers) en
appliquant les formules Wakfu, à partir des stats du build.

## Constat sur l'existant (important)

Le moteur de formules **existe déjà et est conforme** aux formules Wakfu :
- `frontend/src/app/domain/combat-resolution/wakfu-combat-calculator.ts`
  implémente dégâts directs, soins, boucliers, conversion résistance
  (brute ↔ %), résistance soin. Les formules correspondent exactement à la
  référence fournie.
- Le chemin de simulation **générique** calcule déjà les dégâts via
  `DamageCalculatorService.calculateDamage` (dans
  `simulation-engine.service.ts`, méthode `computeSpellEffect`).

**Lacunes qui font qu'on ne voit que les ratios :**
1. Les sorts **Xélor** court-circuitent le calcul générique (la stratégie de
   classe retourne tôt) et les effets ne sont pas calculés :
   `xelor-execute-effect.service.ts` contient des `TODO: Appliquer les dégâts`.
2. Le chemin générique met `resistance: 0` en dur et ne dérive pas encore
   mêlée/distance/berserk/dos depuis le plateau (maîtrise « secondaire » unique).
3. Le critique est tiré **aléatoirement** (`Math.random`), ce qui rend les
   résultats non reproductibles.

Le travail est donc de **câbler et compléter** le moteur existant, pas de le
réécrire.

## Décisions de cadrage

| Sujet | Décision |
|-------|----------|
| Termes dépendant de la cible (résistance %, parade, barrière) | **Neutres (0)** pour l'instant : calcul avec les stats du **lanceur** uniquement (« dégâts avant mitigation cible »). Les ennemis n'ont pas de stats aujourd'hui. |
| Types d'effets | **Dégâts + soins + boucliers** (le moteur gère déjà les 3). |
| Maîtrises conditionnelles | **Ajouter mêlée + distance** (sélection selon la distance cible : ≤2 = mêlée, ≥3 = distance) ; dos via orientation ; crit ; + **maîtrise soin** pour les soins. **Berserk ignoré** (pas de PV). |
| Présentation | **Moyenne** (pondérée par le taux de crit) mise en avant **+ détail normal/crit** ; **déterministe** (plus de tirage aléatoire). |
| Architecture | **Approche A** : résolveur de maîtrises **pur** + point de calcul unique partagé par le chemin générique et le chemin Xélor. |

## Architecture

### 1. Modèle & stats

`frontend/src/app/models/build.model.ts` — `BuildStats` :
- ajouter `masteryMelee: number`, `masteryDistance: number`, `masteryHealing: number`.
- `masterySecondary` **conservé** (compat ; le résolveur utilise mêlée/distance).

`frontend/src/app/pages/build-editor.component.ts` (et/ou son modèle de formulaire) :
- trois champs de saisie supplémentaires (mêlée, distance, soin), alignés sur
  les champs de maîtrise existants.

`frontend/src/app/services/calculators/stats-calculator.service.ts` :
- propager `masteryMelee`, `masteryDistance`, `masteryHealing` dans `TotalStats`.
- Défaut **0** si absent → les builds existants restent valides.

### 2. Résolveur de maîtrises applicables (fonction pure — nouveau fichier)

Nouveau `frontend/src/app/domain/combat-resolution/applicable-mastery.ts` :

```ts
resolveApplicableMasterySum({
  element,        // élément du sort ('FIRE'|'WATER'|'EARTH'|'AIR'|'LIGHT'|'STASIS'|undefined)
  stats,          // maîtrises du lanceur
  distanceCases,  // distance Manhattan lanceur↔cible
  orientation,    // 'front' | 'side' | 'back'
  isCritical,
  isHeal,
}): number
```

Logique :
- maîtrise élémentaire selon l'élément ; pour **Lumière/Stasis** → la **plus
  haute** des 4 maîtrises élémentaires ;
- `+ (distanceCases <= 2 ? masteryMelee : masteryDistance)` ;
- `+ (orientation === 'back' ? backMastery : 0)` ;
- `+ (isCritical ? critMastery : 0)` ;
- `+ (isHeal ? masteryHealing : 0)`.
- Berserk **non appliqué** (pas de PV disponible).

Fonction pure → testable isolément.

### 3. Calcul d'effet déterministe (normal / crit / moyenne)

`simulation-engine.service.ts` :
- `SpellEffectResult` étendu avec `normalValue`, `critValue`, `averageValue`
  (par effet, pour dégâts/soins/boucliers).
- `computeSpellEffect` :
  - **supprime le tirage aléatoire** du critique ;
  - calcule la valeur **normale** (crit=false) et **critique** (crit=true) via
    `DamageCalculatorService` / `WakfuCombatCalculator` ;
  - calcule la **moyenne** = `normal × (1 − critRate/100) + crit × (critRate/100)` ;
  - utilise le résolveur (§2) pour la somme des maîtrises applicables, avec la
    **distance Manhattan** (lanceur↔cible), l'orientation et l'élément ;
  - résistance / parade / barrière = 0.

La distance et l'orientation sont dérivées de l'état du plateau au moment du
cast (positions + facing), comme le fait déjà `resolveOrientation`.

**Point à vérifier à l'implémentation (base normale vs critique) :** les sorts
ont des breakpoints séparés `NORMAL` et `CRITICAL`. Le calcul déterministe doit
extraire la base **normale** (breakpoint NORMAL) pour la valeur normale et la
base **critique** (breakpoint CRIT) pour la valeur critique. Il faut confirmer
si le multiplicateur critique ×1.25 s'applique **par-dessus** le ratio CRIT ou
est **déjà** intégré dans ce ratio, pour éviter un double comptage. À trancher
avec la validation de mécaniques (simulation-domain-specialist) pendant le plan.

### 4. Câblage du chemin Xélor

Router les effets **DEAL_DAMAGE / HEAL / SHIELD** des sorts Xélor vers le **même**
point de calcul (§3) et enregistrer `normalValue`/`critValue`/`averageValue` dans
le résultat d'action, pour qu'ils remontent à la page Résultats. Cela couvre :
- les effets directs des sorts Xélor (court-circuités aujourd'hui) ;
- les effets **différés** (`xelor-execute-effect.service.ts` : `executeDealDamage`,
  `executeHeal` — remplacer les TODO) ;
- l'**explosion Rouage** (`applyRouageDamage`) et le **soin Sinistro**
  (`applySinistroHealing`), qui doivent utiliser le calculateur avec les
  maîtrises applicables plutôt qu'une valeur brute.

Le plan d'implémentation énumérera précisément chaque site d'appel.

### 5. UI Résultats (`damage-summary.component.ts`)

- Afficher la **moyenne** en avant par action / étape / total.
- Rendre le détail **normal / critique** disponible (sous-ligne ou survol).
- Les totaux somment les **moyennes** (déterministe).

## Tests

- **Résolveur pur** (`applicable-mastery`) : sélection élémentaire (dont
  Lumière/Stasis = plus haute), mêlée (≤2) vs distance (≥3), dos, crit, soin ;
  berserk non appliqué.
- **Calcul déterministe** : normal / crit / moyenne pour une entrée connue,
  valeurs calculées à la main via la formule (mastery, DI, orientation, crit).
- **Round-trip** : un effet de sort avec base + stats connues → dégâts attendus.
- Réutiliser le pattern de tests existant (Jasmine/Karma).

## Hors périmètre (YAGNI)

- Pas de stats de cible (résistance / PV / parade / barrière) : neutres (0).
- Pas de maîtrise **berserk** ni de suivi de PV.
- Pas de refonte de la page Résultats au-delà de l'affichage moyenne + détail.
- Pas de gestion des états/statuts appliqués (niveau d'état ×1.25 en crit) —
  uniquement les valeurs directes dégâts/soins/boucliers.
