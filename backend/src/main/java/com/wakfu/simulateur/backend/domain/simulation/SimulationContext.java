package com.wakfu.simulateur.backend.domain.simulation;

/**
 * Contexte de départ pour une simulation (ressources disponibles, ...).
 */
public record SimulationContext(
        int availablePa,
        int availablePm,
        int availablePw,
        int currentHour
) {
    public SimulationContext {
        if (availablePa < 0 || availablePm < 0 || availablePw < 0) {
            throw new IllegalArgumentException("Les ressources initiales doivent être positives");
        }
        if (currentHour < 1 || currentHour > 12) {
            throw new IllegalArgumentException("L'heure courante doit être comprise entre 1 et 12");
        }
    }
}
