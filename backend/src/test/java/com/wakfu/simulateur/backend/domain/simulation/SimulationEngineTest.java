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
        SimulationContext context = new SimulationContext(4, 3, 2, 12);
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
        assertThat(result.currentHour()).isEqualTo(12);
        assertThat(result.hourWraps()).isZero();
        assertThat(result.actions()).hasSize(3);
        assertThat(result.actions().get(0).status()).isEqualTo(ActionStatus.SUCCESS);
        assertThat(result.actions().get(1).status()).isEqualTo(ActionStatus.SUCCESS);
        assertThat(result.actions().get(2).status()).isEqualTo(ActionStatus.FAILED);
        assertThat(result.actions().get(2).message()).contains("PA insuffisants");
        assertThat(result.actions().get(0).resultingHour()).isEqualTo(12);
        assertThat(result.actions().get(1).resultingHour()).isEqualTo(12);
        assertThat(result.actions().get(2).resultingHour()).isEqualTo(12);
        assertThat(result.hasFailure()).isTrue();
    }

    @Test
    @DisplayName("Le cadran avance d'une heure par PW consommé")
    void shouldAdvanceHourWhenSpendingPw() {
        Spell devotion = spellGateway.findById("XEL_DEVOUEMENT").orElseThrow();
        SimulationContext context = new SimulationContext(10, 3, 6, 6);
        SimulationRequest request = new SimulationRequest(
                context,
                List.of(SpellCastAction.of(devotion, VariantKind.NORMAL))
        );

        SimulationResult result = engine.simulate(request);

        assertThat(result.remainingPa()).isEqualTo(10);
        assertThat(result.remainingPw()).isEqualTo(2);
        assertThat(result.currentHour()).isEqualTo(10);
        assertThat(result.hourWraps()).isZero();
        assertThat(result.actions()).hasSize(1);
        ActionResult action = result.actions().getFirst();
        assertThat(action.pwCost()).isEqualTo(4);
        assertThat(action.resultingHour()).isEqualTo(10);
        assertThat(action.totalHourWraps()).isZero();
    }

    @Test
    @DisplayName("Vol du temps consomme des PW dynamiques et rend des PA")
    void shouldHandleTimeStealDynamicCosts() {
        Spell timeSteal = spellGateway.findById("XEL_VDT").orElseThrow();
        SimulationContext context = new SimulationContext(6, 3, 5, 12);
        SimulationRequest request = new SimulationRequest(
                context,
                List.of(
                        SpellCastAction.of(timeSteal, VariantKind.NORMAL),
                        SpellCastAction.of(timeSteal, VariantKind.NORMAL)
                )
        );

        SimulationResult result = engine.simulate(request);

        assertThat(result.remainingPa()).isEqualTo(7);
        assertThat(result.remainingPw()).isEqualTo(4);
        assertThat(result.currentHour()).isEqualTo(1);
        assertThat(result.hourWraps()).isEqualTo(1);
        assertThat(result.actions()).hasSize(2);

        ActionResult first = result.actions().getFirst();
        ActionResult second = result.actions().get(1);

        assertThat(first.pwCost()).isEqualTo(1);
        assertThat(first.resultingHour()).isEqualTo(1);
        assertThat(first.totalHourWraps()).isEqualTo(1);

        assertThat(second.status()).isEqualTo(ActionStatus.FAILED);
        assertThat(second.message()).contains("Vol du Temps ne peut être lancé qu'une fois par tour");
        assertThat(second.pwCost()).isEqualTo(2);
        assertThat(second.resultingHour()).isEqualTo(1);
        assertThat(second.totalHourWraps()).isEqualTo(1);
    }
}
