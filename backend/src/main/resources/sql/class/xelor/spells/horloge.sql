-- ============================
--  HORLOGE
-- ============================

-- nettoyage si déjà présent
DELETE FROM spell_effect       WHERE variant_id IN (SELECT id FROM spell_variant WHERE spell_id='XEL_HORLOGE');
DELETE FROM spell_variant      WHERE spell_id='XEL_HORLOGE';
DELETE FROM spell_ratio_breakpoint WHERE spell_id='XEL_HORLOGE';
DELETE FROM spell              WHERE id='XEL_HORLOGE';

DELETE FROM status_effect      WHERE status_id IN ('HORLOGE_BANK','HORLOGE_MARK');
DELETE FROM status_def         WHERE id IN ('HORLOGE_BANK','HORLOGE_MARK');

INSERT INTO spell (
    id, class_id, name, element, spell_type,
    pa_cost, pw_cost, po_min, po_max, po_modifiable, line_of_sight,
    cooldown, use_per_turn, use_per_target, direction, ratio_eval_mode, icon_id, is_aoe
) VALUES (
             'XEL_HORLOGE','XEL','Horloge','WATER','ELEMENTAL',
             5,0,1,3,TRUE,TRUE,
             0,2,1,'LINE','STEP', 763, FALSE
         );

INSERT INTO spell_ratio_breakpoint VALUES
    ('XEL_HORLOGE','NORMAL',200,149),
    ('XEL_HORLOGE','CRIT',200,186);

INSERT INTO spell_variant (spell_id, kind)
VALUES ('XEL_HORLOGE','NORMAL'),
       ('XEL_HORLOGE','CRIT');

-- Compteur horloge
INSERT INTO status_def (id, name, max_stacks, duration_type, base_duration)
VALUES ('HORLOGE_BANK','Banque Horloge',1,'INFINITE',NULL);

INSERT INTO status_def (id, name, max_stacks, duration_type, base_duration)
VALUES ('HORLOGE_MARK','Horloge',1,'FIXED',1);

-- Ticks de dégâts : fin du tour de la cible ET hour-wrap
INSERT INTO status_effect (status_id, tick_phase, effect_type, params_json) VALUES
    ('HORLOGE_MARK','ON_TARGET_TURN_END','DEAL_DAMAGE',
     '{"element":"WATER","indirect":true,"amountFromStatus":true,"doubleField":"double"}');

INSERT INTO status_effect (status_id, tick_phase, effect_type, params_json) VALUES
    ('HORLOGE_MARK','ON_HOUR_WRAPPED','DEAL_DAMAGE',
     '{"element":"WATER","indirect":true,"amountFromStatus":true,"doubleField":"double"}');

INSERT INTO spell_effect
(variant_id, phase, order_index, effect_type, target_scope, params_json, cond_group_id)
SELECT v.id, 'ON_CAST', 0, 'APPLY_STATUS', 'TARGET',
       '{
          "status":"HORLOGE_MARK",
          "amount":139,
          "duration":1,
          "doubleFromBank": { "bankStatus":"HORLOGE_BANK", "per":12, "consume":true }
        }', NULL
FROM spell_variant v
WHERE v.spell_id='XEL_HORLOGE' AND v.kind='NORMAL';

INSERT INTO spell_effect
(variant_id, phase, order_index, effect_type, target_scope, params_json, cond_group_id)
SELECT v.id, 'ON_CAST', 0, 'APPLY_STATUS', 'TARGET',
       '{
          "status":"HORLOGE_MARK",
          "amount":174,
          "duration":1,
          "doubleFromBank": { "bankStatus":"HORLOGE_BANK", "per":12, "consume":true }
        }', NULL
FROM spell_variant v
WHERE v.spell_id='XEL_HORLOGE' AND v.kind='CRIT';