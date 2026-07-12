import { TestBed } from '@angular/core/testing';
import { BoardService } from './board.service';

const MAP_SIZE_KEY = 'wakfu.mapSize';

describe('BoardService — taille de map', () => {
  beforeEach(() => {
    localStorage.removeItem(MAP_SIZE_KEY);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [BoardService] });
  });

  it('gridSize vaut 10x10 par defaut', () => {
    const service = TestBed.inject(BoardService);
    expect(service.gridSize()).toEqual({ cols: 10, rows: 10 });
  });

  it('setGridSize clampe entre 5 et 20', () => {
    const service = TestBed.inject(BoardService);
    service.setGridSize(2, 99);
    expect(service.gridSize()).toEqual({ cols: 5, rows: 20 });
  });

  it('setGridSize persiste la taille dans localStorage', () => {
    const service = TestBed.inject(BoardService);
    service.setGridSize(12, 8);
    expect(JSON.parse(localStorage.getItem(MAP_SIZE_KEY)!)).toEqual({ cols: 12, rows: 8 });
  });

  it('lit la taille en cache au demarrage', () => {
    localStorage.setItem(MAP_SIZE_KEY, JSON.stringify({ cols: 15, rows: 7 }));
    const service = TestBed.inject(BoardService);
    expect(service.gridSize()).toEqual({ cols: 15, rows: 7 });
  });

  it('retombe sur 10x10 si le JSON en cache est invalide', () => {
    localStorage.setItem(MAP_SIZE_KEY, 'not-json');
    const service = TestBed.inject(BoardService);
    expect(service.gridSize()).toEqual({ cols: 10, rows: 10 });
  });

  it('clampe une taille hors bornes lue en cache', () => {
    localStorage.setItem(MAP_SIZE_KEY, JSON.stringify({ cols: 0, rows: 999 }));
    const service = TestBed.inject(BoardService);
    expect(service.gridSize()).toEqual({ cols: 5, rows: 20 });
  });

  it('resetToDefault preserve la taille courante', () => {
    const service = TestBed.inject(BoardService);
    service.setGridSize(14, 6);
    service.resetToDefault();
    expect(service.gridSize()).toEqual({ cols: 14, rows: 6 });
  });

  it('setGridSize recale les entites hors bornes sur le bord', () => {
    const service = TestBed.inject(BoardService);
    service.addEntity({
      id: 'e1', type: 'enemy', name: 'X',
      position: { x: 9, y: 8 }, facing: { direction: 'front' }
    });
    service.setGridSize(6, 6);
    const moved = service.getEntity('e1')!;
    expect(moved.position).toEqual({ x: 5, y: 5 });
  });

  it('setGridSize recale les rouages manuels mais laisse les rouages de sort', () => {
    const service = TestBed.inject(BoardService);
    service.addMechanism({ id: 'manual', type: 'cog', position: { x: 9, y: 9 }, charges: 0 });
    service.addMechanism({ id: 'spell', type: 'cog', position: { x: 8, y: 8 }, charges: 0, spellId: 'S' });
    service.setGridSize(5, 5);
    expect(service.getMechanism('manual')!.position).toEqual({ x: 4, y: 4 });
    expect(service.getMechanism('spell')!.position).toEqual({ x: 8, y: 8 });
  });

  it('exportCurrentSetup ecrit cols/rows courants', () => {
    const service = TestBed.inject(BoardService);
    service.setGridSize(14, 9);
    const setup = service.exportCurrentSetup();
    expect(setup.cols).toBe(14);
    expect(setup.rows).toBe(9);
  });

  it('applyTimelineSetup applique cols/rows du setup', () => {
    const service = TestBed.inject(BoardService);
    service.applyTimelineSetup({
      entities: [{ id: 'a', type: 'player', name: 'P', position: { x: 0, y: 0 }, facing: { direction: 'front' } }],
      cols: 16, rows: 12
    });
    expect(service.gridSize()).toEqual({ cols: 16, rows: 12 });
  });

  it('applyTimelineSetup retombe sur 10x10 si le setup n a pas de taille', () => {
    const service = TestBed.inject(BoardService);
    service.setGridSize(18, 18);
    service.applyTimelineSetup({
      entities: [{ id: 'a', type: 'player', name: 'P', position: { x: 0, y: 0 }, facing: { direction: 'front' } }]
    });
    expect(service.gridSize()).toEqual({ cols: 10, rows: 10 });
  });

  it('applyTimelineSetup recale une entite hors bornes du setup', () => {
    const service = TestBed.inject(BoardService);
    service.applyTimelineSetup({
      entities: [{ id: 'e1', type: 'enemy', name: 'X', position: { x: 20, y: 20 }, facing: { direction: 'front' } }],
      cols: 8, rows: 8
    });
    expect(service.getEntity('e1')!.position).toEqual({ x: 7, y: 7 });
  });

  it('applyTimelineSetup clampe un cols/rows hors bornes', () => {
    const service = TestBed.inject(BoardService);
    service.applyTimelineSetup({
      entities: [{ id: 'a', type: 'player', name: 'P', position: { x: 0, y: 0 }, facing: { direction: 'front' } }],
      cols: 1, rows: 999
    });
    expect(service.gridSize()).toEqual({ cols: 5, rows: 20 });
  });

  it('applyTimelineSetup persiste la taille dans localStorage', () => {
    const service = TestBed.inject(BoardService);
    service.applyTimelineSetup({
      entities: [{ id: 'a', type: 'player', name: 'P', position: { x: 0, y: 0 }, facing: { direction: 'front' } }],
      cols: 13, rows: 7
    });
    expect(JSON.parse(localStorage.getItem(MAP_SIZE_KEY)!)).toEqual({ cols: 13, rows: 7 });
  });
});
