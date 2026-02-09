/**
 * Mechanism Utilities
 * Fonctions utilitaires pour gérer les mécanismes Xélor
 */

/**
 * Map spell ID to mechanism type
 */
export function getSpellMechanismType(spellId: string): 'cog' | 'sinistro' | 'dial' | 'regulateur' | null {
  const spellIdLower = spellId.toLowerCase();

  console.log(`🔎 Detection mécanisme pour spell: "${spellId}" (lowercase: "${spellIdLower}")`);

  // Rouage - cog/gear
  if (spellIdLower.includes('rouage') || spellIdLower === 'cog' || spellIdLower === 'gear') {
    console.log('  ✅ Détecté comme ROUAGE (cog)');
    return 'cog';
  }

  // Cadran - dial (ATTENTION: le sort pourrait avoir différents noms)
  if (spellIdLower.includes('cadran') ||
      spellIdLower.includes('dial')) {
    console.log('  ✅ Détecté comme CADRAN (dial)');
    return 'dial';
  }

  // Sinistro
  if (spellIdLower.includes('sinistro')) {
    console.log('  ✅ Détecté comme SINISTRO');
    return 'sinistro';
  }

  // Régulateur
  if (spellIdLower.includes('regulateur') || spellIdLower.includes('regulator')) {
    console.log('  ✅ Détecté comme REGULATEUR');
    return 'regulateur';
  }

  console.log('  ❌ Aucun mécanisme détecté');
  return null;
}

/**
 * Check if a spell creates a mechanism
 */
export function isSpellMechanism(spellId: string): boolean {
  return getSpellMechanismType(spellId) !== null;
}

/**
 * Get mechanism display name
 */
export function getMechanismDisplayName(type: string): string {
  switch (type) {
    case 'cog':
    case 'gear':
      return 'Rouage';
    case 'dial':
      return 'Cadran';
    case 'sinistro':
      return 'Sinistro';
    case 'regulateur':
      return 'Régulateur';
    default:
      return 'Mécanisme';
  }
}

/**
 * Get mechanism image path
 */
export function getMechanismImagePath(type: string, _charges?: number): string {
  switch (type) {
    case 'cog':
    case 'gear':
      // Utilise toujours rouage.png - le CSS gère la teinte bleue quand il y a des charges
      return 'resources/rouage.png';
    case 'dial':
      return 'resources/dial/dial-center.png';
    case 'sinistro':
      return 'resources/sinistro.png';
    case 'regulateur':
      return 'resources/regulateur.png';
    default:
      return 'resources/rouage.png';
  }
}

/**
 * Get dial hour image path (for specific dial positions)
 */
export function getDialHourImagePath(hour: number): string {
  if (hour < 1 || hour > 12) {
    return 'resources/dial/dial-center.png';
  }
  return `resources/dial/dial_hours-${hour}.png`;
}

/**
 * Calcule les positions des 12 heures autour du cadran
 * Les heures sont à 3 cases de distance du centre
 * @param centerX Position X du cadran central
 * @param centerY Position Y du cadran central
 * @returns Array de 12 positions pour chaque heure (index 0 = heure 1, etc.)
 */
export function calculateDialHourPositions(centerX: number, centerY: number): Array<{hour: number, x: number, y: number}> {
  const radius = 3; // Distance de 3 cases

  // Positions des heures comme sur une horloge (sens horaire à partir de 12h)
  // Basé sur les positions exactes de Wakfu
  return [
    { hour: 12, x: centerX, y: centerY - radius },      // 12h : (0, -3) Nord
    { hour: 1, x: centerX + 1, y: centerY - 2 },        // 1h : (+1, -2)
    { hour: 2, x: centerX + 2, y: centerY - 1 },        // 2h : (+2, -1)
    { hour: 3, x: centerX + radius, y: centerY },       // 3h : (+3, 0) Est
    { hour: 4, x: centerX + 2, y: centerY + 1 },        // 4h : (+2, +1)
    { hour: 5, x: centerX + 1, y: centerY + 2 },        // 5h : (+1, +2)
    { hour: 6, x: centerX, y: centerY + radius },       // 6h : (0, +3) Sud
    { hour: 7, x: centerX - 1, y: centerY + 2 },        // 7h : (-1, +2)
    { hour: 8, x: centerX - 2, y: centerY + 1 },        // 8h : (-2, +1)
    { hour: 9, x: centerX - radius, y: centerY },       // 9h : (-3, 0) Ouest
    { hour: 10, x: centerX - 2, y: centerY - 1 },       // 10h : (-2, -1)
    { hour: 11, x: centerX - 1, y: centerY - 2 },       // 11h : (-1, -2)
  ];
}

/**
 * Vérifie si une position est valide sur le plateau (13x13)
 */
export function isValidPosition(x: number, y: number): boolean {
  return x >= 0 && x < 13 && y >= 0 && y < 13;
}
