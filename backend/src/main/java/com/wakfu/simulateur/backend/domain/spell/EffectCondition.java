package com.wakfu.simulateur.backend.domain.spell;

import com.fasterxml.jackson.databind.JsonNode;

/**
 * Condition à remplir pour déclencher un effet.
 */
public record EffectCondition(
        String conditionType,
        JsonNode parameters
) {
}
