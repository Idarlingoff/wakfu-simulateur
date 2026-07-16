#!/usr/bin/env node
/**
 * Genere src/environments/environment.ts a partir de frontend/.env.
 *
 * Pourquoi un generateur plutot qu'un fichier commite : garder les valeurs du projet
 * Supabase hors de git (rotation simple, repo public, pas de commit accidentel).
 *
 * ATTENTION — ceci ne rend PAS l'anon key secrete. L'application est un SPA statique :
 * la cle est inlinee dans le bundle que chaque visiteur telecharge, et lisible en trois
 * clics dans les devtools. C'est le fonctionnement nominal de Supabase (cle "anon",
 * publique par design) : la securite repose ENTIEREMENT sur les politiques RLS cote
 * Postgres. La cle a proteger reellement est service_role, qui contourne RLS et ne doit
 * jamais approcher le frontend — ce script echoue d'ailleurs s'il la trouve dans .env.
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const ENV_FILE = path.join(ROOT, '.env');
const OUT_FILE = path.join(ROOT, 'src', 'environments', 'environment.ts');

const PLACEHOLDER_URL = 'https://REMPLACER.supabase.co';
const PLACEHOLDER_KEY = 'REMPLACER_PAR_ANON_KEY';

/** Parseur .env minimal : KEY=VALUE, # commentaires, guillemets optionnels. */
function parseEnv(content) {
  const vars = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const separator = trimmed.indexOf('=');
    if (separator === -1) {
      continue;
    }
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    const quoted =
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"));
    if (quoted && value.length >= 2) {
      value = value.slice(1, -1);
    }
    vars[key] = value;
  }
  return vars;
}

/**
 * Lit le claim "role" d'une cle Supabase, ou null si illisible.
 *
 * Les cles Supabase historiques sont des JWT dont le payload porte le role en clair
 * ("anon" ou "service_role"). On le lit sans verifier la signature : on ne cherche pas
 * a authentifier la cle, seulement a refuser celle qui ne doit pas etre publiee.
 */
function readKeyRole(key) {
  const payload = key.split('.')[1];
  if (!payload) {
    return null;
  }
  try {
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(Buffer.from(normalized, 'base64').toString()).role ?? null;
  } catch {
    return null;
  }
}

/**
 * Refuse toute cle qui contourne RLS.
 *
 * Verifier le NOM de la variable ne suffit pas : l'erreur la plus probable est de coller
 * la cle service_role dans SUPABASE_ANON_KEY, les deux etant cote a cote dans le
 * dashboard. On inspecte donc la cle elle-meme.
 */
function assertNotServiceRole(key) {
  const role = readKeyRole(key);
  const isLegacyServiceRole = role === 'service_role';
  const isNewSecretKey = key.startsWith('sb_secret_');

  if (isLegacyServiceRole || isNewSecretKey) {
    console.error('[generate-env] ERREUR : SUPABASE_ANON_KEY contient une cle secrete');
    console.error(`[generate-env] (${isNewSecretKey ? 'prefixe sb_secret_' : 'role=service_role'}).`);
    console.error('[generate-env] Elle contourne RLS et serait publiee dans le bundle,');
    console.error('[generate-env] donc lisible par tous les visiteurs. Utilise l\'anon key.');
    process.exit(1);
  }

  if (role && role !== 'anon') {
    console.warn(`[generate-env] Cle au role inattendu : "${role}" (attendu "anon").`);
  }
}

function resolveConfig() {
  if (!fs.existsSync(ENV_FILE)) {
    // Pas de .env : on genere des placeholders pour que build et tests tournent quand
    // meme (clone frais, CI). L'app ne joindra pas Supabase et restera en mode invite,
    // ce qui est exactement le comportement de repli attendu.
    console.warn('[generate-env] .env absent — placeholders utilises (mode invite).');
    console.warn('[generate-env] Copie .env.example en .env pour brancher ton projet.');
    return { url: PLACEHOLDER_URL, key: PLACEHOLDER_KEY };
  }

  const vars = parseEnv(fs.readFileSync(ENV_FILE, 'utf8'));

  // Garde-fou : la cle service_role contourne RLS. Dans un SPA statique elle serait
  // publiee a tous les visiteurs et annulerait toute la securite du projet.
  if (vars.SUPABASE_SERVICE_ROLE_KEY || vars.SUPABASE_SERVICE_KEY) {
    console.error('[generate-env] ERREUR : une cle service_role figure dans .env.');
    console.error('[generate-env] Elle contourne RLS et serait publiee dans le bundle.');
    console.error('[generate-env] Retire-la : le frontend n\'utilise QUE l\'anon key.');
    process.exit(1);
  }

  if (!vars.SUPABASE_URL || !vars.SUPABASE_ANON_KEY) {
    console.warn('[generate-env] SUPABASE_URL et/ou SUPABASE_ANON_KEY manquants dans .env.');
  }

  if (vars.SUPABASE_ANON_KEY) {
    assertNotServiceRole(vars.SUPABASE_ANON_KEY);
  }

  return {
    url: vars.SUPABASE_URL || PLACEHOLDER_URL,
    key: vars.SUPABASE_ANON_KEY || PLACEHOLDER_KEY,
  };
}

const { url, key } = resolveConfig();

// JSON.stringify pour produire un litteral JS correctement echappe.
const content = `// GENERE AUTOMATIQUEMENT par scripts/generate-env.js — NE PAS EDITER, NE PAS COMMITER.
// Valeurs issues de frontend/.env (modele : .env.example). Regenere a chaque start/build/test.
//
// L'anon key est publique par design : elle est inlinee dans le bundle telecharge par
// chaque visiteur. La securite repose entierement sur les politiques RLS cote Postgres.
export const environment = {
  supabaseUrl: ${JSON.stringify(url)},
  supabaseAnonKey: ${JSON.stringify(key)},
};
`;

fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
fs.writeFileSync(OUT_FILE, content);

const source = url === PLACEHOLDER_URL ? 'placeholders' : '.env';
console.log(`[generate-env] src/environments/environment.ts genere depuis ${source}.`);
