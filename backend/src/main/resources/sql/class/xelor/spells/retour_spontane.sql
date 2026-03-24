-- ============================
--  RETOUR SPONTANE
-- ============================

-- nettoyage si déjà présent
DELETE FROM spell_effect       WHERE variant_id IN (SELECT id FROM spell_variant WHERE spell_id='XEL_RETOUR_SPONTANE');
DELETE FROM spell_variant      WHERE spell_id='XEL_RETOUR_SPONTANE';
DELETE FROM spell_ratio_breakpoint WHERE spell_id='XEL_RETOUR_SPONTANE';
DELETE FROM spell              WHERE id='XEL_RETOUR_SPONTANE';

INSERT INTO spell (
    id, class_id, name, element, spell_type,
    pa_cost, pw_cost, po_min, po_max, po_modifiable, line_of_sight,
    cooldown, use_per_turn, use_per_target, direction, ratio_eval_mode, icon_id, is_aoe
) VALUES (
             'XEL_RETOUR_SPONTANE','XEL','Retour spontané','AIR','ELEMENTAL',
             3,0,1,3,TRUE,TRUE,
             0,3,2,'AREA','STEP', 771, FALSE
         );

INSERT INTO spell_ratio_breakpoint VALUES
    ('XEL_RETOUR_SPONTANE','NORMAL',200,80),
    ('XEL_RETOUR_SPONTANE','CRIT',  200,100);

INSERT INTO spell_variant (spell_id, kind)
VALUES ('XEL_RETOUR_SPONTANE','NORMAL'),
       ('XEL_RETOUR_SPONTANE','CRIT');

INSERT INTO effect_condition_group(op) VALUES ('AND');

INSERT INTO effect_condition (group_id, cond_type, params_json)
VALUES (1, 'LAST_MOVE_EXISTS', '{}');

INSERT INTO spell_effect (variant_id, phase, order_index, effect_type, target_scope, cond_group_id, params_json)
VALUES
    (3, 'ON_CAST',0,'DEAL_DAMAGE','TARGET',null, '{"amount":75,"element":"AIR"}'),
    (3, 'ON_CAST',1,'REWIND_LAST_MOVE','TARGET',1, '{}'),
    (4, 'ON_CAST',0,'DEAL_DAMAGE','TARGET',null, '{"amount":94,"element":"AIR"}'),
    (4, 'ON_CAST',1,'REWIND_LAST_MOVE','TARGET',1, '{}');
