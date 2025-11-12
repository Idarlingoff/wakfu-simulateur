package com.wakfu.simulateur.backend.infrastructure.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "passive")
@Getter @Setter
public class PassiveEntity {
    @Id
    @Column(length = 64)
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "class_id", nullable = false)
    private ClassRefEntity characterClass;

    @Column(nullable = false, length = 128)
    private String name;

    @Lob
    private String description;

    @OneToMany(mappedBy = "passive", fetch = FetchType.LAZY, cascade = CascadeType.ALL, orphanRemoval = true)
    private List<PassiveEffectEntity> effects = new ArrayList<>();
}
