-- Payload en jsonb : Build et Timeline sont des structures imbriquees profondes
-- (spellBar, steps[].actions[], boardSetup.entities), et la simulation tourne
-- integralement cote client. Postgres n'interroge JAMAIS l'interieur d'une timeline :
-- seules sont sorties du JSON les colonnes reellement filtrees.
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
  -- Nullable des maintenant : le lot 3 partagera des timelines "structure seule",
  -- detachees du build de leur auteur. Nullable ici evite une migration plus tard.
  build_id    uuid references public.builds (id) on delete set null,
  name        text not null,
  -- Denormalise depuis le build a l'ecriture. Inutile au lot 2 (une timeline privee
  -- passe par son build_id), indispensable au lot 3 : une timeline partagee est
  -- detachee de son build, et la galerie doit filtrer par classe et verifier que le
  -- build du lecteur est compatible.
  class_id    text,
  -- Colonne presente des maintenant pour eviter une 2e migration au lot 3.
  --
  -- ATTENTION : aucune politique de lecture publique n'est creee ici, volontairement.
  -- Tant que la galerie n'existe pas, une telle politique exposerait des donnees sans
  -- aucune UI pour les controler. Elle viendra au lot 3, avec l'interface qui va avec.
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

-- Proprietaire uniquement, sur les deux tables.
-- Les builds ne seront JAMAIS partages : ce projet n'est pas un builder.
create policy "builds_owner_all" on public.builds
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "timelines_owner_all" on public.timelines
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
