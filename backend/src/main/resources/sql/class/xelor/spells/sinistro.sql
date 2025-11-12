-- ============================
-- SINISTRO
-- ============================

-- cleanup
DELETE FROM spell_effect       WHERE variant_id IN (SELECT id FROM spell_variant WHERE spell_id='XEL_SINISTRO');
DELETE FROM spell_variant      WHERE spell_id='XEL_SINISTRO';
DELETE FROM spell_ratio_breakpoint WHERE spell_id='XEL_SINISTRO';
DELETE FROM spell              WHERE id='XEL_SINISTRO';

DELETE FROM status_effect      WHERE status_id IN ('SINISTRO_AURA');
DELETE FROM status_def         WHERE id IN ('SINISTRO_AURA');

-- Aura (posée sur le Xélor; pilote les ticks)
INSERT INTO status_def (id, name, max_stacks, duration_type, base_duration)
VALUES ('SINISTRO_AURA', 'Aura du Sinistro', 1, 'INFINITE', NULL);

-- Fin de tour du Xélor : SOINS aux ALLIÉS ADJACENTS à chaque Sinistro du lanceur
INSERT INTO status_effect (status_id, tick_phase, effect_type, params_json) VALUES
    (
        'SINISTRO_AURA',
        'ON_CASTER_TURN_END',
        'HEAL_AROUND_MECHANISM',
        '{
           "kind":"SINISTRO",
           "owner":"CASTER",
           "targets":"ALLIES_ADJACENT",
           "percentMissingPerCharge": 2
         }'
    );

-- Fin de tour du Xélor : PA aux ALLIÉS ADJACENTS (1 PA / 5 charges)
INSERT INTO status_effect (status_id, tick_phase, effect_type, params_json) VALUES
    (
        'SINISTRO_AURA',
        'ON_CASTER_TURN_END',
        'ADD_AP_AROUND_MECHANISM',
        '{
           "kind":"SINISTRO",
           "owner":"CASTER",
           "targets":"ALLIES_ADJACENT",
           "perCharges": 5,
           "amountPerStep": 1
         }'
    );

-- Tour de cadran : mêmes effets (soins + PA)
INSERT INTO status_effect (status_id, tick_phase, effect_type, params_json) VALUES
    (
        'SINISTRO_AURA',
        'ON_HOUR_WRAPPED',
        'HEAL_AROUND_MECHANISM',
        '{
           "kind":"SINISTRO",
           "owner":"CASTER",
           "targets":"ALLIES_ADJACENT",
           "percentMissingPerCharge": 2
         }'
    );

INSERT INTO status_effect (status_id, tick_phase, effect_type, params_json) VALUES
    (
        'SINISTRO_AURA',
        'ON_HOUR_WRAPPED',
        'ADD_AP_AROUND_MECHANISM',
        '{
           "kind":"SINISTRO",
           "owner":"CASTER",
           "targets":"ALLIES_ADJACENT",
           "perCharges": 5,
           "amountPerStep": 1
         }'
    );

-- Sort
INSERT INTO spell (
    id, class_id, name, element, spell_type,
    pa_cost, pw_cost, po_min, po_max, po_modifiable, line_of_sight,
    cooldown, use_per_turn, use_per_target, direction, ratio_eval_mode
) VALUES (
             'XEL_SINISTRO', 'XEL', 'Sinistro', 'NONE', 'NEUTRAL',
             2, 0, 2, 5, FALSE, TRUE,
             0, 1, 1, 'NONE', 'STEP'
         );

-- ratio (pas de dégâts directs)
INSERT INTO spell_ratio_breakpoint (spell_id, lvl, ratio)
VALUES ('XEL_SINISTRO', 185, 0);

-- variante
INSERT INTO spell_variant (spell_id, kind)
VALUES ('XEL_SINISTRO', 'NORMAL');

-- Effets au cast
-- Invocation du Sinistro
--   - max 1 par Xélor PAR DÉFAUT
--   - le moteur peut lire "maxPerCasterPassiveBoost" pour porter à 2 si la passive est active
--   - maxCharges = 15
INSERT INTO spell_effect
(variant_id, phase, order_index, effect_type, target_scope, params_json, cond_group_id)
SELECT v.id, 'ON_CAST', 0, 'SUMMON_MECHANISM', 'TARGET',
       '{
          "mechanism": "SINISTRO",
          "maxPerCaster": 1,
          "maxPerCasterPassiveBoost": { "passiveId": "XEL_REMANENCE", "bonus": 1 },
          "replaceExisting": true,
          "placeOnDialOnly": false,
          "maxCharges": 15
        }', NULL
FROM spell_variant v
WHERE v.spell_id='XEL_SINISTRO' AND v.kind='NORMAL';

-- Appliquer l''aura Sinistro au Xélor (ticks = fin de tour + hour wrap)
INSERT INTO spell_effect
(variant_id, phase, order_index, effect_type, target_scope, params_json, cond_group_id)
SELECT v.id, 'ON_CAST', 1, 'APPLY_STATUS', 'SELF',
       '{"status":"SINISTRO_AURA","duration": null}', NULL
FROM spell_variant v
WHERE v.spell_id='XEL_SINISTRO' AND v.kind='NORMAL';
