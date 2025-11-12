package com.wakfu.simulateur.backend.infrastructure.entity;

import com.fasterxml.jackson.databind.JsonNode;
import com.wakfu.simulateur.backend.infrastructure.entity.converter.JsonNodeConverter;
import com.wakfu.simulateur.backend.infrastructure.entity.enums.TargetScope;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "spell_effect")
@Getter @Setter
public class SpellEffectEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "variant_id", nullable = false)
    private SpellVariantEntity variant;

    @Column(name = "phase", nullable = false, length = 24)
    private String phase;

    @Column(name = "order_index", nullable = false)
    private int orderIndex;

    @Column(name = "effect_type", nullable = false, length = 64)
    private String effectType;

    @Enumerated(EnumType.STRING)
    @Column(name = "target_scope", nullable = false, length = 32)
    private TargetScope targetScope;

    @Lob
    @Column(name = "params_json")
    @Convert(converter = JsonNodeConverter.class)
    private JsonNode params;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cond_group_id")
    private EffectConditionGroupEntity condGroup;
}
