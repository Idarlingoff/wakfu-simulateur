import { TestBed } from '@angular/core/testing';
import { LocalMirror } from './local-mirror.service';

describe('LocalMirror', () => {
  let mirror: LocalMirror;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [LocalMirror] });
    mirror = TestBed.inject(LocalMirror);
  });

  afterEach(() => localStorage.clear());

  it('retourne null quand rien n a ete mis en cache', () => {
    expect(mirror.read('u1', 'builds')).toBeNull();
  });

  it('relit ce qu il a ecrit', () => {
    mirror.write('u1', 'builds', [{ id: 'b1' }]);
    expect(mirror.read('u1', 'builds')).toEqual([{ id: 'b1' }]);
  });

  it('cloisonne les caches par utilisateur', () => {
    mirror.write('u1', 'builds', [{ id: 'b1' }]);
    mirror.write('u2', 'builds', [{ id: 'b2' }]);
    expect(mirror.read('u1', 'builds')).toEqual([{ id: 'b1' }]);
    expect(mirror.read('u2', 'builds')).toEqual([{ id: 'b2' }]);
  });

  it('cloisonne les caches par collection', () => {
    mirror.write('u1', 'builds', [{ id: 'b1' }]);
    mirror.write('u1', 'timelines', [{ id: 't1' }]);
    expect(mirror.read('u1', 'builds')).toEqual([{ id: 'b1' }]);
    expect(mirror.read('u1', 'timelines')).toEqual([{ id: 't1' }]);
  });

  // LE test du lot : le cache cloud ne doit JAMAIS ecraser les donnees d'invite.
  it('n ecrase jamais les cles d invite', () => {
    localStorage.setItem('wakfu_builds', JSON.stringify([{ id: 'invite' }]));
    mirror.write('u1', 'builds', [{ id: 'cloud' }]);
    expect(JSON.parse(localStorage.getItem('wakfu_builds')!)).toEqual([{ id: 'invite' }]);
  });

  it('retourne null plutot que de jeter sur un cache corrompu', () => {
    localStorage.setItem('wakfu_cache_u1_builds', '{ ceci nest pas du json');
    expect(mirror.read('u1', 'builds')).toBeNull();
  });

  it('clear supprime le cache d un utilisateur sans toucher aux autres', () => {
    mirror.write('u1', 'builds', [{ id: 'b1' }]);
    mirror.write('u2', 'builds', [{ id: 'b2' }]);
    mirror.clear('u1');
    expect(mirror.read('u1', 'builds')).toBeNull();
    expect(mirror.read('u2', 'builds')).toEqual([{ id: 'b2' }]);
  });
});
