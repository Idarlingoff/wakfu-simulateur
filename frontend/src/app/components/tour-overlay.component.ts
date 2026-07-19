/**
 * Voile de la visite guidee, avec un trou sur l'element mis en avant.
 *
 * Semi-bloquant : le voile intercepte les clics partout SAUF sur la zone eclairee, qui
 * reste utilisable. Echap et « Passer » quittent a tout moment.
 *
 * Cible absente — element non rendu, ecran trop etroit, chargement en cours — la bulle se
 * centre sans surbrillance et la visite continue. C'est le mode de defaillance le plus
 * courant d'une visite guidee : il se concoit, il ne se decouvre pas.
 */

import { Component, HostListener, computed, effect, inject, signal } from '@angular/core';
import { TourService } from '../services/tour.service';

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PADDING = 6;
const BUBBLE_WIDTH = 340;
const BUBBLE_HEIGHT_ESTIMATE = 190;

@Component({
  selector: 'app-tour-overlay',
  standalone: true,
  template: `
    @if (tour.currentStep(); as step) {
      <div class="tour-veil" [style.clip-path]="veilClip()"></div>
      <div
        class="tour-bubble"
        [class.centered]="spotlight() === null"
        [style.top.px]="bubbleTop()"
        [style.left.px]="bubbleLeft()"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="step.title"
      >
        <h2>{{ step.title }}</h2>
        <p>{{ step.body }}</p>
        <div class="tour-foot">
          <span class="tour-progress">{{ tour.stepIndex() + 1 }} / {{ tour.steps.length }}</span>
          <span class="tour-spacer"></span>
          <button type="button" class="tour-ghost" (click)="tour.skip()">Passer</button>
          @if (tour.stepIndex() > 0) {
            <button type="button" class="tour-ghost" (click)="tour.previous()">Précédent</button>
          }
          <button type="button" class="tour-primary" (click)="tour.next()">Suivant</button>
        </div>
      </div>
    }
  `,
  styles: [`
    .tour-veil { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.6); z-index: 900; }
    .tour-bubble {
      position: fixed; z-index: 901; width: min(340px, calc(100vw - 32px));
      background: var(--app-surface); color: var(--app-text);
      border: 1px solid var(--app-border); border-radius: 12px; padding: 16px;
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.35);
    }
    .tour-bubble.centered { top: 50% !important; left: 50% !important; transform: translate(-50%, -50%); }
    .tour-bubble h2 { margin: 0 0 6px; font-size: 16px; }
    .tour-bubble p { margin: 0 0 14px; font-size: 14px; color: var(--app-text-muted); }
    .tour-foot { display: flex; align-items: center; gap: 8px; }
    .tour-progress { font-size: 12px; color: var(--app-text-muted); }
    .tour-spacer { flex: 1 1 auto; }
    .tour-ghost, .tour-primary { padding: 6px 12px; border-radius: 8px; cursor: pointer; font-size: 13px; }
    .tour-ghost { background: transparent; border: 1px solid var(--app-border); color: var(--app-text); }
    .tour-primary { background: var(--app-accent); border: 0; color: var(--app-accent-contrast); }
    .tour-ghost:focus-visible, .tour-primary:focus-visible { outline: 2px solid var(--app-focus); outline-offset: 2px; }
  `],
})
export class TourOverlayComponent {
  protected readonly tour = inject(TourService);

  readonly spotlight = signal<SpotlightRect | null>(null);

  constructor() {
    // Deux mesures, et les deux sont necessaires. L'immediate sert quand la cible est deja
    // a l'ecran — c'est le cas au montage et lors d'un retour en arriere. La differee sert
    // quand l'etape vient de declencher une navigation : l'ecran cible n'est alors pas
    // encore rendu, et une mesure unique ne trouverait jamais l'element.
    effect(() => {
      const step = this.tour.currentStep();
      if (!step) {
        this.spotlight.set(null);
        return;
      }
      this.measure(step.target);
      setTimeout(() => this.measure(step.target), 50);
    });
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.tour.active()) {
      this.tour.skip();
    }
  }

  @HostListener('window:resize')
  onResize(): void {
    const step = this.tour.currentStep();
    if (step) {
      this.measure(step.target);
    }
  }

  private measure(selector: string): void {
    const el = document.querySelector(selector);
    if (!el) {
      this.spotlight.set(null);
      return;
    }
    const r = el.getBoundingClientRect();
    // Rectangle brut de la cible, sans marge : c'est le contrat expose par le signal
    // (positionnement de la bulle notamment). La marge visuelle du trou est ajoutee au
    // moment de construire le clip-path, pas ici.
    this.spotlight.set({
      top: r.top,
      left: r.left,
      width: r.width,
      height: r.height,
    });
  }

  /** Rectangle exterieur puis rectangle interieur en sens inverse : le trou du voile. */
  protected readonly veilClip = computed(() => {
    const s = this.spotlight();
    if (!s) {
      return 'none';
    }
    const top = s.top - PADDING;
    const left = s.left - PADDING;
    const width = s.width + PADDING * 2;
    const height = s.height + PADDING * 2;
    return `polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${left}px ${top}px, ${left}px ${top + height}px, ${left + width}px ${top + height}px, ${left + width}px ${top}px, ${left}px ${top}px)`;
  });

  protected readonly bubbleTop = computed(() => {
    const s = this.spotlight();
    const step = this.tour.currentStep();
    if (!s || !step) return 0;
    return step.placement === 'top' ? Math.max(8, s.top - BUBBLE_HEIGHT_ESTIMATE) : s.top + s.height + 12;
  });

  protected readonly bubbleLeft = computed(() => {
    const s = this.spotlight();
    if (!s) return 0;
    return Math.max(16, Math.min(s.left, window.innerWidth - BUBBLE_WIDTH - 16));
  });
}
