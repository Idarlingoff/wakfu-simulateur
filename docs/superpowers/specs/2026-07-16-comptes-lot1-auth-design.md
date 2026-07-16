# Design — Comptes utilisateurs, lot 1 : Auth

**Date :** 2026-07-16
**Branche :** `feat_account`
**Statut :** Validé, prêt pour plan d'implémentation

## Besoin

Aujourd'hui, builds et timelines vivent dans le `localStorage` du navigateur : rien
ne survit à un changement d'appareil ou à un vidage de cache, et rien ne peut être
partagé. L'objectif global est double :

1. rendre les données **persistantes** (builds et timelines rattachés à un compte) ;
2. permettre aux joueurs de **partager leurs timelines** (pas les builds — ce projet
   n'est pas un builder).

Ce document couvre **uniquement le lot 1 : l'authentification**. Les lots 2 et 3 sont
décrits en fin de document pour donner la trajectoire, mais ne sont pas spécifiés ici.

## Contexte technique existant

L'exploration a révélé trois faits qui cadrent tout le reste :

- **L'application est 100 % statique.** Le frontend ne parle pas au backend : les sorts
  et passifs sont chargés depuis des assets JSON (`assets/data/Spells.json`,
  `assets/data/Passives.json`), les builds/timelines depuis `localStorage`
  (`wakfu_builds`, `wakfu_timelines`). Le déploiement est `npm run deploy` → GitHub Pages.
- **Le backend Spring Boot + H2 est du code mort côté produit.** Il n'expose que
  `SpellController` / `PassiveController`, que le frontend n'appelle jamais, et ses tests
  sont désactivés (`backend/src/test/java.backup`). Sa base H2 est un fichier local
  (`jdbc:h2:~/wakfu-db/wakfu`), mono-utilisateur, non déployable en l'état.
- **`WakfuApiService` est déjà la couche d'abstraction du stockage** : builds et
  timelines y transitent tous. C'est la couture par laquelle la persistance cloud
  s'insérera au lot 2, sans toucher `BuildService` ni `TimelineService`.

Conséquence : GitHub Pages ne peut héberger ni serveur ni base. Des comptes et des
timelines partagées imposent une infrastructure hébergée en permanence.

## Décisions de cadrage

| Sujet | Décision |
|-------|----------|
| Infrastructure | **Supabase** (auth + Postgres managés). Le front reste statique sur GitHub Pages. Le backend Java n'est pas réanimé. |
| Mode invité | **Conservé.** On simule sans compte, données en `localStorage` comme aujourd'hui. Le compte sert à sauvegarder dans le cloud et à publier. |
| Méthode d'auth | **Email + mot de passe uniquement.** Pas d'OAuth pour l'instant (YAGNI). Pseudo demandé à l'inscription. |
| Confirmation d'email | **Requise.** L'utilisateur doit cliquer le lien reçu avant de pouvoir se connecter. |
| Partage de timeline | **Structure seule** : séquence d'actions + board. Aucune donnée de build ne quitte le navigateur. Le lecteur rejoue avec *son* build. |
| Visibilité timeline | **Privé / Lien non listé / Public** (lot 3). |
| Copie de timeline | **Autorisée**, copie simple et indépendante, sans filiation (lot 3). |
| Builds | **Privés dans le compte** (lot 2). Jamais partageables ni visibles par autrui. |
| Migration des données locales | **Import opt-in** à la première connexion, non destructif (lot 2). |
| Stratégie de stockage | **Approche A** : pattern repository derrière `WakfuApiService`, deux implémentations (localStorage / Supabase) choisies selon l'état d'auth (lot 2). |

### Approches écartées

- **Auth anonyme Supabase** (un seul chemin de code, migration native par liaison du
  compte anonyme) : imposerait une connexion réseau à des visiteurs qui utilisent
  aujourd'hui l'outil entièrement côté client, créerait une ligne en base par visiteur
  de passage, et ne supprimerait pas le besoin d'importer les données `localStorage`
  déjà existantes. Prix fort sans résoudre le problème.
- **Offline-first avec sync bidirectionnelle** : meilleure UX sur le papier, mais impose
  la résolution de conflits (même timeline modifiée sur deux appareils). Projet en soi,
  YAGNI tant qu'aucun utilisateur ne le réclame.
- **Réanimer le backend Spring Boot** : cohérent avec la stack décrite dans `CLAUDE.md`,
  mais impose d'écrire l'auth soi-même (hashing, JWT, reset) — la partie la plus facile
  à rater côté sécurité — pour un backend aujourd'hui inutilisé.

## Périmètre du lot 1

**Dans le périmètre :** créer un compte, confirmer son email, se connecter, se
déconnecter, demander une réinitialisation de mot de passe, et voir son état de
connexion dans l'interface.

**Explicitement hors périmètre :** aucun changement de stockage. Builds et timelines
restent en `localStorage`, y compris pour un utilisateur connecté. Le lot 1 est neutre
pour les données — c'est ce qui en fait le meilleur endroit où se tromper.

**Pas de guard de route dans ce lot.** Il n'y a rien à protéger tant que les données
sont locales et que le mode invité est entier. Le guard arrivera avec le lot 2/3, quand
« mes timelines » existera réellement.

## Architecture

### 1. `SupabaseClientService`

Possède l'unique instance du client `@supabase/supabase-js`, et rien d'autre. C'est le
seul fichier de l'application qui connaît l'URL et la clé du projet.

L'`anon key` sera présente dans le bundle : **c'est le fonctionnement nominal de
Supabase**, cette clé est publique par design et la sécurité repose entièrement sur les
politiques RLS, jamais sur son secret. Il faut créer `src/environments/`
(`environment.ts` / `environment.production.ts`), inexistant aujourd'hui, et brancher
le `fileReplacements` correspondant dans `angular.json`.

### 2. `AuthService`

L'unique point de contact entre l'application et l'authentification. Aucun composant ne
touche Supabase directement.

Suit le pattern des services existants (cf. `theme.service.ts`) : `providedIn: 'root'`,
signals privés exposés en lecture via `.asReadonly()`.

État exposé :
- `status` : `'loading' | 'authenticated' | 'anonymous'`
- `user` : l'utilisateur Supabase courant, ou `null`
- `profile` : le profil applicatif (dont le pseudo), ou `null`

Actions : `signUp(email, password, username)`, `signIn(email, password)`, `signOut()`,
`requestPasswordReset(email)`.

L'état `'loading'` est nécessaire : au rafraîchissement, la restauration de session est
asynchrone, et sans lui la sidebar afficherait brièvement « Se connecter » à un
utilisateur déjà connecté.

### 3. Table `profiles`

`auth.users` (géré par Supabase) ne stocke pas de pseudo. Une table applicative le porte :

| Colonne | Type | Contrainte |
|---|---|---|
| `id` | `uuid` | PK, FK → `auth.users.id`, `on delete cascade` |
| `username` | `text` | **unique**, non nul |
| `created_at` | `timestamptz` | défaut `now()` |

Alimentée par un trigger `on_auth_user_created` qui lit le pseudo depuis les métadonnées
de l'inscription. Ce pseudo signera les timelines publiques au lot 3.

**RLS :** lecture publique (nécessaire pour afficher l'auteur d'une timeline publique au
lot 3), écriture restreinte au propriétaire (`auth.uid() = id`).

### 4. Routes et composants

| Route | Composant | Rôle |
|---|---|---|
| `/connexion` | `LoginPageComponent` | email + mot de passe, lien « mot de passe oublié » |
| `/inscription` | `SignupPageComponent` | email + mot de passe + pseudo |
| `/mot-de-passe-oublie` | `PasswordResetPageComponent` | demande du mail de réinitialisation |

Routes en français, cohérentes avec l'existant (`/accueil`, `/builds`, `/timelines`).
Composants standalone, Reactive Forms.

Dans `app-sidebar.component.ts`, une entrée en pied de navigation : « Se connecter » si
invité, sinon le pseudo + « Se déconnecter ». La logique de formulaire vit dans les
composants, toute la logique d'auth dans `AuthService`.

## Flux de données

**Démarrage** — `AuthService` s'abonne à `onAuthStateChange` de Supabase, qui restaure
la session depuis son propre stockage. `status` passe de `'loading'` à `'authenticated'`
ou `'anonymous'`, les signals se peuplent, la sidebar réagit.

**Inscription** — le pseudo est d'abord validé pour unicité (requête sur `profiles`),
afin de rendre une erreur de champ exploitable plutôt qu'une violation de contrainte
brute. Puis `signUp` avec le pseudo en métadonnées → le trigger crée la ligne `profiles`
→ Supabase envoie le mail de confirmation → l'utilisateur atterrit sur un écran
« vérifie tes mails ». Le compte n'est pas utilisable avant confirmation.

**Connexion** — `signIn` → session établie → le profil est chargé → redirection vers
l'accueil.

**Déconnexion** — `signOut()` → signals vidés → retour à l'état invité. **Le
`localStorage` métier n'est pas purgé** : les builds et timelines locaux survivent à la
déconnexion.

## Gestion d'erreurs

Le point non négociable : **une panne d'authentification ne doit jamais casser le
simulateur.** Supabase injoignable, session expirée, navigateur hors-ligne → on retombe
silencieusement en mode invité, et builds / timelines / simulation continuent de
fonctionner exactement comme aujourd'hui. `AuthService` n'est jamais dans le chemin
critique de la simulation.

Les erreurs Supabase sont traduites en messages français exploitables, jamais affichées
brutes :

| Cas | Message |
|---|---|
| `Invalid login credentials` | « Email ou mot de passe incorrect. » |
| Email déjà utilisé | « Un compte existe déjà avec cet email. » |
| Pseudo déjà pris | « Ce pseudo est déjà utilisé. » (erreur de champ) |
| Mot de passe trop court | « Le mot de passe doit faire au moins 8 caractères. » |
| Email non confirmé | « Confirme ton email avant de te connecter. » |
| Réseau indisponible | « Service indisponible, tu peux continuer sans compte. » |

## Tests

- **`AuthService`** avec un faux client Supabase : transitions d'état
  (`loading → authenticated / anonymous`), mapping des erreurs, et surtout **le repli en
  mode invité quand Supabase échoue** — c'est le test qui protège l'invariant central.
- **Composants** : validation des champs, affichage des erreurs, désactivation du bouton
  de soumission pendant l'appel.
- **Non testé** (dépend de l'infra Supabase réelle, vérifié manuellement) : envoi effectif
  des mails de confirmation et de reset, exécution du trigger `on_auth_user_created`.

### Prérequis d'exécution

`ng test` ne fonctionne pas en l'état sur la machine de dev : aucun Chrome installé, et
Arc ne supporte pas le mode headless. Il faut un binaire dédié :

```bash
npx --yes puppeteer@latest browsers install chrome-headless-shell
export CHROME_BIN="$HOME/.cache/puppeteer/chrome-headless-shell/mac_arm-<version>/chrome-headless-shell-mac-arm64/chrome-headless-shell"
npx ng test --watch=false --browsers=ChromeHeadless
```

## Trajectoire — lots suivants

Chaque lot fera l'objet de son propre spec → plan → implémentation.

- **Lot 2 — Persistance cloud.** Pattern repository derrière `WakfuApiService` (deux
  implémentations : `localStorage` / Supabase, sélectionnées selon l'état d'auth). Tables
  `builds` et `timelines` + RLS propriétaire. Écran d'import opt-in des données locales à
  la première connexion. Livrable : connecté = données cloud multi-appareil ; invité =
  comportement actuel inchangé.
- **Lot 3 — Partage & galerie.** Visibilité privé / lien / public, page de browsing avec
  filtres (« mes timelines » / « publiques »), copie dans son compte, rejeu avec son
  propre build. Le découplage `Timeline.buildId` est traité ici : une timeline partagée ne
  référence plus le build de son auteur, et porte un `classId` pour filtrer la galerie et
  valider la compatibilité du build du lecteur.
