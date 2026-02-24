-- ============================
--  SYMÉTRIE
-- ============================

-- nettoyage si déjà présent
DELETE FROM spell_effect       WHERE variant_id IN (SELECT id FROM spell_variant WHERE spell_id='XEL_SYMETRIE');
DELETE FROM spell_variant      WHERE spell_id='XEL_SYMETRIE';
DELETE FROM spell_ratio_breakpoint WHERE spell_id='XEL_SYMETRIE';
DELETE FROM spell              WHERE id='XEL_SYMETRIE';

INSERT INTO spell VALUES (
                             'XEL_SYMETRIE','XEL','Symétrie','AIR','ELEMENTAL',
                             3,0,1,3,FALSE,TRUE,
                             0,3,1,'NONE','STEP'
                         );

INSERT INTO spell_ratio_breakpoint VALUES
    ('XEL_SYMETRIE',185,58);

INSERT INTO spell_variant (spell_id, kind)
VALUES ('XEL_SYMETRIE','NORMAL'),
       ('XEL_SYMETRIE','CRIT');

-- Effets NORMAL
INSERT INTO spell_effect (variant_id, phase, order_index, effect_type, target_scope, params_json)
SELECT v.id, 'ON_CAST', 0, 'TELEPORT_SYMMETRIC', 'TARGET',
       '{"mode":"SINGLE_TARGET","reverseOnOddHour":true}'
FROM spell_variant v WHERE v.spell_id='XEL_SYMETRIE' AND v.kind='NORMAL';

INSERT INTO spell_effect (variant_id, phase, order_index, effect_type, target_scope, params_json)
SELECT v.id, 'ON_CAST', 1, 'DEAL_DAMAGE', 'TARGET', '{"amount":58,"element":"AIR"}'
FROM spell_variant v WHERE v.spell_id='XEL_SYMETRIE' AND v.kind='NORMAL';

-- Effets CRIT
INSERT INTO spell_effect (variant_id, phase, order_index, effect_type, target_scope, params_json)
SELECT v.id, 'ON_CAST', 0, 'TELEPORT_SYMMETRIC', 'TARGET',
       '{"mode":"SINGLE_TARGET","reverseOnOddHour":true}'
FROM spell_variant v WHERE v.spell_id='XEL_SYMETRIE' AND v.kind='CRIT';

INSERT INTO spell_effect (variant_id, phase, order_index, effect_type, target_scope, params_json)
SELECT v.id, 'ON_CAST', 1, 'DEAL_DAMAGE', 'TARGET', '{"amount":72,"element":"AIR"}'
FROM spell_variant v WHERE v.spell_id='XEL_SYMETRIE' AND v.kind='CRIT';