-- Correction : la galerie publique etait toujours vide et la vue partagee affichait
-- "Anonyme".
--
-- Cause : le frontend embarquait `profiles(username)` via PostgREST, mais il n'existe
-- AUCUNE cle etrangere entre timelines et profiles (les deux referencent seulement
-- auth.users). PostgREST ne peut donc pas resoudre l'embed -> erreur PGRST200 -> le repo
-- retombe sur une liste vide. Et get_shared_timeline (0003) ne renvoyait pas de pseudo.
--
-- Solution : deux fonctions dediees qui joignent profiles cote SQL et renvoient le
-- pseudo a plat. SECURITY INVOKER (defaut) : la RLS de l'appelant s'applique, donc un
-- anonyme ne voit que les timelines 'public' (et, par jeton, 'public'/'unlisted').

-- Galerie publique : timelines 'public' + pseudo de l'auteur, filtre classe optionnel.
create function public.get_public_timelines(class_filter text default null)
returns table (
  id           uuid,
  name         text,
  build_id     uuid,
  class_id     text,
  visibility   text,
  share_token  uuid,
  data         jsonb,
  author_username text
)
language sql
stable
set search_path = public
as $$
  select t.id, t.name, t.build_id, t.class_id, t.visibility, t.share_token, t.data,
         p.username
  from public.timelines t
  join public.profiles p on p.id = t.owner_id
  where t.visibility = 'public'
    and (class_filter is null or t.class_id = class_filter)
  order by t.name;
$$;

grant execute on function public.get_public_timelines(text) to anon, authenticated;

-- Remplace get_shared_timeline (0003) pour renvoyer aussi le pseudo de l'auteur.
-- Reste SECURITY DEFINER : l'acces par jeton doit court-circuiter la RLS pour atteindre
-- une 'unlisted', mais uniquement contre presentation du jeton, et jamais une 'private'.
drop function if exists public.get_shared_timeline(uuid);

create function public.get_shared_timeline(token uuid)
returns table (
  id           uuid,
  name         text,
  build_id     uuid,
  class_id     text,
  visibility   text,
  share_token  uuid,
  data         jsonb,
  author_username text
)
language sql
security definer
stable
set search_path = public
as $$
  select t.id, t.name, t.build_id, t.class_id, t.visibility, t.share_token, t.data,
         p.username
  from public.timelines t
  join public.profiles p on p.id = t.owner_id
  where t.share_token = token and t.visibility in ('public', 'unlisted');
$$;

grant execute on function public.get_shared_timeline(uuid) to anon, authenticated;
