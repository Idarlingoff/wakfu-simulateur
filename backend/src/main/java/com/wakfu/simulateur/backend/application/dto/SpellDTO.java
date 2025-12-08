package com.wakfu.simulateur.backend.application.dto;

import lombok.*;

import java.util.List;

/**
 * Simple DTO for Spell data - Frontend will handle all logic
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SpellDTO {
    private String id;
    private String classId;
    private String name;
    private String element;
    private String spellType;
    private int paCost;
    private int pwCost;
    private int poMin;
    private int poMax;
    private boolean poModifiable;
    private boolean lineOfSight;
    private int cooldown;
    private int usePerTurn;
    private int usePerTarget;
    private String direction;
    private String ratioEvalMode;
    private List<SpellVariantDTO> variants;
    private List<SpellRatioBreakpointDTO> breakpoints;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SpellVariantDTO {
        private Long id;
        private String kind;
        private List<SpellEffectDTO> effects;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SpellEffectDTO {
        private Long id;
        private int ordinal;
        private String element;
        private String effect;
        private String targetScope;
        private String durationType;
        private Integer duration;
        private String phase;
        private Integer cooldown;
        private Double minValue;
        private Double maxValue;
        private Object extendedData; // JsonNode
        private EffectConditionGroupDTO condGroup;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class EffectConditionGroupDTO {
        private Long id;
        private String operator;
        private List<EffectConditionDTO> conditions;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class EffectConditionDTO {
        private Long id;
        private String code;
        private Object data; // JsonNode
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SpellRatioBreakpointDTO {
        private Long id;
        private int threshold;
        private double ratio;
    }
}



