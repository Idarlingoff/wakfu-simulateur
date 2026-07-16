-- Table applicative portant le pseudo : auth.users (gere par Supabase) ne le stocke pas.
-- Ce pseudo signera les timelines publiques au lot 3.

-- citext : l'unicite du pseudo DOIT etre insensible a la casse. En text, "Lilia" et
-- "lilia" coexisteraient — usurpation triviale sur un nom d'auteur public. citext rend
-- aussi le .eq('username', X) du controle d'unicite insensible a la casse cote client,
-- sans quoi ce controle laisserait passer les variantes de casse.
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
  -- Sans pseudo, on echoue explicitement plutot que sur une violation not_null opaque.
  -- Un echec ici annule l'INSERT sur auth.users : c'est voulu (pas de compte sans pseudo),
  -- mais le message doit etre lisible. Cas concret : creation d'un utilisateur depuis le
  -- dashboard Supabase sans renseigner {"username": "..."} dans les metadonnees.
  if new.raw_user_meta_data ->> 'username' is null then
    raise exception 'Inscription refusee : username absent des metadonnees.';
  end if;

  insert into public.profiles (id, username)
  values (new.id, new.raw_user_meta_data ->> 'username');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
