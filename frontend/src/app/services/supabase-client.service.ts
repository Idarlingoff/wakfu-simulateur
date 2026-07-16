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
