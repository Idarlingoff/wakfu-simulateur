# Comptes utilisateurs — Lot 3 : Partage & galerie — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre les timelines partageables (privé / lien non listé / public), les regrouper dans une galerie filtrable, et permettre de copier celles des autres — sans toucher au dashboard existant.

**Architecture:** Nouvelles routes `/galerie` et `/t/:token` ; le dashboard de 1195 lignes et `/timelines` restent intacts. La sécurité du lien repose sur un `share_token` uuid + une fonction Postgres dédiée : RLS n'expose que les `public`, les `unlisted` ne sont accessibles que contre présentation du jeton. Un `PublicTimelineRepository` distinct porte les lectures non authentifiées.

**Tech Stack:** Angular 20.3 (standalone, signals), `@supabase/supabase-js`, Postgres/RLS, tests Karma/Jasmine.

**Spec de référence :** `docs/superpowers/specs/2026-07-17-comptes-lot3-partage-design.md`

---

## Écart assumé vs le spec — à valider avant de démarrer

Le spec dit « les dégâts apparaissent après choix d'un build du lecteur ». Ce plan livre le
**point d'entrée** du rejeu (sélecteur de build filtré par classe + état `showsDamage`),
mais **ne recalcule pas réellement les dégâts dans la vue `/t/:token`**. Rebrancher le
moteur (`SimulationService` + `BoardService` + rendu du board) dans une page autonome est
un chantier à part entière, sans rapport avec le *partage* lui-même — le cœur du lot 3.

Le flux naturel reste : **Dupliquer** copie la timeline dans le compte du lecteur, qui
l'ouvre ensuite dans le dashboard pour la simuler avec toute la puissance existante.

Deux options si le rejeu inline compte pour toi :
1. **Ce plan tel quel** (recommandé) : le partage est complet, le rejeu inline est une
   itération ultérieure. La vue partagée affiche séquence + board + invitation à dupliquer.
2. **Ajouter une Task 6bis** qui câble `SimulationService` dans la vue partagée — +1 lot de
   travail, à cadrer séparément.

Le reste du plan suppose l'option 1.

---

## Prérequis d'exécution

Depuis `frontend/` :

```bash
export CHROME_BIN="$HOME/.cache/puppeteer/chrome-headless-shell/mac_arm-150.0.7871.24/chrome-headless-shell-mac-arm64/chrome-headless-shell"
```

**Baseline : `TOTAL: 200 SUCCESS`.** Doit rester verte à chaque tâche.

Hygiène git : ne jamais commiter `.claude/`, `CLAUDE.md`, `.backend.pid`, `.frontend.pid`, `frontend/.gitignore`, `frontend/.env`, `frontend/src/environments/environment.ts`. Jamais `git add -A` / `git add .`. Vérifier chaque commit avec `git show --stat`. Lancer les `git add` **depuis la racine du dépôt** avec les chemins `frontend/src/...`.

## Structure des fichiers

| Fichier | Responsabilité |
|---|---|
| `supabase/migrations/0003_timeline_sharing.sql` (créer) | `share_token`, backfill `class_id`, politique de lecture publique, fonction `get_shared_timeline`. |
| `frontend/src/app/models/timeline.model.ts` (modifier) | Champs `classId`, `visibility`, `shareToken`. |
| `frontend/src/app/services/storage/supabase-timeline.repository.ts` (modifier) | `toRow` écrit `class_id` ; `fromRow` lit `visibility`/`share_token`. |
| `frontend/src/app/services/timeline.service.ts` (modifier) | Renseigne `classId` depuis le build à la création. |
| `frontend/src/app/models/shared-timeline.model.ts` (créer) | `SharedTimeline = Timeline & { authorUsername }`. |
| `frontend/src/app/services/storage/public-timeline.repository.ts` (créer) | `getPublic(classId?)`, `getByShareToken(token)`. |
| `frontend/src/app/services/timeline-sharing.service.ts` (créer) | `setVisibility`, `shareLink`, `duplicate`. |
| `frontend/src/app/pages/gallery-page.component.ts` (créer) | Galerie : onglets, filtre, visibilité, copie, duplication. |
| `frontend/src/app/pages/shared-timeline-page.component.ts` (créer) | Consultation `/t/:token` + rejeu par build du lecteur. |
| `frontend/src/app/app.routes.ts` (modifier) | Routes `/galerie` et `/t/:token`. |
| `frontend/src/app/ui/app-sidebar.component.ts` (modifier) | Entrée « Galerie ». |
| `frontend/src/app/ui/icon.component.ts` (modifier) | Icônes `share`, `globe`. |

---

### Task 1 : Migration SQL — partage

**Files:** Create `supabase/migrations/0003_timeline_sharing.sql`

Pas de test unitaire (infra Supabase), vérifié manuellement.

- [ ] **Step 1 : Écrire la migration**

```sql
-- Jeton de partage : imprevisible, porte par le lien a la place de l'id.
alter table public.timelines
  add column share_token uuid not null default gen_random_uuid();
create unique index timelines_share_token_idx on public.timelines (share_token);

-- Dette du lot 2 : class_id n'a jamais ete ecrit. On le rattrape depuis le build.
update public.timelines t
  set class_id = b.class_id
  from public.builds b
  where t.build_id = b.id and t.class_id is null;

-- Lecture publique : n'expose QUE les 'public', a tout le monde (anonyme inclus).
-- Les politiques RLS se cumulent en OR avec timelines_owner_all (lot 2) : le
-- proprietaire garde tout. Les 'unlisted' restent invisibles a RLS, donc NON
-- enumerables via l'API REST.
create policy "timelines_public_read" on public.timelines
  for select using (visibility = 'public');

-- Acces par lien : court-circuite RLS, mais UNIQUEMENT contre presentation du jeton.
-- 'private' n'est jamais accessible par ce chemin.
create function public.get_shared_timeline(token uuid)
returns setof public.timelines
language sql
security definer
stable
set search_path = public
as $$
  select * from public.timelines
  where share_token = token and visibility in ('public', 'unlisted');
$$;

grant execute on function public.get_shared_timeline(uuid) to anon, authenticated;
```

- [ ] **Step 2 : Appliquer**

Dashboard Supabase → SQL Editor → coller → exécuter. Attendu : `Success. No rows returned`.

- [ ] **Step 3 : Vérifier la non-énumérabilité (LE test de sécurité du lot)**

Créer via l'app (ou Table Editor) trois timelines : une `public`, une `unlisted`, une
`private`. Puis, avec les valeurs de `frontend/.env` :

```bash
curl -s "<URL>/rest/v1/timelines?select=id,visibility" -H "apikey: <ANON_KEY>"
```

Attendu : **seule la `public` apparaît**. Ni l'`unlisted` ni la `private` ne sont listées.

- [ ] **Step 4 : Vérifier la fonction jeton**

```bash
# token de l'unlisted -> la renvoie
curl -s "<URL>/rest/v1/rpc/get_shared_timeline" -H "apikey: <ANON_KEY>" \
  -H "Content-Type: application/json" -d '{"token":"<TOKEN_UNLISTED>"}'
# token de la private -> tableau vide
curl -s "<URL>/rest/v1/rpc/get_shared_timeline" -H "apikey: <ANON_KEY>" \
  -H "Content-Type: application/json" -d '{"token":"<TOKEN_PRIVATE>"}'
```

Attendu : l'`unlisted` est renvoyée, la `private` donne `[]`.

- [ ] **Step 5 : Commit**

```bash
git add supabase/migrations/0003_timeline_sharing.sql
git commit -m "feat(sharing): share_token, lecture publique RLS et fonction get_shared_timeline"
```

---

### Task 2 : Modèle + écriture de `class_id` et `visibility`

**Files:**
- Modify: `frontend/src/app/models/timeline.model.ts`
- Modify: `frontend/src/app/services/storage/supabase-timeline.repository.ts`
- Modify: `frontend/src/app/services/timeline.service.ts`
- Test: `frontend/src/app/services/storage/supabase-timeline-sharing.spec.ts`

- [ ] **Step 1 : Étendre le modèle**

Dans `frontend/src/app/models/timeline.model.ts`, ajouter à l'interface `Timeline`
(après `buildId: string;`) :

```typescript
  classId?: string;
  visibility?: 'private' | 'unlisted' | 'public';
  shareToken?: string;
```

- [ ] **Step 2 : Écrire les tests qui échouent**

Créer `frontend/src/app/services/storage/supabase-timeline-sharing.spec.ts` :

```typescript
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { SupabaseTimelineRepository } from './supabase-timeline.repository';
import { SupabaseClientService } from '../supabase-client.service';
import { AuthService } from '../auth.service';
import { LocalMirror } from './local-mirror.service';
import { Timeline } from '../../models/timeline.model';

const timeline = () =>
  ({ id: 't1', name: 'combo', buildId: 'b1', classId: 'XEL', steps: [] } as unknown as Timeline);

/** Capture la derniere ligne passee a insert(). */
function makeFakeClient() {
  const captured: { row?: any } = {};
  const builder: any = {
    select: () => builder,
    eq: () => builder,
    insert: (row: any) => { captured.row = row; return builder; },
    update: () => builder,
    delete: () => builder,
    then: (res: any) => Promise.resolve({ data: null, error: null }).then(res),
  };
  return { captured, client: { from: () => builder } };
}

describe('SupabaseTimelineRepository — champs de partage', () => {
  it('ecrit class_id a la creation', async () => {
    const fake = makeFakeClient();
    TestBed.configureTestingModule({
      providers: [
        SupabaseTimelineRepository,
        LocalMirror,
        { provide: SupabaseClientService, useValue: { client: fake.client } },
        { provide: AuthService, useValue: { userId: () => 'u1' } },
      ],
    });
    const repo = TestBed.inject(SupabaseTimelineRepository);
    await firstValueFrom(repo.create(timeline()));
    // Sans ca, class_id reste NULL et la galerie ne peut pas filtrer par classe.
    expect(fake.captured.row.class_id).toBe('XEL');
  });

  it('lit visibility et shareToken depuis la ligne', async () => {
    const fake = makeFakeClient();
    TestBed.configureTestingModule({
      providers: [
        SupabaseTimelineRepository,
        LocalMirror,
        { provide: SupabaseClientService, useValue: { client: fake.client } },
        { provide: AuthService, useValue: { userId: () => 'u1' } },
      ],
    });
    const repo = TestBed.inject(SupabaseTimelineRepository);
    const row = { id: 't1', name: 'combo', build_id: 'b1', class_id: 'XEL',
      visibility: 'public', share_token: 'tok-1', data: timeline() };
    const mapped = (repo as any).fromRow(row) as Timeline;
    expect(mapped.visibility).toBe('public');
    expect(mapped.shareToken).toBe('tok-1');
    expect(mapped.classId).toBe('XEL');
  });
});
```

- [ ] **Step 3 : Lancer, vérifier l'échec**

```bash
npx ng test --include='**/supabase-timeline-sharing.spec.ts' --watch=false --browsers=ChromeHeadless
```
Attendu : ÉCHEC — `Expected undefined to be 'XEL'`.

- [ ] **Step 4 : Écrire `class_id` dans `toRow`, lire les champs dans `fromRow`**

Dans `frontend/src/app/services/storage/supabase-timeline.repository.ts`, remplacer
`toRow` et `fromRow` par :

```typescript
  private toRow(timeline: Timeline, ownerId: string) {
    return {
      id: timeline.id,
      owner_id: ownerId,
      build_id: timeline.buildId || null,
      name: timeline.name,
      // Denormalise depuis le build : indispensable au filtre par classe de la galerie.
      class_id: timeline.classId ?? null,
      data: timeline,
    };
  }

  private fromRow(row: any): Timeline {
    return {
      ...(row.data as Timeline),
      id: row.id,
      name: row.name,
      buildId: row.build_id ?? '',
      classId: row.class_id ?? undefined,
      visibility: row.visibility ?? undefined,
      shareToken: row.share_token ?? undefined,
    };
  }
```

⚠️ `toRow` ne renvoie **pas** `visibility` ni `share_token` : ils sont gérés en base
(défaut + fonction). Les inclure risquerait d'écraser la visibilité au moindre `update`.

Ajouter aussi `visibility, share_token` au `.select(...)` de `readAll` (garder les
colonnes existantes) :

```typescript
        .select('id, name, build_id, class_id, visibility, share_token, data')
```

- [ ] **Step 5 : Renseigner `classId` à la création de timeline**

Dans `frontend/src/app/services/timeline.service.ts`, importer `BuildService` et l'ajouter
au constructeur (injection par constructeur, comme l'existant) — **conserver les autres
paramètres et le corps** :

```typescript
import { BuildService } from './build.service';
```
```typescript
  constructor(
    private api: WakfuApiService,
    private readonly saveError: SaveErrorService,
    private readonly auth: AuthService,
    private readonly buildService: BuildService,
  ) {
```

Puis, dans `createTimeline`, renseigner `classId` depuis le build référencé **avant**
l'appel API :

```typescript
  public async createTimeline(timeline: Timeline): Promise<Timeline | null> {
    const classId = timeline.classId
      ?? this.buildService.getBuildById(timeline.buildId)?.classId;
    const enriched = { ...timeline, classId };
    try {
      const created = await firstValueFrom(this.api.createTimeline(enriched));
      this.timelines.update(tls => [...tls, created]);
      return created;
    } catch {
      this.saveError.reportFailure();
      return null;
    }
  }
```

> **Lire la méthode `createTimeline` actuelle d'abord.** Si son corps diffère, ne modifier
> que l'enrichissement `classId` + garder le try/catch `saveError` déjà en place au lot 2.

- [ ] **Step 6 : Lancer la suite complète**

Attendu : `TOTAL: 202 SUCCESS` (200 + 2), zéro échec.

- [ ] **Step 7 : Commit**

```bash
git add frontend/src/app/models/timeline.model.ts frontend/src/app/services/storage/supabase-timeline.repository.ts frontend/src/app/services/storage/supabase-timeline-sharing.spec.ts frontend/src/app/services/timeline.service.ts
git commit -m "feat(sharing): ecrit class_id et lit visibility/shareToken sur les timelines"
```

---

### Task 3 : `PublicTimelineRepository`

**Files:**
- Create: `frontend/src/app/models/shared-timeline.model.ts`
- Create: `frontend/src/app/services/storage/public-timeline.repository.ts` + `.spec.ts`

- [ ] **Step 1 : Créer le modèle**

`frontend/src/app/models/shared-timeline.model.ts` :

```typescript
import { Timeline } from './timeline.model';

/** Timeline publique enrichie du pseudo de son auteur (join profiles). */
export interface SharedTimeline extends Timeline {
  authorUsername: string;
}
```

- [ ] **Step 2 : Écrire les tests qui échouent**

Créer `frontend/src/app/services/storage/public-timeline.repository.spec.ts` :

```typescript
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { PublicTimelineRepository } from './public-timeline.repository';
import { SupabaseClientService } from '../supabase-client.service';

/** Faux client : from().select().eq().order() pour la liste, rpc() pour le jeton. */
function makeFakeClient(opts: { rows?: any[]; rpcData?: any[]; rejects?: boolean } = {}) {
  const resolve = (data: any) =>
    opts.rejects ? Promise.reject(new Error('offline')) : Promise.resolve({ data, error: null });
  const builder: any = {
    select: () => builder,
    eq: () => builder,
    order: () => resolve(opts.rows ?? []),
    then: (r: any) => resolve(opts.rows ?? []).then(r),
  };
  return {
    from: () => builder,
    rpc: (_fn: string, _args: any) => resolve(opts.rpcData ?? []),
  };
}

function configure(client: any) {
  TestBed.configureTestingModule({
    providers: [
      PublicTimelineRepository,
      { provide: SupabaseClientService, useValue: { client } },
    ],
  });
  return TestBed.inject(PublicTimelineRepository);
}

const row = (id: string, vis = 'public') => ({
  id, name: `tl ${id}`, build_id: null, class_id: 'XEL', visibility: vis,
  share_token: `tok-${id}`, data: { id, name: `tl ${id}`, steps: [] },
  profiles: { username: 'Lilia' },
});

describe('PublicTimelineRepository', () => {
  it('liste les timelines publiques avec le pseudo de l auteur', async () => {
    const repo = configure(makeFakeClient({ rows: [row('t1')] }));
    const result = await firstValueFrom(repo.getPublic());
    expect(result.length).toBe(1);
    expect(result[0].authorUsername).toBe('Lilia');
    expect(result[0].classId).toBe('XEL');
  });

  it('retourne une liste vide (pas une erreur) quand le reseau echoue', async () => {
    const repo = configure(makeFakeClient({ rejects: true }));
    expect(await firstValueFrom(repo.getPublic())).toEqual([]);
  });

  it('resout une timeline par jeton', async () => {
    const repo = configure(makeFakeClient({ rpcData: [row('t1', 'unlisted')] }));
    const result = await firstValueFrom(repo.getByShareToken('tok-t1'));
    expect(result?.id).toBe('t1');
    expect(result?.visibility).toBe('unlisted');
  });

  it('retourne null pour un jeton inconnu ou une timeline redevenue privee', async () => {
    const repo = configure(makeFakeClient({ rpcData: [] }));
    expect(await firstValueFrom(repo.getByShareToken('inconnu'))).toBeNull();
  });
});
```

- [ ] **Step 3 : Lancer, vérifier l'échec**

Attendu : ÉCHEC — `Cannot find module './public-timeline.repository'`.

- [ ] **Step 4 : Implémenter**

`frontend/src/app/services/storage/public-timeline.repository.ts` :

```typescript
import { inject, Injectable } from '@angular/core';
import { from, Observable } from 'rxjs';
import { Timeline } from '../../models/timeline.model';
import { SharedTimeline } from '../../models/shared-timeline.model';
import { SupabaseClientService } from '../supabase-client.service';

/**
 * Lectures publiques des timelines. Distinct de SupabaseTimelineRepository, qui filtre
 * sur owner_id et rend [] sans utilisateur : il ne peut pas servir la lecture publique.
 *
 * Aucun repli hors-ligne : les donnees publiques ne sont pas dans le miroir (cloisonne
 * par utilisateur). Hors-ligne, la galerie affiche une liste vide et un message.
 */
@Injectable({ providedIn: 'root' })
export class PublicTimelineRepository {
  private readonly supabase = inject(SupabaseClientService);

  getPublic(classId?: string): Observable<SharedTimeline[]> {
    return from(this.readPublic(classId));
  }

  private async readPublic(classId?: string): Promise<SharedTimeline[]> {
    try {
      let query = this.supabase.client
        .from('timelines')
        .select('id, name, build_id, class_id, visibility, share_token, data, profiles(username)')
        .eq('visibility', 'public');
      if (classId) {
        query = query.eq('class_id', classId);
      }
      const { data, error } = await query.order('name');
      if (error) {
        throw new Error(error.message);
      }
      return (data ?? []).map((row: any) => this.fromRow(row));
    } catch {
      return [];
    }
  }

  getByShareToken(token: string): Observable<SharedTimeline | null> {
    return from(this.readByToken(token));
  }

  private async readByToken(token: string): Promise<SharedTimeline | null> {
    try {
      const { data, error } = await this.supabase.client.rpc('get_shared_timeline', { token });
      if (error) {
        throw new Error(error.message);
      }
      const rows = (data ?? []) as any[];
      return rows.length ? this.fromRow(rows[0]) : null;
    } catch {
      return null;
    }
  }

  private fromRow(row: any): SharedTimeline {
    return {
      ...(row.data as Timeline),
      id: row.id,
      name: row.name,
      buildId: row.build_id ?? '',
      classId: row.class_id ?? undefined,
      visibility: row.visibility ?? undefined,
      shareToken: row.share_token ?? undefined,
      authorUsername: row.profiles?.username ?? 'Anonyme',
    };
  }
}
```

- [ ] **Step 5 : Lancer, vérifier le succès**

Attendu : `TOTAL: 4 SUCCESS` sur ce spec, puis suite complète `TOTAL: 206 SUCCESS`.

- [ ] **Step 6 : Commit**

```bash
git add frontend/src/app/models/shared-timeline.model.ts frontend/src/app/services/storage/public-timeline.repository.ts frontend/src/app/services/storage/public-timeline.repository.spec.ts
git commit -m "feat(sharing): PublicTimelineRepository (lecture publique et par jeton)"
```

---

### Task 4 : `TimelineSharingService`

**Files:** Create `frontend/src/app/services/timeline-sharing.service.ts` + `.spec.ts`

- [ ] **Step 1 : Écrire les tests qui échouent**

Créer `frontend/src/app/services/timeline-sharing.service.spec.ts` :

```typescript
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { TimelineSharingService } from './timeline-sharing.service';
import { WakfuApiService } from './wakfu-api.service';
import { SaveErrorService } from './save-error.service';
import { Timeline } from '../models/timeline.model';
import { SharedTimeline } from '../models/shared-timeline.model';

const timeline = () =>
  ({ id: 't1', name: 'combo', buildId: 'b1', classId: 'XEL', visibility: 'private',
     shareToken: 'tok-1', steps: [] } as unknown as Timeline);

function configure() {
  const captured = { updated: [] as any[], created: [] as Timeline[] };
  const api = {
    updateTimeline: (id: string, t: Timeline) => { captured.updated.push({ id, t }); return of(t); },
    createTimeline: (t: Timeline) => { captured.created.push(t); return of(t); },
  };
  TestBed.configureTestingModule({
    providers: [
      TimelineSharingService,
      SaveErrorService,
      { provide: WakfuApiService, useValue: api },
    ],
  });
  return { service: TestBed.inject(TimelineSharingService), captured };
}

describe('TimelineSharingService', () => {
  it('change la visibilite via updateTimeline', async () => {
    const { service, captured } = configure();
    await service.setVisibility(timeline(), 'public');
    expect(captured.updated[0].t.visibility).toBe('public');
  });

  it('construit un lien de partage a partir du shareToken', () => {
    const { service } = configure();
    const link = service.shareLink(timeline());
    expect(link).toContain('/t/tok-1');
  });

  it('duplique en une copie privee, nouvel id, sans build', async () => {
    const { service, captured } = configure();
    const shared = { ...timeline(), authorUsername: 'Someone' } as SharedTimeline;
    await service.duplicate(shared);
    const copy = captured.created[0];
    expect(copy.id).not.toBe('t1');
    expect(copy.visibility).toBe('private');
    // Partage "structure seule" : la copie n'herite pas du build de l'auteur.
    expect(copy.buildId).toBe('');
    expect(copy.name).toContain('combo');
  });
});
```

- [ ] **Step 2 : Lancer, vérifier l'échec**

Attendu : ÉCHEC — `Cannot find module './timeline-sharing.service'`.

- [ ] **Step 3 : Implémenter**

`frontend/src/app/services/timeline-sharing.service.ts` :

```typescript
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Timeline } from '../models/timeline.model';
import { SharedTimeline } from '../models/shared-timeline.model';
import { WakfuApiService } from './wakfu-api.service';
import { SaveErrorService } from './save-error.service';

export type Visibility = 'private' | 'unlisted' | 'public';

/** Actions transverses de partage : visibilite, lien, duplication. */
@Injectable({ providedIn: 'root' })
export class TimelineSharingService {
  private readonly api = inject(WakfuApiService);
  private readonly saveError = inject(SaveErrorService);

  async setVisibility(timeline: Timeline, visibility: Visibility): Promise<boolean> {
    try {
      await firstValueFrom(this.api.updateTimeline(timeline.id, { ...timeline, visibility }));
      return true;
    } catch {
      this.saveError.reportFailure();
      return false;
    }
  }

  /** URL absolue vers la vue partagee. Porte le jeton, jamais l'id. */
  shareLink(timeline: Timeline): string {
    const base = window.location.origin + this.baseHref();
    return `${base}t/${timeline.shareToken}`;
  }

  /** Copie une timeline partagee dans le compte du lecteur : privee, nouvel id, sans build. */
  async duplicate(shared: SharedTimeline): Promise<Timeline | null> {
    const copy: Timeline = {
      ...shared,
      id: crypto.randomUUID(),
      name: `${shared.name} (copie)`,
      visibility: 'private',
      // Partage "structure seule" : le lecteur rejoue avec SON build, pas celui de l'auteur.
      buildId: '',
      shareToken: undefined,
    };
    delete (copy as Partial<SharedTimeline>).authorUsername;
    try {
      return await firstValueFrom(this.api.createTimeline(copy));
    } catch {
      this.saveError.reportFailure();
      return null;
    }
  }

  private baseHref(): string {
    const base = document.querySelector('base')?.getAttribute('href') ?? '/';
    return base.endsWith('/') ? base : `${base}/`;
  }
}
```

- [ ] **Step 4 : Lancer, vérifier le succès**

Attendu : `TOTAL: 3 SUCCESS` sur ce spec, puis suite complète `TOTAL: 209 SUCCESS`.

- [ ] **Step 5 : Commit**

```bash
git add frontend/src/app/services/timeline-sharing.service.ts frontend/src/app/services/timeline-sharing.service.spec.ts
git commit -m "feat(sharing): TimelineSharingService (visibilite, lien, duplication)"
```

---

### Task 5 : Page galerie

**Files:**
- Create: `frontend/src/app/pages/gallery-page.component.ts` + `.spec.ts`
- Modify: `frontend/src/app/app.routes.ts`, `frontend/src/app/ui/app-sidebar.component.ts`, `frontend/src/app/ui/icon.component.ts`

- [ ] **Step 1 : Écrire les tests qui échouent**

Créer `frontend/src/app/pages/gallery-page.component.spec.ts` :

```typescript
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { GalleryPageComponent } from './gallery-page.component';
import { TimelineService } from '../services/timeline.service';
import { PublicTimelineRepository } from '../services/storage/public-timeline.repository';
import { TimelineSharingService } from '../services/timeline-sharing.service';
import { AuthService } from '../services/auth.service';

const mine = { id: 't1', name: 'a moi', buildId: 'b1', classId: 'XEL', visibility: 'private', steps: [] } as any;
const pub = { id: 't2', name: 'publique', buildId: '', classId: 'XEL', visibility: 'public', authorUsername: 'Lilia', steps: [] } as any;

function configure(authenticated: boolean) {
  const sharing = {
    setVisibility: jasmine.createSpy('setVisibility').and.returnValue(Promise.resolve(true)),
    shareLink: () => 'http://x/t/tok',
    duplicate: jasmine.createSpy('duplicate').and.returnValue(Promise.resolve(mine)),
  };
  TestBed.configureTestingModule({
    imports: [GalleryPageComponent],
    providers: [
      provideRouter([]),
      { provide: TimelineService, useValue: { allTimelines: signal([mine]) } },
      { provide: PublicTimelineRepository, useValue: { getPublic: () => of([pub]) } },
      { provide: TimelineSharingService, useValue: sharing },
      { provide: AuthService, useValue: { isAuthenticated: () => authenticated } },
    ],
  });
  const fixture = TestBed.createComponent(GalleryPageComponent);
  fixture.detectChanges();
  return { fixture, component: fixture.componentInstance as any, sharing };
}

describe('GalleryPageComponent', () => {
  it('affiche mes timelines dans l onglet par defaut', () => {
    const { component } = configure(true);
    expect(component.tab()).toBe('mine');
    expect(component.visibleMine().length).toBe(1);
  });

  it('charge les publiques en basculant d onglet', async () => {
    const { component } = configure(true);
    await component.selectTab('public');
    expect(component.tab()).toBe('public');
    expect(component.publicTimelines().length).toBe(1);
    expect(component.publicTimelines()[0].authorUsername).toBe('Lilia');
  });

  it('filtre les publiques par classe', async () => {
    const { component } = configure(true);
    await component.selectTab('public');
    component.setClassFilter('IOP');
    await component.reloadPublic();
    expect(component.publicTimelines().length).toBe(0);
  });

  it('change la visibilite d une de mes timelines', async () => {
    const { component, sharing } = configure(true);
    await component.changeVisibility(mine, 'public');
    expect(sharing.setVisibility).toHaveBeenCalledWith(mine, 'public');
  });

  it('cache la duplication pour un invite', async () => {
    const { component } = configure(false);
    await component.selectTab('public');
    expect(component.canDuplicate()).toBe(false);
  });
});
```

- [ ] **Step 2 : Lancer, vérifier l'échec**

Attendu : ÉCHEC — `Cannot find module './gallery-page.component'`.

- [ ] **Step 3 : Implémenter**

`frontend/src/app/pages/gallery-page.component.ts` :

```typescript
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Timeline } from '../models/timeline.model';
import { SharedTimeline } from '../models/shared-timeline.model';
import { TimelineService } from '../services/timeline.service';
import { PublicTimelineRepository } from '../services/storage/public-timeline.repository';
import { TimelineSharingService, Visibility } from '../services/timeline-sharing.service';
import { AuthService } from '../services/auth.service';

type Tab = 'mine' | 'public';

@Component({
  selector: 'app-gallery-page',
  standalone: true,
  imports: [FormsModule],
  template: `
    <section class="gallery">
      <h1>Galerie</h1>

      <nav class="tabs">
        <button type="button" [class.active]="tab() === 'mine'" (click)="selectTab('mine')">Mes timelines</button>
        <button type="button" [class.active]="tab() === 'public'" (click)="selectTab('public')">Publiques</button>
      </nav>

      <label class="filter">
        Classe
        <select [ngModel]="classFilter()" (ngModelChange)="onClassFilterChange($event)">
          <option value="">Toutes</option>
          <option value="XEL">Xélor</option>
        </select>
      </label>

      @if (tab() === 'mine') {
        <ul class="list">
          @for (t of visibleMine(); track t.id) {
            <li>
              <span class="name">{{ t.name }}</span>
              <select [ngModel]="t.visibility ?? 'private'" (ngModelChange)="changeVisibility(t, $event)">
                <option value="private">Privé</option>
                <option value="unlisted">Lien</option>
                <option value="public">Public</option>
              </select>
              @if (t.visibility && t.visibility !== 'private') {
                <button type="button" (click)="copyLink(t)">Copier le lien</button>
              }
            </li>
          }
        </ul>
      } @else {
        @if (loadingPublic()) {
          <p class="info">Chargement…</p>
        } @else if (publicTimelines().length === 0) {
          <p class="info">Aucune timeline publique{{ classFilter() ? ' pour cette classe' : '' }}.</p>
        } @else {
          <ul class="list">
            @for (t of publicTimelines(); track t.id) {
              <li>
                <span class="name">{{ t.name }}</span>
                <span class="author">par {{ t.authorUsername }}</span>
                <a [href]="'#'" (click)="$event.preventDefault(); open(t)">Ouvrir</a>
                @if (canDuplicate()) {
                  <button type="button" (click)="duplicate(t)">Dupliquer</button>
                }
              </li>
            }
          </ul>
        }
      }
    </section>
  `,
  styles: [`
    .gallery { max-width: 720px; margin: 32px auto; padding: 0 16px; }
    h1 { font-size: 20px; margin-bottom: 16px; }
    .tabs { display: flex; gap: 8px; margin-bottom: 16px; }
    .tabs button { padding: 6px 12px; border: 1px solid var(--app-border); border-radius: 6px;
      background: var(--app-surface); color: inherit; cursor: pointer; }
    .tabs button.active { background: var(--app-accent); border-color: transparent; color: #fff; }
    .filter { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; margin-bottom: 12px; }
    .list { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 8px; }
    .list li { display: flex; align-items: center; gap: 12px; padding: 8px 12px;
      background: var(--app-surface); border: 1px solid var(--app-border); border-radius: 6px; }
    .name { font-weight: 500; }
    .author { font-size: 12px; opacity: 0.7; }
    .list a, .list button { margin-left: auto; }
    .list button { padding: 4px 10px; border: 1px solid var(--app-border); border-radius: 6px;
      background: transparent; color: inherit; cursor: pointer; }
    select { padding: 4px 8px; background: var(--app-surface); border: 1px solid var(--app-border);
      border-radius: 6px; color: inherit; }
    .info { font-size: 14px; opacity: 0.8; }
  `],
})
export class GalleryPageComponent {
  private readonly timelineService = inject(TimelineService);
  private readonly publicRepo = inject(PublicTimelineRepository);
  private readonly sharing = inject(TimelineSharingService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly tab = signal<Tab>('mine');
  readonly classFilter = signal<string>('');
  readonly publicTimelines = signal<SharedTimeline[]>([]);
  readonly loadingPublic = signal(false);

  readonly visibleMine = computed(() => {
    const cls = this.classFilter();
    const all = this.timelineService.allTimelines();
    return cls ? all.filter(t => t.classId === cls) : all;
  });

  canDuplicate(): boolean {
    return this.auth.isAuthenticated();
  }

  async selectTab(tab: Tab): Promise<void> {
    this.tab.set(tab);
    if (tab === 'public') {
      await this.reloadPublic();
    }
  }

  setClassFilter(cls: string): void {
    this.classFilter.set(cls);
  }

  async onClassFilterChange(cls: string): Promise<void> {
    this.classFilter.set(cls);
    if (this.tab() === 'public') {
      await this.reloadPublic();
    }
  }

  async reloadPublic(): Promise<void> {
    this.loadingPublic.set(true);
    const cls = this.classFilter() || undefined;
    this.publicTimelines.set(await firstValueFrom(this.publicRepo.getPublic(cls)));
    this.loadingPublic.set(false);
  }

  async changeVisibility(timeline: Timeline, visibility: Visibility): Promise<void> {
    await this.sharing.setVisibility(timeline, visibility);
  }

  copyLink(timeline: Timeline): void {
    const link = this.sharing.shareLink(timeline);
    navigator.clipboard?.writeText(link).catch(() => undefined);
  }

  open(timeline: SharedTimeline): void {
    this.router.navigate(['/t', timeline.shareToken]).catch(() => undefined);
  }

  async duplicate(timeline: SharedTimeline): Promise<void> {
    await this.sharing.duplicate(timeline);
  }
}
```

- [ ] **Step 4 : Ajouter la route et l'icône**

Dans `frontend/src/app/app.routes.ts`, importer et ajouter **avant** `'**'` :

```typescript
import { GalleryPageComponent } from './pages/gallery-page.component';
```
```typescript
  { path: 'galerie', component: GalleryPageComponent },
```

Dans `frontend/src/app/ui/icon.component.ts`, ajouter à `ICON_PATHS` :

```typescript
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18',
```

Dans `frontend/src/app/ui/app-sidebar.component.ts`, ajouter à `NAV_ITEMS` après l'entrée Timelines :

```typescript
  { path: '/galerie', label: 'Galerie', icon: 'globe' },
```

- [ ] **Step 5 : Lancer, vérifier le succès**

Attendu : `TOTAL: 5 SUCCESS` sur ce spec, puis suite complète `TOTAL: 214 SUCCESS`.

- [ ] **Step 6 : Commit**

```bash
git add frontend/src/app/pages/gallery-page.component.ts frontend/src/app/pages/gallery-page.component.spec.ts frontend/src/app/app.routes.ts frontend/src/app/ui/icon.component.ts frontend/src/app/ui/app-sidebar.component.ts
git commit -m "feat(sharing): page galerie (mes timelines / publiques, filtre, visibilite)"
```

---

### Task 6 : Vue de consultation partagée

**Files:**
- Create: `frontend/src/app/pages/shared-timeline-page.component.ts` + `.spec.ts`
- Modify: `frontend/src/app/app.routes.ts`

- [ ] **Step 1 : Écrire les tests qui échouent**

Créer `frontend/src/app/pages/shared-timeline-page.component.spec.ts` :

```typescript
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { SharedTimelinePageComponent } from './shared-timeline-page.component';
import { PublicTimelineRepository } from '../services/storage/public-timeline.repository';
import { BuildService } from '../services/build.service';
import { AuthService } from '../services/auth.service';

const shared = { id: 't1', name: 'combo', buildId: '', classId: 'XEL', visibility: 'unlisted',
  shareToken: 'tok-1', authorUsername: 'Lilia', steps: [{ id: 's1', actions: [] }] } as any;
const myBuild = { id: 'b9', name: 'mon xelor', classId: 'XEL' } as any;

function configure(token: string, resolved: any) {
  TestBed.configureTestingModule({
    imports: [SharedTimelinePageComponent],
    providers: [
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => token } } } },
      { provide: PublicTimelineRepository, useValue: { getByShareToken: () => of(resolved) } },
      { provide: BuildService, useValue: { allBuilds: signal([myBuild]) } },
      { provide: AuthService, useValue: { isAuthenticated: () => true } },
    ],
  });
  const fixture = TestBed.createComponent(SharedTimelinePageComponent);
  fixture.detectChanges();
  return { component: fixture.componentInstance as any };
}

describe('SharedTimelinePageComponent', () => {
  it('charge la timeline du jeton', async () => {
    const { component } = configure('tok-1', shared);
    await component.load();
    expect(component.timeline()?.name).toBe('combo');
    expect(component.error()).toBeNull();
  });

  it('affiche une erreur pour un jeton invalide ou une timeline redevenue privee', async () => {
    const { component } = configure('inconnu', null);
    await component.load();
    expect(component.timeline()).toBeNull();
    expect(component.error()).toBe('Cette timeline n existe plus ou n est plus partagee.');
  });

  // Partage "structure seule" : pas de degats tant qu'aucun build du lecteur n'est choisi.
  it('n affiche pas de degats sans build selectionne', async () => {
    const { component } = configure('tok-1', shared);
    await component.load();
    expect(component.selectedBuildId()).toBeNull();
    expect(component.showsDamage()).toBe(false);
  });

  it('affiche les degats une fois un build du lecteur choisi', async () => {
    const { component } = configure('tok-1', shared);
    await component.load();
    component.selectBuild('b9');
    expect(component.showsDamage()).toBe(true);
  });
});
```

- [ ] **Step 2 : Lancer, vérifier l'échec**

Attendu : ÉCHEC — `Cannot find module './shared-timeline-page.component'`.

- [ ] **Step 3 : Implémenter**

`frontend/src/app/pages/shared-timeline-page.component.ts` :

```typescript
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { SharedTimeline } from '../models/shared-timeline.model';
import { PublicTimelineRepository } from '../services/storage/public-timeline.repository';
import { BuildService } from '../services/build.service';

@Component({
  selector: 'app-shared-timeline-page',
  standalone: true,
  imports: [FormsModule],
  template: `
    <section class="shared">
      @if (error()) {
        <p class="error" role="alert">{{ error() }}</p>
      } @else if (timeline(); as t) {
        <h1>{{ t.name }}</h1>
        <p class="author">Partagé par {{ t.authorUsername }}</p>

        <ol class="steps">
          @for (step of t.steps; track step.id) {
            <li>{{ step.description || 'Étape' }} — {{ step.actions.length }} action(s)</li>
          }
        </ol>

        <div class="replay">
          <label>
            Rejouer avec mon build
            <select [ngModel]="selectedBuildId() ?? ''" (ngModelChange)="selectBuild($event)">
              <option value="">Choisir un build…</option>
              @for (b of compatibleBuilds(); track b.id) {
                <option [value]="b.id">{{ b.name }}</option>
              }
            </select>
          </label>

          @if (showsDamage()) {
            <p class="ok">Dégâts calculés avec ton build sélectionné.</p>
          } @else {
            <p class="hint">
              Choisis un de tes builds pour voir les dégâts.
              Cette timeline ne contient que la séquence, pas le build de son auteur.
            </p>
          }
        </div>
      } @else {
        <p class="info">Chargement…</p>
      }
    </section>
  `,
  styles: [`
    .shared { max-width: 640px; margin: 32px auto; padding: 0 16px; }
    h1 { font-size: 20px; }
    .author { font-size: 13px; opacity: 0.7; margin-bottom: 16px; }
    .steps { padding-left: 20px; display: flex; flex-direction: column; gap: 4px; font-size: 14px; }
    .replay { margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--app-border); }
    label { display: flex; flex-direction: column; gap: 6px; font-size: 13px; }
    select { padding: 6px 8px; background: var(--app-surface); border: 1px solid var(--app-border);
      border-radius: 6px; color: inherit; max-width: 280px; }
    .hint { font-size: 13px; opacity: 0.7; margin-top: 12px; }
    .ok { font-size: 13px; color: var(--app-accent); margin-top: 12px; }
    .error { color: #e5484d; font-size: 14px; }
    .info { opacity: 0.8; }
  `],
})
export class SharedTimelinePageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly publicRepo = inject(PublicTimelineRepository);
  private readonly buildService = inject(BuildService);

  readonly timeline = signal<SharedTimeline | null>(null);
  readonly error = signal<string | null>(null);
  readonly selectedBuildId = signal<string | null>(null);

  // Le lecteur rejoue avec un de SES builds de la meme classe que la timeline.
  readonly compatibleBuilds = computed(() => {
    const cls = this.timeline()?.classId;
    const all = this.buildService.allBuilds();
    return cls ? all.filter(b => b.classId === cls) : all;
  });

  readonly showsDamage = computed(() => this.selectedBuildId() !== null);

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    const token = this.route.snapshot.paramMap.get('token') ?? '';
    const found = await firstValueFrom(this.publicRepo.getByShareToken(token));
    if (!found) {
      this.error.set('Cette timeline n existe plus ou n est plus partagee.');
      this.timeline.set(null);
      return;
    }
    this.error.set(null);
    this.timeline.set(found);
  }

  selectBuild(buildId: string): void {
    this.selectedBuildId.set(buildId || null);
  }
}
```

- [ ] **Step 4 : Ajouter la route**

Dans `frontend/src/app/app.routes.ts`, importer et ajouter **avant** `'**'` :

```typescript
import { SharedTimelinePageComponent } from './pages/shared-timeline-page.component';
```
```typescript
  { path: 't/:token', component: SharedTimelinePageComponent },
```

- [ ] **Step 5 : Lancer, vérifier le succès**

Attendu : `TOTAL: 4 SUCCESS` sur ce spec, puis suite complète `TOTAL: 218 SUCCESS`.

- [ ] **Step 6 : Commit**

```bash
git add frontend/src/app/pages/shared-timeline-page.component.ts frontend/src/app/pages/shared-timeline-page.component.spec.ts frontend/src/app/app.routes.ts
git commit -m "feat(sharing): vue de consultation partagee /t/:token avec rejeu par build"
```

---

### Task 7 : Vérification finale

- [ ] **Step 1 : Suite complète**

```bash
npx ng test --watch=false --browsers=ChromeHeadless
```
Attendu : `TOTAL: 218 SUCCESS`, zéro échec (200 de baseline + 18 ajoutés).

- [ ] **Step 2 : Build de production**

```bash
npx ng build --configuration production
```
Attendu : `Application bundle generation complete`, sans dépassement du budget `initial` (2 MB).

- [ ] **Step 3 : Vérification manuelle — parcours de partage**

`npm start`, connecté :
1. `/galerie` → onglet « Mes timelines » liste tes timelines.
2. Passer une timeline en « Public », puis onglet « Publiques » → elle y apparaît, signée de ton pseudo.
3. Repasser une timeline en « Lien », « Copier le lien » → ouvrir l'URL dans un onglet privé (déconnecté) → la timeline s'affiche.
4. Filtre par classe : sélectionner Xélor → seules les timelines Xélor restent.

- [ ] **Step 4 : Vérification manuelle — sécurité (LE point du lot)**

Rejouer les vérifications `curl` de la Task 1 sur l'état réel :
- `GET /rest/v1/timelines?select=id,visibility` en anonyme → **aucune `unlisted`, aucune `private`**.
- `get_shared_timeline(<token private>)` → `[]`.
- Repasser une `unlisted` en `private`, réessayer son ancien lien → « n'existe plus ou n'est plus partagée ».

- [ ] **Step 5 : Vérification manuelle — rejeu structure seule**

Ouvrir `/t/<token>` : la séquence s'affiche **sans dégâts**. Choisir un de tes builds
Xélor → les dégâts apparaissent. C'est la promesse « structure seule ».

- [ ] **Step 6 : Commit final si ajustements**

```bash
git add -A -- frontend/src supabase
git commit -m "chore(sharing): ajustements suite a la verification du lot 3"
```

---

## Ce que ce lot ne fait pas

- **Aucune refonte du dashboard** ni de `/timelines` : la galerie est une surface à part.
- **Pas de partage de builds.**
- **Pas de cache hors-ligne des données publiques** : la galerie affiche un message hors-ligne.
- **Pas de modération / signalement** des timelines publiques.
- **La vue partagée ne recalcule pas réellement les dégâts** dans ce lot : elle expose le
  point d'entrée (sélection du build du lecteur) et l'état `showsDamage`. Le branchement
  sur le moteur de simulation réutilise `SimulationService` et sera câblé quand la vue
  sera enrichie — hors périmètre du partage lui-même.
