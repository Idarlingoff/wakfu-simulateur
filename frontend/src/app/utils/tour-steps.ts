/**
 * Les etapes de la visite guidee, en DONNEES.
 *
 * Les cibles sont designees par un attribut `data-tour`, jamais par une classe CSS : une
 * classe se renomme au fil d'un restylage sans que personne ne pense a la visite, alors
 * qu'un `data-tour` est un contrat explicite qu'on ne casse pas par accident.
 *
 * Cinq etapes, pas davantage : l'abandon grimpe fortement au-dela de quatre ou cinq, et
 * couvrir chaque ecran couterait plus d'abandons que cela n'apporterait de comprehension.
 * L'ecran Comparaison est volontairement absent — c'est aujourd'hui une page vide.
 */

export interface TourStep {
  id: string;
  route: string;
  target: string;
  title: string;
  body: string;
  placement: 'top' | 'bottom' | 'left' | 'right';
}

export const TOUR_STEPS: ReadonlyArray<TourStep> = [
  {
    id: 'accueil',
    route: '/accueil',
    target: '[data-tour="accueil-cartes"]',
    title: 'Par où commencer',
    body: 'Tout part d’un build. Une fois qu’il existe, les timelines, le freeplay et les résultats s’enchaînent.',
    placement: 'bottom',
  },
  {
    id: 'builds',
    route: '/builds',
    target: '[data-tour="builds-nouveau"]',
    title: 'Tes personnages',
    body: 'Chaque build regroupe une classe, ses sorts, ses passifs et ses stats. Un build de démo est affiché le temps de la visite.',
    placement: 'bottom',
  },
  {
    id: 'code-deck',
    route: '/builds/nouveau',
    target: '[data-tour="code-deck"]',
    title: 'Colle ton deck du jeu',
    body: 'Copie ton code deck depuis Wakfu et colle-le ici : les 12 sorts et les 6 passifs se remplissent d’un coup. Le bouton Copier fait l’inverse.',
    placement: 'bottom',
  },
  {
    id: 'timeline',
    route: '/timelines',
    target: '[data-tour="timeline-selecteur"]',
    title: 'Compose ton tour',
    body: 'Une timeline est une suite d’actions. Enchaîne tes lancers dans l’ordre où tu les jouerais.',
    placement: 'bottom',
  },
  {
    id: 'resultats',
    route: '/resultats',
    target: '[data-tour="resultats-degats"]',
    title: 'Lis tes dégâts',
    body: 'Le détail de ce que ton tour a produit. Le Freeplay, lui, te laisse tester la même chose librement sur la carte.',
    placement: 'top',
  },
];
