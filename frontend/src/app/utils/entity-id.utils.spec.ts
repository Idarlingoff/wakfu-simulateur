import { newEntityId } from './entity-id.utils';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Les ids de builds et de timelines atterrissent dans des colonnes Postgres `uuid`
 * des qu'un utilisateur est connecte. Un id maison (`build_<timestamp>`) y est rejete
 * a l'insertion, et l'echec remonte a l'utilisateur en "service indisponible" — un
 * message mensonger pour un bug permanent. Ce format est donc un contrat, pas un detail.
 */
describe('newEntityId', () => {
  it('produit un uuid, seul format accepte par les colonnes id de Postgres', () => {
    expect(newEntityId()).toMatch(UUID_PATTERN);
  });

  it('ne produit jamais un id maison du type build_<timestamp>', () => {
    expect(newEntityId()).not.toMatch(/^(build|timeline)_/);
  });

  it('produit un id different a chaque appel', () => {
    const ids = new Set(Array.from({ length: 50 }, () => newEntityId()));
    expect(ids.size).toBe(50);
  });
});
