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
        Optional<String> message,
        int resultingHour,
        int totalHourWraps
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
        if (resultingHour < 1 || resultingHour > 12) {
            throw new IllegalArgumentException("L'heure résultante doit être comprise entre 1 et 12");
        }
        if (totalHourWraps < 0) {
            throw new IllegalArgumentException("Le nombre de tours de cadran ne peut pas être négatif");
        }
    }

    public static ActionResult success(Spell spell, SpellVariant variant, int paCost, int pwCost, int resultingHour, int totalHourWraps) {
        return new ActionResult(ActionStatus.SUCCESS, spell, variant.kind(), Optional.of(variant), paCost, pwCost, Optional.empty(), resultingHour, totalHourWraps);
    }

    public static ActionResult failure(Spell spell, VariantKind requestedVariant, int paCost, int pwCost, String message, int resultingHour, int totalHourWraps) {
        return new ActionResult(ActionStatus.FAILED, spell, requestedVariant, Optional.empty(), paCost, pwCost, Optional.ofNullable(message), resultingHour, totalHourWraps);
    }
}
