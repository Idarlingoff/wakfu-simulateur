-- ============================
-- REGULATEUR
-- ============================

-- nettoyage si déjà présent
DELETE FROM spell_effect       WHERE variant_id IN (SELECT id FROM spell_variant WHERE spell_id='XEL_REGULATEUR');
DELETE FROM spell_variant      WHERE spell_id='XEL_REGULATEUR';
DELETE FROM spell_ratio_breakpoint WHERE spell_id='XEL_REGULATEUR';
DELETE FROM spell              WHERE id='XEL_REGULATEUR';

DELETE FROM status_effect      WHERE status_id IN ('REGULATOR_PW_AURA');
DELETE FROM status_def         WHERE id IN ('REGULATOR_PW_AURA');

-- Définition du statut "aura PW" (durée infinie, tick au début du tour du lanceur)
INSERT INTO status_def (id, name, max_stacks, duration_type, base_duration)
VALUES ('REGULATOR_PW_AURA', 'Régulateur : aura +1 PW', 1, 'INFINITE', NULL);

-- Tick : début du tour du Xélor → +1 PW si un Régulateur (owner=caster) est vivant
INSERT INTO status_effect (status_id, tick_phase, effect_type, params_json)
VALUES (
           'REGULATOR_PW_AURA',
           'ON_CASTER_TURN_START',
           'ADD_PW',
           '{
              "amount": 1,
              "requireMechanismAlive": { "kind": "REGULATOR", "owner": "CASTER" }
            }'
       );

-- Sort REGULATEUR
INSERT INTO spell (
    id, class_id, name, element, spell_type,
    pa_cost, pw_cost, po_min, po_max, po_modifiable, line_of_sight,
    cooldown, use_per_turn, use_per_target, direction, ratio_eval_mode
) VALUES (
             'XEL_REGULATEUR', 'XEL', 'Régulateur', 'NONE', 'NEUTRAL',
             0, 3, 1, 2, FALSE, FALSE,
             0, 1, 1, 'NONE', 'STEP'
         );

-- Ratio (aucun dégât) pour cohérence
INSERT INTO spell_ratio_breakpoint (spell_id, lvl, ratio)
VALUES ('XEL_REGULATEUR', 185, 0);

-- Variante unique (pas de critique)
INSERT INTO spell_variant (spell_id, kind)
VALUES ('XEL_REGULATEUR', 'NORMAL');

-- Effets au cast
-- Invoquer/poser le mécanisme REGULATOR
--     - max 1 par Xélor (replaceExisting)
--     - uniquement sur les cases du cadran (placeOnDialOnly)
--     - capture des dégâts directs des invocations du Xélor (meta pour le moteur)
INSERT INTO spell_effect
(variant_id, phase, order_index, effect_type, target_scope, params_json, cond_group_id)
SELECT v.id, 'ON_CAST', 0, 'SUMMON_MECHANISM', 'TARGET',
       '{
          "mechanism": "REGULATOR",
          "maxPerCaster": 1,
          "replaceExisting": true,
          "placeOnDialOnly": true,
          "captureDirectDamageOf": ["DIAL","SINISTRO","ROUAGE"]
        }', NULL
FROM spell_variant v
WHERE v.spell_id='XEL_REGULATEUR' AND v.kind='NORMAL';

-- Appliquer l''aura PW au Xélor (s''active tant qu''un Régulateur du lanceur est vivant)
INSERT INTO spell_effect
(variant_id, phase, order_index, effect_type, target_scope, params_json, cond_group_id)
SELECT v.id, 'ON_CAST', 1, 'APPLY_STATUS', 'SELF',
       '{
          "status":"REGULATOR_PW_AURA",
          "duration": null
        }', NULL
FROM spell_variant v
WHERE v.spell_id='XEL_REGULATEUR' AND v.kind='NORMAL';
