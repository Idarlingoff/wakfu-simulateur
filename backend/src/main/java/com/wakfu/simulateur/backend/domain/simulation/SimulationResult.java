package com.wakfu.simulateur.backend.domain.simulation;

import java.util.List;

/**
 * Résultat global de la simulation.
 */
public record SimulationResult(
        SimulationContext initialContext,
        int remainingPa,
        int remainingPw,
        int currentHour,
        int hourWraps,
        List<ActionResult> actions
) {
    public SimulationResult {
        if (initialContext == null) {
            throw new IllegalArgumentException("Le contexte initial est obligatoire");
        }
        if (currentHour < 1 || currentHour > 12) {
            throw new IllegalArgumentException("L'heure courante doit être comprise entre 1 et 12");
        }
        if (hourWraps < 0) {
            throw new IllegalArgumentException("Le nombre de tours de cadran ne peut pas être négatif");
        }
        actions = List.copyOf(actions);
    }

    public boolean hasFailure() {
        return actions.stream().anyMatch(result -> result.status() == ActionStatus.FAILED);
    }
}
