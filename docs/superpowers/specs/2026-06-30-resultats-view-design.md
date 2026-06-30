# Design — Vue Résultats dédiée

**Date :** 2026-06-30
**Branche :** `feat_new-ihm`
**Statut :** validé en brainstorming, prêt pour le plan d'implémentation.

## Contexte

Dernière fonctionnalité de la refonte UI. Aujourd'hui les deux résumés de simulation — `<app-damage-summary>` (RÉSUMÉ DES DÉGÂTS) et `<app-timeline-summary>` — sont rendus **inline dans le dashboard** (au-dessus et en dessous du board). On les déplace vers un **écran dédié `/resultats`** pour que l'espace de travail (Timeline/Freeplay) reste centré sur le board.

Les deux composants sont **autonomes** : ils n'ont aucun `@Input` et tirent toutes leurs données des services (`SimulationService`, `TimelineService`, `BuildService`, `DataCacheService`, `StatsCalculatorService`). Ils possèdent déjà leurs **états vides** (ex. « Lancez la simulation pour voir les dégâts »). Les déplacer ne change donc pas leur comportement : sur `/resultats` ils affichent les résultats du dernier run, ou leur état vide.

## Décisions de conception (validées)

- **Route `/resultats`** ajoutée, avec un item **« Résultats »** dans la sidebar (icône `chart`), placé **après Freeplay** : *Accueil · Builds · Timelines · Freeplay · Résultats · Comparaison*.
- **Retirer** `<app-damage-summary>` et `<app-timeline-summary>` du dashboard → workspace = board + sélecteurs uniquement. Une seule place pour les résultats.
- **Accueil** : ajouter une carte « Résultats » (les cartes reflètent les sections de la sidebar).

## Non-objectifs

- Aucun changement à la logique interne des résumés, ni au moteur de simulation.
- Pas de nouvelles données/agrégations : on réutilise les composants tels quels.

## Architecture

```
/resultats → ResultatsPageComponent
               ├─ en-tête identitaire (icône chart + "Résultats" + sous-titre)
               ├─ <app-damage-summary>
               └─ <app-timeline-summary>
```

Le dashboard ne référence plus les deux résumés.

## Composants / fichiers

| Fichier | Action | Rôle |
|---|---|---|
| `pages/resultats-page.component.ts` (+spec) | **créer** | En-tête + `<app-damage-summary>` + `<app-timeline-summary>`. |
| `app.routes.ts` | **modifier** | Ajouter `{ path: 'resultats', component: ResultatsPageComponent }`. |
| `ui/app-sidebar.component.ts` (+ spec si compte d'items) | **modifier** | Ajouter l'item nav « Résultats » (icône `chart`, path `/resultats`) après Freeplay. |
| `pages/home.component.ts` | **modifier** | Ajouter une carte « Résultats » (icône `chart`, path `/resultats`) dans le tableau `links`. |
| `components/dashboard.component.ts` | **modifier** | Retirer les éléments `<app-damage-summary>` et `<app-timeline-summary>` du template, et leurs imports (`DamageSummaryComponent`, `TimelineSummaryComponent`). |

## Tests

- `resultats-page.spec` : rend l'en-tête (« Résultats ») + un `<app-damage-summary>` + un `<app-timeline-summary>`. Les deux résumés injectent `DataCacheService`/HttpClient → les neutraliser en les retirant des imports de la page via `overrideComponent(..., { remove: { imports: [...] }, add: { schemas: [CUSTOM_ELEMENTS_SCHEMA] } })` (mêmes éléments inertes ; on vérifie leur présence DOM).
- `app-sidebar.spec` : si un test assertait le nombre d'items, le passer de 5 à 6 et ajouter « Résultats ».
- `home.spec` : le test « rend une carte par section » passe de 4 à 5 cartes.

## Séquencement suggéré

1. `ResultatsPageComponent` + route + spec.
2. Sidebar + carte accueil + retrait des résumés du dashboard (+ mises à jour de specs).

Chaque tâche : `ng build` comme barrière (karma indisponible — pas de Chrome), un commit par tâche, branche `feat_new-ihm`.
