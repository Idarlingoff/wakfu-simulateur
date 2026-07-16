# Comptes utilisateurs — Lot 2 : Persistance cloud — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Faire monter builds et timelines dans le compte Supabase quand l'utilisateur est connecté, sans rien changer pour l'invité, et sans jamais casser le simulateur en cas de panne réseau.

**Architecture:** Deux interfaces (`BuildRepository`, `TimelineRepository`), chacune avec une implémentation locale (invité) et une Supabase (connecté). `WakfuApiService` garde sa signature exacte et route selon `AuthService.status()`. Un `LocalMirror` cloisonné par utilisateur permet la lecture hors-ligne ; les écritures restent cloud-only et échouent bruyamment.

**Tech Stack:** Angular 20.3 (standalone, signals, RxJS), `@supabase/supabase-js@^2.110.7`, Postgres/RLS, formulaires template-driven, tests Karma/Jasmine.

**Spec de référence :** `docs/superpowers/specs/2026-07-17-comptes-lot2-persistance-design.md`

---

## Prérequis d'exécution

Depuis `frontend/`, avant toute tâche :

```bash
export CHROME_BIN="$HOME/.cache/puppeteer/chrome-headless-shell/mac_arm-150.0.7871.24/chrome-headless-shell-mac-arm64/chrome-headless-shell"
```

Si le chemin n'existe pas : `npx --yes puppeteer@latest browsers install chrome-headless-shell` et relire la version.

**Baseline : `TOTAL: 138 SUCCESS`.** Elle doit rester verte à chaque tâche : c'est la preuve que les quatre consommateurs de `WakfuApiService` n'ont pas bougé.

**Hygiène git :** ne jamais commiter `.claude/`, `CLAUDE.md`, `.backend.pid`, `.frontend.pid`, `frontend/.gitignore`, `frontend/.env`, `frontend/src/environments/environment.ts`. Jamais `git add -A` ni `git add .`. Vérifier chaque commit avec `git show --stat`. Lancer les `git add` **depuis la racine du dépôt** avec les chemins `frontend/src/...` (le cwd du shell est réinitialisé entre les appels).

## Structure des fichiers

| Fichier | Responsabilité |
|---|---|
| `supabase/migrations/0002_builds_timelines.sql` (créer) | Tables `builds`/`timelines` + RLS propriétaire. |
| `frontend/src/app/services/storage/build-repository.ts` (créer) | Interface `BuildRepository`. |
| `frontend/src/app/services/storage/timeline-repository.ts` (créer) | Interface `TimelineRepository`. |
| `frontend/src/app/services/storage/local-build.repository.ts` (créer) | Invité → `localStorage` (`wakfu_builds`). |
| `frontend/src/app/services/storage/local-timeline.repository.ts` (créer) | Invité → `localStorage` (`wakfu_timelines`). |
| `frontend/src/app/services/storage/local-mirror.service.ts` (créer) | Cache cloisonné `wakfu_cache_<userId>_<collection>`. |
| `frontend/src/app/services/storage/supabase-build.repository.ts` (créer) | Cloud builds + repli lecture via miroir. |
| `frontend/src/app/services/storage/supabase-timeline.repository.ts` (créer) | Cloud timelines + repli lecture via miroir. |
| `frontend/src/app/services/storage/local-data-import.service.ts` (créer) | Import opt-in : remap d'ids, build embarqué, flag. |
| `frontend/src/app/pages/import-page.component.ts` (créer) | Écran d'import à cocher. |
| `frontend/src/app/services/wakfu-api.service.ts` (modifier) | Délègue aux repositories selon l'état d'auth. |
| `frontend/src/app/app.routes.ts` (modifier) | Route `/import`. |

---

### Task 1 : Migration SQL — tables `builds` et `timelines`

**Files:** Create `supabase/migrations/0002_builds_timelines.sql`

Pas de test unitaire : s'exécute sur l'infra Supabase, vérifié manuellement.

- [ ] **Step 1 : Écrire la migration**

```sql
-- Payload en jsonb : Build et Timeline sont des structures imbriquees profondes, et la
-- simulation tourne integralement cote client. Postgres n'interroge jamais l'interieur
-- d'une timeline : seules sont sorties du JSON les colonnes reellement filtrees.
create table public.builds (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users (id) on delete cascade,
  name        text not null,
  class_id    text,
  data        jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.timelines (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users (id) on delete cascade,
  -- Nullable des maintenant : le lot 3 partage des timelines detachees de leur build.
  build_id    uuid references public.builds (id) on delete set null,
  name        text not null,
  -- Denormalise depuis le build : indispensable au lot 3 (filtre par classe dans la
  -- galerie, verification de compatibilite du build du lecteur).
  class_id    text,
  -- Colonne presente des maintenant pour eviter une 2e migration au lot 3.
  -- ATTENTION : aucune politique de lecture publique n'est creee ici. Tant que la
  -- galerie n'existe pas, une telle politique exposerait des donnees sans aucune UI
  -- pour les controler. Elle viendra au lot 3.
  visibility  text not null default 'private'
              check (visibility in ('private', 'unlisted', 'public')),
  data        jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index builds_owner_idx on public.builds (owner_id);
create index timelines_owner_idx on public.timelines (owner_id);
create index timelines_build_idx on public.timelines (build_id);

alter table public.builds enable row level security;
alter table public.timelines enable row level security;

-- Proprietaire uniquement, sur les deux tables. Les builds ne seront JAMAIS partages.
create policy "builds_owner_all" on public.builds
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "timelines_owner_all" on public.timelines
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
```

- [ ] **Step 2 : Appliquer**

Dashboard Supabase → SQL Editor → coller → exécuter. Attendu : `Success. No rows returned`.

- [ ] **Step 3 : Vérifier l'isolation RLS**

Table Editor → `builds` → « Insert row » avec `owner_id` = un uuid quelconque, `name` = `test`, `data` = `{}`.
Puis, depuis un terminal (remplace `<URL>` et `<ANON_KEY>` par les valeurs de `frontend/.env`) :

```bash
curl -s "<URL>/rest/v1/builds?select=id" -H "apikey: <ANON_KEY>" -H "Authorization: Bearer <ANON_KEY>"
```

Attendu : `[]` — un anonyme ne voit **aucun** build, malgré la ligne insérée. C'est la preuve que la RLS isole. Supprimer ensuite la ligne de test.

- [ ] **Step 4 : Commit**

```bash
git add supabase/migrations/0002_builds_timelines.sql
git commit -m "feat(storage): tables builds et timelines avec RLS proprietaire"
```

---

### Task 2 : `LocalMirror` — cache cloisonné par utilisateur

**Files:** Create `frontend/src/app/services/storage/local-mirror.service.ts` + `.spec.ts`

- [ ] **Step 1 : Écrire les tests qui échouent**

Créer `frontend/src/app/services/storage/local-mirror.service.spec.ts` :

```typescript
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
```

- [ ] **Step 2 : Lancer, vérifier l'échec**

```bash
npx ng test --include='**/local-mirror.service.spec.ts' --watch=false --browsers=ChromeHeadless
```
Attendu : ÉCHEC — `Cannot find module './local-mirror.service'`.

- [ ] **Step 3 : Implémenter**

```typescript
import { Injectable } from '@angular/core';

export type MirroredCollection = 'builds' | 'timelines';

/**
 * Miroir local des donnees cloud, permettant la lecture hors-ligne.
 *
 * Les cles sont cloisonnees par utilisateur ET distinctes des cles d'invite
 * (wakfu_builds / wakfu_timelines) : sans ce cloisonnement, le cache d'un compte
 * ecraserait les donnees locales de l'invite, ce que la promesse "import non
 * destructif" interdit.
 */
@Injectable({ providedIn: 'root' })
export class LocalMirror {
  private key(userId: string, collection: MirroredCollection): string {
    return `wakfu_cache_${userId}_${collection}`;
  }

  read<T>(userId: string, collection: MirroredCollection): T[] | null {
    try {
      const raw = localStorage.getItem(this.key(userId, collection));
      return raw ? (JSON.parse(raw) as T[]) : null;
    } catch {
      // Cache corrompu ou localStorage indisponible : on se comporte comme un cache
      // vide plutot que de casser la lecture.
      return null;
    }
  }

  write<T>(userId: string, collection: MirroredCollection, data: T[]): void {
    try {
      localStorage.setItem(this.key(userId, collection), JSON.stringify(data));
    } catch {
      /* quota depasse : le cache est un confort, pas une garantie */
    }
  }

  clear(userId: string): void {
    try {
      localStorage.removeItem(this.key(userId, 'builds'));
      localStorage.removeItem(this.key(userId, 'timelines'));
    } catch {
      /* localStorage indisponible */
    }
  }
}
```

- [ ] **Step 4 : Lancer, vérifier le succès**

Attendu : `TOTAL: 7 SUCCESS`.

- [ ] **Step 5 : Commit**

```bash
git add frontend/src/app/services/storage/local-mirror.service.ts frontend/src/app/services/storage/local-mirror.service.spec.ts
git commit -m "feat(storage): LocalMirror, cache cloisonne par utilisateur"
```

---

### Task 3 : Interfaces + repositories locaux (refactor pur)

**Files:**
- Create: `frontend/src/app/services/storage/build-repository.ts`, `timeline-repository.ts`, `local-build.repository.ts`, `local-timeline.repository.ts`
- Modify: `frontend/src/app/services/wakfu-api.service.ts`
- Test: `frontend/src/app/services/storage/local-repositories.spec.ts`

Refactor **à comportement constant** : `WakfuApiService` délègue aux repos locaux, sa signature ne change pas. La baseline de 138 tests prouve la non-régression.

- [ ] **Step 1 : Créer les interfaces**

`frontend/src/app/services/storage/build-repository.ts` :

```typescript
import { Observable } from 'rxjs';
import { Build } from '../../models/build.model';

/** Contrat de stockage des builds. Implemente en local (invite) et Supabase (connecte). */
export interface BuildRepository {
  getAll(): Observable<Build[]>;
  getById(id: string): Observable<Build>;
  create(build: Build): Observable<Build>;
  update(id: string, build: Build): Observable<Build>;
  delete(id: string): Observable<void>;
}
```

`frontend/src/app/services/storage/timeline-repository.ts` :

```typescript
import { Observable } from 'rxjs';
import { Timeline } from '../../models/timeline.model';

/** Contrat de stockage des timelines. Implemente en local (invite) et Supabase (connecte). */
export interface TimelineRepository {
  getAll(buildId?: string): Observable<Timeline[]>;
  getById(id: string): Observable<Timeline>;
  create(timeline: Timeline): Observable<Timeline>;
  update(id: string, timeline: Timeline): Observable<Timeline>;
  delete(id: string): Observable<void>;
}
```

- [ ] **Step 2 : Écrire les tests qui échouent**

Créer `frontend/src/app/services/storage/local-repositories.spec.ts` :

```typescript
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { LocalBuildRepository } from './local-build.repository';
import { LocalTimelineRepository } from './local-timeline.repository';
import { Build } from '../../models/build.model';
import { Timeline } from '../../models/timeline.model';

const build = (id: string) => ({ id, name: `build ${id}`, classId: 'XEL' } as unknown as Build);
const timeline = (id: string, buildId: string) =>
  ({ id, name: `tl ${id}`, buildId, steps: [] } as unknown as Timeline);

describe('LocalBuildRepository', () => {
  let repo: LocalBuildRepository;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [LocalBuildRepository] });
    repo = TestBed.inject(LocalBuildRepository);
  });
  afterEach(() => localStorage.clear());

  it('retourne une liste vide au depart', async () => {
    expect(await firstValueFrom(repo.getAll())).toEqual([]);
  });

  it('cree puis relit un build', async () => {
    await firstValueFrom(repo.create(build('b1')));
    expect(await firstValueFrom(repo.getAll())).toEqual([build('b1')]);
    expect(await firstValueFrom(repo.getById('b1'))).toEqual(build('b1'));
  });

  it('utilise bien la cle d invite wakfu_builds', async () => {
    await firstValueFrom(repo.create(build('b1')));
    expect(JSON.parse(localStorage.getItem('wakfu_builds')!)).toEqual([build('b1')]);
  });

  it('jette si le build est introuvable', async () => {
    await expectAsync(firstValueFrom(repo.getById('absent'))).toBeRejected();
  });

  it('met a jour puis supprime', async () => {
    await firstValueFrom(repo.create(build('b1')));
    const modifie = { ...build('b1'), name: 'renomme' } as Build;
    await firstValueFrom(repo.update('b1', modifie));
    expect((await firstValueFrom(repo.getById('b1'))).name).toBe('renomme');
    await firstValueFrom(repo.delete('b1'));
    expect(await firstValueFrom(repo.getAll())).toEqual([]);
  });
});

describe('LocalTimelineRepository', () => {
  let repo: LocalTimelineRepository;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [LocalTimelineRepository] });
    repo = TestBed.inject(LocalTimelineRepository);
  });
  afterEach(() => localStorage.clear());

  it('cree puis relit une timeline', async () => {
    await firstValueFrom(repo.create(timeline('t1', 'b1')));
    expect(await firstValueFrom(repo.getAll())).toEqual([timeline('t1', 'b1')]);
  });

  it('filtre par buildId', async () => {
    await firstValueFrom(repo.create(timeline('t1', 'b1')));
    await firstValueFrom(repo.create(timeline('t2', 'b2')));
    expect(await firstValueFrom(repo.getAll('b1'))).toEqual([timeline('t1', 'b1')]);
  });

  it('utilise bien la cle d invite wakfu_timelines', async () => {
    await firstValueFrom(repo.create(timeline('t1', 'b1')));
    expect(JSON.parse(localStorage.getItem('wakfu_timelines')!)).toEqual([timeline('t1', 'b1')]);
  });

  it('jette si la timeline est introuvable', async () => {
    await expectAsync(firstValueFrom(repo.getById('absent'))).toBeRejected();
  });
});
```

- [ ] **Step 3 : Lancer, vérifier l'échec**

```bash
npx ng test --include='**/local-repositories.spec.ts' --watch=false --browsers=ChromeHeadless
```
Attendu : ÉCHEC — `Cannot find module './local-build.repository'`.

- [ ] **Step 4 : Implémenter les repos locaux**

`frontend/src/app/services/storage/local-build.repository.ts` :

```typescript
import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { Build } from '../../models/build.model';
import { BuildRepository } from './build-repository';

const LS_BUILDS = 'wakfu_builds';

function lsGet<T>(key: string): T[] {
  try { return JSON.parse(localStorage.getItem(key) ?? '[]') as T[]; }
  catch { return []; }
}
function lsSet<T>(key: string, data: T[]): void {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch { /* quota */ }
}

/** Stockage des builds de l'invite. Comportement historique, inchange. */
@Injectable({ providedIn: 'root' })
export class LocalBuildRepository implements BuildRepository {
  getAll(): Observable<Build[]> {
    return of(lsGet<Build>(LS_BUILDS));
  }

  getById(id: string): Observable<Build> {
    const found = lsGet<Build>(LS_BUILDS).find(b => b.id === id);
    return found ? of(found) : throwError(() => new Error(`Build ${id} not found`));
  }

  create(build: Build): Observable<Build> {
    const builds = lsGet<Build>(LS_BUILDS);
    builds.push(build);
    lsSet(LS_BUILDS, builds);
    return of(build);
  }

  update(id: string, build: Build): Observable<Build> {
    lsSet(LS_BUILDS, lsGet<Build>(LS_BUILDS).map(b => (b.id === id ? build : b)));
    return of(build);
  }

  delete(id: string): Observable<void> {
    lsSet(LS_BUILDS, lsGet<Build>(LS_BUILDS).filter(b => b.id !== id));
    return of(undefined);
  }
}
```

`frontend/src/app/services/storage/local-timeline.repository.ts` :

```typescript
import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { Timeline } from '../../models/timeline.model';
import { TimelineRepository } from './timeline-repository';

const LS_TIMELINES = 'wakfu_timelines';

function lsGet<T>(key: string): T[] {
  try { return JSON.parse(localStorage.getItem(key) ?? '[]') as T[]; }
  catch { return []; }
}
function lsSet<T>(key: string, data: T[]): void {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch { /* quota */ }
}

/** Stockage des timelines de l'invite. Comportement historique, inchange. */
@Injectable({ providedIn: 'root' })
export class LocalTimelineRepository implements TimelineRepository {
  getAll(buildId?: string): Observable<Timeline[]> {
    const timelines = lsGet<Timeline>(LS_TIMELINES);
    return of(buildId ? timelines.filter(t => t.buildId === buildId) : timelines);
  }

  getById(id: string): Observable<Timeline> {
    const found = lsGet<Timeline>(LS_TIMELINES).find(t => t.id === id);
    return found ? of(found) : throwError(() => new Error(`Timeline ${id} not found`));
  }

  create(timeline: Timeline): Observable<Timeline> {
    const timelines = lsGet<Timeline>(LS_TIMELINES);
    timelines.push(timeline);
    lsSet(LS_TIMELINES, timelines);
    return of(timeline);
  }

  update(id: string, timeline: Timeline): Observable<Timeline> {
    lsSet(LS_TIMELINES, lsGet<Timeline>(LS_TIMELINES).map(t => (t.id === id ? timeline : t)));
    return of(timeline);
  }

  delete(id: string): Observable<void> {
    lsSet(LS_TIMELINES, lsGet<Timeline>(LS_TIMELINES).filter(t => t.id !== id));
    return of(undefined);
  }
}
```

- [ ] **Step 5 : Faire déléguer `WakfuApiService`**

Dans `frontend/src/app/services/wakfu-api.service.ts` :

Ajouter aux imports :
```typescript
import { inject } from '@angular/core';
import { LocalBuildRepository } from './storage/local-build.repository';
import { LocalTimelineRepository } from './storage/local-timeline.repository';
```

Supprimer les constantes `LS_BUILDS`, `LS_TIMELINES` et les fonctions `lsGet` / `lsSet` (désormais portées par les repos).

Remplacer les 10 méthodes builds/timelines par :

```typescript
  private readonly localBuilds = inject(LocalBuildRepository);
  private readonly localTimelines = inject(LocalTimelineRepository);

  // ============ Builds ============

  getAllBuilds(): Observable<Build[]> { return this.localBuilds.getAll(); }
  getBuildById(id: string): Observable<Build> { return this.localBuilds.getById(id); }
  createBuild(build: Build): Observable<Build> { return this.localBuilds.create(build); }
  updateBuild(id: string, build: Build): Observable<Build> { return this.localBuilds.update(id, build); }
  deleteBuild(id: string): Observable<void> { return this.localBuilds.delete(id); }

  // ============ Timelines ============

  getAllTimelines(buildId?: string): Observable<Timeline[]> { return this.localTimelines.getAll(buildId); }
  getTimelineById(id: string): Observable<Timeline> { return this.localTimelines.getById(id); }
  createTimeline(timeline: Timeline): Observable<Timeline> { return this.localTimelines.create(timeline); }
  updateTimeline(id: string, timeline: Timeline): Observable<Timeline> { return this.localTimelines.update(id, timeline); }
  deleteTimeline(id: string): Observable<void> { return this.localTimelines.delete(id); }
```

Si `of` ou `throwError` ne sont plus utilisés ailleurs dans le fichier, retirer les imports devenus inutiles.

- [ ] **Step 6 : Lancer la suite COMPLÈTE**

```bash
npx ng test --watch=false --browsers=ChromeHeadless
```
Attendu : `TOTAL: 147 SUCCESS` (138 + 9). **Zéro échec** : c'est la preuve que le refactor est à comportement constant.

- [ ] **Step 7 : Commit**

```bash
git add frontend/src/app/services/storage/build-repository.ts frontend/src/app/services/storage/timeline-repository.ts frontend/src/app/services/storage/local-build.repository.ts frontend/src/app/services/storage/local-timeline.repository.ts frontend/src/app/services/storage/local-repositories.spec.ts frontend/src/app/services/wakfu-api.service.ts
git commit -m "refactor(storage): extrait les repositories locaux de WakfuApiService"
```

---

### Task 4 : Repositories Supabase + repli de lecture

**Files:**
- Create: `frontend/src/app/services/storage/supabase-build.repository.ts`, `supabase-timeline.repository.ts`
- Test: `frontend/src/app/services/storage/supabase-repositories.spec.ts`

- [ ] **Step 1 : Écrire les tests qui échouent**

Créer `frontend/src/app/services/storage/supabase-repositories.spec.ts` :

```typescript
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { SupabaseBuildRepository } from './supabase-build.repository';
import { SupabaseClientService } from '../supabase-client.service';
import { AuthService } from '../auth.service';
import { LocalMirror } from './local-mirror.service';
import { Build } from '../../models/build.model';

const build = (id: string) => ({ id, name: `build ${id}`, classId: 'XEL' } as unknown as Build);

/** Faux client Supabase : chaine from().select().eq()… avec resultat pilotable. */
function makeFakeClient(result: { data?: any; error?: any; rejects?: boolean }) {
  const respond = () =>
    result.rejects
      ? Promise.reject(new Error('Failed to fetch'))
      : Promise.resolve({ data: result.data ?? null, error: result.error ?? null });

  const builder: any = {
    select: () => builder,
    eq: () => builder,
    order: () => builder,
    single: () => respond(),
    insert: () => builder,
    update: () => builder,
    delete: () => builder,
    then: (resolve: any, reject: any) => respond().then(resolve, reject),
  };
  return { from: () => builder };
}

function configure(client: any, userId: string | null = 'u1') {
  TestBed.configureTestingModule({
    providers: [
      SupabaseBuildRepository,
      LocalMirror,
      { provide: SupabaseClientService, useValue: { client } },
      { provide: AuthService, useValue: { userId: () => userId } },
    ],
  });
  return TestBed.inject(SupabaseBuildRepository);
}

describe('SupabaseBuildRepository', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('lit les builds depuis Postgres et les recopie dans le miroir', async () => {
    const rows = [{ id: 'b1', name: 'build b1', class_id: 'XEL', data: build('b1') }];
    const repo = configure(makeFakeClient({ data: rows }));
    const result = await firstValueFrom(repo.getAll());
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('b1');
    expect(TestBed.inject(LocalMirror).read('u1', 'builds')).not.toBeNull();
  });

  // L'invariant du lot : une panne reseau ne casse pas la lecture.
  it('retombe sur le miroir quand Postgres est injoignable', async () => {
    TestBed.resetTestingModule();
    const repo = configure(makeFakeClient({ rejects: true }));
    TestBed.inject(LocalMirror).write('u1', 'builds', [build('cache')]);
    const result = await firstValueFrom(repo.getAll());
    expect(result).toEqual([build('cache')]);
  });

  it('retourne une liste vide si Postgres echoue et que le miroir est vide', async () => {
    const repo = configure(makeFakeClient({ rejects: true }));
    expect(await firstValueFrom(repo.getAll())).toEqual([]);
  });

  // Les ecritures ne doivent JAMAIS echouer en silence.
  it('propage l erreur en ecriture quand Postgres est injoignable', async () => {
    const repo = configure(makeFakeClient({ rejects: true }));
    await expectAsync(firstValueFrom(repo.create(build('b1')))).toBeRejected();
  });

  it('propage l erreur en ecriture quand Postgres renvoie une erreur', async () => {
    const repo = configure(makeFakeClient({ error: { message: 'boom' } }));
    await expectAsync(firstValueFrom(repo.create(build('b1')))).toBeRejected();
  });

  it('jette si aucun utilisateur n est connecte', async () => {
    const repo = configure(makeFakeClient({ data: [] }), null);
    await expectAsync(firstValueFrom(repo.create(build('b1')))).toBeRejected();
  });
});
```

- [ ] **Step 2 : Lancer, vérifier l'échec**

```bash
npx ng test --include='**/supabase-repositories.spec.ts' --watch=false --browsers=ChromeHeadless
```
Attendu : ÉCHEC — `Cannot find module './supabase-build.repository'`.

- [ ] **Step 3 : Ajouter `userId()` à `AuthService`**

Dans `frontend/src/app/services/auth.service.ts`, ajouter après le signal `profile` :

```typescript
  /** Id de l'utilisateur connecte, ou null. Necessaire au cloisonnement du miroir. */
  readonly userId = computed(() => this._profile()?.id ?? null);
```

- [ ] **Step 4 : Implémenter le repo builds**

`frontend/src/app/services/storage/supabase-build.repository.ts` :

```typescript
import { inject, Injectable } from '@angular/core';
import { from, Observable } from 'rxjs';
import { Build } from '../../models/build.model';
import { AuthService } from '../auth.service';
import { SupabaseClientService } from '../supabase-client.service';
import { BuildRepository } from './build-repository';
import { LocalMirror } from './local-mirror.service';

/**
 * Stockage cloud des builds.
 *
 * Lecture : Postgres, recopiee dans le miroir. Si Postgres est injoignable, le miroir
 * repond — le simulateur continue de tourner (invariant du lot 1).
 * Ecriture : cloud uniquement. Une ecriture qui echoue DOIT jeter : un echec silencieux
 * laisserait croire a une sauvegarde.
 */
@Injectable({ providedIn: 'root' })
export class SupabaseBuildRepository implements BuildRepository {
  private readonly supabase = inject(SupabaseClientService);
  private readonly auth = inject(AuthService);
  private readonly mirror = inject(LocalMirror);

  private table() {
    return this.supabase.client.from('builds');
  }

  private requireUserId(): string {
    const id = this.auth.userId();
    if (!id) {
      throw new Error('Aucun utilisateur connecte');
    }
    return id;
  }

  private toRow(build: Build, ownerId: string) {
    return { id: build.id, owner_id: ownerId, name: build.name, class_id: build.classId, data: build };
  }

  private fromRow(row: any): Build {
    return { ...(row.data as Build), id: row.id, name: row.name };
  }

  getAll(): Observable<Build[]> {
    return from(this.readAll());
  }

  private async readAll(): Promise<Build[]> {
    const userId = this.auth.userId();
    if (!userId) {
      return [];
    }
    try {
      const { data, error } = await this.table().select('id, name, class_id, data').eq('owner_id', userId);
      if (error) {
        throw new Error(error.message);
      }
      const builds = (data ?? []).map(row => this.fromRow(row));
      this.mirror.write(userId, 'builds', builds);
      return builds;
    } catch {
      // Postgres injoignable : le miroir prend le relais.
      return this.mirror.read<Build>(userId, 'builds') ?? [];
    }
  }

  getById(id: string): Observable<Build> {
    return from(this.readOne(id));
  }

  private async readOne(id: string): Promise<Build> {
    const all = await this.readAll();
    const found = all.find(b => b.id === id);
    if (!found) {
      throw new Error(`Build ${id} not found`);
    }
    return found;
  }

  create(build: Build): Observable<Build> {
    return from(this.write(async () => {
      const userId = this.requireUserId();
      const { error } = await this.table().insert(this.toRow(build, userId));
      if (error) {
        throw new Error(error.message);
      }
      return build;
    }));
  }

  update(id: string, build: Build): Observable<Build> {
    return from(this.write(async () => {
      const userId = this.requireUserId();
      const { error } = await this.table().update(this.toRow(build, userId)).eq('id', id);
      if (error) {
        throw new Error(error.message);
      }
      return build;
    }));
  }

  delete(id: string): Observable<void> {
    return from(this.write(async () => {
      this.requireUserId();
      const { error } = await this.table().delete().eq('id', id);
      if (error) {
        throw new Error(error.message);
      }
      return undefined;
    }));
  }

  /** Les ecritures ne beneficient d'AUCUN repli : elles doivent echouer bruyamment. */
  private async write<T>(action: () => Promise<T>): Promise<T> {
    return action();
  }
}
```

- [ ] **Step 5 : Implémenter le repo timelines**

`frontend/src/app/services/storage/supabase-timeline.repository.ts` — même structure, avec le filtre `buildId`, `visibility` et `class_id` :

```typescript
import { inject, Injectable } from '@angular/core';
import { from, Observable } from 'rxjs';
import { Timeline } from '../../models/timeline.model';
import { AuthService } from '../auth.service';
import { SupabaseClientService } from '../supabase-client.service';
import { TimelineRepository } from './timeline-repository';
import { LocalMirror } from './local-mirror.service';

/**
 * Stockage cloud des timelines. Memes regles que SupabaseBuildRepository :
 * lecture avec repli sur le miroir, ecriture sans repli (echec bruyant).
 *
 * `visibility` reste 'private' dans ce lot : aucune UI ne permet encore de la changer,
 * et aucune politique RLS publique n'existe. C'est le lot 3 qui l'exploitera.
 */
@Injectable({ providedIn: 'root' })
export class SupabaseTimelineRepository implements TimelineRepository {
  private readonly supabase = inject(SupabaseClientService);
  private readonly auth = inject(AuthService);
  private readonly mirror = inject(LocalMirror);

  private table() {
    return this.supabase.client.from('timelines');
  }

  private requireUserId(): string {
    const id = this.auth.userId();
    if (!id) {
      throw new Error('Aucun utilisateur connecte');
    }
    return id;
  }

  private toRow(timeline: Timeline, ownerId: string) {
    return {
      id: timeline.id,
      owner_id: ownerId,
      build_id: timeline.buildId || null,
      name: timeline.name,
      data: timeline,
    };
  }

  private fromRow(row: any): Timeline {
    return { ...(row.data as Timeline), id: row.id, name: row.name, buildId: row.build_id ?? '' };
  }

  getAll(buildId?: string): Observable<Timeline[]> {
    return from(this.readAll(buildId));
  }

  private async readAll(buildId?: string): Promise<Timeline[]> {
    const userId = this.auth.userId();
    if (!userId) {
      return [];
    }
    try {
      const { data, error } = await this.table()
        .select('id, name, build_id, class_id, visibility, data')
        .eq('owner_id', userId);
      if (error) {
        throw new Error(error.message);
      }
      const timelines = (data ?? []).map(row => this.fromRow(row));
      this.mirror.write(userId, 'timelines', timelines);
      return buildId ? timelines.filter(t => t.buildId === buildId) : timelines;
    } catch {
      const cached = this.mirror.read<Timeline>(userId, 'timelines') ?? [];
      return buildId ? cached.filter(t => t.buildId === buildId) : cached;
    }
  }

  getById(id: string): Observable<Timeline> {
    return from(this.readOne(id));
  }

  private async readOne(id: string): Promise<Timeline> {
    const found = (await this.readAll()).find(t => t.id === id);
    if (!found) {
      throw new Error(`Timeline ${id} not found`);
    }
    return found;
  }

  create(timeline: Timeline): Observable<Timeline> {
    return from((async () => {
      const userId = this.requireUserId();
      const { error } = await this.table().insert(this.toRow(timeline, userId));
      if (error) {
        throw new Error(error.message);
      }
      return timeline;
    })());
  }

  update(id: string, timeline: Timeline): Observable<Timeline> {
    return from((async () => {
      const userId = this.requireUserId();
      const { error } = await this.table().update(this.toRow(timeline, userId)).eq('id', id);
      if (error) {
        throw new Error(error.message);
      }
      return timeline;
    })());
  }

  delete(id: string): Observable<void> {
    return from((async () => {
      this.requireUserId();
      const { error } = await this.table().delete().eq('id', id);
      if (error) {
        throw new Error(error.message);
      }
      return undefined;
    })());
  }
}
```

- [ ] **Step 6 : Lancer, vérifier le succès**

Attendu : `TOTAL: 6 SUCCESS` sur ce spec, puis suite complète `TOTAL: 153 SUCCESS`.

- [ ] **Step 7 : Commit**

```bash
git add frontend/src/app/services/storage/supabase-build.repository.ts frontend/src/app/services/storage/supabase-timeline.repository.ts frontend/src/app/services/storage/supabase-repositories.spec.ts frontend/src/app/services/auth.service.ts
git commit -m "feat(storage): repositories Supabase avec repli de lecture sur le miroir"
```

---

### Task 5 : Routage de `WakfuApiService` selon l'état d'auth

**Files:**
- Modify: `frontend/src/app/services/wakfu-api.service.ts`
- Test: `frontend/src/app/services/wakfu-api.routing.spec.ts`

- [ ] **Step 1 : Écrire les tests qui échouent**

Créer `frontend/src/app/services/wakfu-api.routing.spec.ts` :

```typescript
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { WakfuApiService } from './wakfu-api.service';
import { AuthService } from './auth.service';
import { LocalBuildRepository } from './storage/local-build.repository';
import { LocalTimelineRepository } from './storage/local-timeline.repository';
import { SupabaseBuildRepository } from './storage/supabase-build.repository';
import { SupabaseTimelineRepository } from './storage/supabase-timeline.repository';

function configure(authenticated: boolean) {
  const localBuilds = { getAll: jasmine.createSpy('local.getAll').and.returnValue(of([])) };
  const cloudBuilds = { getAll: jasmine.createSpy('cloud.getAll').and.returnValue(of([])) };
  const localTimelines = { getAll: jasmine.createSpy('localTl.getAll').and.returnValue(of([])) };
  const cloudTimelines = { getAll: jasmine.createSpy('cloudTl.getAll').and.returnValue(of([])) };

  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: AuthService, useValue: { isAuthenticated: () => authenticated } },
      { provide: LocalBuildRepository, useValue: localBuilds },
      { provide: LocalTimelineRepository, useValue: localTimelines },
      { provide: SupabaseBuildRepository, useValue: cloudBuilds },
      { provide: SupabaseTimelineRepository, useValue: cloudTimelines },
    ],
  });
  return { api: TestBed.inject(WakfuApiService), localBuilds, cloudBuilds, localTimelines, cloudTimelines };
}

describe('WakfuApiService — routage selon l etat d auth', () => {
  it('utilise le repo local quand on est invite', () => {
    const { api, localBuilds, cloudBuilds } = configure(false);
    api.getAllBuilds().subscribe();
    expect(localBuilds.getAll).toHaveBeenCalled();
    expect(cloudBuilds.getAll).not.toHaveBeenCalled();
  });

  it('utilise le repo cloud quand on est connecte', () => {
    const { api, localBuilds, cloudBuilds } = configure(true);
    api.getAllBuilds().subscribe();
    expect(cloudBuilds.getAll).toHaveBeenCalled();
    expect(localBuilds.getAll).not.toHaveBeenCalled();
  });

  it('route aussi les timelines en invite', () => {
    const { api, localTimelines, cloudTimelines } = configure(false);
    api.getAllTimelines().subscribe();
    expect(localTimelines.getAll).toHaveBeenCalled();
    expect(cloudTimelines.getAll).not.toHaveBeenCalled();
  });

  it('route aussi les timelines en connecte', () => {
    const { api, localTimelines, cloudTimelines } = configure(true);
    api.getAllTimelines().subscribe();
    expect(cloudTimelines.getAll).toHaveBeenCalled();
    expect(localTimelines.getAll).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2 : Lancer, vérifier l'échec**

Attendu : ÉCHEC — le repo cloud n'est jamais appelé (`Expected spy cloud.getAll to have been called`).

- [ ] **Step 3 : Implémenter le routage**

Dans `frontend/src/app/services/wakfu-api.service.ts`, ajouter aux imports :

```typescript
import { AuthService } from './auth.service';
import { SupabaseBuildRepository } from './storage/supabase-build.repository';
import { SupabaseTimelineRepository } from './storage/supabase-timeline.repository';
import { BuildRepository } from './storage/build-repository';
import { TimelineRepository } from './storage/timeline-repository';
```

Remplacer les deux champs injectés et les 10 méthodes par :

```typescript
  private readonly auth = inject(AuthService);
  private readonly localBuilds = inject(LocalBuildRepository);
  private readonly localTimelines = inject(LocalTimelineRepository);
  private readonly cloudBuilds = inject(SupabaseBuildRepository);
  private readonly cloudTimelines = inject(SupabaseTimelineRepository);

  /** Invite -> localStorage, connecte -> Supabase. Seul point de bascule du stockage. */
  private builds(): BuildRepository {
    return this.auth.isAuthenticated() ? this.cloudBuilds : this.localBuilds;
  }

  private timelines(): TimelineRepository {
    return this.auth.isAuthenticated() ? this.cloudTimelines : this.localTimelines;
  }

  // ============ Builds ============

  getAllBuilds(): Observable<Build[]> { return this.builds().getAll(); }
  getBuildById(id: string): Observable<Build> { return this.builds().getById(id); }
  createBuild(build: Build): Observable<Build> { return this.builds().create(build); }
  updateBuild(id: string, build: Build): Observable<Build> { return this.builds().update(id, build); }
  deleteBuild(id: string): Observable<void> { return this.builds().delete(id); }

  // ============ Timelines ============

  getAllTimelines(buildId?: string): Observable<Timeline[]> { return this.timelines().getAll(buildId); }
  getTimelineById(id: string): Observable<Timeline> { return this.timelines().getById(id); }
  createTimeline(timeline: Timeline): Observable<Timeline> { return this.timelines().create(timeline); }
  updateTimeline(id: string, timeline: Timeline): Observable<Timeline> { return this.timelines().update(id, timeline); }
  deleteTimeline(id: string): Observable<void> { return this.timelines().delete(id); }
```

- [ ] **Step 4 : Lancer la suite complète**

Attendu : `TOTAL: 157 SUCCESS` (153 + 4), zéro échec.

- [ ] **Step 5 : Commit**

```bash
git add frontend/src/app/services/wakfu-api.service.ts frontend/src/app/services/wakfu-api.routing.spec.ts
git commit -m "feat(storage): WakfuApiService route local/cloud selon l'etat d'auth"
```

---

### Task 6 : `LocalDataImportService`

**Files:**
- Create: `frontend/src/app/services/storage/local-data-import.service.ts` + `.spec.ts`

- [ ] **Step 1 : Écrire les tests qui échouent**

Créer `frontend/src/app/services/storage/local-data-import.service.spec.ts` :

```typescript
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { LocalDataImportService } from './local-data-import.service';
import { LocalBuildRepository } from './local-build.repository';
import { LocalTimelineRepository } from './local-timeline.repository';
import { SupabaseBuildRepository } from './supabase-build.repository';
import { SupabaseTimelineRepository } from './supabase-timeline.repository';
import { AuthService } from '../auth.service';
import { Build } from '../../models/build.model';
import { Timeline } from '../../models/timeline.model';

const build = (id: string) => ({ id, name: `build ${id}`, classId: 'XEL' } as unknown as Build);
const timeline = (id: string, buildId: string) =>
  ({ id, name: `tl ${id}`, buildId, steps: [] } as unknown as Timeline);

function configure(localBuilds: Build[], localTimelines: Timeline[]) {
  const created = { builds: [] as Build[], timelines: [] as Timeline[] };
  TestBed.configureTestingModule({
    providers: [
      LocalDataImportService,
      { provide: LocalBuildRepository, useValue: { getAll: () => of(localBuilds) } },
      { provide: LocalTimelineRepository, useValue: { getAll: () => of(localTimelines) } },
      {
        provide: SupabaseBuildRepository,
        useValue: { create: (b: Build) => { created.builds.push(b); return of(b); } },
      },
      {
        provide: SupabaseTimelineRepository,
        useValue: { create: (t: Timeline) => { created.timelines.push(t); return of(t); } },
      },
      { provide: AuthService, useValue: { userId: () => 'u1' } },
    ],
  });
  return { service: TestBed.inject(LocalDataImportService), created };
}

describe('LocalDataImportService', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('liste les donnees locales importables', async () => {
    const { service } = configure([build('b1')], [timeline('t1', 'b1')]);
    const preview = await service.preview();
    expect(preview.builds.length).toBe(1);
    expect(preview.timelines.length).toBe(1);
  });

  it('genere de nouveaux ids et reecrit timeline.buildId', async () => {
    const { service, created } = configure([build('b1')], [timeline('t1', 'b1')]);
    await service.importSelected({ buildIds: ['b1'], timelineIds: ['t1'] });

    const nouveauBuild = created.builds[0];
    const nouvelleTimeline = created.timelines[0];
    expect(nouveauBuild.id).not.toBe('b1');
    expect(nouvelleTimeline.id).not.toBe('t1');
    // Sans ce remap, la timeline importee pointerait vers un build inexistant.
    expect(nouvelleTimeline.buildId).toBe(nouveauBuild.id);
  });

  it('embarque le build requis meme s il n est pas coche', async () => {
    const { service, created } = configure([build('b1')], [timeline('t1', 'b1')]);
    await service.importSelected({ buildIds: [], timelineIds: ['t1'] });
    expect(created.builds.length).toBe(1);
    expect(created.timelines[0].buildId).toBe(created.builds[0].id);
  });

  it('n importe pas ce qui n est pas coche', async () => {
    const { service, created } = configure([build('b1'), build('b2')], []);
    await service.importSelected({ buildIds: ['b1'], timelineIds: [] });
    expect(created.builds.length).toBe(1);
    expect(created.builds[0].name).toBe('build b1');
  });

  it('pose le flag apres un import reussi', async () => {
    const { service } = configure([build('b1')], []);
    expect(service.alreadyImported()).toBe(false);
    await service.importSelected({ buildIds: ['b1'], timelineIds: [] });
    expect(service.alreadyImported()).toBe(true);
  });

  it('ne detruit pas les donnees locales', async () => {
    localStorage.setItem('wakfu_builds', JSON.stringify([build('b1')]));
    const { service } = configure([build('b1')], []);
    await service.importSelected({ buildIds: ['b1'], timelineIds: [] });
    expect(JSON.parse(localStorage.getItem('wakfu_builds')!)).toEqual([build('b1')]);
  });

  it('le flag est cloisonne par utilisateur', async () => {
    const { service } = configure([build('b1')], []);
    await service.importSelected({ buildIds: ['b1'], timelineIds: [] });
    expect(localStorage.getItem('wakfu_imported_u1')).toBeTruthy();
  });
});
```

- [ ] **Step 2 : Lancer, vérifier l'échec**

Attendu : ÉCHEC — `Cannot find module './local-data-import.service'`.

- [ ] **Step 3 : Implémenter**

`frontend/src/app/services/storage/local-data-import.service.ts` :

```typescript
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Build } from '../../models/build.model';
import { Timeline } from '../../models/timeline.model';
import { AuthService } from '../auth.service';
import { LocalBuildRepository } from './local-build.repository';
import { LocalTimelineRepository } from './local-timeline.repository';
import { SupabaseBuildRepository } from './supabase-build.repository';
import { SupabaseTimelineRepository } from './supabase-timeline.repository';

export interface ImportPreview {
  builds: Build[];
  timelines: Timeline[];
}

export interface ImportSelection {
  buildIds: string[];
  timelineIds: string[];
}

/**
 * Importe les donnees locales de l'invite dans le compte.
 *
 * Non destructif : le localStorage d'invite est lu, jamais vide. Un flag par
 * utilisateur et par navigateur evite de reproposer l'import a chaque connexion.
 */
@Injectable({ providedIn: 'root' })
export class LocalDataImportService {
  private readonly localBuilds = inject(LocalBuildRepository);
  private readonly localTimelines = inject(LocalTimelineRepository);
  private readonly cloudBuilds = inject(SupabaseBuildRepository);
  private readonly cloudTimelines = inject(SupabaseTimelineRepository);
  private readonly auth = inject(AuthService);

  async preview(): Promise<ImportPreview> {
    return {
      builds: await firstValueFrom(this.localBuilds.getAll()),
      timelines: await firstValueFrom(this.localTimelines.getAll()),
    };
  }

  alreadyImported(): boolean {
    const userId = this.auth.userId();
    if (!userId) {
      return false;
    }
    try {
      return localStorage.getItem(this.flagKey(userId)) !== null;
    } catch {
      return false;
    }
  }

  async importSelected(selection: ImportSelection): Promise<void> {
    const { builds, timelines } = await this.preview();

    const chosenTimelines = timelines.filter(t => selection.timelineIds.includes(t.id));

    // Une timeline cochee embarque son build, meme decoche : sans lui, elle arriverait
    // cassee dans le compte.
    const requiredBuildIds = new Set<string>([
      ...selection.buildIds,
      ...chosenTimelines.map(t => t.buildId).filter(Boolean),
    ]);
    const chosenBuilds = builds.filter(b => requiredBuildIds.has(b.id));

    // Les ids locaux sont des chaines libres, les ids Postgres des uuid : on remappe.
    const idMap = new Map<string, string>();
    for (const build of chosenBuilds) {
      const newId = crypto.randomUUID();
      idMap.set(build.id, newId);
      await firstValueFrom(this.cloudBuilds.create({ ...build, id: newId }));
    }

    for (const timeline of chosenTimelines) {
      await firstValueFrom(this.cloudTimelines.create({
        ...timeline,
        id: crypto.randomUUID(),
        buildId: idMap.get(timeline.buildId) ?? '',
      }));
    }

    this.markImported();
  }

  private markImported(): void {
    const userId = this.auth.userId();
    if (!userId) {
      return;
    }
    try {
      localStorage.setItem(this.flagKey(userId), new Date().toISOString());
    } catch {
      /* localStorage indisponible : on repropose l'import, c'est sans danger */
    }
  }

  private flagKey(userId: string): string {
    return `wakfu_imported_${userId}`;
  }
}
```

- [ ] **Step 4 : Lancer, vérifier le succès**

Attendu : `TOTAL: 7 SUCCESS`, puis suite complète `TOTAL: 164 SUCCESS`.

- [ ] **Step 5 : Commit**

```bash
git add frontend/src/app/services/storage/local-data-import.service.ts frontend/src/app/services/storage/local-data-import.service.spec.ts
git commit -m "feat(storage): import opt-in des donnees locales avec remap des ids"
```

---

### Task 7 : Écran d'import

**Files:**
- Create: `frontend/src/app/pages/import-page.component.ts` + `.spec.ts`
- Modify: `frontend/src/app/app.routes.ts`

- [ ] **Step 1 : Écrire les tests qui échouent**

Créer `frontend/src/app/pages/import-page.component.spec.ts` :

```typescript
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ImportPageComponent } from './import-page.component';
import { LocalDataImportService } from '../services/storage/local-data-import.service';

const build = (id: string) => ({ id, name: `build ${id}`, classId: 'XEL' } as any);
const timeline = (id: string, buildId: string) => ({ id, name: `tl ${id}`, buildId } as any);

function configure(importResult: Promise<void> = Promise.resolve()) {
  const importService = {
    preview: jasmine.createSpy('preview').and.returnValue(
      Promise.resolve({ builds: [build('b1'), build('b2')], timelines: [timeline('t1', 'b1')] })
    ),
    importSelected: jasmine.createSpy('importSelected').and.returnValue(importResult),
  };
  TestBed.configureTestingModule({
    imports: [ImportPageComponent],
    providers: [provideRouter([]), { provide: LocalDataImportService, useValue: importService }],
  });
  const fixture = TestBed.createComponent(ImportPageComponent);
  fixture.detectChanges();
  return { fixture, component: fixture.componentInstance as any, importService };
}

describe('ImportPageComponent', () => {
  it('coche tout par defaut', async () => {
    const { component } = configure();
    await component.load();
    expect(component.selectedBuildIds().size).toBe(2);
    expect(component.selectedTimelineIds().size).toBe(1);
  });

  it('permet de decocher un element', async () => {
    const { component } = configure();
    await component.load();
    component.toggleBuild('b1');
    expect(component.selectedBuildIds().has('b1')).toBe(false);
    expect(component.selectedBuildIds().has('b2')).toBe(true);
  });

  it('transmet la selection au service', async () => {
    const { component, importService } = configure();
    await component.load();
    component.toggleBuild('b2');
    await component.submit();
    expect(importService.importSelected).toHaveBeenCalledWith({
      buildIds: ['b1'],
      timelineIds: ['t1'],
    });
  });

  it('affiche une erreur si l import echoue, sans rester en chargement', async () => {
    const { component } = configure(Promise.reject(new Error('boom')));
    await component.load();
    await component.submit();
    expect(component.error()).toBe('Import impossible : service indisponible. Tes donnees locales sont intactes.');
    expect(component.loading()).toBe(false);
  });
});
```

- [ ] **Step 2 : Lancer, vérifier l'échec**

Attendu : ÉCHEC — `Cannot find module './import-page.component'`.

- [ ] **Step 3 : Implémenter**

`frontend/src/app/pages/import-page.component.ts` :

```typescript
import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Build } from '../models/build.model';
import { Timeline } from '../models/timeline.model';
import { LocalDataImportService } from '../services/storage/local-data-import.service';

@Component({
  selector: 'app-import-page',
  standalone: true,
  template: `
    <section class="import-page">
      <h1>Importer tes données locales</h1>
      <p class="info">
        Ces builds et timelines sont stockés dans ce navigateur. Coche ce que tu veux
        copier dans ton compte. <strong>Rien ne sera supprimé localement.</strong>
      </p>

      @if (builds().length || timelines().length) {
        <h2>Builds</h2>
        <ul>
          @for (b of builds(); track b.id) {
            <li>
              <label>
                <input type="checkbox" [checked]="selectedBuildIds().has(b.id)" (change)="toggleBuild(b.id)" />
                {{ b.name }}
              </label>
            </li>
          }
        </ul>

        <h2>Timelines</h2>
        <ul>
          @for (t of timelines(); track t.id) {
            <li>
              <label>
                <input type="checkbox" [checked]="selectedTimelineIds().has(t.id)" (change)="toggleTimeline(t.id)" />
                {{ t.name }}
              </label>
            </li>
          }
        </ul>
        <p class="hint">Une timeline cochée importe automatiquement le build dont elle dépend.</p>

        @if (error()) { <p class="error" role="alert">{{ error() }}</p> }

        <div class="actions">
          <button type="button" (click)="skip()">Plus tard</button>
          <button type="button" (click)="submit()" [disabled]="loading()">
            {{ loading() ? 'Import…' : 'Importer la sélection' }}
          </button>
        </div>
      } @else {
        <p class="info">Aucune donnée locale à importer.</p>
        <div class="actions"><button type="button" (click)="skip()">Continuer</button></div>
      }
    </section>
  `,
  styles: [`
    .import-page { max-width: 520px; margin: 48px auto; padding: 0 16px; }
    h1 { font-size: 20px; margin-bottom: 12px; }
    h2 { font-size: 14px; margin: 20px 0 8px; opacity: 0.8; }
    ul { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 6px; }
    label { display: flex; align-items: center; gap: 8px; font-size: 14px; }
    .info { font-size: 14px; line-height: 1.5; }
    .hint { font-size: 12px; opacity: 0.7; margin-top: 8px; }
    .error { color: #e5484d; font-size: 13px; }
    .actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 24px; }
    button {
      padding: 9px 12px; border: 1px solid var(--app-border); border-radius: 6px;
      background: var(--app-surface); color: inherit; cursor: pointer;
    }
    button:last-child { background: var(--app-accent); border-color: transparent; color: #fff; }
    button[disabled] { opacity: 0.6; cursor: default; }
  `],
})
export class ImportPageComponent {
  private readonly importService = inject(LocalDataImportService);
  private readonly router = inject(Router);

  readonly builds = signal<Build[]>([]);
  readonly timelines = signal<Timeline[]>([]);
  readonly selectedBuildIds = signal<Set<string>>(new Set());
  readonly selectedTimelineIds = signal<Set<string>>(new Set());
  readonly error = signal<string | null>(null);
  readonly loading = signal(false);

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    const preview = await this.importService.preview();
    this.builds.set(preview.builds);
    this.timelines.set(preview.timelines);
    // Tout coche par defaut : le cas courant est de vouloir tout recuperer.
    this.selectedBuildIds.set(new Set(preview.builds.map(b => b.id)));
    this.selectedTimelineIds.set(new Set(preview.timelines.map(t => t.id)));
  }

  toggleBuild(id: string): void {
    this.selectedBuildIds.update(current => toggle(current, id));
  }

  toggleTimeline(id: string): void {
    this.selectedTimelineIds.update(current => toggle(current, id));
  }

  async submit(): Promise<void> {
    this.error.set(null);
    this.loading.set(true);
    try {
      await this.importService.importSelected({
        buildIds: [...this.selectedBuildIds()],
        timelineIds: [...this.selectedTimelineIds()],
      });
      this.loading.set(false);
      await this.router.navigate(['/builds']).catch(() => undefined);
    } catch {
      this.loading.set(false);
      this.error.set('Import impossible : service indisponible. Tes donnees locales sont intactes.');
    }
  }

  skip(): void {
    this.router.navigate(['/accueil']).catch(() => undefined);
  }
}

function toggle(current: Set<string>, id: string): Set<string> {
  const next = new Set(current);
  next.has(id) ? next.delete(id) : next.add(id);
  return next;
}
```

- [ ] **Step 4 : Ajouter la route**

Dans `frontend/src/app/app.routes.ts`, ajouter l'import :

```typescript
import { ImportPageComponent } from './pages/import-page.component';
```

et la route, **avant** la route `'**'` :

```typescript
  { path: 'import', component: ImportPageComponent },
```

- [ ] **Step 5 : Lancer, vérifier le succès**

Attendu : `TOTAL: 4 SUCCESS` sur ce spec, puis suite complète `TOTAL: 168 SUCCESS`.

- [ ] **Step 6 : Commit**

```bash
git add frontend/src/app/pages/import-page.component.ts frontend/src/app/pages/import-page.component.spec.ts frontend/src/app/app.routes.ts
git commit -m "feat(storage): ecran d'import des donnees locales"
```

---

### Task 8 : Remontée des échecs d'écriture

**Files:**
- Create: `frontend/src/app/services/save-error.service.ts` + `.spec.ts`
- Modify: `frontend/src/app/services/build.service.ts`, `frontend/src/app/services/timeline.service.ts`
- Modify: `frontend/src/app/layout/app-shell.component.ts`

**Pourquoi cette tâche existe.** `BuildService.createBuild/updateBuild/deleteBuild` (lignes ~60-76) n'attrapent **rien** : seul `loadBuilds()` gère les erreurs. Avec `localStorage`, une écriture n'échouait jamais — le trou n'a jamais été exercé. Avec Supabase hors-ligne, l'écriture jette dans le vide : rejection non gérée, et **l'utilisateur croit avoir sauvegardé**. C'est précisément l'échec silencieux que le spec interdit.

- [ ] **Step 1 : Écrire les tests qui échouent**

Créer `frontend/src/app/services/save-error.service.spec.ts` :

```typescript
import { TestBed } from '@angular/core/testing';
import { SaveErrorService } from './save-error.service';

describe('SaveErrorService', () => {
  let service: SaveErrorService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [SaveErrorService] });
    service = TestBed.inject(SaveErrorService);
  });

  it('ne signale rien au depart', () => {
    expect(service.message()).toBeNull();
  });

  it('expose le message de la derniere sauvegarde echouee', () => {
    service.reportFailure();
    expect(service.message()).toBe(
      'Sauvegarde impossible : service indisponible. Tes modifications ne sont pas enregistrees.'
    );
  });

  it('peut etre acquitte', () => {
    service.reportFailure();
    service.dismiss();
    expect(service.message()).toBeNull();
  });
});
```

Ajouter à la fin de `frontend/src/app/services/build.service.ts` un nouveau fichier de test `frontend/src/app/services/build-service-save-errors.spec.ts` :

```typescript
import { TestBed } from '@angular/core/testing';
import { throwError } from 'rxjs';
import { BuildService } from './build.service';
import { WakfuApiService } from './wakfu-api.service';
import { SaveErrorService } from './save-error.service';
import { Build } from '../models/build.model';

const build = { id: 'b1', name: 'test', classId: 'XEL' } as unknown as Build;

function configure() {
  const api = {
    getAllBuilds: () => throwError(() => new Error('offline')),
    createBuild: () => throwError(() => new Error('offline')),
    updateBuild: () => throwError(() => new Error('offline')),
    deleteBuild: () => throwError(() => new Error('offline')),
    getBuildById: () => throwError(() => new Error('offline')),
  };
  TestBed.configureTestingModule({
    providers: [BuildService, SaveErrorService, { provide: WakfuApiService, useValue: api }],
  });
  return {
    service: TestBed.inject(BuildService),
    saveError: TestBed.inject(SaveErrorService),
  };
}

describe('BuildService — echecs d ecriture', () => {
  // Sans ca, l'utilisateur croit avoir sauvegarde alors que rien n'est parti.
  it('signale un echec de creation au lieu de jeter dans le vide', async () => {
    const { service, saveError } = configure();
    const result = await service.createBuild(build);
    expect(result).toBeNull();
    expect(saveError.message()).toContain('Sauvegarde impossible');
  });

  it('signale un echec de mise a jour', async () => {
    const { service, saveError } = configure();
    const ok = await service.updateBuild('b1', { name: 'x' });
    expect(ok).toBe(false);
    expect(saveError.message()).toContain('Sauvegarde impossible');
  });
});
```

- [ ] **Step 2 : Lancer, vérifier l'échec**

```bash
npx ng test --include='**/save-error.service.spec.ts' --watch=false --browsers=ChromeHeadless
```
Attendu : ÉCHEC — `Cannot find module './save-error.service'`.

- [ ] **Step 3 : Implémenter le service**

`frontend/src/app/services/save-error.service.ts` :

```typescript
import { Injectable, signal } from '@angular/core';

const MESSAGE =
  'Sauvegarde impossible : service indisponible. Tes modifications ne sont pas enregistrees.';

/**
 * Signale a l'utilisateur qu'une ecriture a echoue.
 *
 * Les lectures ont un repli (le miroir local), pas les ecritures : une sauvegarde qui
 * echoue DOIT etre visible, sinon l'utilisateur croit son travail enregistre alors que
 * rien n'est parti.
 */
@Injectable({ providedIn: 'root' })
export class SaveErrorService {
  private readonly _message = signal<string | null>(null);
  readonly message = this._message.asReadonly();

  reportFailure(): void {
    this._message.set(MESSAGE);
  }

  dismiss(): void {
    this._message.set(null);
  }
}
```

- [ ] **Step 4 : Faire remonter les erreurs dans `BuildService`**

Dans `frontend/src/app/services/build.service.ts`, ajouter l'import :

```typescript
import { SaveErrorService } from './save-error.service';
```

⚠️ **Ce service utilise l'injection par constructeur** (ligne ~38 : `constructor(private readonly api: WakfuApiService) {`), pas `inject()`. Ajouter le paramètre au constructeur **existant**, sans en créer un second :

```typescript
  constructor(
    private readonly api: WakfuApiService,
    private readonly saveError: SaveErrorService,
  ) {
```

en conservant intégralement le corps actuel du constructeur.

Remplacer `createBuild`, `updateBuild` et `deleteBuild` par des versions qui attrapent :

```typescript
  public async createBuild(build: Build): Promise<Build | null> {
    try {
      const created = await firstValueFrom(this.api.createBuild(build));
      this.builds.update(list => [...list, created]);
      return created;
    } catch {
      this.saveError.reportFailure();
      return null;
    }
  }

  public async updateBuild(buildId: string, updates: Partial<Build>): Promise<boolean> {
    const current = this.builds().find(b => b.id === buildId);
    if (!current) {
      return false;
    }
    const updated = { ...current, ...updates } as Build;
    try {
      await firstValueFrom(this.api.updateBuild(buildId, updated));
      this.builds.update(list => list.map(b => (b.id === buildId ? updated : b)));
      return true;
    } catch {
      this.saveError.reportFailure();
      return false;
    }
  }

  public async deleteBuild(buildId: string): Promise<boolean> {
    try {
      await firstValueFrom(this.api.deleteBuild(buildId));
      this.builds.update(list => list.filter(b => b.id !== buildId));
      return true;
    } catch {
      this.saveError.reportFailure();
      return false;
    }
  }
```

> **Lire le fichier avant d'éditer.** Les corps actuels manipulent l'état interne (`this.builds`, sélection courante…). Conserver cette logique métier telle quelle : n'ajouter que le `try/catch` et le `reportFailure()`. Si un nom de signal diffère (`builds`, `_builds`…), garder celui du fichier.

- [ ] **Step 5 : Même traitement dans `TimelineService`**

Dans `frontend/src/app/services/timeline.service.ts`, même chose — ce service utilise lui aussi l'injection par constructeur (ligne ~40 : `constructor(private api: WakfuApiService) {`) :

```typescript
  constructor(
    private api: WakfuApiService,
    private readonly saveError: SaveErrorService,
  ) {
```

Puis entourer chaque appel d'écriture (`createTimeline`, `updateTimeline`, `deleteTimeline`) d'un `try/catch` appelant `this.saveError.reportFailure()` et retournant une valeur d'échec (`null` / `false`) au lieu de laisser l'exception remonter. Conserver la logique métier existante (mise à jour des signaux internes) : n'ajouter que le `try/catch`.

- [ ] **Step 6 : Afficher le message dans la coquille**

Dans `frontend/src/app/layout/app-shell.component.ts`, injecter `SaveErrorService` et ajouter, en haut du template (juste après l'ouverture du conteneur principal) :

```html
      @if (saveError.message()) {
        <div class="save-error" role="alert">
          {{ saveError.message() }}
          <button type="button" (click)="saveError.dismiss()" aria-label="Fermer">×</button>
        </div>
      }
```

et le style :

```css
    .save-error {
      display: flex; align-items: center; justify-content: space-between; gap: 12px;
      padding: 8px 12px; background: #e5484d; color: #fff; font-size: 13px;
    }
    .save-error button { background: none; border: 0; color: #fff; font-size: 18px; cursor: pointer; }
```

en exposant le service : `protected readonly saveError = inject(SaveErrorService);`

- [ ] **Step 7 : Lancer, vérifier le succès**

Attendu : `TOTAL: 5 SUCCESS` sur les deux nouveaux specs, puis suite complète `TOTAL: 173 SUCCESS`.

- [ ] **Step 8 : Commit**

```bash
git add frontend/src/app/services/save-error.service.ts frontend/src/app/services/save-error.service.spec.ts frontend/src/app/services/build-service-save-errors.spec.ts frontend/src/app/services/build.service.ts frontend/src/app/services/timeline.service.ts frontend/src/app/layout/app-shell.component.ts
git commit -m "feat(storage): remonte les echecs d'ecriture au lieu de les avaler"
```

---

### Task 9 : Proposer l'import après connexion

**Files:**
- Modify: `frontend/src/app/pages/login-page.component.ts` + `.spec.ts`

Sans cette tâche, `/import` existe mais personne n'y va, et `alreadyImported()` n'est jamais appelé.

- [ ] **Step 1 : Écrire les tests qui échouent**

Ajouter à `frontend/src/app/pages/login-page.component.spec.ts`, dans le `describe` existant :

```typescript
  describe('proposition d import apres connexion', () => {
    function configureWithImport(opts: { hasLocalData: boolean; alreadyImported: boolean }) {
      const auth = {
        signIn: jasmine.createSpy('signIn').and.returnValue(Promise.resolve({ ok: true })),
      };
      const importService = {
        preview: () =>
          Promise.resolve({
            builds: opts.hasLocalData ? [{ id: 'b1' }] : [],
            timelines: [],
          }),
        alreadyImported: () => opts.alreadyImported,
      };
      const router = { navigate: jasmine.createSpy('navigate').and.returnValue(Promise.resolve(true)) };

      TestBed.configureTestingModule({
        imports: [LoginPageComponent],
        providers: [
          provideRouter([]),
          { provide: AuthService, useValue: auth },
          { provide: LocalDataImportService, useValue: importService },
          { provide: Router, useValue: router },
        ],
      });
      const fixture = TestBed.createComponent(LoginPageComponent);
      fixture.detectChanges();
      return { component: fixture.componentInstance as any, router };
    }

    it('redirige vers /import quand des donnees locales n ont pas encore ete importees', async () => {
      const { component, router } = configureWithImport({ hasLocalData: true, alreadyImported: false });
      component.email = 'a@b.c';
      component.password = 'motdepasse8';
      await component.submit();
      expect(router.navigate).toHaveBeenCalledWith(['/import']);
    });

    it('va a l accueil quand ce navigateur a deja importe', async () => {
      const { component, router } = configureWithImport({ hasLocalData: true, alreadyImported: true });
      component.email = 'a@b.c';
      component.password = 'motdepasse8';
      await component.submit();
      expect(router.navigate).toHaveBeenCalledWith(['/accueil']);
    });

    it('va a l accueil quand il n y a aucune donnee locale', async () => {
      const { component, router } = configureWithImport({ hasLocalData: false, alreadyImported: false });
      component.email = 'a@b.c';
      component.password = 'motdepasse8';
      await component.submit();
      expect(router.navigate).toHaveBeenCalledWith(['/accueil']);
    });
  });
```

Ajouter les imports nécessaires en tête du spec :

```typescript
import { Router } from '@angular/router';
import { LocalDataImportService } from '../services/storage/local-data-import.service';
```

- [ ] **Step 2 : Lancer, vérifier l'échec**

Attendu : ÉCHEC — `Expected navigate to have been called with [ '/import' ]` (la page redirige toujours vers `/accueil`).

- [ ] **Step 3 : Implémenter**

Dans `frontend/src/app/pages/login-page.component.ts`, ajouter l'import et l'injection :

```typescript
import { LocalDataImportService } from '../services/storage/local-data-import.service';
```
```typescript
  private readonly importService = inject(LocalDataImportService);
```

Remplacer la branche de succès de `submit()` :

```typescript
    if (result.ok) {
      await this.router.navigate([await this.destinationAfterLogin()]).catch(() => undefined);
    } else {
      this.error.set(result.error ?? null);
    }
```

et ajouter la méthode :

```typescript
  /**
   * Propose l'import si ce navigateur porte des donnees locales pas encore montees dans
   * le compte. Un echec de cette verification ne doit pas bloquer la connexion.
   */
  private async destinationAfterLogin(): Promise<string> {
    try {
      if (this.importService.alreadyImported()) {
        return '/accueil';
      }
      const preview = await this.importService.preview();
      const hasLocalData = preview.builds.length > 0 || preview.timelines.length > 0;
      return hasLocalData ? '/import' : '/accueil';
    } catch {
      return '/accueil';
    }
  }
```

- [ ] **Step 4 : Lancer, vérifier le succès**

Attendu : `TOTAL: 7 SUCCESS` sur `login-page.component.spec.ts` (4 existants + 3 nouveaux), puis suite complète `TOTAL: 176 SUCCESS`.

- [ ] **Step 5 : Commit**

```bash
git add frontend/src/app/pages/login-page.component.ts frontend/src/app/pages/login-page.component.spec.ts
git commit -m "feat(storage): propose l'import des donnees locales apres connexion"
```

---

### Task 10 : Vérification finale

- [ ] **Step 1 : Suite complète**

```bash
npx ng test --watch=false --browsers=ChromeHeadless
```
Attendu : `TOTAL: 176 SUCCESS`, zéro échec (138 de baseline + 38 ajoutés).

- [ ] **Step 2 : Build de production**

```bash
npx ng build --configuration production
```
Attendu : `Application bundle generation complete`, sans dépassement du budget `initial` (2 MB).

- [ ] **Step 3 : Vérification manuelle — invité inchangé**

`npm start`, puis en **navigation privée** (pour partir d'un localStorage vierge) :
1. Créer un build et une timeline **sans se connecter**.
2. Recharger : ils sont toujours là.
3. Vérifier dans les devtools → Application → Local Storage : les clés `wakfu_builds` / `wakfu_timelines` sont utilisées, et **aucune** clé `wakfu_cache_*`.

- [ ] **Step 4 : Vérification manuelle — parcours connecté**

1. Se connecter → aller sur `/import` → l'écran liste les données créées au step 3, tout coché.
2. Décocher un build, importer → redirection vers `/builds`.
3. Dashboard Supabase → Table Editor → `builds` / `timelines` : les lignes sont là, avec le bon `owner_id`, et **`timelines.build_id` pointe vers l'uuid du build importé** (pas vers l'ancien id local).
4. Vérifier que `wakfu_builds` / `wakfu_timelines` sont **intacts** en local.
5. Se déconnecter → les données d'invité sont toujours là.

- [ ] **Step 5 : Vérification de l'isolation entre comptes**

Se connecter avec un **2ᵉ compte** : il ne doit voir **aucune** donnée du 1ᵉʳ. C'est la vérification de la RLS côté application.

- [ ] **Step 6 : Vérification de l'invariant hors-ligne**

Connecté, avec des timelines en base : ouvrir les devtools → Network → passer en **Offline**, puis recharger.

Attendu :
- les builds/timelines s'affichent (le miroir répond) ;
- le simulateur fonctionne (board, freeplay) ;
- une tentative de sauvegarde **échoue avec un message**, sans faire croire à un succès.

- [ ] **Step 7 : Commit final si ajustements**

```bash
git add -A -- frontend/src supabase
git commit -m "chore(storage): ajustements suite a la verification du lot 2"
```

---

## Ce que ce lot ne fait pas

- **Aucun partage.** `visibility` reste `'private'`, aucune UI ne permet de la changer, aucune politique RLS publique n'existe. Lot 3.
- **Pas de galerie**, pas de copie de timeline, pas de rejeu avec son propre build. Lot 3.
- **Pas de file d'attente d'écritures hors-ligne.** Une écriture hors-ligne échoue et le dit ; elle n'est pas rejouée plus tard.
- **Pas de synchronisation bidirectionnelle.** Les écritures sont cloud-only, donc aucun conflit n'est possible par construction.
- **Pas de découplage `timeline.buildId`.** La colonne est nullable, mais le partage « structure seule » est le lot 3.
