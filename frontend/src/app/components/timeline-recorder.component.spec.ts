import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TimelineRecorderComponent } from './timeline-recorder.component';
import { InteractivePlayService } from '../services/interactive-play.service';
import { TimelineService } from '../services/timeline.service';
import { BuildService } from '../services/build.service';
import { BoardService } from '../services/board.service';
import { TimelineStep } from '../models/timeline.model';

function castStep(spellId: string, x: number, y: number): TimelineStep {
  return { id: 's_' + spellId, actions: [{ id: 'a', type: 'CastSpell', order: 1, spellId, targetPosition: { x, y } }] };
}

describe('TimelineRecorderComponent', () => {
  let recorded: ReturnType<typeof signal<TimelineStep[]>>;
  let iplay: any;
  let timelineSvc: any;

  beforeEach(() => {
    recorded = signal<TimelineStep[]>([]);
    iplay = {
      recordedSteps: recorded,
      recordedCount: () => recorded().length,
      clearRecording: jasmine.createSpy('clearRecording'),
      resetSession: jasmine.createSpy('resetSession'),
    };
    timelineSvc = { createTimeline: jasmine.createSpy('createTimeline').and.returnValue(Promise.resolve({ id: 't1' })) };
    const buildSvc = { selectedBuildA: () => ({ id: 'b1' }) };
    const boardSvc = { players: () => [], enemies: () => [] };
    TestBed.configureTestingModule({
      imports: [TimelineRecorderComponent],
      providers: [
        { provide: InteractivePlayService, useValue: iplay },
        { provide: TimelineService, useValue: timelineSvc },
        { provide: BuildService, useValue: buildSvc },
        { provide: BoardService, useValue: boardSvc },
      ],
    });
  });

  it('désactive Sauvegarder quand aucune action', () => {
    const fixture = TestBed.createComponent(TimelineRecorderComponent);
    fixture.detectChanges();
    const saveBtn = fixture.nativeElement.querySelector('button.save') as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(true);
  });

  it('sauvegarde crée une timeline avec les steps et le build courant', async () => {
    recorded.set([castStep('spell_x', 3, 4), castStep('spell_y', 5, 6)]);
    spyOn(window, 'prompt').and.returnValue('Mon combo');
    spyOn(window, 'alert');
    const fixture = TestBed.createComponent(TimelineRecorderComponent);
    fixture.detectChanges();
    await fixture.componentInstance.save();
    expect(timelineSvc.createTimeline).toHaveBeenCalled();
    const arg = timelineSvc.createTimeline.calls.mostRecent().args[0];
    expect(arg.name).toBe('Mon combo');
    expect(arg.buildId).toBe('b1');
    expect(arg.steps.length).toBe(2);
    expect(iplay.clearRecording).toHaveBeenCalled();
  });

  it('sauvegarde annulée (prompt vide) n appelle pas createTimeline', async () => {
    recorded.set([castStep('spell_x', 3, 4)]);
    spyOn(window, 'prompt').and.returnValue(null);
    const fixture = TestBed.createComponent(TimelineRecorderComponent);
    fixture.detectChanges();
    await fixture.componentInstance.save();
    expect(timelineSvc.createTimeline).not.toHaveBeenCalled();
  });

  it('Nouvelle timeline réinitialise la session', () => {
    const fixture = TestBed.createComponent(TimelineRecorderComponent);
    fixture.detectChanges();
    fixture.componentInstance.newTimeline();
    expect(iplay.resetSession).toHaveBeenCalled();
  });
});
