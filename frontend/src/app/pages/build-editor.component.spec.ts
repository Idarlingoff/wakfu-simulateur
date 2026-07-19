import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Location } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { provideRouter } from '@angular/router';
import { BuildEditorComponent } from './build-editor.component';
import { BuildService } from '../services/build.service';
import { SpellSelectorComponent } from '../components/spell-selector.component';
import { PassiveSelectorComponent } from '../components/passive-selector.component';
import { SublimationSelectorComponent } from '../components/sublimation-selector.component';
import { Build } from '../models/build.model';
import { DeckCodeService } from '../services/deck-code.service';
import { DeckCodeFormatError, DeckCodeImportResult } from '../utils/deck-code.utils';

function makeBuild(id: string, name: string): Build {
  return {
    id, name, classId: 'XEL', characterLevel: 230,
    spellBar: { spells: [] }, passiveBar: { passives: [] }, sublimationBar: { sublimations: [] },
    stats: {
      level: 230, masteryFire: 100, masteryWater: 0, masteryEarth: 0, masteryAir: 0,
      masterySecondary: 0, backMastery: 0, masteryMelee: 0, masteryDistance: 0, masteryHealing: 0,
      dommageInflict: 0, critRate: 0, critMastery: 0,
      resistance: 0, ap: 12, mp: 4, wp: 6, range: 3,
    },
  };
}

class StubBuildService {
  getBuildById = jasmine.createSpy('getBuildById').and.returnValue(undefined);
  createBuild = jasmine.createSpy('createBuild');
  updateBuild = jasmine.createSpy('updateBuild');
}

function importResult(spellCount: number, passiveCount: number): DeckCodeImportResult {
  const spells = new Array(12).fill(null);
  const passives = new Array(6).fill(null);
  for (let i = 0; i < spellCount; i++) spells[i] = { spellId: `XEL_S${i}` };
  for (let i = 0; i < passiveCount; i++) passives[i] = { passiveId: `XEL_P${i}` };
  return {
    spells, passives,
    unresolvedSpellIcons: [], unresolvedPassiveIcons: [],
    duplicateSpellIcons: [], duplicatePassiveIcons: [],
  };
}

class StubDeckCodeService {
  decode = jasmine.createSpy('decode').and.resolveTo(importResult(12, 5));
  encode = jasmine.createSpy('encode').and.resolveTo('763-0-0-0-0-0-0-0-0-0-0-0-0-0-0-0-0-0');
}

let stub: StubBuildService;
let deckStub: StubDeckCodeService;

function configure(idParam: string | null): void {
  stub = new StubBuildService();
  deckStub = new StubDeckCodeService();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [BuildEditorComponent],
    providers: [
      provideRouter([]),
      { provide: BuildService, useValue: stub },
      { provide: DeckCodeService, useValue: deckStub },
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: (_: string) => idParam } } } },
    ],
  });
  TestBed.overrideComponent(BuildEditorComponent, {
    remove: { imports: [SpellSelectorComponent, PassiveSelectorComponent, SublimationSelectorComponent] },
    add: { schemas: [CUSTOM_ELEMENTS_SCHEMA] },
  });
}

describe('BuildEditorComponent', () => {
  it('mode création : formulaire vierge, save appelle createBuild', () => {
    configure(null);
    const fixture = TestBed.createComponent(BuildEditorComponent);
    fixture.detectChanges();
    expect(stub.getBuildById).not.toHaveBeenCalled();
    const cmp = fixture.componentInstance;
    cmp.form.name = 'Nouveau';
    cmp.form.classId = 'XEL';
    cmp.save();
    expect(stub.createBuild).toHaveBeenCalled();
    expect(stub.updateBuild).not.toHaveBeenCalled();
    const arg = stub.createBuild.calls.mostRecent().args[0];
    expect(arg.name).toBe('Nouveau');
    expect(arg.classId).toBe('XEL');
  });

  it('mode édition : précharge le build et save appelle updateBuild', () => {
    configure('b1');
    stub.getBuildById.and.returnValue(makeBuild('b1', 'Rouage'));
    const fixture = TestBed.createComponent(BuildEditorComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance;
    expect(cmp.form.name).toBe('Rouage');
    cmp.save();
    expect(stub.updateBuild).toHaveBeenCalled();
    expect(stub.updateBuild.calls.mostRecent().args[0]).toBe('b1');
    expect(stub.createBuild).not.toHaveBeenCalled();
  });

  it('annuler revient en arrière sans sauvegarder', () => {
    configure(null);
    const fixture = TestBed.createComponent(BuildEditorComponent);
    const loc = TestBed.inject(Location);
    const backSpy = spyOn(loc, 'back');
    fixture.detectChanges();
    fixture.componentInstance.cancel();
    expect(backSpy).toHaveBeenCalled();
    expect(stub.createBuild).not.toHaveBeenCalled();
    expect(stub.updateBuild).not.toHaveBeenCalled();
  });

  it('save sans nom/classe n appelle ni create ni update', () => {
    configure(null);
    spyOn(window, 'alert');
    const fixture = TestBed.createComponent(BuildEditorComponent);
    fixture.detectChanges();
    fixture.componentInstance.save();
    expect(stub.createBuild).not.toHaveBeenCalled();
    expect(stub.updateBuild).not.toHaveBeenCalled();
  });
});

describe('BuildEditorComponent — code deck', () => {
  it('remplace integralement la selection existante', async () => {
    configure(null);
    const fixture = TestBed.createComponent(BuildEditorComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance;
    cmp.form.classId = 'XEL';
    cmp.form.spells[0] = { spellId: 'XEL_ANCIEN' };
    cmp.form.passives[0] = { passiveId: 'XEL_ANCIEN_PASSIF' };
    cmp.deckCodeInput = '2839-5344-767-771-765-772-777-766-1417-763-775-757-758-785-7190-7191-7192-0';

    await cmp.importDeckCode();

    expect(deckStub.decode).toHaveBeenCalledWith(cmp.deckCodeInput, 'XEL');
    expect(cmp.form.spells[0]).toEqual({ spellId: 'XEL_S0' });
    expect(cmp.form.passives[0]).toEqual({ passiveId: 'XEL_P0' });
    expect(cmp.deckCodeReport?.tone).toBe('ok');
  });

  it('refuse d importer sans classe et laisse la selection intacte', async () => {
    configure(null);
    const fixture = TestBed.createComponent(BuildEditorComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance;
    cmp.form.classId = '';
    cmp.form.spells[0] = { spellId: 'XEL_ANCIEN' };
    cmp.deckCodeInput = '2839-5344-767-771-765-772-777-766-1417-763-775-757-758-785-7190-7191-7192-0';

    await cmp.importDeckCode();

    expect(deckStub.decode).not.toHaveBeenCalled();
    expect(cmp.form.spells[0]).toEqual({ spellId: 'XEL_ANCIEN' });
  });

  it('laisse la selection intacte quand le code est malforme', async () => {
    configure(null);
    const fixture = TestBed.createComponent(BuildEditorComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance;
    cmp.form.classId = 'XEL';
    cmp.form.spells[0] = { spellId: 'XEL_ANCIEN' };
    cmp.deckCodeInput = '1-2-3';
    deckStub.decode.and.rejectWith(new DeckCodeFormatError('Code deck invalide : 3 valeur(s) au lieu de 18.'));

    await cmp.importDeckCode();

    expect(cmp.form.spells[0]).toEqual({ spellId: 'XEL_ANCIEN' });
    expect(cmp.deckCodeReport?.tone).toBe('error');
    expect(cmp.deckCodeReport?.message).toContain('18');
  });

  it('laisse la selection intacte quand rien n est reconnu', async () => {
    configure(null);
    const fixture = TestBed.createComponent(BuildEditorComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance;
    cmp.form.classId = 'XEL';
    cmp.form.spells[0] = { spellId: 'XEL_ANCIEN' };
    cmp.deckCodeInput = '2839-5344-767-771-765-772-777-766-1417-763-775-757-758-785-7190-7191-7192-0';
    deckStub.decode.and.resolveTo(importResult(0, 0));

    await cmp.importDeckCode();

    expect(cmp.form.spells[0]).toEqual({ spellId: 'XEL_ANCIEN' });
    expect(cmp.deckCodeReport?.tone).toBe('error');
  });

  it('copie le code deck dans le presse-papier', async () => {
    configure(null);
    const fixture = TestBed.createComponent(BuildEditorComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance;
    cmp.form.classId = 'XEL';
    const writeText = jasmine.createSpy('writeText').and.resolveTo(undefined);
    spyOnProperty(navigator, 'clipboard', 'get').and.returnValue({ writeText } as unknown as Clipboard);

    await cmp.copyDeckCode();

    expect(deckStub.encode).toHaveBeenCalled();
    expect(writeText).toHaveBeenCalledWith('763-0-0-0-0-0-0-0-0-0-0-0-0-0-0-0-0-0');
    expect(cmp.deckCodeCopied).toBeTrue();
  });

  it('affiche un champ de repli quand le presse-papier est indisponible', async () => {
    configure(null);
    const fixture = TestBed.createComponent(BuildEditorComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance;
    cmp.form.classId = 'XEL';
    // Force a true pour que toBeFalse() prouve l'affectation, pas la valeur initiale.
    cmp.deckCodeCopied = true;
    spyOnProperty(navigator, 'clipboard', 'get').and.returnValue(undefined as unknown as Clipboard);

    await cmp.copyDeckCode();

    expect(cmp.deckCodeFallback).toBe('763-0-0-0-0-0-0-0-0-0-0-0-0-0-0-0-0-0');
    expect(cmp.deckCodeCopied).toBeFalse();
    expect(cmp.deckCodeReport?.tone).toBe('warn');
  });

  it('efface le repli et le rapport quand une copie ulterieure reussit', async () => {
    configure(null);
    const fixture = TestBed.createComponent(BuildEditorComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance;
    cmp.form.classId = 'XEL';
    const clipboardGetter = spyOnProperty(navigator, 'clipboard', 'get');

    clipboardGetter.and.returnValue(undefined as unknown as Clipboard);
    await cmp.copyDeckCode();
    expect(cmp.deckCodeFallback).not.toBe('');

    const writeText = jasmine.createSpy('writeText').and.resolveTo(undefined);
    clipboardGetter.and.returnValue({ writeText } as unknown as Clipboard);
    await cmp.copyDeckCode();

    expect(cmp.deckCodeFallback).toBe('');
    expect(cmp.deckCodeReport).toBeNull();
    expect(cmp.deckCodeCopied).toBeTrue();
  });

  it('signale en orange un import partiel', async () => {
    configure(null);
    const fixture = TestBed.createComponent(BuildEditorComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance;
    cmp.form.classId = 'XEL';
    cmp.deckCodeInput = '2839-5344-767-771-765-772-777-766-1417-763-775-757-758-785-7190-7191-7192-0';
    const partial = importResult(10, 4);
    partial.unresolvedSpellIcons = [9999];
    deckStub.decode.and.resolveTo(partial);

    await cmp.importDeckCode();

    expect(cmp.deckCodeReport?.tone).toBe('warn');
    expect(cmp.deckCodeReport?.message).toContain('9999');
  });

  it('ignore les passifs tombant dans un emplacement verrouille', async () => {
    configure(null);
    const fixture = TestBed.createComponent(BuildEditorComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance;
    cmp.form.classId = 'XEL';
    // Niveau 50 : seuls les emplacements 0, 1 et 2 sont deverrouilles (20/35/50).
    cmp.form.characterLevel = 50;
    cmp.deckCodeInput = '2839-5344-767-771-765-772-777-766-1417-763-775-757-758-785-7190-7191-7192-0';

    await cmp.importDeckCode();

    expect(cmp.form.passives[0]).toEqual({ passiveId: 'XEL_P0' });
    expect(cmp.form.passives[2]).toEqual({ passiveId: 'XEL_P2' });
    expect(cmp.form.passives[3]).toBeNull();
    expect(cmp.form.passives[4]).toBeNull();
    expect(cmp.deckCodeReport?.tone).toBe('warn');
    expect(cmp.deckCodeReport?.message).toContain('verrouillé');
  });

  it('rend le champ de repli et la tonalite du rapport dans le DOM', () => {
    configure(null);
    const fixture = TestBed.createComponent(BuildEditorComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance;
    cmp.form.classId = 'XEL';
    cmp.deckCodeFallback = '763-0-0-0-0-0-0-0-0-0-0-0-0-0-0-0-0-0';
    cmp.deckCodeReport = { tone: 'warn', message: 'Copie automatique indisponible' };
    fixture.detectChanges();

    const fallback: HTMLInputElement = fixture.nativeElement.querySelector('.deck-fallback');
    expect(fallback).toBeTruthy();
    expect(fallback.value).toBe('763-0-0-0-0-0-0-0-0-0-0-0-0-0-0-0-0-0');

    const report: HTMLElement = fixture.nativeElement.querySelector('.deck-report');
    expect(report).toBeTruthy();
    expect(report.classList).toContain('deck-report');
    expect(report.classList).toContain('deck-report-warn');
  });
});
