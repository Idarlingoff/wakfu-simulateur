# Comptes utilisateurs — Lot 1 : Auth — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre de créer un compte, confirmer son email, se connecter et se déconnecter, sans changer quoi que ce soit au stockage des builds et timelines (qui restent en `localStorage`).

**Architecture:** Supabase (auth + Postgres) attaqué depuis le frontend Angular statique. `SupabaseClientService` possède l'unique client ; `AuthService` est le seul point de contact de l'application avec l'auth et expose son état en signals. Une table `profiles` porte le pseudo, alimentée par un trigger. Invariant central : **une panne d'auth ne doit jamais casser le simulateur** — on retombe en mode invité.

**Tech Stack:** Angular 20.3 (standalone, signals), `@supabase/supabase-js@^2.110.7`, formulaires template-driven (`FormsModule` + `ngModel`), tests Karma/Jasmine.

**Spec de référence :** `docs/superpowers/specs/2026-07-16-comptes-lot1-auth-design.md`

---

## Prérequis d'exécution

`ng test` ne fonctionne pas nativement sur cette machine (aucun Chrome installé, Arc ne
supporte pas le headless). **Avant toute tâche**, dans `frontend/` :

```bash
npx --yes puppeteer@latest browsers install chrome-headless-shell
export CHROME_BIN="$HOME/.cache/puppeteer/chrome-headless-shell/mac_arm-150.0.7871.24/chrome-headless-shell-mac-arm64/chrome-headless-shell"
```

Si le chemin n'existe pas, relancer l'install et lire la version affichée en sortie.
Toutes les commandes `npx ng ...` de ce plan s'exécutent depuis `frontend/`.

## Écarts assumés par rapport au spec

- **Formulaires template-driven** au lieu de Reactive Forms : le codebase n'utilise que
  `FormsModule` + `[(ngModel)]` (cf. `build-editor.component.ts`, `player-form.component.ts`).
- **Un seul `environment.ts`**, sans `fileReplacements` : il n'existe qu'un projet Supabase
  et l'`anon key` est publique par design. À réintroduire le jour où un environnement de
  staging existe (YAGNI).
- **Pas de signal `user`** sur `AuthService`, contrairement au spec : aucun consommateur
  n'en a besoin dans ce lot (la sidebar affiche `profile.username`). À ajouter le jour où
  un appelant réel le demande.

## Structure des fichiers

| Fichier | Responsabilité |
|---|---|
| `src/environments/environment.ts` (~~créer~~ **généré, non versionné** — cf. `51a9bc0`) | URL + anon key Supabase. Généré par `scripts/generate-env.js` depuis `frontend/.env`. |
| `frontend/scripts/generate-env.js` (créer — ajouté après coup) | Génère `environment.ts` depuis `.env`. Échoue si une clé `service_role` est présente. |
| `frontend/.env.example` (créer — ajouté après coup) | Modèle versionné de `.env`. |
| `src/app/services/supabase-client.service.ts` (créer) | Possède l'unique instance du client. Rien d'autre. |
| `src/app/models/profile.model.ts` (créer) | Type `Profile` (id, username). |
| `src/app/services/auth.service.ts` (créer) | État d'auth en signals + actions. Seul point de contact avec l'auth. |
| `src/app/services/auth-errors.ts` (créer) | Traduction des erreurs Supabase en messages français. Isolé pour être testable seul. |
| `src/app/pages/login-page.component.ts` (créer) | Formulaire de connexion. |
| `src/app/pages/signup-page.component.ts` (créer) | Formulaire d'inscription (+ pseudo). |
| `src/app/pages/password-reset-page.component.ts` (créer) | Demande de mail de réinitialisation. |
| `src/app/app.routes.ts` (modifier) | 3 routes : `/connexion`, `/inscription`, `/mot-de-passe-oublie`. |
| `src/app/ui/app-sidebar.component.ts` (modifier) | Pied de nav : état de connexion. |
| `src/app/ui/icon.component.ts` (modifier) | Ajouter les icônes `log-in` / `log-out`. |
| `supabase/migrations/0001_profiles.sql` (créer) | Table `profiles` + trigger + RLS. |

---

### Task 1 : Installer Supabase et créer le client

**Files:**
- Create: `frontend/src/environments/environment.ts`
- Create: `frontend/src/app/services/supabase-client.service.ts`
- Modify: `frontend/package.json` (via npm install)

- [ ] **Step 1 : Installer la dépendance**

Depuis `frontend/` :

```bash
npm install @supabase/supabase-js@^2.110.7
```

Attendu : `package.json` contient `"@supabase/supabase-js": "^2.110.7"` dans `dependencies`.

- [ ] **Step 2 : Créer le fichier d'environnement**

Créer `frontend/src/environments/environment.ts`.

Récupérer les valeurs dans le dashboard Supabase → Project Settings → API.
L'`anon key` est **publique par design** : elle est protégée par les politiques RLS,
pas par le secret. La committer est le fonctionnement nominal de Supabase.

```typescript
/**
 * Configuration Supabase.
 *
 * L'anon key est publique par design : la securite repose entierement sur les
 * politiques RLS cote Postgres, jamais sur le secret de cette cle.
 */
export const environment = {
  supabaseUrl: 'https://REMPLACER.supabase.co',
  supabaseAnonKey: 'REMPLACER_PAR_ANON_KEY',
};
```

> Remplacer les deux valeurs par celles du projet avant de lancer l'application.
> Ce sont les seules valeurs à saisir manuellement de tout le plan.

- [ ] **Step 3 : Écrire le test du client**

Créer `frontend/src/app/services/supabase-client.service.spec.ts` :

```typescript
import { TestBed } from '@angular/core/testing';
import { SupabaseClientService } from './supabase-client.service';

describe('SupabaseClientService', () => {
  let service: SupabaseClientService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [SupabaseClientService] });
    service = TestBed.inject(SupabaseClientService);
  });

  it('expose un client avec un module auth', () => {
    expect(service.client).toBeTruthy();
    expect(service.client.auth).toBeTruthy();
  });

  it('retourne toujours la meme instance', () => {
    expect(service.client).toBe(service.client);
  });
});
```

- [ ] **Step 4 : Lancer le test, vérifier qu'il échoue**

```bash
npx ng test --include='**/supabase-client.service.spec.ts' --watch=false --browsers=ChromeHeadless
```

Attendu : ÉCHEC — `Cannot find module './supabase-client.service'`.

- [ ] **Step 5 : Implémenter le service**

Créer `frontend/src/app/services/supabase-client.service.ts` :

```typescript
import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

/**
 * Possede l'unique instance du client Supabase.
 *
 * Seul fichier de l'application qui connait l'URL et la cle du projet : tout le
 * reste passe par AuthService.
 */
@Injectable({ providedIn: 'root' })
export class SupabaseClientService {
  readonly client: SupabaseClient = createClient(
    environment.supabaseUrl,
    environment.supabaseAnonKey,
    { auth: { persistSession: true, autoRefreshToken: true } }
  );
}
```

- [ ] **Step 6 : Lancer le test, vérifier qu'il passe**

```bash
npx ng test --include='**/supabase-client.service.spec.ts' --watch=false --browsers=ChromeHeadless
```

Attendu : `TOTAL: 2 SUCCESS`.

- [ ] **Step 7 : Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/environments/environment.ts frontend/src/app/services/supabase-client.service.ts frontend/src/app/services/supabase-client.service.spec.ts
git commit -m "feat(auth): ajoute le client Supabase et la config d'environnement"
```

---

### Task 2 : Migration SQL — table `profiles`, trigger et RLS

**Files:**
- Create: `supabase/migrations/0001_profiles.sql`

Cette tâche n'est pas couverte par des tests unitaires : elle s'exécute sur
l'infrastructure Supabase et se vérifie manuellement (step 3).

- [ ] **Step 1 : Écrire la migration**

Créer `supabase/migrations/0001_profiles.sql` :

> **Corrigé en revue sécurité (commit `90644cb`)** : `username` est en `citext` et non en
> `text`. En `text`, « Lilia » et « lilia » coexistent — usurpation triviale d'un nom
> d'auteur public — et le `.eq('username', X)` de la Task 5 laisserait passer les variantes
> de casse. Le trigger lève aussi une exception lisible quand le pseudo est absent.

```sql
-- Table applicative portant le pseudo : auth.users (gere par Supabase) ne le stocke pas.
-- Ce pseudo signera les timelines publiques au lot 3.

-- citext : l'unicite du pseudo DOIT etre insensible a la casse.
create extension if not exists citext;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username citext not null unique,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Lecture publique : necessaire pour afficher l'auteur d'une timeline publique (lot 3),
-- et pour verifier l'unicite d'un pseudo avant inscription.
create policy "profiles_select_public"
  on public.profiles for select
  using (true);

-- Ecriture reservee au proprietaire.
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Cree la ligne profiles a l'inscription, en lisant le pseudo passe en metadonnees.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, new.raw_user_meta_data ->> 'username');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

- [ ] **Step 2 : Appliquer la migration**

Dans le dashboard Supabase → SQL Editor : coller le contenu du fichier et exécuter.

Attendu : `Success. No rows returned`.

- [ ] **Step 3 : Vérifier manuellement le trigger**

Dashboard Supabase → Authentication → Users → « Add user » → renseigner un email, un mot
de passe, et dans « User Metadata » : `{"username": "test_pseudo"}`.

Puis Table Editor → `profiles`.

Attendu : une ligne existe, avec `username = test_pseudo` et le même `id` que l'utilisateur.
Supprimer ensuite l'utilisateur de test (la ligne `profiles` disparaît par cascade — ce qui
vérifie aussi le `on delete cascade`).

- [ ] **Step 4 : Commit**

```bash
git add supabase/migrations/0001_profiles.sql
git commit -m "feat(auth): table profiles avec trigger d'inscription et RLS"
```

---

### Task 3 : Traduction des erreurs Supabase

**Files:**
- Create: `frontend/src/app/services/auth-errors.ts`
- Test: `frontend/src/app/services/auth-errors.spec.ts`

Isolé dans son propre fichier : c'est de la logique pure, testable sans TestBed.

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `frontend/src/app/services/auth-errors.spec.ts` :

```typescript
import { toFrenchAuthMessage } from './auth-errors';

describe('toFrenchAuthMessage', () => {
  it('traduit des identifiants invalides', () => {
    expect(toFrenchAuthMessage({ message: 'Invalid login credentials' }))
      .toBe('Email ou mot de passe incorrect.');
  });

  it('traduit un email deja utilise', () => {
    expect(toFrenchAuthMessage({ message: 'User already registered' }))
      .toBe('Un compte existe deja avec cet email.');
  });

  it('traduit un email non confirme', () => {
    expect(toFrenchAuthMessage({ message: 'Email not confirmed' }))
      .toBe('Confirme ton email avant de te connecter.');
  });

  it('traduit un mot de passe trop court', () => {
    expect(toFrenchAuthMessage({ message: 'Password should be at least 8 characters' }))
      .toBe('Le mot de passe doit faire au moins 8 caracteres.');
  });

  it('traduit une panne reseau en invitant a continuer sans compte', () => {
    expect(toFrenchAuthMessage({ message: 'Failed to fetch' }))
      .toBe('Service indisponible, tu peux continuer sans compte.');
  });

  it('ne laisse jamais fuiter un message brut inconnu', () => {
    expect(toFrenchAuthMessage({ message: 'some internal postgres detail' }))
      .toBe('Une erreur est survenue, reessaie.');
  });

  it('gere une erreur nulle', () => {
    expect(toFrenchAuthMessage(null)).toBe('Une erreur est survenue, reessaie.');
  });
});
```

- [ ] **Step 2 : Lancer le test, vérifier qu'il échoue**

```bash
npx ng test --include='**/auth-errors.spec.ts' --watch=false --browsers=ChromeHeadless
```

Attendu : ÉCHEC — `Cannot find module './auth-errors'`.

- [ ] **Step 3 : Implémenter**

Créer `frontend/src/app/services/auth-errors.ts` :

```typescript
/**
 * Traduit une erreur Supabase en message francais affichable.
 *
 * Aucun message brut ne doit atteindre l'utilisateur : tout ce qui n'est pas
 * explicitement reconnu retombe sur un message generique.
 */
export interface AuthErrorLike {
  message?: string;
}

const FALLBACK = 'Une erreur est survenue, reessaie.';

const RULES: ReadonlyArray<{ match: RegExp; message: string }> = [
  { match: /invalid login credentials/i, message: 'Email ou mot de passe incorrect.' },
  { match: /already registered|already exists/i, message: 'Un compte existe deja avec cet email.' },
  { match: /email not confirmed/i, message: 'Confirme ton email avant de te connecter.' },
  { match: /password should be at least/i, message: 'Le mot de passe doit faire au moins 8 caracteres.' },
  { match: /failed to fetch|network|fetch error/i, message: 'Service indisponible, tu peux continuer sans compte.' },
  { match: /profiles_username_key|duplicate key/i, message: 'Ce pseudo est deja utilise.' },
];

export function toFrenchAuthMessage(error: AuthErrorLike | null | undefined): string {
  const raw = error?.message;
  if (!raw) {
    return FALLBACK;
  }
  return RULES.find(rule => rule.match.test(raw))?.message ?? FALLBACK;
}
```

- [ ] **Step 4 : Lancer le test, vérifier qu'il passe**

```bash
npx ng test --include='**/auth-errors.spec.ts' --watch=false --browsers=ChromeHeadless
```

Attendu : `TOTAL: 7 SUCCESS`.

- [ ] **Step 5 : Commit**

```bash
git add frontend/src/app/services/auth-errors.ts frontend/src/app/services/auth-errors.spec.ts
git commit -m "feat(auth): traduction des erreurs Supabase en messages francais"
```

---

### Task 4 : `AuthService` — état de session et repli invité

**Files:**
- Create: `frontend/src/app/models/profile.model.ts`
- Create: `frontend/src/app/services/auth.service.ts`
- Test: `frontend/src/app/services/auth.service.spec.ts`

C'est la tâche qui porte l'invariant central du lot : **si Supabase échoue, on retombe en
invité, jamais bloqué en `loading`**.

> **Bug trouvé en revue, corrigé par `2d3f04b`.** Le code ci-dessous est fautif :
> `onAuthStateChange` rejoue TOUJOURS un événement `INITIAL_SESSION`
> (`@supabase/auth-js`, `_emitInitialSession`), donc `applySession` tournait deux fois à
> chaque démarrage (requête `profiles` en double), et un `applySession` obsolète pouvait
> ré-authentifier après un `signOut()`. Le test-double ci-dessous masquait le bug en
> n'invoquant jamais ses listeners. Correctif : ignorer `INITIAL_SESSION` dans le listener
> + compteur de génération invalidant les `applySession` en vol, avec 4 tests de
> non-régression. **Leçon : un test-double doit imiter le vrai client, sinon il ne teste
> que lui-même.**

- [ ] **Step 1 : Créer le modèle**

Créer `frontend/src/app/models/profile.model.ts` :

```typescript
/** Profil applicatif : porte le pseudo, que auth.users ne stocke pas. */
export interface Profile {
  id: string;
  username: string;
}
```

- [ ] **Step 2 : Écrire les tests qui échouent**

Créer `frontend/src/app/services/auth.service.spec.ts` :

```typescript
import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';
import { SupabaseClientService } from './supabase-client.service';

/** Construit un faux client Supabase, surchargeable par test. */
function makeFakeClient(options: {
  session?: any;
  getSessionRejects?: boolean;
  profileRow?: { id: string; username: string } | null;
} = {}) {
  const listeners: Array<(event: string, session: any) => void> = [];
  return {
    listeners,
    auth: {
      getSession: () =>
        options.getSessionRejects
          ? Promise.reject(new Error('Failed to fetch'))
          : Promise.resolve({ data: { session: options.session ?? null }, error: null }),
      onAuthStateChange: (cb: (event: string, session: any) => void) => {
        listeners.push(cb);
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
      signOut: () => Promise.resolve({ error: null }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: options.profileRow ?? null, error: null }),
        }),
      }),
    }),
  };
}

function configure(fake: any): AuthService {
  TestBed.configureTestingModule({
    providers: [AuthService, { provide: SupabaseClientService, useValue: { client: fake } }],
  });
  return TestBed.inject(AuthService);
}

describe('AuthService', () => {
  it('passe en anonymous quand il n y a pas de session', async () => {
    const service = configure(makeFakeClient({ session: null }));
    await service.ready();
    expect(service.status()).toBe('anonymous');
    expect(service.profile()).toBeNull();
    expect(service.isAuthenticated()).toBe(false);
  });

  it('passe en authenticated et charge le profil quand une session existe', async () => {
    const fake = makeFakeClient({
      session: { user: { id: 'u1', email: 'a@b.c' } },
      profileRow: { id: 'u1', username: 'Lilia' },
    });
    const service = configure(fake);
    await service.ready();
    expect(service.status()).toBe('authenticated');
    expect(service.profile()?.username).toBe('Lilia');
    expect(service.isAuthenticated()).toBe(true);
  });

  // L'invariant central du lot : une panne d'auth ne doit jamais casser le simulateur.
  it('retombe en anonymous si Supabase est injoignable, sans rester bloque en loading', async () => {
    const service = configure(makeFakeClient({ getSessionRejects: true }));
    await service.ready();
    expect(service.status()).toBe('anonymous');
    expect(service.profile()).toBeNull();
  });

  it('reagit a une deconnexion emise par onAuthStateChange', async () => {
    const fake = makeFakeClient({
      session: { user: { id: 'u1' } },
      profileRow: { id: 'u1', username: 'Lilia' },
    });
    const service = configure(fake);
    await service.ready();
    expect(service.status()).toBe('authenticated');

    fake.listeners.forEach(cb => cb('SIGNED_OUT', null));
    await service.ready();

    expect(service.status()).toBe('anonymous');
    expect(service.profile()).toBeNull();
  });
});
```

- [ ] **Step 3 : Lancer les tests, vérifier qu'ils échouent**

```bash
npx ng test --include='**/auth.service.spec.ts' --watch=false --browsers=ChromeHeadless
```

Attendu : ÉCHEC — `Cannot find module './auth.service'`.

- [ ] **Step 4 : Implémenter**

Créer `frontend/src/app/services/auth.service.ts` :

```typescript
import { computed, inject, Injectable, signal } from '@angular/core';
import { SupabaseClientService } from './supabase-client.service';
import { Profile } from '../models/profile.model';

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

/**
 * Seul point de contact de l'application avec l'authentification.
 *
 * Invariant : ce service n'est JAMAIS dans le chemin critique de la simulation.
 * Toute panne (Supabase injoignable, session expiree, hors-ligne) retombe
 * silencieusement en mode invite ; builds, timelines et simulation continuent.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly supabase = inject(SupabaseClientService);

  private readonly _status = signal<AuthStatus>('loading');
  private readonly _profile = signal<Profile | null>(null);

  readonly status = this._status.asReadonly();
  readonly profile = this._profile.asReadonly();
  readonly isAuthenticated = computed(() => this._status() === 'authenticated');

  /** Resolue quand la resolution de session en cours est terminee (tests et guards). */
  private pending: Promise<void> = Promise.resolve();

  constructor() {
    this.pending = this.restoreSession();
  }

  /** Attend la fin de la resolution de session en cours. */
  ready(): Promise<void> {
    return this.pending;
  }

  private async restoreSession(): Promise<void> {
    try {
      const { data } = await this.supabase.client.auth.getSession();
      this.supabase.client.auth.onAuthStateChange((_event, session) => {
        this.pending = this.applySession(session);
      });
      await this.applySession(data.session);
    } catch {
      this.toAnonymous();
    }
  }

  private async applySession(session: { user?: { id: string } } | null): Promise<void> {
    const userId = session?.user?.id;
    if (!userId) {
      this.toAnonymous();
      return;
    }
    this._profile.set(await this.loadProfile(userId));
    this._status.set('authenticated');
  }

  private toAnonymous(): void {
    this._profile.set(null);
    this._status.set('anonymous');
  }

  private async loadProfile(userId: string): Promise<Profile | null> {
    try {
      const { data } = await this.supabase.client
        .from('profiles')
        .select('id, username')
        .eq('id', userId)
        .single();
      return (data as Profile) ?? null;
    } catch {
      // Le profil est accessoire : mieux vaut un utilisateur connecte sans pseudo
      // affiche qu'une session cassee.
      return null;
    }
  }
}
```

- [ ] **Step 5 : Lancer les tests, vérifier qu'ils passent**

```bash
npx ng test --include='**/auth.service.spec.ts' --watch=false --browsers=ChromeHeadless
```

Attendu : `TOTAL: 4 SUCCESS`.

- [ ] **Step 6 : Commit**

```bash
git add frontend/src/app/models/profile.model.ts frontend/src/app/services/auth.service.ts frontend/src/app/services/auth.service.spec.ts
git commit -m "feat(auth): AuthService avec etat de session et repli invite"
```

---

### Task 5 : `AuthService` — actions signUp / signIn / signOut / reset

**Files:**
- Modify: `frontend/src/app/services/auth.service.ts`
- Modify: `frontend/src/app/services/auth.service.spec.ts`

- [ ] **Step 1 : Écrire les tests qui échouent**

Ajouter dans `frontend/src/app/services/auth.service.spec.ts`, à la fin du `describe('AuthService')` :

```typescript
  describe('actions', () => {
    it('signIn retourne ok quand Supabase accepte', async () => {
      const fake: any = makeFakeClient({ session: null });
      fake.auth.signInWithPassword = () => Promise.resolve({ data: {}, error: null });
      const service = configure(fake);
      await service.ready();

      const result = await service.signIn('a@b.c', 'motdepasse8');
      expect(result.ok).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('signIn traduit une erreur d identifiants', async () => {
      const fake: any = makeFakeClient({ session: null });
      fake.auth.signInWithPassword = () =>
        Promise.resolve({ data: {}, error: { message: 'Invalid login credentials' } });
      const service = configure(fake);
      await service.ready();

      const result = await service.signIn('a@b.c', 'faux');
      expect(result.ok).toBe(false);
      expect(result.error).toBe('Email ou mot de passe incorrect.');
    });

    it('signIn traduit une exception reseau sans la laisser remonter', async () => {
      const fake: any = makeFakeClient({ session: null });
      fake.auth.signInWithPassword = () => Promise.reject(new Error('Failed to fetch'));
      const service = configure(fake);
      await service.ready();

      const result = await service.signIn('a@b.c', 'motdepasse8');
      expect(result.ok).toBe(false);
      expect(result.error).toBe('Service indisponible, tu peux continuer sans compte.');
    });

    it('signUp refuse un pseudo deja pris sans appeler Supabase', async () => {
      const fake: any = makeFakeClient({ profileRow: { id: 'autre', username: 'Lilia' } });
      const signUpSpy = jasmine.createSpy('signUp');
      fake.auth.signUp = signUpSpy;
      const service = configure(fake);
      await service.ready();

      const result = await service.signUp('a@b.c', 'motdepasse8', 'Lilia');
      expect(result.ok).toBe(false);
      expect(result.error).toBe('Ce pseudo est deja utilise.');
      expect(signUpSpy).not.toHaveBeenCalled();
    });

    it('signUp transmet le pseudo en metadonnees quand il est libre', async () => {
      const fake: any = makeFakeClient({ profileRow: null });
      const signUpSpy = jasmine
        .createSpy('signUp')
        .and.returnValue(Promise.resolve({ data: {}, error: null }));
      fake.auth.signUp = signUpSpy;
      const service = configure(fake);
      await service.ready();

      const result = await service.signUp('a@b.c', 'motdepasse8', 'Nouveau');
      expect(result.ok).toBe(true);
      const args = signUpSpy.calls.mostRecent().args[0];
      expect(args.email).toBe('a@b.c');
      expect(args.options.data.username).toBe('Nouveau');
    });

    it('signOut repasse en anonymous', async () => {
      const fake: any = makeFakeClient({
        session: { user: { id: 'u1' } },
        profileRow: { id: 'u1', username: 'Lilia' },
      });
      const service = configure(fake);
      await service.ready();
      expect(service.status()).toBe('authenticated');

      await service.signOut();
      expect(service.status()).toBe('anonymous');
      expect(service.profile()).toBeNull();
    });

    it('requestPasswordReset retourne ok', async () => {
      const fake: any = makeFakeClient({ session: null });
      fake.auth.resetPasswordForEmail = () => Promise.resolve({ data: {}, error: null });
      const service = configure(fake);
      await service.ready();

      const result = await service.requestPasswordReset('a@b.c');
      expect(result.ok).toBe(true);
    });
  });
```

- [ ] **Step 2 : Lancer les tests, vérifier qu'ils échouent**

```bash
npx ng test --include='**/auth.service.spec.ts' --watch=false --browsers=ChromeHeadless
```

Attendu : ÉCHEC — `service.signIn is not a function`.

- [ ] **Step 3 : Implémenter les actions**

Dans `frontend/src/app/services/auth.service.ts`, ajouter l'import :

```typescript
import { toFrenchAuthMessage } from './auth-errors';
```

Ajouter le type après `AuthStatus` :

```typescript
/** Resultat d'une action d'auth : jamais d'exception, toujours un message pret a afficher. */
export interface AuthResult {
  ok: boolean;
  error?: string;
}
```

Puis ajouter ces méthodes publiques dans la classe `AuthService`, après `ready()` :

```typescript
  async signIn(email: string, password: string): Promise<AuthResult> {
    try {
      const { error } = await this.supabase.client.auth.signInWithPassword({ email, password });
      return error ? { ok: false, error: toFrenchAuthMessage(error) } : { ok: true };
    } catch (e) {
      return { ok: false, error: toFrenchAuthMessage(e as { message?: string }) };
    }
  }

  /**
   * Verifie d'abord l'unicite du pseudo : sans ce controle, Supabase remonterait une
   * violation de contrainte brute, inexploitable comme erreur de champ.
   */
  async signUp(email: string, password: string, username: string): Promise<AuthResult> {
    try {
      if (await this.isUsernameTaken(username)) {
        return { ok: false, error: 'Ce pseudo est deja utilise.' };
      }
      const { error } = await this.supabase.client.auth.signUp({
        email,
        password,
        options: { data: { username } },
      });
      return error ? { ok: false, error: toFrenchAuthMessage(error) } : { ok: true };
    } catch (e) {
      return { ok: false, error: toFrenchAuthMessage(e as { message?: string }) };
    }
  }

  async signOut(): Promise<AuthResult> {
    try {
      await this.supabase.client.auth.signOut();
      this.toAnonymous();
      return { ok: true };
    } catch (e) {
      // Meme si Supabase echoue, on veut que l'utilisateur soit deconnecte localement.
      this.toAnonymous();
      return { ok: false, error: toFrenchAuthMessage(e as { message?: string }) };
    }
  }

  async requestPasswordReset(email: string): Promise<AuthResult> {
    try {
      const { error } = await this.supabase.client.auth.resetPasswordForEmail(email);
      return error ? { ok: false, error: toFrenchAuthMessage(error) } : { ok: true };
    } catch (e) {
      return { ok: false, error: toFrenchAuthMessage(e as { message?: string }) };
    }
  }

  private async isUsernameTaken(username: string): Promise<boolean> {
    const { data } = await this.supabase.client
      .from('profiles')
      .select('id, username')
      .eq('username', username)
      .single();
    return !!data;
  }
```

- [ ] **Step 4 : Lancer les tests, vérifier qu'ils passent**

```bash
npx ng test --include='**/auth.service.spec.ts' --watch=false --browsers=ChromeHeadless
```

Attendu : `TOTAL: 11 SUCCESS`.

- [ ] **Step 5 : Commit**

```bash
git add frontend/src/app/services/auth.service.ts frontend/src/app/services/auth.service.spec.ts
git commit -m "feat(auth): actions signUp, signIn, signOut et reset de mot de passe"
```

---

### Task 6 : Page de connexion

**Files:**
- Create: `frontend/src/app/pages/login-page.component.ts`
- Test: `frontend/src/app/pages/login-page.component.spec.ts`

- [ ] **Step 1 : Écrire les tests qui échouent**

Créer `frontend/src/app/pages/login-page.component.spec.ts` :

```typescript
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LoginPageComponent } from './login-page.component';
import { AuthService } from '../services/auth.service';

describe('LoginPageComponent', () => {
  function configure(authOverrides: Partial<AuthService> = {}) {
    const auth = {
      signIn: jasmine.createSpy('signIn').and.returnValue(Promise.resolve({ ok: true })),
      ...authOverrides,
    };
    TestBed.configureTestingModule({
      imports: [LoginPageComponent],
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
    });
    const fixture = TestBed.createComponent(LoginPageComponent);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance as any, auth };
  }

  it('n appelle pas signIn si les champs sont vides', async () => {
    const { component, auth } = configure();
    await component.submit();
    expect(auth.signIn).not.toHaveBeenCalled();
    expect(component.error()).toBe('Renseigne ton email et ton mot de passe.');
  });

  it('appelle signIn avec les identifiants saisis', async () => {
    const { component, auth } = configure();
    component.email = 'a@b.c';
    component.password = 'motdepasse8';
    await component.submit();
    expect(auth.signIn).toHaveBeenCalledWith('a@b.c', 'motdepasse8');
  });

  it('affiche l erreur retournee par le service', async () => {
    const { component } = configure({
      signIn: jasmine.createSpy('signIn').and.returnValue(
        Promise.resolve({ ok: false, error: 'Email ou mot de passe incorrect.' })
      ),
    } as any);
    component.email = 'a@b.c';
    component.password = 'faux';
    await component.submit();
    expect(component.error()).toBe('Email ou mot de passe incorrect.');
    expect(component.loading()).toBe(false);
  });

  it('retombe a loading=false meme apres une erreur', async () => {
    const { component } = configure({
      signIn: jasmine.createSpy('signIn').and.returnValue(
        Promise.resolve({ ok: false, error: 'Service indisponible, tu peux continuer sans compte.' })
      ),
    } as any);
    component.email = 'a@b.c';
    component.password = 'motdepasse8';
    await component.submit();
    expect(component.loading()).toBe(false);
  });
});
```

- [ ] **Step 2 : Lancer les tests, vérifier qu'ils échouent**

```bash
npx ng test --include='**/login-page.component.spec.ts' --watch=false --browsers=ChromeHeadless
```

Attendu : ÉCHEC — `Cannot find module './login-page.component'`.

- [ ] **Step 3 : Implémenter**

Créer `frontend/src/app/pages/login-page.component.ts` :

```typescript
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <section class="auth-page">
      <h1>Connexion</h1>

      <form (ngSubmit)="submit()">
        <label for="email">Email</label>
        <input id="email" type="email" name="email" [(ngModel)]="email" autocomplete="email" />

        <label for="password">Mot de passe</label>
        <input
          id="password"
          type="password"
          name="password"
          [(ngModel)]="password"
          autocomplete="current-password"
        />

        @if (error()) {
          <p class="error" role="alert">{{ error() }}</p>
        }

        <button type="submit" [disabled]="loading()">
          {{ loading() ? 'Connexion…' : 'Se connecter' }}
        </button>
      </form>

      <nav class="links">
        <a routerLink="/mot-de-passe-oublie">Mot de passe oublié ?</a>
        <a routerLink="/inscription">Créer un compte</a>
      </nav>
    </section>
  `,
  styles: [`
    .auth-page { max-width: 360px; margin: 48px auto; padding: 0 16px; }
    h1 { font-size: 20px; margin-bottom: 20px; }
    form { display: flex; flex-direction: column; gap: 6px; }
    label { font-size: 13px; color: var(--app-text-muted, inherit); }
    input {
      padding: 8px 10px;
      margin-bottom: 8px;
      background: var(--app-surface);
      border: 1px solid var(--app-border);
      border-radius: 6px;
      color: inherit;
    }
    button {
      margin-top: 8px;
      padding: 9px 12px;
      background: var(--app-accent);
      border: 0;
      border-radius: 6px;
      color: #fff;
      cursor: pointer;
    }
    button[disabled] { opacity: 0.6; cursor: default; }
    .error { color: #e5484d; font-size: 13px; margin: 4px 0; }
    .links { display: flex; justify-content: space-between; margin-top: 16px; font-size: 13px; }
  `],
})
export class LoginPageComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  email = '';
  password = '';
  readonly error = signal<string | null>(null);
  readonly loading = signal(false);

  async submit(): Promise<void> {
    if (!this.email || !this.password) {
      this.error.set('Renseigne ton email et ton mot de passe.');
      return;
    }
    this.error.set(null);
    this.loading.set(true);
    const result = await this.auth.signIn(this.email, this.password);
    this.loading.set(false);

    if (result.ok) {
      await this.router.navigate(['/accueil']);
    } else {
      this.error.set(result.error ?? null);
    }
  }
}
```

- [ ] **Step 4 : Lancer les tests, vérifier qu'ils passent**

```bash
npx ng test --include='**/login-page.component.spec.ts' --watch=false --browsers=ChromeHeadless
```

Attendu : `TOTAL: 4 SUCCESS`.

- [ ] **Step 5 : Commit**

```bash
git add frontend/src/app/pages/login-page.component.ts frontend/src/app/pages/login-page.component.spec.ts
git commit -m "feat(auth): page de connexion"
```

---

### Task 7 : Page d'inscription

**Files:**
- Create: `frontend/src/app/pages/signup-page.component.ts`
- Test: `frontend/src/app/pages/signup-page.component.spec.ts`

- [ ] **Step 1 : Écrire les tests qui échouent**

Créer `frontend/src/app/pages/signup-page.component.spec.ts` :

```typescript
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SignupPageComponent } from './signup-page.component';
import { AuthService } from '../services/auth.service';

describe('SignupPageComponent', () => {
  function configure(signUpResult: any = { ok: true }) {
    const auth = {
      signUp: jasmine.createSpy('signUp').and.returnValue(Promise.resolve(signUpResult)),
    };
    TestBed.configureTestingModule({
      imports: [SignupPageComponent],
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
    });
    const fixture = TestBed.createComponent(SignupPageComponent);
    fixture.detectChanges();
    return { component: fixture.componentInstance as any, auth };
  }

  it('exige tous les champs', async () => {
    const { component, auth } = configure();
    await component.submit();
    expect(auth.signUp).not.toHaveBeenCalled();
    expect(component.error()).toBe('Tous les champs sont obligatoires.');
  });

  it('refuse un mot de passe de moins de 8 caracteres sans appeler le service', async () => {
    const { component, auth } = configure();
    component.email = 'a@b.c';
    component.password = 'court';
    component.username = 'Lilia';
    await component.submit();
    expect(auth.signUp).not.toHaveBeenCalled();
    expect(component.error()).toBe('Le mot de passe doit faire au moins 8 caracteres.');
  });

  it('appelle signUp avec email, mot de passe et pseudo', async () => {
    const { component, auth } = configure();
    component.email = 'a@b.c';
    component.password = 'motdepasse8';
    component.username = 'Lilia';
    await component.submit();
    expect(auth.signUp).toHaveBeenCalledWith('a@b.c', 'motdepasse8', 'Lilia');
  });

  // La confirmation d'email est requise : on ne redirige pas, on informe.
  it('affiche l ecran de confirmation apres une inscription reussie', async () => {
    const { component } = configure({ ok: true });
    component.email = 'a@b.c';
    component.password = 'motdepasse8';
    component.username = 'Lilia';
    await component.submit();
    expect(component.submitted()).toBe(true);
  });

  it('affiche l erreur de pseudo deja pris', async () => {
    const { component } = configure({ ok: false, error: 'Ce pseudo est deja utilise.' });
    component.email = 'a@b.c';
    component.password = 'motdepasse8';
    component.username = 'Lilia';
    await component.submit();
    expect(component.error()).toBe('Ce pseudo est deja utilise.');
    expect(component.submitted()).toBe(false);
  });
});
```

- [ ] **Step 2 : Lancer les tests, vérifier qu'ils échouent**

```bash
npx ng test --include='**/signup-page.component.spec.ts' --watch=false --browsers=ChromeHeadless
```

Attendu : ÉCHEC — `Cannot find module './signup-page.component'`.

- [ ] **Step 3 : Implémenter**

Créer `frontend/src/app/pages/signup-page.component.ts` :

```typescript
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../services/auth.service';

const MIN_PASSWORD_LENGTH = 8;

@Component({
  selector: 'app-signup-page',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <section class="auth-page">
      @if (submitted()) {
        <h1>Vérifie tes mails</h1>
        <p class="info">
          On a envoyé un lien de confirmation à <strong>{{ email }}</strong>.
          Clique dessus pour activer ton compte, puis connecte-toi.
        </p>
        <nav class="links"><a routerLink="/connexion">Retour à la connexion</a></nav>
      } @else {
        <h1>Créer un compte</h1>

        <form (ngSubmit)="submit()">
          <label for="username">Pseudo</label>
          <input id="username" type="text" name="username" [(ngModel)]="username" autocomplete="nickname" />

          <label for="email">Email</label>
          <input id="email" type="email" name="email" [(ngModel)]="email" autocomplete="email" />

          <label for="password">Mot de passe</label>
          <input
            id="password"
            type="password"
            name="password"
            [(ngModel)]="password"
            autocomplete="new-password"
          />
          <small>Au moins {{ minLength }} caractères.</small>

          @if (error()) {
            <p class="error" role="alert">{{ error() }}</p>
          }

          <button type="submit" [disabled]="loading()">
            {{ loading() ? 'Création…' : 'Créer mon compte' }}
          </button>
        </form>

        <nav class="links"><a routerLink="/connexion">J'ai déjà un compte</a></nav>
      }
    </section>
  `,
  styles: [`
    .auth-page { max-width: 360px; margin: 48px auto; padding: 0 16px; }
    h1 { font-size: 20px; margin-bottom: 20px; }
    form { display: flex; flex-direction: column; gap: 6px; }
    label { font-size: 13px; color: var(--app-text-muted, inherit); }
    input {
      padding: 8px 10px;
      background: var(--app-surface);
      border: 1px solid var(--app-border);
      border-radius: 6px;
      color: inherit;
    }
    small { font-size: 12px; opacity: 0.7; margin-bottom: 8px; }
    button {
      margin-top: 8px;
      padding: 9px 12px;
      background: var(--app-accent);
      border: 0;
      border-radius: 6px;
      color: #fff;
      cursor: pointer;
    }
    button[disabled] { opacity: 0.6; cursor: default; }
    .error { color: #e5484d; font-size: 13px; margin: 4px 0; }
    .info { font-size: 14px; line-height: 1.5; }
    .links { display: flex; justify-content: space-between; margin-top: 16px; font-size: 13px; }
  `],
})
export class SignupPageComponent {
  private readonly auth = inject(AuthService);

  readonly minLength = MIN_PASSWORD_LENGTH;

  email = '';
  password = '';
  username = '';
  readonly error = signal<string | null>(null);
  readonly loading = signal(false);
  readonly submitted = signal(false);

  async submit(): Promise<void> {
    if (!this.email || !this.password || !this.username) {
      this.error.set('Tous les champs sont obligatoires.');
      return;
    }
    if (this.password.length < MIN_PASSWORD_LENGTH) {
      this.error.set('Le mot de passe doit faire au moins 8 caracteres.');
      return;
    }

    this.error.set(null);
    this.loading.set(true);
    const result = await this.auth.signUp(this.email, this.password, this.username);
    this.loading.set(false);

    if (result.ok) {
      // Confirmation d'email requise : le compte n'est pas utilisable tout de suite,
      // on informe au lieu de rediriger vers une connexion qui echouerait.
      this.submitted.set(true);
    } else {
      this.error.set(result.error ?? null);
    }
  }
}
```

- [ ] **Step 4 : Lancer les tests, vérifier qu'ils passent**

```bash
npx ng test --include='**/signup-page.component.spec.ts' --watch=false --browsers=ChromeHeadless
```

Attendu : `TOTAL: 5 SUCCESS`.

- [ ] **Step 5 : Commit**

```bash
git add frontend/src/app/pages/signup-page.component.ts frontend/src/app/pages/signup-page.component.spec.ts
git commit -m "feat(auth): page d'inscription avec pseudo et ecran de confirmation"
```

---

### Task 8 : Page mot de passe oublié

**Files:**
- Create: `frontend/src/app/pages/password-reset-page.component.ts`
- Test: `frontend/src/app/pages/password-reset-page.component.spec.ts`

- [ ] **Step 1 : Écrire les tests qui échouent**

Créer `frontend/src/app/pages/password-reset-page.component.spec.ts` :

```typescript
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PasswordResetPageComponent } from './password-reset-page.component';
import { AuthService } from '../services/auth.service';

describe('PasswordResetPageComponent', () => {
  function configure(result: any = { ok: true }) {
    const auth = {
      requestPasswordReset: jasmine
        .createSpy('requestPasswordReset')
        .and.returnValue(Promise.resolve(result)),
    };
    TestBed.configureTestingModule({
      imports: [PasswordResetPageComponent],
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
    });
    const fixture = TestBed.createComponent(PasswordResetPageComponent);
    fixture.detectChanges();
    return { component: fixture.componentInstance as any, auth };
  }

  it('exige un email', async () => {
    const { component, auth } = configure();
    await component.submit();
    expect(auth.requestPasswordReset).not.toHaveBeenCalled();
    expect(component.error()).toBe('Renseigne ton email.');
  });

  it('appelle le service avec l email saisi', async () => {
    const { component, auth } = configure();
    component.email = 'a@b.c';
    await component.submit();
    expect(auth.requestPasswordReset).toHaveBeenCalledWith('a@b.c');
    expect(component.submitted()).toBe(true);
  });

  it('affiche une erreur en cas d echec', async () => {
    const { component } = configure({
      ok: false,
      error: 'Service indisponible, tu peux continuer sans compte.',
    });
    component.email = 'a@b.c';
    await component.submit();
    expect(component.error()).toBe('Service indisponible, tu peux continuer sans compte.');
    expect(component.submitted()).toBe(false);
  });
});
```

- [ ] **Step 2 : Lancer les tests, vérifier qu'ils échouent**

```bash
npx ng test --include='**/password-reset-page.component.spec.ts' --watch=false --browsers=ChromeHeadless
```

Attendu : ÉCHEC — `Cannot find module './password-reset-page.component'`.

- [ ] **Step 3 : Implémenter**

Créer `frontend/src/app/pages/password-reset-page.component.ts` :

```typescript
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-password-reset-page',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <section class="auth-page">
      @if (submitted()) {
        <h1>Vérifie tes mails</h1>
        <p class="info">
          Si un compte existe pour <strong>{{ email }}</strong>, un lien de
          réinitialisation vient d'être envoyé.
        </p>
      } @else {
        <h1>Mot de passe oublié</h1>

        <form (ngSubmit)="submit()">
          <label for="email">Email</label>
          <input id="email" type="email" name="email" [(ngModel)]="email" autocomplete="email" />

          @if (error()) {
            <p class="error" role="alert">{{ error() }}</p>
          }

          <button type="submit" [disabled]="loading()">
            {{ loading() ? 'Envoi…' : 'Envoyer le lien' }}
          </button>
        </form>
      }

      <nav class="links"><a routerLink="/connexion">Retour à la connexion</a></nav>
    </section>
  `,
  styles: [`
    .auth-page { max-width: 360px; margin: 48px auto; padding: 0 16px; }
    h1 { font-size: 20px; margin-bottom: 20px; }
    form { display: flex; flex-direction: column; gap: 6px; }
    label { font-size: 13px; color: var(--app-text-muted, inherit); }
    input {
      padding: 8px 10px;
      margin-bottom: 8px;
      background: var(--app-surface);
      border: 1px solid var(--app-border);
      border-radius: 6px;
      color: inherit;
    }
    button {
      margin-top: 8px;
      padding: 9px 12px;
      background: var(--app-accent);
      border: 0;
      border-radius: 6px;
      color: #fff;
      cursor: pointer;
    }
    button[disabled] { opacity: 0.6; cursor: default; }
    .error { color: #e5484d; font-size: 13px; margin: 4px 0; }
    .info { font-size: 14px; line-height: 1.5; }
    .links { margin-top: 16px; font-size: 13px; }
  `],
})
export class PasswordResetPageComponent {
  private readonly auth = inject(AuthService);

  email = '';
  readonly error = signal<string | null>(null);
  readonly loading = signal(false);
  readonly submitted = signal(false);

  async submit(): Promise<void> {
    if (!this.email) {
      this.error.set('Renseigne ton email.');
      return;
    }
    this.error.set(null);
    this.loading.set(true);
    const result = await this.auth.requestPasswordReset(this.email);
    this.loading.set(false);

    if (result.ok) {
      this.submitted.set(true);
    } else {
      this.error.set(result.error ?? null);
    }
  }
}
```

- [ ] **Step 4 : Lancer les tests, vérifier qu'ils passent**

```bash
npx ng test --include='**/password-reset-page.component.spec.ts' --watch=false --browsers=ChromeHeadless
```

Attendu : `TOTAL: 3 SUCCESS`.

- [ ] **Step 5 : Commit**

```bash
git add frontend/src/app/pages/password-reset-page.component.ts frontend/src/app/pages/password-reset-page.component.spec.ts
git commit -m "feat(auth): page de demande de reinitialisation de mot de passe"
```

---

### Task 9 : Brancher les routes

**Files:**
- Modify: `frontend/src/app/app.routes.ts`

- [ ] **Step 1 : Ajouter les routes**

Dans `frontend/src/app/app.routes.ts`, ajouter les imports après la ligne
`import { ResultatsPageComponent } from './pages/resultats-page.component';` :

```typescript
import { LoginPageComponent } from './pages/login-page.component';
import { SignupPageComponent } from './pages/signup-page.component';
import { PasswordResetPageComponent } from './pages/password-reset-page.component';
```

Puis ajouter les 3 routes **avant** la route `'**'` (qui doit rester en dernier) :

```typescript
  { path: 'connexion', component: LoginPageComponent },
  { path: 'inscription', component: SignupPageComponent },
  { path: 'mot-de-passe-oublie', component: PasswordResetPageComponent },
```

- [ ] **Step 2 : Vérifier que l'application compile**

```bash
npx ng build --configuration development
```

Attendu : `Application bundle generation complete`, sans erreur.

- [ ] **Step 3 : Commit**

```bash
git add frontend/src/app/app.routes.ts
git commit -m "feat(auth): routes connexion, inscription et mot de passe oublie"
```

---

### Task 10 : État de connexion dans la sidebar

**Files:**
- Modify: `frontend/src/app/ui/icon.component.ts`
- Modify: `frontend/src/app/ui/app-sidebar.component.ts`

- [ ] **Step 1 : Ajouter les icônes manquantes**

Dans `frontend/src/app/ui/icon.component.ts`, ajouter ces deux entrées dans `ICON_PATHS`,
après la ligne `grid: '...'` (ajouter une virgule à la fin de la ligne `grid` si absente) :

```typescript
  'log-in': 'M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3',
  'log-out': 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
```

- [ ] **Step 2 : Écrire le test qui échoue**

Créer `frontend/src/app/ui/app-sidebar.component.spec.ts` :

```typescript
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { AppSidebarComponent } from './app-sidebar.component';
import { AuthService } from '../services/auth.service';

describe('AppSidebarComponent — etat de connexion', () => {
  function configure(status: 'loading' | 'authenticated' | 'anonymous', username?: string) {
    const auth = {
      status: signal(status),
      profile: signal(username ? { id: 'u1', username } : null),
      isAuthenticated: signal(status === 'authenticated'),
      signOut: jasmine.createSpy('signOut').and.returnValue(Promise.resolve({ ok: true })),
    };
    TestBed.configureTestingModule({
      imports: [AppSidebarComponent],
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
    });
    const fixture = TestBed.createComponent(AppSidebarComponent);
    fixture.componentRef.setInput('expanded', true);
    fixture.detectChanges();
    return { fixture, auth };
  }

  it('propose de se connecter quand on est invite', () => {
    const { fixture } = configure('anonymous');
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Se connecter');
  });

  it('affiche le pseudo quand on est connecte', () => {
    const { fixture } = configure('authenticated', 'Lilia');
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Lilia');
    expect(text).not.toContain('Se connecter');
  });

  // Evite le flash "Se connecter" au rafraichissement pour un utilisateur deja connecte.
  it('n affiche rien pendant la resolution de session', () => {
    const { fixture } = configure('loading');
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).not.toContain('Se connecter');
  });
});
```

- [ ] **Step 3 : Lancer le test, vérifier qu'il échoue**

```bash
npx ng test --include='**/app-sidebar.component.spec.ts' --watch=false --browsers=ChromeHeadless
```

Attendu : ÉCHEC — le texte « Se connecter » est absent (`NullInjectorError` possible si
`AuthService` n'est pas encore injecté dans le composant).

- [ ] **Step 4 : Implémenter**

Dans `frontend/src/app/ui/app-sidebar.component.ts` :

Remplacer la ligne d'import Angular :

```typescript
import { Component, input } from '@angular/core';
```

par :

```typescript
import { Component, inject, input } from '@angular/core';
import { AuthService } from '../services/auth.service';
```

Dans le décorateur, remplacer la fermeture du `</ul>` et du `</nav>` — c'est-à-dire
remplacer ce fragment du template :

```html
      </ul>
    </nav>
  `,
```

par :

```html
      </ul>

      <div class="account">
        @if (status() === 'authenticated') {
          <a class="nav-item" routerLink="/accueil" (click)="signOut()" [attr.title]="expanded() ? null : 'Se déconnecter'">
            <ui-icon name="log-out"></ui-icon>
            @if (expanded()) { <span class="nav-label">{{ profile()?.username ?? 'Mon compte' }}</span> }
          </a>
        } @else if (status() === 'anonymous') {
          <a class="nav-item" routerLink="/connexion" routerLinkActive="active" [attr.title]="expanded() ? null : 'Se connecter'">
            <ui-icon name="log-in"></ui-icon>
            @if (expanded()) { <span class="nav-label">Se connecter</span> }
          </a>
        }
      </div>
    </nav>
  `,
```

Ajouter ce style à la fin du tableau `styles` (avant le backtick fermant) :

```css
    .account { margin-top: auto; border-top: 1px solid var(--app-border); padding-top: 6px; }
```

Enfin, remplacer le corps de la classe :

```typescript
export class AppSidebarComponent {
  readonly expanded = input(false);
  protected readonly items = NAV_ITEMS;
}
```

par :

```typescript
export class AppSidebarComponent {
  private readonly auth = inject(AuthService);

  readonly expanded = input(false);
  protected readonly items = NAV_ITEMS;

  // 'loading' n'affiche rien : evite le flash "Se connecter" au rafraichissement
  // pour un utilisateur deja connecte.
  protected readonly status = this.auth.status;
  protected readonly profile = this.auth.profile;

  protected async signOut(): Promise<void> {
    await this.auth.signOut();
  }
}
```

> Si le corps actuel de la classe diffère (propriétés supplémentaires), conserver
> l'existant et n'ajouter que `auth`, `status`, `profile` et `signOut`.

- [ ] **Step 5 : Lancer le test, vérifier qu'il passe**

```bash
npx ng test --include='**/app-sidebar.component.spec.ts' --watch=false --browsers=ChromeHeadless
```

Attendu : `TOTAL: 3 SUCCESS`.

- [ ] **Step 6 : Commit**

```bash
git add frontend/src/app/ui/app-sidebar.component.ts frontend/src/app/ui/app-sidebar.component.spec.ts frontend/src/app/ui/icon.component.ts
git commit -m "feat(auth): etat de connexion dans la sidebar"
```

---

### Task 11 : Vérification finale

**Files:** aucun (vérification)

- [ ] **Step 1 : Lancer toute la suite de tests**

```bash
npx ng test --watch=false --browsers=ChromeHeadless
```

Attendu : `TOTAL: 137 SUCCESS`, **zéro échec**. La suite comptait 98 specs avant ce lot ;
ce plan en ajoute 39 (2 client + 7 erreurs + 11 AuthService + 4 connexion + 5 inscription
+ 3 reset + 3 sidebar + **4 de non-régression** ajoutés par le correctif `2d3f04b`, voir
la note de la Task 4).

- [ ] **Step 2 : Vérifier le build de production**

```bash
npx ng build --configuration production
```

Attendu : `Application bundle generation complete`, sans dépassement de budget.
Si le budget `initial` (2 MB) explose à cause de `@supabase/supabase-js`, relever
`maximumError` à `3MB` dans `angular.json` et le mentionner dans le commit.

- [ ] **Step 3 : Vérification manuelle du parcours complet**

Renseigner les vraies valeurs dans `src/environments/environment.ts`, puis :

```bash
npx ng serve
```

Vérifier dans l'ordre :
1. `/inscription` → créer un compte → l'écran « Vérifie tes mails » s'affiche.
2. Boîte mail → cliquer le lien de confirmation.
3. `/connexion` → se connecter → la sidebar affiche le pseudo.
4. Recharger la page → la sidebar affiche toujours le pseudo, **sans flash « Se connecter »**.
5. Cliquer le pseudo → déconnexion → la sidebar propose « Se connecter ».
6. **Les builds et timelines existants sont toujours là**, connecté comme déconnecté.
7. `/inscription` avec un pseudo déjà pris → message « Ce pseudo est deja utilise. ».

- [ ] **Step 4 : Vérifier l'invariant de résilience**

Dans `src/environments/environment.ts`, remplacer temporairement `supabaseUrl` par
`https://injoignable.supabase.co`, puis `npx ng serve`.

Attendu : l'application démarre, la sidebar propose « Se connecter », et **le simulateur
fonctionne normalement** (builds, timelines, freeplay). C'est l'invariant central du lot.

Restaurer ensuite la vraie URL.

- [ ] **Step 5 : Commit final si des ajustements ont été nécessaires**

```bash
git add -A
git commit -m "chore(auth): ajustements suite a la verification du lot 1"
```

---

## Ce que ce lot ne fait pas

- **Aucun changement de stockage.** Builds et timelines restent en `localStorage`, y
  compris connecté. C'est volontaire : le lot est livrable sans risque de perte de données.
- **Aucun guard de route.** Rien à protéger tant que les données sont locales.
- **Pas de page de saisie du nouveau mot de passe** après clic sur le lien de reset :
  Supabase héberge ce formulaire par défaut. Une page applicative dédiée pourra être
  ajoutée au lot 2 si le parcours par défaut ne convient pas.
- **Pas d'OAuth**, pas de magic link.
