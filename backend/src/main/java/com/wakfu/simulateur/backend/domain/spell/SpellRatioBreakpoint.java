package com.wakfu.simulateur.backend.domain.spell;

/**
 * Ratio de dégâts pour un niveau donné.
 */
public record SpellRatioBreakpoint(
        int level,
        int ratio
) {
}
