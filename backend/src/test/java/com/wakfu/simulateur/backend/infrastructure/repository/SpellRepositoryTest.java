package com.wakfu.simulateur.backend.infrastructure.repository;

import com.fasterxml.jackson.databind.JsonNode;

import com.wakfu.simulateur.backend.infrastructure.entity.EffectConditionEntity;
import com.wakfu.simulateur.backend.infrastructure.entity.SpellEffectEntity;
import com.wakfu.simulateur.backend.infrastructure.entity.SpellEntity;
import com.wakfu.simulateur.backend.infrastructure.entity.SpellVariantEntity;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
@ActiveProfiles("test")
class SpellRepositoryTest {

    @Autowired
    private SpellRepository spellRepository;

    @Test
    @DisplayName("XEL_DIAL: charge le sort + variantes + effets + conditions via EntityGraph")
    void shouldLoadDialSpellWithVariantsEffectsAndConditions() {
        Optional<SpellEntity> opt = spellRepository.findById("XEL_DIAL");
        assertThat(opt).as("Le sort XEL_DIAL doit exister (migré par Flyway)").isPresent();

        SpellEntity dial = opt.get();
        assertThat(dial.getName()).isEqualTo("Dial");
        assertThat(dial.getElement()).isEqualTo("NONE");
        assertThat(dial.getPaCost()).isEqualTo(2);
        assertThat(dial.isLineOfSight()).isTrue();

        // Variantes
        List<SpellVariantEntity> variants = dial.getVariants();
        assertThat(variants)
                .as("Au moins une variante (NORMAL)")
                .isNotEmpty();

        SpellVariantEntity normal = variants.stream()
                .filter(v -> "NORMAL".equals(v.getKind().name()) || "NORMAL".equalsIgnoreCase(v.getKind().toString()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("Variante NORMAL introuvable"));

        // Effets
        List<SpellEffectEntity> effects = normal.getEffects();
        assertThat(effects).isNotEmpty();

        List<SpellEffectEntity> onCast = effects.stream()
                .filter(e -> "ON_CAST".equals(e.getPhase()))
                .collect(Collectors.toList());
        assertThat(onCast).hasSizeGreaterThanOrEqualTo(3);

        assertThat(onCast.stream().map(SpellEffectEntity::getEffectType))
                .contains("SUMMON_MECHANISM", "TELEPORT_TO_DIAL_HOUR", "APPLY_STATUS");

        SpellEffectEntity summon = onCast.stream()
                .filter(e -> "SUMMON_MECHANISM".equals(e.getEffectType()))
                .findFirst().orElseThrow();
        JsonNode smParams = summon.getParams();
        assertThat(smParams.get("mechanism").asText()).isEqualTo("DIAL");
        assertThat(smParams.get("replaceExisting").asBoolean()).isTrue();

        SpellEffectEntity tpHour = onCast.stream()
                .filter(e -> "TELEPORT_TO_DIAL_HOUR".equals(e.getEffectType()))
                .findFirst().orElseThrow();
        assertThat(tpHour.getParams().get("hour").asInt()).isEqualTo(6);

        SpellEffectEntity applyStatus = onCast.stream()
                .filter(e -> "APPLY_STATUS".equals(e.getEffectType()))
                .findFirst().orElseThrow();
        assertThat(applyStatus.getParams().get("status").asText()).isEqualTo("DIAL_AURA");

        List<SpellEffectEntity> preCast = effects.stream()
                .filter(e -> "PRE_CAST".equals(e.getPhase()))
                .collect(Collectors.toList());
        assertThat(preCast).isNotEmpty();

        assertThat(preCast.stream().map(SpellEffectEntity::getEffectType))
                .contains("EXTRA_COST_IF_PASSIVE", "COOLDOWN_DELTA_IF_PASSIVE");

        preCast.forEach(e -> {
            assertThat(e.getCondGroup()).isNotNull();
            assertThat(e.getCondGroup().getConditions()).isNotEmpty();

            boolean hasPassive =
                    e.getCondGroup().getConditions().stream()
                            .map(EffectConditionEntity::getCondType)
                            .anyMatch("HAS_PASSIVE"::equals);
            assertThat(hasPassive).isTrue();

            boolean referencesRightPassive =
                    e.getCondGroup().getConditions().stream()
                            .anyMatch(c -> {
                                JsonNode p = c.getParams();
                                return p != null && p.has("passiveId")
                                        && "XEL_CONNAISSANCE_PASSE".equals(p.get("passiveId").asText());
                            });
            assertThat(referencesRightPassive).isTrue();
        });
    }

    @Test
    @DisplayName("Les breakpoints de ratio sont présents pour XEL_DIAL (même si 0 dmg)")
    void shouldLoadDialBreakpoints() {
        SpellEntity dial = spellRepository.findById("XEL_DIAL").orElseThrow();
        assertThat(dial.getBreakpoints()).isNotEmpty();

        var bp185 = dial.getBreakpoints().stream()
                .filter(b -> b.getId().getLvl() == 185)
                .findFirst();

        assertThat(bp185).isPresent();
        assertThat(bp185.get().getRatio()).isZero();
    }
}
