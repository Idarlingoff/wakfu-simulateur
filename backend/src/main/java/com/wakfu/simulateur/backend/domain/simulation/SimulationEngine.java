package com.wakfu.simulateur.backend.domain.simulation;

import com.wakfu.simulateur.backend.domain.spell.Spell;
import com.wakfu.simulateur.backend.domain.spell.SpellVariant;

import java.util.ArrayList;
import java.util.List;

/**
 * Moteur principal de simulation. Implémentation initiale qui gère uniquement la consommation
 * de ressources (PA/PW) lors du lancement successif de sorts.
 */
public class SimulationEngine {

    private static final String TIME_STEAL_SPELL_ID = "XEL_VDT";

    public SimulationResult simulate(SimulationRequest request) {
        int remainingPa = request.context().availablePa();
        int remainingPw = request.context().availablePw();
        int currentHour = request.context().currentHour();
        int hourWraps = 0;
        int timeStealStacks = 0;

        List<ActionResult> results = new ArrayList<>();

        for (SpellCastAction action : request.timeline()) {
            Spell spell = action.spell();
            SpellVariant variant = spell.findVariant(action.variant())
                    .orElse(null);

            if (variant == null) {
                results.add(ActionResult.failure(
                        spell,
                        action.variant(),
                        0,
                        0,
                        "Variante introuvable pour le sort " + spell.id(),
                        currentHour,
                        hourWraps
                ));
                break;
            }

            int paCost = Math.max(0, spell.paCost());
            int pwCost = Math.max(0, spell.pwCost());

            if (TIME_STEAL_SPELL_ID.equals(spell.id())) {
                pwCost = Math.max(1, timeStealStacks + 1);
            }

            boolean hasPa = remainingPa >= paCost;
            boolean hasPw = remainingPw >= pwCost;

            if (hasPa && hasPw) {
                remainingPa -= paCost;
                remainingPw -= pwCost;
                if (TIME_STEAL_SPELL_ID.equals(spell.id())) {
                    int gain = timeStealStacks + 1;
                    remainingPa += gain;
                    timeStealStacks++;
                }

                if (pwCost > 0) {
                    int total = (currentHour - 1) + pwCost;
                    hourWraps += total / 12;
                    currentHour = (total % 12) + 1;
                }

                results.add(ActionResult.success(spell, variant, paCost, pwCost, currentHour, hourWraps));
                continue;
            }

            String message;
            if (!hasPa && !hasPw) {
                message = "PA et PW insuffisants";
            } else if (!hasPa) {
                message = "PA insuffisants";
            } else {
                message = "PW insuffisants";
            }

            results.add(ActionResult.failure(spell, action.variant(), paCost, pwCost, message, currentHour, hourWraps));
            break;
        }

        return new SimulationResult(request.context(), remainingPa, remainingPw, currentHour, hourWraps, results);
    }
}
