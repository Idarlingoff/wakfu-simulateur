package com.wakfu.simulateur.backend.infrastructure.entity;

import jakarta.persistence.*;
import lombok.*;

import java.io.Serializable;

@Entity
@Table(name = "spell_ratio_breakpoint")
@Getter @Setter
public class SpellRatioBreakpointEntity {

    @EmbeddedId
    private SpellRatioKey id;

    @MapsId("spellId")
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "spell_id", nullable = false)
    private SpellEntity spell;

    @Column(name = "ratio", nullable = false)
    private int ratio;

    @Embeddable
    @Getter @Setter @NoArgsConstructor @AllArgsConstructor @EqualsAndHashCode
    public static class SpellRatioKey implements Serializable {
        @Column(name = "spell_id", length = 64)
        private String spellId;

        @Column(name = "lvl", nullable = false)
        private int lvl;
    }
}
