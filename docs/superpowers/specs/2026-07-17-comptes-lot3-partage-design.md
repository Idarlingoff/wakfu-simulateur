# Design — Comptes utilisateurs, lot 3 : Partage & galerie

**Date :** 2026-07-17
**Branche :** `feat_gestion-stockage-timeline-supabase-et-partage`
**Statut :** Validé, prêt pour plan d'implémentation

## Besoin

Les lots 1 (auth) et 2 (persistance privée) sont livrés. Ce dernier lot permet de
**partager ses timelines** : les rendre publiques ou accessibles par lien, les retrouver
dans une galerie filtrable, et copier celles des autres. Les builds ne sont jamais
partagés (ce n'est pas un builder).

## Contexte technique existant

- **Le partage est « structure seule »** (décidé au lot 1) : une timeline partagée porte
  sa séquence d'actions et son board, mais **aucune donnée de build**. Le lecteur rejoue
  avec son propre build.
- **`WakfuApiService` route local/cloud** selon `AuthService.status()`.
  `SupabaseTimelineRepository` filtre sur `owner_id` et renvoie `[]` sans utilisateur : il
  **ne peut pas** servir la lecture publique.
- **Deux dettes du lot 2 à solder ici :**
  - `timelines.class_id` n'est **jamais écrit** (seulement lu) → toutes les timelines en
    base l'ont à `NULL`. La galerie en a besoin pour filtrer par classe.
  - Seules les politiques RLS propriétaire existent. Aucune lecture publique.
- **La vraie UI des timelines vit dans `dashboard.component.ts` (1195 lignes)**, à double
  casquette (`mode() === 'timeline' | 'freeplay'`). `timeline-page.component.ts` n'en est
  qu'un habillage de 10 lignes. Ce lot **ne touche pas** au dashboard.
- **Supabase attaque Postgres directement depuis le client.** Toute donnée lisible par
  une politique RLS est **énumérable** via l'API REST (`/rest/v1/timelines?select=*`).
  C'est la contrainte centrale de sécurité de ce lot.

## Décisions de cadrage

| Sujet | Décision |
|-------|----------|
| Architecture | **Approche A** : galerie et vue partagée sur de nouvelles routes ; le dashboard n'est pas touché. |
| Visiteur sans compte | Peut **consulter** les timelines publiques et par lien. Le compte ne sert qu'à publier et copier. |
| Niveaux de visibilité | `private` / `unlisted` (lien) / `public`. |
| Sécurité du lien | **`share_token` uuid + fonction Postgres dédiée.** RLS n'expose que `public` ; les `unlisted` ne sont accessibles que via leur jeton. |
| `class_id` | **Backfill SQL** depuis le build référencé, + écriture désormais. |
| Ouverture d'une timeline partagée | Séquence + board toujours affichés ; **dégâts seulement après choix d'un build du lecteur**. |
| Copie | **Connectés uniquement.** |
| Repasser en `private` | **Casse les liens déjà distribués** (comportement voulu). |
| Galerie hors-ligne | **Message clair**, pas de cache des données publiques. |

### Approches écartées

- **RLS simple sur `visibility`** (anonyme lit `public` ET `unlisted`) : rendrait toute
  timeline non listée énumérable par n'importe qui via l'API REST. « Non listé » ne
  voudrait plus rien dire.
- **Galerie dans le dashboard** ou **galerie remplaçant `/timelines`** : imposerait de
  découper un fichier de 1195 lignes à double casquette pendant l'ajout d'une feature —
  le genre de refactor sous pression qui casse le freeplay sans qu'on le voie. Le lot 3
  ajoute de la surface, il n'a pas à en refondre.

## Périmètre du lot 3

**Dans le périmètre :** `share_token` + politiques RLS + fonction de lecture par jeton ;
backfill et écriture de `class_id` ; `PublicTimelineRepository` ; page galerie
(`/galerie`) avec onglets et filtre ; page de consultation partagée (`/t/:token`) avec
rejeu par build du lecteur ; sélecteur de visibilité et copie de lien ; duplication.

**Hors périmètre :** toute refonte du dashboard ou de `/timelines` ; le partage de
builds ; un cache hors-ligne des données publiques ; la modération/signalement.

## Architecture

### 1. Migration SQL (`supabase/migrations/0003_timeline_sharing.sql`)

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
-- Les politiques RLS se cumulent en OR : le proprietaire garde tout via
-- timelines_owner_all (lot 2). Les 'unlisted' restent invisibles a RLS, donc NON
-- enumerables via l'API REST.
create policy "timelines_public_read" on public.timelines
  for select using (visibility = 'public');

-- Acces par lien : court-circuite RLS, mais UNIQUEMENT contre presentation du jeton.
-- 'private' n'est jamais accessible par ce chemin. Repasser une timeline en 'private'
-- invalide donc les liens deja distribues.
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

### 2. Modèle

`Timeline` (`frontend/src/app/models/timeline.model.ts`) gagne :

```typescript
  classId?: string;
  visibility?: 'private' | 'unlisted' | 'public';
  shareToken?: string;
```

`SupabaseTimelineRepository.toRow()` écrit désormais `class_id` (depuis `timeline.classId`)
et n'écrase pas `visibility`/`share_token` (gérés en base). La création de timeline doit
renseigner `classId` depuis le build associé.

### 3. `PublicTimelineRepository`

Fichier dédié : les lectures publiques ne passent pas par le repo propriétaire.

```typescript
interface PublicTimelineRepository {
  // Timelines publiques, avec le pseudo de l'auteur (join profiles). Filtre classe optionnel.
  getPublic(classId?: string): Observable<SharedTimeline[]>;
  // Une timeline par jeton, via la fonction Postgres. null si absente/plus partagee.
  getByShareToken(token: string): Observable<SharedTimeline | null>;
}
```

`SharedTimeline` = `Timeline` + `{ authorUsername: string }`.

### 4. Surfaces

| Route | Composant | Rôle |
|---|---|---|
| `/galerie` | `GalleryPageComponent` | Onglets « Mes timelines / Publiques », filtre par classe. Sur les miennes : sélecteur de visibilité + copie du lien. Sur les publiques : pseudo auteur + bouton dupliquer (connecté). |
| `/t/:token` | `SharedTimelinePageComponent` | Consultation. Séquence + board toujours ; dégâts après choix d'un build du lecteur (local ou compte) ; sinon invitation à en créer/choisir un. Dupliquer si connecté. |

Entrée « Galerie » dans la sidebar. `/timelines` et le dashboard inchangés.

Un `TimelineSharingService` porte les actions transverses : `setVisibility(id, visibility)`,
`shareLink(timeline)` (construit l'URL `/t/<shareToken>`), `duplicate(shared)` (copie dans
le compte du lecteur, nouvel uuid, `visibility='private'`, `buildId=''`).

### 5. Flux de données

- **Galerie / onglet « Mes timelines »** — `WakfuApiService.getAllTimelines()` (déjà
  routé cloud). Chaque ligne montre sa visibilité, modifiable ; si `public`/`unlisted`,
  un bouton copie l'URL de partage.
- **Galerie / onglet « Publiques »** — `PublicTimelineRepository.getPublic(classId?)`.
  Accessible même déconnecté.
- **Vue `/t/:token`** — `getByShareToken(token)`. La séquence et le board s'affichent ;
  un sélecteur propose les builds du lecteur (locaux si invité, du compte si connecté) ;
  les dégâts n'apparaissent qu'une fois un build choisi.
- **Dupliquer** — connecté uniquement ; insère une copie privée dans le compte.

## Gestion d'erreurs

- **Jeton invalide, ou timeline repassée en `private`** → « Cette timeline n'existe plus
  ou n'est plus partagée. » Jamais de page blanche ni de message technique.
- **Galerie hors-ligne** → message clair. Les données publiques ne sont pas dans le
  miroir (cloisonné par utilisateur ; cacher les timelines des autres n'a pas de sens).
  Les timelines privées du lecteur, elles, restent lisibles via le miroir du lot 2.
- **Échec de changement de visibilité / duplication** → passe par le `SaveErrorService`
  du lot 2 : échec bruyant, jamais silencieux.

## Tests

- **`PublicTimelineRepository`** (faux client) : lecture publique avec pseudo, lecture par
  jeton, jeton absent → `null`.
- **`TimelineSharingService`** : `setVisibility`, construction de l'URL de partage,
  `duplicate` (nouvel uuid, `private`, `buildId` vidé).
- **`GalleryPageComponent`** : bascule d'onglets, filtre par classe, bouton dupliquer
  masqué en invité.
- **`SharedTimelinePageComponent`** : pas de dégâts sans build sélectionné, dégâts après
  sélection, message d'erreur sur jeton invalide.
- **Non-régression** : la suite existante (200 specs) reste verte.

### Non testable en unitaire — vérification manuelle obligatoire

Ces points ne se prouvent que sur la vraie base ; ils sont la raison d'être de
l'architecture jeton :

1. Un **anonyme ne peut pas énumérer les `unlisted`** :
   `curl "<URL>/rest/v1/timelines?select=*" -H "apikey: <ANON>"` ne doit renvoyer **que**
   des `public`.
2. `get_shared_timeline(<token d'une private>)` renvoie **vide**.
3. `get_shared_timeline(<token d'une unlisted>)` renvoie la timeline.
4. Repasser une timeline en `private` fait que son ancien lien renvoie « plus partagée ».

### Prérequis d'exécution

```bash
cd frontend
export CHROME_BIN="$HOME/.cache/puppeteer/chrome-headless-shell/mac_arm-<version>/chrome-headless-shell-mac-arm64/chrome-headless-shell"
npx ng test --watch=false --browsers=ChromeHeadless
```

Rappel : après toute modification de `frontend/.env`, relancer le serveur ou
`npm run generate:env`.
