package com.wakfu.simulateur.backend.infrastructure.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "effect_condition_group")
@Getter
@Setter
public class EffectConditionGroupEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "op", nullable = false, length = 8)
    private String op;

    @OneToMany(mappedBy = "group", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<EffectConditionEntity> conditions = new ArrayList<>();
}
