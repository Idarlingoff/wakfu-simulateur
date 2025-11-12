package com.wakfu.simulateur.backend.infrastructure.entity;

import com.fasterxml.jackson.databind.JsonNode;
import com.wakfu.simulateur.backend.infrastructure.entity.converter.JsonNodeConverter;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "effect_condition")
@Getter @Setter
public class EffectConditionEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "group_id", nullable = false)
    private EffectConditionGroupEntity group;

    @Column(name = "cond_type", nullable = false, length = 64)
    private String condType;

    @Lob
    @Column(name = "params_json")
    @Convert(converter = JsonNodeConverter.class)
    private JsonNode params;
}
