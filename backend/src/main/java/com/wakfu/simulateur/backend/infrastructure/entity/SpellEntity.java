package com.wakfu.simulateur.backend.infrastructure.entity;

import com.wakfu.simulateur.backend.infrastructure.entity.enums.SpellDirection;
import com.wakfu.simulateur.backend.infrastructure.entity.enums.SpellType;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "spell")
@Getter @Setter
public class SpellEntity {
    @Id
    @Column(length = 64)
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "class_id", nullable = false)
    private ClassRefEntity characterClass;

    @Column(nullable = false, length = 128)
    private String name;

    @Column(length = 16)
    private String element; // "WATER", "NEUTRAL", ...

    @Enumerated(EnumType.STRING)
    @Column(name = "spell_type", nullable = false, length = 16)
    private SpellType spellType;

    @Column(name = "pa_cost", nullable = false)
    private int paCost;

    @Column(name = "pw_cost", nullable = false)
    private int pwCost;

    @Column(name = "po_min", nullable = false)
    private int poMin;

    @Column(name = "po_max", nullable = false)
    private int poMax;

    @Column(name = "po_modifiable", nullable = false)
    private boolean poModifiable;

    @Column(name = "line_of_sight", nullable = false)
    private boolean lineOfSight;

    @Column(nullable = false)
    private int cooldown;

    @Column(name = "use_per_turn", nullable = false)
    private int usePerTurn;

    @Column(name = "use_per_target", nullable = false)
    private int usePerTarget;

    @Enumerated(EnumType.STRING)
    @Column(name = "direction", nullable = false, length = 16)
    private SpellDirection direction;

    @Column(name = "ratio_eval_mode", nullable = false, length = 16)
    private String ratioEvalMode; 

    @OneToMany(mappedBy = "spell", fetch = FetchType.LAZY, cascade = CascadeType.ALL, orphanRemoval = true)
    private List<SpellVariantEntity> variants = new ArrayList<>();

    @OneToMany(mappedBy = "spell", fetch = FetchType.LAZY, cascade = CascadeType.ALL, orphanRemoval = true)
    private List<SpellRatioBreakpointEntity> breakpoints = new ArrayList<>();
}
