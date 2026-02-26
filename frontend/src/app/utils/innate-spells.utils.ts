import { Build, SpellReference } from '../models/build.model';

const XELOR_INNATE_SPELL_IDS = ['XEL_DIAL', 'XEL_DISTO', 'XEL_VDT'] as const;

const INNATE_SPELL_ALIASES: Record<string, string> = {
  // Dial / Cadran
  xel_dial: 'XEL_DIAL',
  dial: 'XEL_DIAL',
  cadran: 'XEL_DIAL',
  // Distorsion
  xel_disto: 'XEL_DISTO',
  distorsion: 'XEL_DISTO',
  disto: 'XEL_DISTO',
  // Vol du temps
  xel_vdt: 'XEL_VDT',
  vol_du_temps: 'XEL_VDT',
  'vol du temps': 'XEL_VDT',
  vdt: 'XEL_VDT'
};

function normalizeSpellId(spellId: string | undefined | null): string {
  return (spellId || '').trim().toLowerCase().replace(/-/g, '_');
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

export function canonicalizeInnateSpellId(spellId: string | undefined | null): string {
  const normalized = normalizeSpellId(spellId);
  return INNATE_SPELL_ALIASES[normalized] || (spellId || '').trim();
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
