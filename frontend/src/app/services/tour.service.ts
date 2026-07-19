/**
 * Progression de la visite guidee.
 *
 * Le service navigue lui-meme vers la route de chaque etape. Il doit donc distinguer SA
 * navigation de celle de l'utilisateur : partir ailleurs de son plein gre met fin a la
 * visite, changer d'etape non. La distinction passe par un drapeau leve le temps de la
 * navigation pilotee, et NON par une comparaison d'URL — comparer se ferait piéger par les
 * redirections et les parametres de requete.
 *
 * Le drapeau est baisse par TOUTE fin de navigation : aboutie, annulee ou en erreur. Une
 * navigation pilotee qu'une garde interrompt n'emet jamais NavigationEnd ; sans ce filet le
 * drapeau resterait leve et la navigation suivante — celle de l'utilisateur — passerait
 * pour la notre, laissant la visite ouverte indefiniment.
 */

import { Injectable, computed, inject, signal } from '@angular/core';
import { NavigationCancel, NavigationEnd, NavigationError, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { BuildService } from './build.service';
import { DEMO_BUILD_ID, DEMO_TIMELINE_ID, DemoDataService } from './demo-data.service';
import { TimelineService } from './timeline.service';
import { TOUR_STEPS, TourStep } from '../utils/tour-steps';

export const TOUR_SEEN_KEY = 'wakfu-onboarding-vu';

@Injectable({ providedIn: 'root' })
export class TourService {
  private readonly router = inject(Router);
  private readonly demo = inject(DemoDataService);
  private readonly builds = inject(BuildService);
  private readonly timelines = inject(TimelineService);

  private readonly isActive = signal(false);
  private readonly index = signal(0);
  private navigatingSelf = false;
  private previousBuildId: string | null = null;
  private previousTimelineId: string | null = null;

  readonly active = this.isActive.asReadonly();
  readonly stepIndex = this.index.asReadonly();
  readonly steps = TOUR_STEPS;
  readonly currentStep = computed<TourStep | null>(() =>
    this.isActive() ? TOUR_STEPS[this.index()] ?? null : null,
  );

  constructor() {
    this.router.events
      .pipe(filter((e): e is NavigationEnd | NavigationCancel | NavigationError =>
        e instanceof NavigationEnd || e instanceof NavigationCancel || e instanceof NavigationError))
      .subscribe(event => {
        // Une navigation pilotee annulee (garde, resolveur) n'emet pas NavigationEnd. Sans
        // ce filet, le drapeau resterait leve et la navigation SUIVANTE — celle de
        // l'utilisateur — serait prise pour la notre : la visite ne se terminerait jamais.
        if (event instanceof NavigationEnd && this.isActive() && !this.navigatingSelf) {
          this.finish();
        }
        this.navigatingSelf = false;
      });
  }

  /** Vrai tant que l'utilisateur n'a ni termine ni passe la visite. */
  shouldAutoStart(): boolean {
    return this.readSeen() === null;
  }

  async start(): Promise<void> {
    await this.demo.activate();

    // Rendre la demo visible ne suffit pas : tant qu'elle n'est pas SELECTIONNEE, les
    // ecrans Timelines et Resultats affichent leur etat vide, et les deux dernieres etapes
    // de la visite ne montrent rien. On memorise la selection de l'utilisateur pour la lui
    // rendre intacte a la fin — la visite emprunte son espace de travail, elle ne le prend pas.
    this.previousBuildId = this.builds.selectedBuildA()?.id ?? null;
    this.previousTimelineId = this.timelines.currentTimelineId();

    const demoBuild = this.builds.getBuildById(DEMO_BUILD_ID);
    if (demoBuild) {
      this.builds.selectBuildA(demoBuild);
    }
    this.timelines.loadTimeline(DEMO_TIMELINE_ID);

    this.index.set(0);
    this.isActive.set(true);
    await this.goTo(TOUR_STEPS[0]);
  }

  async next(): Promise<void> {
    const target = this.index() + 1;
    if (target >= TOUR_STEPS.length) {
      this.finish();
      return;
    }
    this.index.set(target);
    await this.goTo(TOUR_STEPS[target]);
  }

  async previous(): Promise<void> {
    const target = this.index() - 1;
    if (target < 0) {
      return;
    }
    this.index.set(target);
    await this.goTo(TOUR_STEPS[target]);
  }

  /** Passer vaut terminer : quelqu'un qui passe a choisi, on ne le relance pas. */
  skip(): void {
    this.finish();
  }

  finish(): void {
    // Restaurer avant d'eteindre la demo. L'ordre n'est pas load-bearing aujourd'hui : on
    // ne rebranche qu'une selection d'AVANT la visite, donc un build reel, toujours
    // resolvable que la demo soit active ou non. C'est de la prudence, pas une dependance —
    // le jour ou la restauration touchera un etat que la demo masque, l'ordre comptera.
    this.restoreSelection();
    this.isActive.set(false);
    this.demo.deactivate();
    this.writeSeen();
  }

  /** Rend a l'utilisateur exactement ce qu'il avait avant la visite, y compris « rien ». */
  private restoreSelection(): void {
    const previousBuild = this.previousBuildId
      ? this.builds.getBuildById(this.previousBuildId)
      : undefined;
    this.builds.selectBuildA(previousBuild ?? null);
    this.timelines.currentTimelineId.set(this.previousTimelineId);
    this.previousBuildId = null;
    this.previousTimelineId = null;
  }

  private async goTo(step: TourStep): Promise<void> {
    this.navigatingSelf = true;
    await this.router.navigateByUrl(step.route);
  }

  // localStorage peut lever : navigation privee, quota, stockage desactive. Un onboarding
  // ne doit jamais empecher l'application de demarrer pour si peu.
  private readSeen(): string | null {
    try {
      return localStorage.getItem(TOUR_SEEN_KEY);
    } catch {
      return '1';
    }
  }

  private writeSeen(): void {
    try {
      localStorage.setItem(TOUR_SEEN_KEY, '1');
    } catch {
      // Sans stockage la visite se relancera au prochain passage : desagreable, pas grave.
    }
  }
}
