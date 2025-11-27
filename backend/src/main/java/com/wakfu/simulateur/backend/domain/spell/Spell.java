package com.wakfu.simulateur.backend.domain.spell;

import java.util.List;
import java.util.Optional;

/**
 * Agrégat représentant un sort jouable dans le simulateur.
 */
public record Spell(
        String id,
        String characterClassId,
        String name,
        String element,
        SpellType type,
        int paCost,
        int pwCost,
        int poMin,
        int poMax,
        boolean poModifiable,
        boolean lineOfSight,
        int cooldown,
        int usePerTurn,
        int usePerTarget,
        SpellDirection direction,
        String ratioEvalMode,
        List<SpellVariant> variants,
        List<SpellRatioBreakpoint> breakpoints
) {
    public Spell {
        variants = List.copyOf(variants);
        breakpoints = List.copyOf(breakpoints);
    }

    public Optional<SpellVariant> findVariant(VariantKind kind) {
        return variants.stream().filter(v -> v.kind() == kind).findFirst();
    }
}
