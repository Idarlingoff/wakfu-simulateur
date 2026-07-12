# Refonte UI — Restructure + Restyle complet + Accessibilité (Bloc A)

- **Date** : 2026-06-29
- **Statut** : conçu, en attente de relecture utilisateur
- **Périmètre** : Bloc A d'un programme plus large (voir « Programme global »). Frontend uniquement.

## Programme global (rappel du découpage)

L'objectif final de l'utilisateur recouvre plusieurs sous-systèmes indépendants, chacun avec son propre cycle spec → plan → implémentation :

| # | Sous-projet | Dépend de |
|---|---|---|
| **A** | Refonte UI : restructure + restyle complet + accessibilité | — |
| B | Comptes & authentification (backend + front) | — |
| C | Persistance BDD des builds/timelines + visibilité privé/public | B |
| D | Écran de comparaison de builds sur une timeline | A |
| E | Freeplay first-class | inclus dans A |
| F | Interface Sublimations (UI ; calcul des effets plus tard) | A |

**Ce spec ne couvre que le Bloc A.** Il crée les « maisons » et coquilles navigables des blocs B–F mais n'implémente ni comptes, ni persistance backend, ni moteur de comparaison, ni calcul de sublimations.

## Contexte / état actuel

- **Front monolithique** : `DashboardComponent` (~1160 lignes) regroupe sélecteurs build/timeline, board, résumé dégâts, résumé timeline et modales. Routes existantes : `/dashboard` et `/simulation` seulement.
- **Persistance** : builds & timelines vivent dans le `localStorage` (via `WakfuApiService`). Inchangé par le bloc A.
- **Backend** : entités/contrôleurs pour les données de jeu (sorts, passifs, statuts) uniquement. Aucune table utilisateur/build/timeline, aucune sécurité. Hors périmètre du bloc A.
- **Composants standalone Angular** déjà nombreux, avec beaucoup de CSS en `styles: []` inline par composant.

## Objectifs

1. Éclater le monolithe en sections routées, simples d'accès et de compréhension « pour tous ».
2. Restyle visuel **complet** via un design system maison (tokens CSS) avec **double thème clair + sombre**.
3. **Accessibilité WCAG 2.1 AA**.
4. **Pleinement responsive**, jusqu'au mobile (y compris interactions tactiles sur le board).
5. Préserver intégralement la logique métier existante (board, moteur de simulation, services) — on **réhéberge et restyle**, on ne réécrit pas.

## Non-objectifs (frontière de périmètre)

- Pas de comptes / authentification (bloc B).
- Pas de migration de persistance vers la BDD ni de visibilité privé/public (bloc C).
- Pas de moteur de comparaison de builds — seulement une coquille navigable (bloc D).
- Pas de calcul des effets de sublimations — l'UF d'ajout existe déjà (`sublimation-selector`), réorganisée mais non calculée (bloc F).

## Décisions actées (avec l'utilisateur)

- **Ambition** : refonte visuelle complète + restructure + a11y.
- **Navigation** : barre latérale gauche **repliable** (rail d'icônes ↔ étendue).
- **Sections** : Accueil · Builds · Timelines · Freeplay · Comparaison.
- **Thème** : design system maison, **clair + sombre** commutables, défaut = `prefers-color-scheme`.
- **Responsive** : pleinement responsive jusqu'au mobile.
- **Fondation technique** : design system maison (tokens CSS) + **Angular CDK** pour les primitives d'accessibilité/overlay/responsive. Pas de lib UI imposant un look.
- **Timeline build-agnostique** : le build n'est pas stocké dans la timeline ; on choisit avec quel build la jouer dans l'éditeur. C'est ce qui rend la comparaison (bloc D) possible (1 timeline × N builds).
- **Surface d'édition d'une timeline préservée** : **map à gauche + panneau de sorts à droite** (comme aujourd'hui). Le résumé des dégâts et le détail des ressources par étape partent sur une **vue/page « Résultats »** dédiée.

## Architecture

### App shell

`AppShellComponent` remplace la racine de layout actuelle :
- Sidebar repliable (Angular CDK) : rail d'icônes par défaut, étendue (icône + label) au survol/clic ; sur mobile → tiroir off-canvas déclenché par un bouton menu.
- Barre du haut : titre de la section courante, bascule de thème, emplacement « Compte » **réservé** (inerte tant que le bloc B n'est pas fait).
- `<router-outlet>` pour les zones de fonctionnalités.

Le `DashboardComponent` monolithique est démantelé : board, panneau de sorts, sélecteurs et résumés deviennent des composants réutilisables réhébergés dans les écrans. **Aucune logique board/moteur réécrite.**

### Routes (lazy par zone)

```
/                 Accueil (hub)
/builds           Liste des builds (cartes : créer / dupliquer / supprimer)
/builds/:id       Éditeur de build → onglets : Caractéristiques · Sorts · Passifs · Sublimations (à venir)
/timelines        Liste des timelines
/timelines/:id    Éditeur de timeline (map + panneau sorts + étapes + en-tête build/lecture)
/timelines/:id/resultats   Vue Résultats (résumé dégâts + ressources par étape)
/freeplay         Freeplay (board interactif, sélecteur de build optionnel, menu passifs Xel)
/comparaison      Comparaison (coquille navigable ; logique = bloc D)
```

L'ancien `/dashboard` redirige vers `/timelines` (ou Accueil) une fois la migration faite. `/simulation` est fusionné dans Timelines/Résultats.

### Contenu des écrans

- **Accueil** : builds & timelines récents, actions rapides (nouveau build, nouvelle timeline, freeplay), court texte d'explication. Porte d'entrée « simple à comprendre ».
- **Builds** : liste en cartes (nom, classe, PA/PM/PW, actions éditer/dupliquer/supprimer) + état vide ; éditeur en onglets réorganisant `build-form`, `spell-selector`, `passive-selector`, `sublimation-selector`.
- **Timelines** : liste en cartes + éditeur. Éditeur = **map (gauche) + panneau de sorts (droite)** + en-tête (nom, sélecteur « Build : … ▾ », contrôles de lecture précédent/jouer/suivant) + bande compacte de la liste d'étapes.
- **Timeline → Résultats** : résumé des dégâts + détail des ressources par étape (composants `damage-summary` / `timeline-summary` réhébergés ici).
- **Freeplay** : même surface map + sorts, sélecteur de build **optionnel**, menu passifs Xel Rouage existant.
- **Comparaison** : coquille avec le layout (choix d'1 timeline + N builds, zone de résultats) ; branchement réel au bloc D.

## Design system & thème

- **Trois couches** : palette brute (primitifs) → **tokens sémantiques** en variables CSS (`--bg`, `--surface`, `--text`, `--text-muted`, `--accent`, `--accent-2`, `--border`, `--danger`, `--success`, `--warning`, `--info`…) → usage par composant.
- **Thèmes** clair/sombre via `[data-theme="light|dark"]` sur la racine ; `ThemeService` (signal, persisté en localStorage, défaut `prefers-color-scheme`).
- Échelles : typographie, espacement, rayons, élévation (minimale), **motion** (respecte `prefers-reduced-motion`).
- **Accent** proposé : violet « temporel » (héritage Xélor) + or/ambre en accent secondaire. Palette exacte calée à l'implémentation et **validée en contraste AA sur les deux thèmes**.
- **Kit `ui/`** (réutilisable, testable isolément) : Button / IconButton, Card, Field (label+input+erreur), Select, Switch, Tabs, Dialog (CDK overlay + focus trap), Tooltip, Badge/Chip, EmptyState, Toast + `LiveAnnouncer`, SidebarNav/Item, AppBar, ResourceStat.

## Responsive

Via CDK `BreakpointObserver`. Seuils : mobile <640, tablette 640–1024, desktop >1024.
- **Sidebar** : rail d'icônes (desktop) ↔ tiroir off-canvas + bouton menu (mobile).
- **Layouts multi-colonnes** → colonne unique empilée sur petit écran ; panneaux secondaires (ressources, étapes) repliés en accordéons.
- **Board 13×13 sur mobile** (point dur) : conteneur **zoomable/défilable**, cibles tactiles ≥44px, interaction « sélectionner un sort puis taper une case » (déjà tactile). Le panneau de sorts passe sous la map sur mobile.

## Accessibilité (WCAG 2.1 AA)

- **Clavier** : navigation complète, focus visible, `skip-to-content`, ordre de tabulation logique, focus trap des dialogues (CDK).
- **ARIA** : landmarks (`nav`/`main`/`header`), `aria-current` sur l'item de nav actif, labels sur tous les contrôles, rôles de dialogue, régions live (`LiveAnnouncer`) pour annoncer résultats de simulation et changements de ressources.
- **Contraste** AA (4.5:1 texte, 3:1 large/UI) vérifié sur les deux thèmes.
- **Motion** : `prefers-reduced-motion` respecté.
- **Cibles tactiles** ≥44px sur mobile.
- **Formulaires** : labels associés, messages d'erreur, `aria-invalid`.
- **Board** : alternative textuelle (résumé d'état) + cases labellisées par coordonnées/contenu ; navigation clavier des cases si faisable (au minimum labels + résumé).

## Stratégie de migration (incrémentale / strangler)

L'app reste fonctionnelle et livrable à chaque phase.

1. **Fondations** : tokens CSS + `ThemeService` + premiers composants `ui/`, appliqués a minima sur l'existant. Pas de changement de structure.
2. **Coquille + routes** : `AppShell` (sidebar + `router-outlet`) + routes ; réhébergement des composants existants (board, panneau sorts, sélecteurs, résumés) dans Builds / Timelines / Freeplay **sans toucher à leur logique**. `/dashboard` redirige.
3. **Restyle écran par écran** avec le kit `ui/` + tokens ; construction de l'Accueil, de la vue Résultats de timeline, et de la coquille Comparaison.
4. **Responsive + a11y** : sidebar→tiroir, board tactile/zoom, empilement mobile ; passe a11y (focus, ARIA/landmarks, audit contraste AA sur les 2 thèmes, `prefers-reduced-motion`, alternative textuelle du board).

## Tests / vérification

- `ng build` vert à chaque phase (seul exécutable dans l'environnement courant — pas de Chrome/karma ; les specs sont écrites pour tourner en CI/local).
- Specs unitaires du kit `ui/` (Button, Field, focus-trap du Dialog, clavier du Select) + `ThemeService`.
- **A11y** : check automatisé (axe) + checklist manuelle (parcours clavier, focus visible, contraste AA, landmarks lecteur d'écran).
- **Non-régression** : logique board/moteur inchangée → risque faible ; smoke test « une timeline se simule toujours après réhébergement ».

## Risques & points de vigilance

- **Board tactile/mobile** : le plus gros effort UX ; prévoir zoom/scroll et cibles ≥44px dès la phase 4.
- **Volume de CSS inline existant** à centraliser dans les tokens : faire au fil du réhébergement, pas en big-bang.
- **Timeline build-agnostique** : vérifier que le flux actuel (build A sélectionné séparément) se mappe proprement sur « build choisi à la lecture » sans casser la simulation.
- **Coquilles (Comparaison, Sublimations, Compte)** : rester des placeholders inertes pour ne pas empiéter sur les blocs B/C/D/F.

## Suites

Après validation de ce spec → skill `writing-plans` pour le plan d'implémentation détaillé du bloc A. Les blocs B–F feront chacun l'objet d'un cycle séparé.
