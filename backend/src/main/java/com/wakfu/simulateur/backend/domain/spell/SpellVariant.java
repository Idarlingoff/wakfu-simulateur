package com.wakfu.simulateur.backend.domain.spell;

import java.util.List;

/**
 * Variante jouable d'un sort.
 */
public record SpellVariant(
        VariantKind kind,
        List<SpellEffect> effects
) {
    public SpellVariant {
        effects = List.copyOf(effects);
    }
}
