package com.wakfu.simulateur.backend.infrastructure.mapper;

import com.wakfu.simulateur.backend.application.dto.PassiveDTO;
import com.wakfu.simulateur.backend.infrastructure.entity.PassiveEffectEntity;
import com.wakfu.simulateur.backend.infrastructure.entity.PassiveEntity;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.stream.Collectors;

/**
 * Simple mapper: Entity -> DTO for REST API
 */
@Component
public class PassiveDTOMapper {

    public PassiveDTO toDTO(PassiveEntity entity) {
        if (entity == null) return null;

        return PassiveDTO.builder()
                .id(entity.getId())
                .classId(entity.getCharacterClass() != null ? entity.getCharacterClass().getId() : null)
                .name(entity.getName())
                .description(entity.getDescription())
                .effects(toEffectDTOs(entity.getEffects()))
                .build();
    }

    public List<PassiveDTO> toDTOs(List<PassiveEntity> entities) {
        return entities.stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    private List<PassiveDTO.PassiveEffectDTO> toEffectDTOs(List<PassiveEffectEntity> entities) {
        if (entities == null) return List.of();
        return entities.stream()
                .map(e -> PassiveDTO.PassiveEffectDTO.builder()
                        .id(e.getId())
                        .ordinal(e.getOrderIndex())
                        .stat(e.getEffectType())
                        .value(0) // Not directly available in current structure
                        .build())
                .collect(Collectors.toList());
    }
}

