package com.wakfu.simulateur.backend.domain.spell;

import com.fasterxml.jackson.databind.JsonNode;

import java.util.Optional;

/**
 * Effet élémentaire d'un sort.
 */
public record SpellEffect(
        String phase,
        int orderIndex,
        String effectType,
        TargetScope targetScope,
        JsonNode parameters,
        Optional<EffectConditionGroup> conditionGroup
) {
    public SpellEffect {
        conditionGroup = conditionGroup == null ? Optional.empty() : conditionGroup;
    }
}
