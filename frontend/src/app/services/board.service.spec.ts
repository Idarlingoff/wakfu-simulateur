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
});
