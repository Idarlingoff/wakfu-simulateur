-- ============================
--  POINTE-HEURE
-- ============================

-- nettoyage si déjà présent
DELETE FROM spell_effect       WHERE variant_id IN (SELECT id FROM spell_variant WHERE spell_id='XEL_POINTE_HEURE');
DELETE FROM spell_variant      WHERE spell_id='XEL_POINTE_HEURE';
DELETE FROM spell_ratio_breakpoint WHERE spell_id='XEL_POINTE_HEURE';
DELETE FROM spell              WHERE id='XEL_POINTE_HEURE';

INSERT INTO spell (
    id, class_id, name, element, spell_type,
    pa_cost, pw_cost, po_min, po_max, po_modifiable, line_of_sight,
    cooldown, use_per_turn, use_per_target, direction, ratio_eval_mode
) VALUES (
             'XEL_POINTE_HEURE', 'XEL', 'Pointe-heure', 'AIR', 'ELEMENTAL',
             2, 0, 2, 4, TRUE, TRUE,
             0, 2, 1, 'LINE', 'STEP'
         );

INSERT INTO spell_ratio_breakpoint (spell_id, lvl, ratio)
VALUES
    ('XEL_POINTE_HEURE', 185, 46);

INSERT INTO spell_variant (spell_id, kind)
VALUES
    ('XEL_POINTE_HEURE', 'NORMAL'),
    ('XEL_POINTE_HEURE', 'CRIT');

INSERT INTO spell_effect (variant_id, phase, order_index, effect_type, target_scope, params_json)
VALUES
    (1, 'ON_CAST', 0, 'DEAL_DAMAGE', 'TARGET', '{"amount":46, "element":"AIR"}'),
    (1, 'ON_CAST', 1, 'TELEPORT', 'TARGET', '{"cells":2, "direction":"BACK"}');

INSERT INTO spell_effect (variant_id, phase, order_index, effect_type, target_scope, params_json)
VALUES
    (2, 'ON_CAST', 0, 'DEAL_DAMAGE', 'TARGET', '{"amount":57, "element":"AIR"}'),
    (2, 'ON_CAST', 1, 'TELEPORT', 'TARGET', '{"cells":2, "direction":"BACK"}');
