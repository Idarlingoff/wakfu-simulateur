package com.wakfu.simulateur.backend.application.dto;

import lombok.*;

import java.util.List;

/**
 * Simple DTO for Passive data - Frontend will handle all logic
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PassiveDTO {
    private String id;
    private String classId;
    private String name;
    private String description;
    private List<PassiveEffectDTO> effects;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PassiveEffectDTO {
        private Long id;
        private int ordinal;
        private String stat;
        private double value;
    }
}

