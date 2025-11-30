package com.wakfu.simulateur.backend.infrastructure.mapper;

import com.wakfu.simulateur.backend.application.dto.SpellDTO;
import com.wakfu.simulateur.backend.infrastructure.entity.*;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.stream.Collectors;

/**
 * Simple mapper: Entity -> DTO for REST API
 */
@Component
public class SpellDTOMapper {

    public SpellDTO toDTO(SpellEntity entity) {
        if (entity == null) return null;

        return SpellDTO.builder()
                .id(entity.getId())
                .classId(entity.getCharacterClass() != null ? entity.getCharacterClass().getId() : null)
                .name(entity.getName())
                .element(entity.getElement())
                .spellType(entity.getSpellType() != null ? entity.getSpellType().name() : null)
                .paCost(entity.getPaCost())
                .pwCost(entity.getPwCost())
                .poMin(entity.getPoMin())
                .poMax(entity.getPoMax())
                .poModifiable(entity.isPoModifiable())
                .lineOfSight(entity.isLineOfSight())
                .cooldown(entity.getCooldown())
                .usePerTurn(entity.getUsePerTurn())
                .usePerTarget(entity.getUsePerTarget())
                .direction(entity.getDirection() != null ? entity.getDirection().name() : null)
                .ratioEvalMode(entity.getRatioEvalMode())
                .variants(toVariantDTOs(entity.getVariants()))
                .breakpoints(toBreakpointDTOs(entity.getBreakpoints()))
                .build();
    }

    public List<SpellDTO> toDTOs(List<SpellEntity> entities) {
        return entities.stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    private List<SpellDTO.SpellVariantDTO> toVariantDTOs(List<SpellVariantEntity> entities) {
        if (entities == null) return List.of();
        return entities.stream()
                .map(v -> SpellDTO.SpellVariantDTO.builder()
                        .id(v.getId())
                        .kind(v.getKind() != null ? v.getKind().name() : null)
                        .effects(toEffectDTOs(v.getEffects()))
                        .build())
                .collect(Collectors.toList());
    }

    private List<SpellDTO.SpellEffectDTO> toEffectDTOs(List<SpellEffectEntity> entities) {
        if (entities == null) return List.of();
        return entities.stream()
                .map(e -> SpellDTO.SpellEffectDTO.builder()
                        .id(e.getId())
                        .ordinal(e.getOrderIndex())
                        .element(null) // Not in current entity structure
                        .effect(e.getEffectType())
                        .targetScope(e.getTargetScope() != null ? e.getTargetScope().name() : null)
                        .durationType(null) // Not in current entity structure
                        .duration(null)
                        .phase(e.getPhase())
                        .cooldown(null)
                        .minValue(null)
                        .maxValue(null)
                        .extendedData(e.getParams())
                        .condGroup(toCondGroupDTO(e.getCondGroup()))
                        .build())
                .collect(Collectors.toList());
    }

    private SpellDTO.EffectConditionGroupDTO toCondGroupDTO(EffectConditionGroupEntity entity) {
        if (entity == null) return null;
        return SpellDTO.EffectConditionGroupDTO.builder()
                .id(entity.getId())
                .operator(entity.getOp())
                .conditions(toConditionDTOs(entity.getConditions()))
                .build();
    }

    private List<SpellDTO.EffectConditionDTO> toConditionDTOs(List<EffectConditionEntity> entities) {
        if (entities == null) return List.of();
        return entities.stream()
                .map(c -> SpellDTO.EffectConditionDTO.builder()
                        .id(c.getId())
                        .code(c.getCondType())
                        .data(c.getParams())
                        .build())
                .collect(Collectors.toList());
    }

    private List<SpellDTO.SpellRatioBreakpointDTO> toBreakpointDTOs(List<SpellRatioBreakpointEntity> entities) {
        if (entities == null) return List.of();
        return entities.stream()
                .map(b -> SpellDTO.SpellRatioBreakpointDTO.builder()
                        .id(null) // Composite key, not a simple Long
                        .threshold(b.getId() != null ? b.getId().getLvl() : 0)
                        .ratio(b.getRatio())
                        .build())
                .collect(Collectors.toList());
    }
}

