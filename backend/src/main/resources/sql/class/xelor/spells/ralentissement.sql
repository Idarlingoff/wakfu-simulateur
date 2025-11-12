-- =========================================
-- RALENTISSEMENT
-- =========================================

-- nettoyage si déjà présent
DELETE FROM spell_effect       WHERE variant_id IN (SELECT id FROM spell_variant WHERE spell_id='XEL_RALENTISSEMENT');
DELETE FROM spell_variant      WHERE spell_id='XEL_RALENTISSEMENT';
DELETE FROM spell_ratio_breakpoint WHERE spell_id='XEL_RALENTISSEMENT';
DELETE FROM spell              WHERE id='XEL_RALENTISSEMENT';

-- Sort
INSERT INTO spell (
    id, class_id, name, element, spell_type,
    pa_cost, pw_cost, po_min, po_max, po_modifiable, line_of_sight,
    cooldown, use_per_turn, use_per_target, direction, ratio_eval_mode
) VALUES (
             'XEL_RALENTISSEMENT', 'XEL', 'Ralentissement', 'WATER', 'ELEMENTAL',
             1, 1, 1, 3, TRUE, TRUE,
             0, 3, 2, 'NONE', 'STEP'
         );

-- Ratio (palier 185) — valeur de base (non-crit)
INSERT INTO spell_ratio_breakpoint (spell_id, lvl, ratio)
VALUES ('XEL_RALENTISSEMENT', 185, 27);

-- Variantes NORMAL / CRIT
INSERT INTO spell_variant (spell_id, kind) VALUES
                                               ('XEL_RALENTISSEMENT','NORMAL'),
                                               ('XEL_RALENTISSEMENT','CRIT');

-- Effets NORMAL
-- Ordre: dégâts -> +15 volonté (SELF) -> -2 PA (TARGET)
INSERT INTO spell_effect
(variant_id, phase, order_index, effect_type, target_scope, params_json, cond_group_id)
SELECT v.id, 'ON_CAST', 0, 'DEAL_DAMAGE', 'TARGET',
       '{"amount":27,"element":"WATER"}', NULL
FROM spell_variant v
WHERE v.spell_id='XEL_RALENTISSEMENT' AND v.kind='NORMAL';

INSERT INTO spell_effect
(variant_id, phase, order_index, effect_type, target_scope, params_json, cond_group_id)
SELECT v.id, 'ON_CAST', 1, 'ADD_WILLPOWER', 'SELF',
       '{"amount":15,"duration":1}', NULL
FROM spell_variant v
WHERE v.spell_id='XEL_RALENTISSEMENT' AND v.kind='NORMAL';

INSERT INTO spell_effect
(variant_id, phase, order_index, effect_type, target_scope, params_json, cond_group_id)
SELECT v.id, 'ON_CAST', 2, 'SUB_AP', 'TARGET',
       '{"amount":2}', NULL
FROM spell_variant v
WHERE v.spell_id='XEL_RALENTISSEMENT' AND v.kind='NORMAL';

-- Effets CRIT (dégâts 34, le reste identique)
INSERT INTO spell_effect
(variant_id, phase, order_index, effect_type, target_scope, params_json, cond_group_id)
SELECT v.id, 'ON_CAST', 0, 'DEAL_DAMAGE', 'TARGET',
       '{"amount":34,"element":"WATER"}', NULL
FROM spell_variant v
WHERE v.spell_id='XEL_RALENTISSEMENT' AND v.kind='CRIT';

INSERT INTO spell_effect
(variant_id, phase, order_index, effect_type, target_scope, params_json, cond_group_id)
SELECT v.id, 'ON_CAST', 1, 'ADD_WILLPOWER', 'SELF',
       '{"amount":15,"duration":1}', NULL
FROM spell_variant v
WHERE v.spell_id='XEL_RALENTISSEMENT' AND v.kind='CRIT';

INSERT INTO spell_effect
(variant_id, phase, order_index, effect_type, target_scope, params_json, cond_group_id)
SELECT v.id, 'ON_CAST', 2, 'SUB_AP', 'TARGET',
       '{"amount":2}', NULL
FROM spell_variant v
WHERE v.spell_id='XEL_RALENTISSEMENT' AND v.kind='CRIT';
