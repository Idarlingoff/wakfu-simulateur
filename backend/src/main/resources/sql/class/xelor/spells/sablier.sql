-- ============================
--  SABLIER
-- ============================

-- Nettoyage
DELETE FROM spell_effect       WHERE variant_id IN (SELECT id FROM spell_variant WHERE spell_id='XEL_SABLIER');
DELETE FROM spell_variant      WHERE spell_id='XEL_SABLIER';
DELETE FROM spell_ratio_breakpoint WHERE spell_id='XEL_SABLIER';
DELETE FROM spell              WHERE id='XEL_SABLIER';

DELETE FROM status_effect      WHERE status_id='SABLIER_MARK';
DELETE FROM status_def         WHERE id='SABLIER_MARK';

-- Définition du statut (marque Sablier)
INSERT INTO status_def (id, name, max_stacks, duration_type, base_duration)
VALUES ('SABLIER_MARK','Sablier',1,'FIXED',1);

-- Ticks de dégâts (indirects) :
-- - début du tour de la cible
-- - heure qui fait un tour (HourWrap)
INSERT INTO status_effect (status_id, tick_phase, effect_type, params_json) VALUES
    ('SABLIER_MARK','ON_TARGET_TURN_START','DEAL_DAMAGE',
     '{"element":"WATER","indirect":true,"area":"CROSS1","amountFromStatus":true}');

INSERT INTO status_effect (status_id, tick_phase, effect_type, params_json) VALUES
    ('SABLIER_MARK','ON_HOUR_WRAPPED','DEAL_DAMAGE',
     '{"element":"WATER","indirect":true,"area":"CROSS1","amountFromStatus":true}');

-- Définition du sort SABLIER
INSERT INTO spell (
    id, class_id, name, element, spell_type,
    pa_cost, pw_cost, po_min, po_max, po_modifiable, line_of_sight,
    cooldown, use_per_turn, use_per_target, direction, ratio_eval_mode
) VALUES (
             'XEL_SABLIER', 'XEL', 'Sablier', 'WATER', 'ELEMENTAL',
             3, 0, 1, 2, TRUE, FALSE,
             0, 4, 1, 'NONE', 'STEP'
         );

-- Ratio niveau 185 (aucun crit car dégâts indirects)
INSERT INTO spell_ratio_breakpoint (spell_id, lvl, ratio)
VALUES ('XEL_SABLIER', 185, 93);

-- NORMAL
INSERT INTO spell_variant (spell_id, kind)
VALUES ('XEL_SABLIER','NORMAL');

-- CRIT
INSERT INTO spell_variant (spell_id, kind)
VALUES ('XEL_SABLIER','CRIT');

-- Effet au cast : applique la marque avec amount=92 (pas de dégâts immédiats)
INSERT INTO spell_effect
(variant_id, phase, order_index, effect_type, target_scope, params_json, cond_group_id)
SELECT v.id, 'ON_CAST', 0, 'APPLY_STATUS', 'TARGET',
       '{"status":"SABLIER_MARK","amount":93,"duration":1}', NULL
FROM spell_variant v
WHERE v.spell_id='XEL_SABLIER' AND v.kind='NORMAL';

-- Effet au cast : applique la marque avec amount=92 (pas de dégâts immédiats)
INSERT INTO spell_effect
(variant_id, phase, order_index, effect_type, target_scope, params_json, cond_group_id)
SELECT v.id, 'ON_CAST', 0, 'APPLY_STATUS', 'TARGET',
       '{"status":"SABLIER_MARK","amount":116,"duration":1}', NULL
FROM spell_variant v
WHERE v.spell_id='XEL_SABLIER' AND v.kind='CRIT';
