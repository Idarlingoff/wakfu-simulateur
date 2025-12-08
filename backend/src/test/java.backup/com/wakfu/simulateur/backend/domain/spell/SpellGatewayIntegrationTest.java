package com.wakfu.simulateur.backend.domain.spell;

import com.wakfu.simulateur.backend.domain.spell.port.SpellGateway;
import com.wakfu.simulateur.backend.infrastructure.gateway.JpaSpellGateway;
import com.wakfu.simulateur.backend.infrastructure.mapper.SpellMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;

import static com.wakfu.simulateur.backend.domain.spell.VariantKind.NORMAL;
import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
@ActiveProfiles("test")
@Import({JpaSpellGateway.class, SpellMapper.class})
class SpellGatewayIntegrationTest {

    @Autowired
    private SpellGateway spellGateway;

    @Test
    @DisplayName("XEL_DIAL: mapping domaine complet (sort, variantes, effets, conditions, breakpoints)")
    void shouldMapSpellAggregate() {
        Spell dial = spellGateway.findById("XEL_DIAL").orElseThrow();

        assertThat(dial.name()).isEqualTo("Dial");
        assertThat(dial.characterClassId()).isEqualTo("XEL");
        assertThat(dial.paCost()).isEqualTo(2);
        assertThat(dial.ratioEvalMode()).isEqualTo("STEP");

        assertThat(dial.variants()).isNotEmpty();
        SpellVariant normal = dial.findVariant(NORMAL).orElseThrow();
        assertThat(normal.effects()).isNotEmpty();
        assertThat(normal.effects().stream().map(SpellEffect::effectType))
                .contains("SUMMON_MECHANISM", "TELEPORT_TO_DIAL_HOUR", "APPLY_STATUS");

        boolean hasConditionalEffect = normal.effects().stream()
                .anyMatch(effect -> effect.conditionGroup().isPresent());
        assertThat(hasConditionalEffect).isTrue();

        assertThat(dial.breakpoints()).isNotEmpty();
        assertThat(dial.breakpoints().stream().filter(bp -> bp.level() == 185).findFirst())
                .get()
                .satisfies(bp -> assertThat(bp.ratio()).isZero());
    }
}
