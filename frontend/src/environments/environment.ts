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
