package com.wakfu.simulateur.backend.domain.simulation;

import java.util.List;

/**
 * Résultat global de la simulation.
 */
public record SimulationResult(
        SimulationContext initialContext,
        int remainingPa,
        int remainingPw,
        List<ActionResult> actions
) {
    public SimulationResult {
        if (initialContext == null) {
            throw new IllegalArgumentException("Le contexte initial est obligatoire");
        }
        actions = List.copyOf(actions);
    }

    public boolean hasFailure() {
        return actions.stream().anyMatch(result -> result.status() == ActionStatus.FAILED);
    }
}
