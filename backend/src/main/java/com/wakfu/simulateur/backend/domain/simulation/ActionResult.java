package com.wakfu.simulateur.backend.domain.simulation;

import com.wakfu.simulateur.backend.domain.spell.Spell;
import com.wakfu.simulateur.backend.domain.spell.SpellVariant;
import com.wakfu.simulateur.backend.domain.spell.VariantKind;

import java.util.Optional;

/**
 * Résultat d'une action exécutée durant la simulation.
 */
public record ActionResult(
        ActionStatus status,
        Spell spell,
        VariantKind requestedVariant,
        Optional<SpellVariant> resolvedVariant,
        int paCost,
        int pwCost,
        Optional<String> message
) {
    public ActionResult {
        if (status == null) {
            throw new IllegalArgumentException("Le statut est obligatoire");
        }
        if (spell == null) {
            throw new IllegalArgumentException("Le sort est obligatoire");
        }
        if (requestedVariant == null) {
            throw new IllegalArgumentException("La variante demandée est obligatoire");
        }
        resolvedVariant = resolvedVariant == null ? Optional.empty() : resolvedVariant;
        message = message == null ? Optional.empty() : message;
    }

    public static ActionResult success(Spell spell, SpellVariant variant, int paCost, int pwCost) {
        return new ActionResult(ActionStatus.SUCCESS, spell, variant.kind(), Optional.of(variant), paCost, pwCost, Optional.empty());
    }

    public static ActionResult failure(Spell spell, VariantKind requestedVariant, int paCost, int pwCost, String message) {
        return new ActionResult(ActionStatus.FAILED, spell, requestedVariant, Optional.empty(), paCost, pwCost, Optional.ofNullable(message));
    }
}
