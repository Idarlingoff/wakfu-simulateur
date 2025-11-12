package com.wakfu.simulateur.backend.infrastructure.entity;

import com.wakfu.simulateur.backend.infrastructure.entity.enums.VariantKind;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "spell_variant")
@Getter @Setter
public class SpellVariantEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "spell_id", nullable = false)
    private SpellEntity spell;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private VariantKind kind;

    @OneToMany(mappedBy = "variant", fetch = FetchType.LAZY, cascade = CascadeType.ALL, orphanRemoval = true)
    private List<SpellEffectEntity> effects = new ArrayList<>();
}
