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
-- enumerables via l'API REST (/rest/v1/timelines?select=*).
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
