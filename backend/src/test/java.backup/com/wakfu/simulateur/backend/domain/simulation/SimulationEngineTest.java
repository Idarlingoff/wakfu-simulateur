package com.wakfu.simulateur.backend.domain.simulation;

import com.wakfu.simulateur.backend.domain.spell.Spell;
import com.wakfu.simulateur.backend.domain.spell.VariantKind;
import com.wakfu.simulateur.backend.domain.spell.port.SpellGateway;
import com.wakfu.simulateur.backend.infrastructure.gateway.JpaSpellGateway;
import com.wakfu.simulateur.backend.infrastructure.mapper.SpellMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
@ActiveProfiles("test")
@Import({JpaSpellGateway.class, SpellMapper.class})
class SimulationEngineTest {

    @Autowired
    private SpellGateway spellGateway;

    private final SimulationEngine engine = new SimulationEngine();

    @Test
    @DisplayName("Le moteur consomme les PA et stoppe la timeline lorsqu'il n'y en a plus")
    void shouldConsumeActionPointsAndStopOnFailure() {
        Spell dial = spellGateway.findById("XEL_DIAL").orElseThrow();
        SimulationContext context = new SimulationContext(4, 3, 2);
        SimulationRequest request = new SimulationRequest(
                context,
                List.of(
                        SpellCastAction.of(dial, VariantKind.NORMAL),
                        SpellCastAction.of(dial, VariantKind.NORMAL),
                        SpellCastAction.of(dial, VariantKind.NORMAL)
                )
        );

        SimulationResult result = engine.simulate(request);

        assertThat(result.remainingPa()).isZero();
        assertThat(result.remainingPw()).isEqualTo(2);
        assertThat(result.actions()).hasSize(3);
        assertThat(result.actions().get(0).status()).isEqualTo(ActionStatus.SUCCESS);
        assertThat(result.actions().get(1).status()).isEqualTo(ActionStatus.SUCCESS);
        assertThat(result.actions().get(2).status()).isEqualTo(ActionStatus.FAILED);
        assertThat(result.actions().get(2).message()).contains("PA insuffisants");
        assertThat(result.hasFailure()).isTrue();
    }
}
