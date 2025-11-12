package com.wakfu.simulateur.backend.infrastructure.entity;

import com.fasterxml.jackson.databind.JsonNode;
import com.wakfu.simulateur.backend.infrastructure.entity.converter.JsonNodeConverter;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "passive_effect")
@Getter @Setter
public class PassiveEffectEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "passive_id", nullable = false)
    private PassiveEntity passive;

    @Column(name = "trigger", nullable = false, length = 32)
    private String trigger;

    @Column(name = "order_index", nullable = false)
    private int orderIndex;

    @Column(name = "effect_type", nullable = false, length = 64)
    private String effectType;

    @Column(name = "target_scope", nullable = false, length = 32)
    private String targetScope;

    @Lob
    @Column(name = "params_json")
    @Convert(converter = JsonNodeConverter.class)
    private JsonNode params;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cond_group_id")
    private EffectConditionGroupEntity condGroup;
}
