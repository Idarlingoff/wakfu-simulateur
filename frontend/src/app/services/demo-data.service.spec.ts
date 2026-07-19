import { TestBed } from '@angular/core/testing';
import { DemoDataService, DEMO_BUILD_ID, DEMO_TIMELINE_ID } from './demo-data.service';
import { DeckCodeService } from './deck-code.service';

class StubDeckCode {
  decode = jasmine.createSpy('decode').and.resolveTo({
    // Les slots vides sont INTERCALES, pas seulement en fin de rangee : sans cela,
    // « filtrer les nulls » et « prendre les trois premiers » seraient indistinguables et
    // la timeline pourrait viser un sort inexistant sans qu'aucun test ne bronche.
    spells: [
      null,
      { spellId: 'XEL_DEVOUEMENT', iconId: 2839 },
      null,
      { spellId: 'XEL_REGULATEUR', iconId: 5344 },
      { spellId: 'XEL_POINTE_HEURE', iconId: 767 },
      ...new Array(7).fill(null),
    ],
    passives: [{ passiveId: 'XEL_COURS_TEMPS', iconId: 785 }, ...new Array(5).fill(null)],
    unresolvedSpellIcons: [], unresolvedPassiveIcons: [],
    duplicateSpellIcons: [], duplicatePassiveIcons: [],
  });
}

let deck: StubDeckCode;

function service(): DemoDataService {
  deck = new StubDeckCode();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [DemoDataService, { provide: DeckCodeService, useValue: deck }],
  });
  return TestBed.inject(DemoDataService);
}

describe('DemoDataService', () => {
  it('est inactif au demarrage', () => {
    expect(service().active()).toBeFalse();
  });

  it('resout les sorts du build de demo depuis un code deck', async () => {
    const svc = service();
    await svc.activate();

    expect(deck.decode).toHaveBeenCalled();
    expect(svc.active()).toBeTrue();
    expect(svc.build().id).toBe(DEMO_BUILD_ID);
    expect(svc.build().classId).toBe('XEL');
    // Le slot 0 du deck est vide : les references gardent leur position d'origine, elles
    // ne sont pas tassees vers le debut de la barre.
    expect(svc.build().spellBar.spells[0]).toBeNull();
    expect(svc.build().spellBar.spells[1]).toEqual({ spellId: 'XEL_DEVOUEMENT', iconId: 2839 });
    expect(svc.build().passiveBar.passives[0]).toEqual({ passiveId: 'XEL_COURS_TEMPS', iconId: 785 });
  });

  it('construit une timeline dont les actions visent les sorts resolus', async () => {
    const svc = service();
    await svc.activate();

    const timeline = svc.timeline();
    expect(timeline.id).toBe(DEMO_TIMELINE_ID);
    expect(timeline.buildId).toBe(DEMO_BUILD_ID);
    expect(timeline.steps.length).toBe(3);
    expect(timeline.steps[0].actions[0].spellId).toBe('XEL_DEVOUEMENT');
    expect(timeline.steps[2].actions[0].spellId).toBe('XEL_POINTE_HEURE');
    expect(timeline.steps.every(s => !!s.actions[0].spellId)).toBeTrue();
  });

  it('reste utilisable si la resolution du code deck echoue', async () => {
    const svc = service();
    deck.decode.and.rejectWith(new Error('backend indisponible'));

    await svc.activate();

    expect(svc.active()).toBeTrue();
    expect(svc.build().spellBar.spells.every(s => s === null)).toBeTrue();
    expect(svc.timeline().steps.length).toBe(0);
  });

  it('ne resout le code deck qu une seule fois', async () => {
    const svc = service();
    await svc.activate();
    svc.deactivate();
    await svc.activate();

    expect(deck.decode).toHaveBeenCalledTimes(1);
    // La visite doit rester rejouable : un second activate reactive bien la demo.
    expect(svc.active()).toBeTrue();
    expect(svc.build().spellBar.spells[1]?.spellId).toBe('XEL_DEVOUEMENT');
  });

  it('retente la resolution apres un echec', async () => {
    const svc = service();
    deck.decode.and.rejectWith(new Error('backend indisponible'));

    await svc.activate();
    expect(svc.build().spellBar.spells.every((s: unknown) => s === null)).toBeTrue();

    svc.deactivate();
    deck.decode.and.resolveTo({
      spells: [{ spellId: 'XEL_DEVOUEMENT', iconId: 2839 }, ...new Array(11).fill(null)],
      passives: new Array(6).fill(null),
      unresolvedSpellIcons: [], unresolvedPassiveIcons: [],
      duplicateSpellIcons: [], duplicatePassiveIcons: [],
    });
    await svc.activate();

    expect(deck.decode).toHaveBeenCalledTimes(2);
    expect(svc.build().spellBar.spells[0]).toEqual({ spellId: 'XEL_DEVOUEMENT', iconId: 2839 });
  });

  it('reconnait les identifiants reserves', () => {
    const svc = service();
    expect(svc.isDemoId(DEMO_BUILD_ID)).toBeTrue();
    expect(svc.isDemoId(DEMO_TIMELINE_ID)).toBeTrue();
    expect(svc.isDemoId('build-reel-42')).toBeFalse();
    // Task 2 s'en sert comme garde d'ecriture : trop large, elle refuserait la sauvegarde
    // d'un build utilisateur au nom malheureux.
    expect(svc.isDemoId('__demo-autre__')).toBeFalse();
  });

  it('deactivate remet le drapeau a false', async () => {
    const svc = service();
    await svc.activate();
    svc.deactivate();
    expect(svc.active()).toBeFalse();
  });
});
