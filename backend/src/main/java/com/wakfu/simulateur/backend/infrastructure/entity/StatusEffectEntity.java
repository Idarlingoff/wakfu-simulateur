package com.wakfu.simulateur.backend.infrastructure.entity;

import com.fasterxml.jackson.databind.JsonNode;
import com.wakfu.simulateur.backend.infrastructure.entity.converter.JsonNodeConverter;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "status_effect")
@Getter @Setter
public class StatusEffectEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "status_id", nullable = false)
    private StatusDefEntity status;

    @Column(name = "tick_phase", nullable = false, length = 24)
    private String tickPhase;

    @Column(name = "effect_type", nullable = false, length = 64)
    private String effectType;

    @Lob
    @Column(name = "params_json")
    @Convert(converter = JsonNodeConverter.class)
    private JsonNode params;
}
