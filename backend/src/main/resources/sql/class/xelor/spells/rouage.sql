-- ============================
-- XELOR — ROUAGE
-- ============================

-- nettoyage si déjà présent
DELETE FROM spell_effect       WHERE variant_id IN (SELECT id FROM spell_variant WHERE spell_id='XEL_ROUAGE');
DELETE FROM spell_variant      WHERE spell_id='XEL_ROUAGE';
DELETE FROM spell_ratio_breakpoint WHERE spell_id='XEL_ROUAGE';
DELETE FROM spell              WHERE id='XEL_ROUAGE';

DELETE FROM status_effect      WHERE status_id IN ('ROUAGE_AURA');
DELETE FROM status_def         WHERE id IN ('ROUAGE_AURA');

-- Aura Rouage (posee sur le Xélor; pilote les ticks)
INSERT INTO status_def (id, name, max_stacks, duration_type, base_duration)
VALUES ('ROUAGE_AURA', 'Aura du Rouage', 1, 'INFINITE', NULL);

-- Fin de tour du Xélor : dégâts Lumière autour du/ des Rouage(s)
INSERT INTO status_effect (status_id, tick_phase, effect_type, params_json) VALUES
    (
        'ROUAGE_AURA',
        'ON_CASTER_TURN_END',
        'DEAL_AROUND_MECHANISM',
        '{
           "kind":"ROUAGE",
           "owner":"CASTER",
           "area":"CROSS2",
           "element":"LIGHT",
           "perChargeAmount":20,
           "scaleByCharges": true,
           "maxCharges":10
         }'
    );

-- Tour de cadran (HourWrap) : mêmes dégâts
INSERT INTO status_effect (status_id, tick_phase, effect_type, params_json) VALUES
    (
        'ROUAGE_AURA',
        'ON_HOUR_WRAPPED',
        'DEAL_AROUND_MECHANISM',
        '{
           "kind":"ROUAGE",
           "owner":"CASTER",
           "area":"CROSS2",
           "element":"LIGHT",
           "perChargeAmount":20,
           "scaleByCharges": true,
           "maxCharges":10
         }'
    );

-- 2) Sort ROUAGE
INSERT INTO spell (
    id, class_id, name, element, spell_type,
    pa_cost, pw_cost, po_min, po_max, po_modifiable, line_of_sight,
    cooldown, use_per_turn, use_per_target, direction, ratio_eval_mode
) VALUES (
             'XEL_ROUAGE', 'XEL', 'Rouage', 'NONE', 'NEUTRAL',
             2, 0, 1, 3, TRUE, FALSE,
             0, 1, 1, 'LINE', 'STEP'
         );

-- Ratio (aucun dégât direct au cast)
INSERT INTO spell_ratio_breakpoint (spell_id, lvl, ratio)
VALUES ('XEL_ROUAGE', 185, 0);

-- Variante unique (pas de crit)
INSERT INTO spell_variant (spell_id, kind)
VALUES ('XEL_ROUAGE', 'NORMAL');

-- Effets au cast
-- Invocation du Rouage :
--   - max 1 par Xélor par défaut
--   - +1 si la passive XEL_REMANENCE est présente dans le build
--   - maxCharges = 10
--   - pose libre (pas restreint au cadran)
INSERT INTO spell_effect
(variant_id, phase, order_index, effect_type, target_scope, params_json, cond_group_id)
SELECT v.id, 'ON_CAST', 0, 'SUMMON_MECHANISM', 'TARGET',
       '{
          "mechanism": "ROUAGE",
          "maxPerCaster": 1,
          "maxPerCasterPassiveBoost": { "passiveId": "XEL_REMANENCE", "bonus": 1 },
          "replaceExisting": true,
          "placeOnDialOnly": false,
          "maxCharges": 10
        }', NULL
FROM spell_variant v
WHERE v.spell_id='XEL_ROUAGE' AND v.kind='NORMAL';

-- Appliquer l'aura Rouage au Xélor (gère les ticks de dégâts)
INSERT INTO spell_effect
(variant_id, phase, order_index, effect_type, target_scope, params_json, cond_group_id)
SELECT v.id, 'ON_CAST', 1, 'APPLY_STATUS', 'SELF',
       '{"status":"ROUAGE_AURA","duration": null}', NULL
FROM spell_variant v
WHERE v.spell_id='XEL_ROUAGE' AND v.kind='NORMAL';
