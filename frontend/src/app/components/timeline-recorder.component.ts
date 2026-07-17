import { Component, computed, inject } from '@angular/core';
import { InteractivePlayService } from '../services/interactive-play.service';
import { TimelineService } from '../services/timeline.service';
import { BuildService } from '../services/build.service';
import { BoardService } from '../services/board.service';
import { UiButtonComponent } from '../ui/ui-button.component';
import { Timeline, TimelineStep, TimelineBoardEntitySetup } from '../models/timeline.model';
import { newEntityId } from '../utils/entity-id.utils';

@Component({
  selector: 'app-timeline-recorder',
  standalone: true,
  imports: [UiButtonComponent],
  template: `
    <section class="recorder">
      <header class="recorder-head">
        <span class="rec-dot" aria-hidden="true"></span>
        <span class="rec-title">Timeline en cours</span>
        <span class="rec-count">{{ count() }} action{{ count() > 1 ? 's' : '' }}</span>
        <span class="rec-spacer"></span>
        <button ui-button variant="primary" class="save" [disabled]="count() === 0" (click)="save()">Sauvegarder en timeline</button>
        <button ui-button variant="ghost" class="new" (click)="newTimeline()">Nouvelle timeline</button>
      </header>

      @if (count() === 0) {
        <p class="rec-empty">Joue sur la map (clique un sort → clique une case) : chaque action s'ajoute ici.</p>
      } @else {
        <ol class="rec-list">
          @for (step of steps(); track step.id) {
            <li class="rec-item">
              <span class="rec-num">{{ $index + 1 }}</span>
              <span class="rec-label">{{ label(step) }}</span>
              @if (target(step); as t) { <span class="rec-target">→ ({{ t.x }}, {{ t.y }})</span> }
            </li>
          }
        </ol>
      }
    </section>
  `,
  styles: [`
    .recorder { background: var(--app-surface); border: 1px solid var(--app-border); border-radius: 12px; padding: 12px 14px; color: var(--app-text); }
    .recorder-head { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
    .rec-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--app-danger); }
    .rec-title { font-weight: 600; }
    .rec-count { font-size: 12px; color: var(--app-text-muted); }
    .rec-spacer { flex: 1 1 auto; }
    .rec-empty { color: var(--app-text-muted); font-size: 13px; margin: 4px 0 0; }
    .rec-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; max-height: 220px; overflow: auto; }
    .rec-item { display: flex; align-items: center; gap: 10px; padding: 6px 8px; border-radius: 8px; background: var(--app-surface-2); font-size: 13px; }
    .rec-num { width: 20px; text-align: center; color: var(--app-text-muted); }
    .rec-label { font-weight: 500; }
    .rec-target { color: var(--app-text-muted); }
  `],
})
export class TimelineRecorderComponent {
  private readonly interactivePlay = inject(InteractivePlayService);
  private readonly timelineService = inject(TimelineService);
  private readonly buildService = inject(BuildService);
  private readonly boardService = inject(BoardService);

  protected readonly steps = this.interactivePlay.recordedSteps;
  protected readonly count = computed(() => this.steps().length);

  protected label(step: TimelineStep): string {
    const a = step.actions[0];
    if (!a) return 'Action';
    if (a.type === 'CastSpell') return 'Sort ' + (a.spellId ?? '');
    if (a.type === 'Move') return 'Déplacement';
    return a.type;
  }

  protected target(step: TimelineStep): { x: number; y: number } | null {
    return step.actions[0]?.targetPosition ?? null;
  }

  async save(): Promise<void> {
    if (this.count() === 0) return;
    const name = window.prompt('Nom de la timeline :');
    if (!name || !name.trim()) return;
    const entities: TimelineBoardEntitySetup[] = [
      ...this.boardService.players(),
      ...this.boardService.enemies(),
    ].map(e => ({ id: e.id, type: e.type, name: e.name, classId: e.classId, position: e.position, facing: e.facing }));
    const timeline: Timeline = {
      id: newEntityId(),
      name: name.trim(),
      buildId: this.buildService.selectedBuildA()?.id ?? '',
      steps: [...this.steps()],
      boardSetup: { entities },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await this.timelineService.createTimeline(timeline);
    this.interactivePlay.clearRecording();
    alert('Timeline « ' + timeline.name + ' » sauvegardée.');
  }

  newTimeline(): void {
    this.interactivePlay.resetSession(null);
  }
}
