package com.wakfu.simulateur.backend.domain.simulation;

import com.wakfu.simulateur.backend.domain.spell.Spell;
import com.wakfu.simulateur.backend.domain.spell.VariantKind;

/**
 * Action élémentaire de la timeline représentant le lancement d'un sort.
 */
public record SpellCastAction(
        Spell spell,
        VariantKind variant
) {
    public SpellCastAction {
        if (spell == null) {
            throw new IllegalArgumentException("Le sort est obligatoire");
        }
        if (variant == null) {
            throw new IllegalArgumentException("La variante est obligatoire");
        }
    }

    public static SpellCastAction of(Spell spell, VariantKind variant) {
        return new SpellCastAction(spell, variant);
    }
}
