-- ============================
--  DESYNCHRO
-- ============================

INSERT INTO spell  VALUES (
                              'XEL_DESYNCHRO', 'XEL', 'Désynchronisation', 'WATER', 'ELEMENTAL',
                              4, 0, 3, 6, TRUE, TRUE,
                              0, 2, 0, 'AREA', 'STEP'
                          );

INSERT INTO spell_ratio_breakpoint (spell_id, lvl, ratio)
VALUES ('XEL_DESYNCHRO', 185, 78);

INSERT INTO EFFECT_CONDITION_GROUP (OP) values ( 'AND' );

INSERT INTO effect_condition (group_id, cond_type, params_json)
VALUES (2, 'ON_DIAL_CELL', '{}');

INSERT INTO spell_variant (spell_id, kind) VALUES
                                               ('XEL_DESYNCHRO', 'NORMAL'),
                                               ('XEL_DESYNCHRO', 'CRIT');

-- Cas de base
INSERT INTO spell_effect
(variant_id, phase, order_index, effect_type, target_scope, params_json, cond_group_id)
SELECT id, 'ON_CAST', 0, 'DEAL_DAMAGE', 'AREA',
       '{"amount":78,"element":"WATER"}', NULL
FROM spell_variant
WHERE spell_id='XEL_DESYNCHRO' AND kind='NORMAL';

-- NORMAL : -3 PA sur cibles
INSERT INTO spell_effect
(variant_id, phase, order_index, effect_type, target_scope, params_json, cond_group_id)
SELECT id, 'ON_CAST', 1, 'SUB_AP', 'TARGET',
       '{"amount":3}', NULL
FROM spell_variant
WHERE spell_id='XEL_DESYNCHRO' AND kind='NORMAL';

-- CRIT : dégâts 127 eau en zone
INSERT INTO spell_effect
(variant_id, phase, order_index, effect_type, target_scope, params_json, cond_group_id)
SELECT id, 'ON_CAST', 0, 'DEAL_DAMAGE', 'AREA',
       '{"amount":98,"element":"WATER"}', NULL
FROM spell_variant
WHERE spell_id='XEL_DESYNCHRO' AND kind='CRIT';

-- CRIT : -3 PA sur cibles
INSERT INTO spell_effect
(variant_id, phase, order_index, effect_type, target_scope, params_json, cond_group_id)
SELECT id, 'ON_CAST', 1, 'SUB_AP', 'TARGET',
       '{"amount":3}', NULL
FROM spell_variant
WHERE spell_id='XEL_DESYNCHRO' AND kind='CRIT';

-- 6) Effets conditionnels (Cas 1 : lancé sur le Cadran) — cond_group_id = 1
-- NORMAL : +6h puis +2PA au lanceur
INSERT INTO spell_effect
(variant_id, phase, order_index, effect_type, target_scope, params_json, cond_group_id)
SELECT id, 'ON_CAST', 2, 'ADVANCE_DIAL', 'SELF',
       '{"hours":6}', 2
FROM spell_variant
WHERE spell_id='XEL_DESYNCHRO' AND kind='NORMAL';

INSERT INTO spell_effect
(variant_id, phase, order_index, effect_type, target_scope, params_json, cond_group_id)
SELECT id, 'ON_CAST', 3, 'ADD_AP', 'SELF',
       '{"amount":2}', 2
FROM spell_variant
WHERE spell_id='XEL_DESYNCHRO' AND kind='NORMAL';

-- CRIT : +6h puis +2PA au lanceur (mêmes effets/ordre)
INSERT INTO spell_effect
(variant_id, phase, order_index, effect_type, target_scope, params_json, cond_group_id)
SELECT id, 'ON_CAST', 2, 'ADVANCE_DIAL', 'SELF',
       '{"hours":6}', 2
FROM spell_variant
WHERE spell_id='XEL_DESYNCHRO' AND kind='CRIT';

INSERT INTO spell_effect
(variant_id, phase, order_index, effect_type, target_scope, params_json, cond_group_id)
SELECT id, 'ON_CAST', 3, 'ADD_AP', 'SELF',
       '{"amount":2}', 2
FROM spell_variant
WHERE spell_id='XEL_DESYNCHRO' AND kind='CRIT';