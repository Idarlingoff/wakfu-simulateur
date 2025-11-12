-- =========================================
-- DÉVOUEMENT
-- =========================================

-- nettoyage si déjà présent
DELETE FROM spell_effect       WHERE variant_id IN (SELECT id FROM spell_variant WHERE spell_id='XEL_DEVOUEMENT');
DELETE FROM spell_variant      WHERE spell_id='XEL_DEVOUEMENT';
DELETE FROM spell_ratio_breakpoint WHERE spell_id='XEL_DEVOUEMENT';
DELETE FROM spell              WHERE id='XEL_DEVOUEMENT';

-- Sort principal
INSERT INTO spell (
    id, class_id, name, element, spell_type,
    pa_cost, pw_cost, po_min, po_max, po_modifiable, line_of_sight,
    cooldown, use_per_turn, use_per_target, direction, ratio_eval_mode
) VALUES (
             'XEL_DEVOUEMENT', 'XEL', 'Dévouement', 'NONE', 'NEUTRAL',
             0, 4, 1, 3, TRUE, TRUE,
             0, 99, 99, 'NONE', 'STEP'
         );

-- Ratio
INSERT INTO spell_ratio_breakpoint (spell_id, lvl, ratio)
VALUES ('XEL_DEVOUEMENT', 185, 0);

-- Variante unique (pas de critique)
INSERT INTO spell_variant (spell_id, kind)
VALUES ('XEL_DEVOUEMENT', 'NORMAL');

-- Effets — Donne 3PA à la cible pour 1 tour
INSERT INTO spell_effect
(variant_id, phase, order_index, effect_type, target_scope, params_json, cond_group_id)
SELECT v.id, 'ON_CAST', 0, 'ADD_AP', 'TARGET',
       '{"amount":3,"duration":1}', NULL
FROM spell_variant v
WHERE v.spell_id='XEL_DEVOUEMENT' AND v.kind='NORMAL';
