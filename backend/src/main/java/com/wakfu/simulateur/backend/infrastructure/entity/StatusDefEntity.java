package com.wakfu.simulateur.backend.infrastructure.entity;

import com.wakfu.simulateur.backend.infrastructure.entity.enums.DurationType;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "status_def")
@Getter @Setter
public class StatusDefEntity {
    @Id
    @Column(length = 64)
    private String id;

    @Column(length = 128)
    private String name;

    @Column(name = "max_stacks", nullable = false)
    private int maxStacks;

    @Enumerated(EnumType.STRING)
    @Column(name = "duration_type", nullable = false, length = 16)
    private DurationType durationType;

    @Column(name = "base_duration")
    private Integer baseDuration;

    @OneToMany(mappedBy = "status", fetch = FetchType.LAZY, cascade = CascadeType.ALL, orphanRemoval = true)
    private List<StatusEffectEntity> effects = new ArrayList<>();
}
