package com.wakfu.simulateur.backend.application.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.*;

import java.util.List;

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
    private Integer iconId;
    @JsonProperty("isAoe")
    private boolean isAoe;
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
        private Object extendedData;
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
        private Object data;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SpellRatioBreakpointDTO {
        private String kind;
        private int lvl;
        private int ratio;
    }
}



