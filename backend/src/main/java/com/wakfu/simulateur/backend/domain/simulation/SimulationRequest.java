package com.wakfu.simulateur.backend.domain.simulation;

import java.util.List;

/**
 * Requête de simulation décrivant le contexte et la timeline d'actions.
 */
public record SimulationRequest(
        SimulationContext context,
        List<SpellCastAction> timeline
) {
    public SimulationRequest {
        if (context == null) {
            throw new IllegalArgumentException("Le contexte de simulation est obligatoire");
        }
        timeline = List.copyOf(timeline);
    }
}
