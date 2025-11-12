package com.wakfu.simulateur.backend.domain.simulation;

/**
 * Contexte de départ pour une simulation (ressources disponibles, ...).
 */
public record SimulationContext(
        int availablePa,
        int availablePm,
        int availablePw
) {
    public SimulationContext {
        if (availablePa < 0 || availablePm < 0 || availablePw < 0) {
            throw new IllegalArgumentException("Les ressources initiales doivent être positives");
        }
    }
}
