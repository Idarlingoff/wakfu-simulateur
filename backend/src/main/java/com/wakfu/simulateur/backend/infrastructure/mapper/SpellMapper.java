package com.wakfu.simulateur.backend.infrastructure.mapper;

import com.wakfu.simulateur.backend.domain.spell.*;
import com.wakfu.simulateur.backend.infrastructure.entity.EffectConditionEntity;
import com.wakfu.simulateur.backend.infrastructure.entity.EffectConditionGroupEntity;
import com.wakfu.simulateur.backend.infrastructure.entity.SpellEffectEntity;
import com.wakfu.simulateur.backend.infrastructure.entity.SpellEntity;
import com.wakfu.simulateur.backend.infrastructure.entity.SpellRatioBreakpointEntity;
import com.wakfu.simulateur.backend.infrastructure.entity.SpellVariantEntity;
import org.springframework.stereotype.Component;

import java.util.Comparator;
import java.util.List;
import java.util.Optional;

@Component
public class SpellMapper {

    public Spell toDomain(SpellEntity entity) {
        List<SpellVariant> variants = entity.getVariants().stream()
                .sorted(Comparator.comparing(v -> v.getKind().name()))
                .map(this::mapVariant)
                .toList();

        List<SpellRatioBreakpoint> breakpoints = entity.getBreakpoints().stream()
                .sorted(Comparator.comparingInt(bp -> bp.getId().getLvl()))
                .map(this::mapBreakpoint)
                .toList();

        return new Spell(
                entity.getId(),
                entity.getCharacterClass().getId(),
                entity.getName(),
                entity.getElement(),
                SpellType.valueOf(entity.getSpellType().name()),
                entity.getPaCost(),
                entity.getPwCost(),
                entity.getPoMin(),
                entity.getPoMax(),
                entity.isPoModifiable(),
                entity.isLineOfSight(),
                entity.getCooldown(),
                entity.getUsePerTurn(),
                entity.getUsePerTarget(),
                SpellDirection.valueOf(entity.getDirection().name()),
                entity.getRatioEvalMode(),
                variants,
                breakpoints
        );
    }

    private SpellVariant mapVariant(SpellVariantEntity entity) {
        List<SpellEffect> effects = entity.getEffects().stream()
                .sorted(Comparator.comparingInt(SpellEffectEntity::getOrderIndex))
                .map(this::mapEffect)
                .toList();

        return new SpellVariant(VariantKind.valueOf(entity.getKind().name()), effects);
    }

    private SpellEffect mapEffect(SpellEffectEntity entity) {
        Optional<EffectConditionGroup> condGroup = Optional.ofNullable(entity.getCondGroup())
                .map(this::mapCondGroup);

        return new SpellEffect(
                entity.getPhase(),
                entity.getOrderIndex(),
                entity.getEffectType(),
                TargetScope.valueOf(entity.getTargetScope().name()),
                entity.getParams(),
                condGroup
        );
    }

    private EffectConditionGroup mapCondGroup(EffectConditionGroupEntity entity) {
        List<EffectCondition> conditions = entity.getConditions().stream()
                .sorted(Comparator.comparing(EffectConditionEntity::getId))
                .map(this::mapCondition)
                .toList();

        return new EffectConditionGroup(entity.getOp(), conditions);
    }

    private EffectCondition mapCondition(EffectConditionEntity entity) {
        return new EffectCondition(entity.getCondType(), entity.getParams());
    }

    private SpellRatioBreakpoint mapBreakpoint(SpellRatioBreakpointEntity entity) {
        return new SpellRatioBreakpoint(entity.getId().getLvl(), entity.getRatio());
    }
}
