import { Build, SpellReference } from '../models/build.model';

const XELOR_INNATE_SPELL_IDS = ['XEL_DIAL', 'XEL_DISTO', 'XEL_VDT'] as const;

/**
 * Normalise un ID de sort (trim, minuscules, remplace - par _)
 */
function normalizeSpellId(spellId: string | undefined | null): string {
  return (spellId || '').trim().toLowerCase().replaceAll('-', '_');
}

export function isXelorClass(classId: string | undefined | null): boolean {
  if (!classId) return false;
  const normalized = classId.trim().toUpperCase();
  return normalized === 'XEL' || normalized === 'XELOR';
}

export function getInnateSpellIdsForClass(classId: string | undefined | null): string[] {
  if (isXelorClass(classId)) {
    return [...XELOR_INNATE_SPELL_IDS];
  }
  return [];
}

/**
 * Convertit un ID de sort en son ID canonique
 * Si l'ID est déjà canonique (XEL_*), le retourne tel quel
 * Sinon retourne l'ID normalisé en uppercase
 */
export function canonicalizeInnateSpellId(spellId: string | undefined | null): string {
  if (!spellId) return '';

  const trimmed = spellId.trim();
  const normalized = normalizeSpellId(trimmed);

  if (normalized.startsWith('xel_')) {
    return trimmed.toUpperCase();
  }

  return normalized.toUpperCase();
}

export function areEquivalentSpellIds(a: string | undefined | null, b: string | undefined | null): boolean {
  const canonicalA = canonicalizeInnateSpellId(a).toUpperCase();
  const canonicalB = canonicalizeInnateSpellId(b).toUpperCase();
  return canonicalA.length > 0 && canonicalA === canonicalB;
}

export function buildSpellReferencesWithInnates(build: Build): SpellReference[] {
  const selectedSpellRefs = (build.spellBar?.spells || [])
    .filter((spell): spell is SpellReference => spell !== null)
    .map(spell => ({ ...spell, spellId: canonicalizeInnateSpellId(spell.spellId) }));

  const innateSpellRefs: SpellReference[] = getInnateSpellIdsForClass(build.classId)
    .filter(innateSpellId => !selectedSpellRefs.some(ref => areEquivalentSpellIds(ref.spellId, innateSpellId)))
    .map(spellId => ({ spellId, level: 1 }));

  return [...selectedSpellRefs, ...innateSpellRefs];
}

export function removeInnateSpellsFromSelection(
  classId: string | undefined | null,
  spells: (SpellReference | null)[]
): (SpellReference | null)[] {
  const innateSpellIds = new Set(getInnateSpellIdsForClass(classId));
  return spells.map(spell => {
    if (!spell) return null;
    const isInnate = [...innateSpellIds].some(innateId => areEquivalentSpellIds(spell.spellId, innateId));
    if (isInnate) return null;
    return { ...spell, spellId: canonicalizeInnateSpellId(spell.spellId) };
  });
}
