# Design — Comptes utilisateurs, lot 2 : Persistance cloud

**Date :** 2026-07-17
**Branche :** `feat_gestion-stockage-timeline-supabase-et-partage`
**Statut :** Validé, prêt pour plan d'implémentation

## Besoin

Le lot 1 a livré l'authentification, mais il est **volontairement neutre pour les
données** : builds et timelines vivent toujours dans le `localStorage` du navigateur,
même connecté. Ce lot les fait monter dans le compte, pour qu'elles survivent à un
changement d'appareil ou à un vidage de cache.

Ce document couvre **uniquement le lot 2**. Le partage (visibilité publique, galerie,
copie) reste au lot 3.

## Contexte technique existant

- **`WakfuApiService` est la couture du stockage.** Il expose `getAll/getById/create/
  update/delete` pour les builds et les timelines, en `Observable`, adossés à
  `localStorage` (clés `wakfu_builds`, `wakfu_timelines`). Quatre consommateurs en
  dépendent : `build.service`, `timeline.service`, `data-cache.service`,
  `simulation-engine.service`.
- **`DataCacheService` ne concerne pas ce lot.** C'est un cache *en mémoire* (TTL 5 min)
  des données de référence (sorts, passifs). Aucun recouvrement avec le cache de
  persistance introduit ici.
- **Acquis du lot 1** : `AuthService` expose `status()` (`loading | authenticated |
  anonymous`) et `profile()`. Table `profiles` avec RLS. L'invariant du lot 1 —
  *une panne d'auth ne casse jamais le simulateur* — doit continuer de tenir.
- **L'application reste un SPA statique** sur GitHub Pages. Toute la simulation tourne
  côté client ; Postgres ne sert que de stockage.

## Décisions de cadrage

| Sujet | Décision |
|-------|----------|
| Périmètre | **Lot 2 seul**, mais schéma complet : la colonne `visibility` existe dès maintenant pour éviter une 2ᵉ migration au lot 3. |
| Hors-ligne connecté | **Cache local en lecture.** Les lectures retombent sur un miroir local ; les écritures sont refusées avec un message explicite. |
| Après import | **Non destructif.** Les données locales d'invité sont conservées intactes, et un flag par navigateur évite de reproposer l'import. |
| 2ᵉ navigateur | Repropose l'import de ses données locales inédites. |
| Écran d'import | **Liste à cocher**, tout coché par défaut. |
| Timeline sans son build | Cocher une timeline **importe son build d'office**. |
| Stockage du payload | **`jsonb`**, pas de normalisation. |
| RLS publique | **Pas dans ce lot**, malgré la colonne `visibility`. |
| Architecture | **Approche A** : repositories par entité + miroir de cache. |

### Approches écartées

- **Collections génériques** (`LocalCollection<T>` / `SupabaseCollection<T>`) : très DRY,
  mais builds et timelines ne sont pas symétriques (les timelines ont une FK `build_id`,
  un filtre par build, et bientôt `visibility`). Le générique devrait accepter des
  requêtes arbitraires et masquerait plus qu'il ne factoriserait.
- **Tout dans `WakfuApiService` avec des `if (isAuthenticated)`** : zéro nouveau fichier,
  mais le service devient un fourre-tout mêlant localStorage, Postgres, cache et repli
  réseau, chaque méthode rejouant la même logique. Surtout : le repli réseau — qui porte
  l'invariant — deviendrait intestable isolément.
- **Sync bidirectionnelle offline-first** : écarté dès le lot 1. Impose la résolution de
  conflits (même timeline modifiée sur deux appareils). Ici les écritures restent
  cloud-only, donc **aucun conflit possible par construction**.

## Périmètre du lot 2

**Dans le périmètre :** tables `builds` et `timelines` + RLS propriétaire ; repositories
local/cloud derrière `WakfuApiService` ; miroir de cache et repli hors-ligne ; écran
d'import opt-in des données locales.

**Hors périmètre :** toute UI de partage, la galerie publique, la copie de timeline, la
politique RLS de lecture publique, et le découplage `timeline.buildId` pour le partage
« structure seule » — tout cela est le lot 3.

## Architecture

### 1. Schéma Postgres (`supabase/migrations/0002_builds_timelines.sql`)

```
builds
  id          uuid PK default gen_random_uuid()
  owner_id    uuid NOT NULL references auth.users(id) on delete cascade
  name        text NOT NULL
  class_id    text
  data        jsonb NOT NULL      -- spellBar, passiveBar, sublimationBar, stats
  created_at  timestamptz NOT NULL default now()
  updated_at  timestamptz NOT NULL default now()

timelines
  id          uuid PK default gen_random_uuid()
  owner_id    uuid NOT NULL references auth.users(id) on delete cascade
  build_id    uuid NULL references builds(id) on delete set null
  name        text NOT NULL
  class_id    text
  visibility  text NOT NULL default 'private'
              check (visibility in ('private','unlisted','public'))
  data        jsonb NOT NULL      -- steps, boardSetup, currentTurn, maxTurns
  created_at  timestamptz NOT NULL default now()
  updated_at  timestamptz NOT NULL default now()
```

**Pourquoi `jsonb` plutôt que des tables normalisées :** `Build` et `Timeline` sont des
structures imbriquées profondes (`spellBar`, `steps[].actions[]`, `boardSetup.entities`).
Les normaliser imposerait une dizaine de tables et un mapper à maintenir, pour zéro
bénéfice : **la simulation tourne intégralement côté client**, Postgres n'a jamais besoin
d'interroger l'intérieur d'une timeline. Seules sont sorties du JSON les colonnes qu'on
filtre réellement (`name`, `class_id`, `visibility`, `build_id`, `owner_id`).

**`build_id` nullable dès maintenant :** le lot 3 partagera des timelines détachées de
leur build. Nullable maintenant évite une migration plus tard.

**`class_id` sur `timelines` :** dénormalisé depuis le build au moment de l'écriture.
Inutile au lot 2 (une timeline privée passe par son `build_id`), mais indispensable au
lot 3 : une timeline partagée est détachée de son build, et la galerie doit pouvoir
filtrer par classe et vérifier que le build du lecteur est compatible. Même logique que
`visibility` — la colonne existe maintenant pour éviter une 2ᵉ migration.

**RLS :** politiques propriétaire (`auth.uid() = owner_id`) en select/insert/update/delete
sur les deux tables. **Aucune politique de lecture publique n'est créée dans ce lot** :
l'ajouter maintenant exposerait des données sans aucune UI pour contrôler leur visibilité.
Elle viendra au lot 3, avec la galerie.

### 2. Repositories

```
BuildRepository / TimelineRepository        (interfaces)
  ├── LocalBuildRepository / LocalTimelineRepository        invité → localStorage
  └── SupabaseBuildRepository / SupabaseTimelineRepository  connecté → Postgres + miroir
LocalMirror                                  helper de cache, cloisonné par utilisateur
```

`WakfuApiService` **conserve exactement sa signature actuelle** et route vers l'une ou
l'autre implémentation selon `AuthService.status()`. Aucun de ses quatre consommateurs ne
change.

**Cloisonnement des clés `localStorage` — critique :**

| Contexte | Clés |
|---|---|
| Invité | `wakfu_builds`, `wakfu_timelines` *(inchangées)* |
| Cache connecté | `wakfu_cache_<userId>_builds`, `wakfu_cache_<userId>_timelines` |
| Flag d'import | `wakfu_imported_<userId>` |

Sans ce cloisonnement, le cache cloud écraserait les données d'invité — exactement ce que
la décision « import non destructif » promet d'éviter.

### 3. Import des données locales

`LocalDataImportService` + un écran listant builds et timelines locaux, cases cochées par
défaut. Trois points non triviaux :

- **Remap d'identifiants.** En local, les ids sont des chaînes (`build_1730…`) ; en base,
  des `uuid`. L'import génère de nouveaux uuid **et réécrit `timeline.buildId`** vers le
  nouvel id du build correspondant. Sans ce remap, toute timeline importée arrive cassée.
- **Build embarqué d'office.** Cocher une timeline importe son build, même décoché, avec
  une mention dans l'UI.
- **Flag par navigateur.** `wakfu_imported_<userId>` évite de reproposer l'import. Rien
  n'est supprimé côté local : se déconnecter rend les données d'invité intactes.

### 4. Flux de données

- **Invité** — comportement actuel, strictement inchangé.
- **Connexion** — `status()` passe à `authenticated`, `WakfuApiService` route vers les
  repos Supabase. Si des données locales existent et que ce navigateur n'a pas encore
  importé, l'écran d'import est proposé.
- **Lecture connecté** — Postgres, puis recopie dans le miroir.
- **Lecture connecté hors-ligne** — le miroir répond.
- **Écriture connecté hors-ligne** — refusée, message explicite.
- **Déconnexion** — retour aux repos locaux, données d'invité intactes.

## Gestion d'erreurs

L'invariant du lot 1 doit tenir : **une panne ne casse jamais le simulateur.** Supabase
injoignable et connecté → les lectures retombent sur le miroir, le simulateur continue de
tourner avec les dernières timelines connues.

Les écritures, elles, **échouent bruyamment** : jamais d'échec silencieux qui laisserait
croire à une sauvegarde. Message explicite (« Sauvegarde impossible : service
indisponible. Tes modifications ne sont pas enregistrées. »).

Un import partiellement échoué ne doit rien perdre : les données locales étant conservées,
un nouvel import reste toujours possible.

## Tests

- **`LocalMirror`** isolé : cloisonnement des clés, lecture/écriture, absence de collision
  avec les clés d'invité.
- **Repositories** avec faux client Supabase : CRUD, et surtout **le repli en lecture
  quand le réseau échoue** — c'est le test qui protège l'invariant.
- **Refus d'écriture hors-ligne** : vérifie que l'erreur remonte et n'est pas avalée.
- **`LocalDataImportService`** : remap des ids (`timeline.buildId` pointe bien vers le
  nouvel uuid), build embarqué d'office, pose du flag, non-destruction du local.
- **`WakfuApiService`** : route bien vers le repo local en invité, cloud en connecté.
- **Non-régression** : la suite existante (138 specs) doit rester verte — c'est la preuve
  que les quatre consommateurs n'ont pas bougé.

### Prérequis d'exécution

```bash
cd frontend
export CHROME_BIN="$HOME/.cache/puppeteer/chrome-headless-shell/mac_arm-<version>/chrome-headless-shell-mac-arm64/chrome-headless-shell"
npx ng test --watch=false --browsers=ChromeHeadless
```

Rappel du lot 1 : après toute modification de `frontend/.env`, relancer le serveur ou
`npm run generate:env` — `environment.ts` n'est régénéré qu'au démarrage.

## Trajectoire — lot 3

**Partage & galerie.** Politique RLS de lecture publique sur `timelines` selon
`visibility`, page de browsing avec filtres (« mes timelines » / « publiques »), copie
dans son compte, rejeu d'une timeline publique avec son propre build. Le découplage
`timeline.buildId` (partage « structure seule ») est traité là, la colonne étant déjà
nullable.
