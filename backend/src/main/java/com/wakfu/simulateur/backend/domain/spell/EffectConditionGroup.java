package com.wakfu.simulateur.backend.domain.spell;

import java.util.List;

/**
 * Groupe de conditions (ET/OU) associé à un effet.
 */
public record EffectConditionGroup(
        String operator,
        List<EffectCondition> conditions
) {
    public EffectConditionGroup {
        conditions = List.copyOf(conditions);
    }
}
