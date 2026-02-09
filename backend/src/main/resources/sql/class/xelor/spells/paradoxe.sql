-- ============================
--  PARADOXE
-- ============================

-- nettoyage si déjà présent
DELETE FROM spell_effect       WHERE variant_id IN (SELECT id FROM spell_variant WHERE spell_id='XEL_PARADOXE');
DELETE FROM spell_variant      WHERE spell_id='XEL_PARADOXE';
DELETE FROM spell_ratio_breakpoint WHERE spell_id='XEL_PARADOXE';
DELETE FROM spell              WHERE id='XEL_PARADOXE';

INSERT INTO spell VALUES (
                             'XEL_PARADOXE','XEL','Paradoxe','AIR','ELEMENTAL',
                             4,0,1,3,TRUE,TRUE,
                             0,2,1,'NONE','STEP'
                         );

INSERT INTO spell_ratio_breakpoint VALUES
    ('XEL_PARADOXE',185,78);

INSERT INTO spell_variant (spell_id, kind)
VALUES ('XEL_PARADOXE','NORMAL'),
       ('XEL_PARADOXE','CRIT');

-- Effets NORMAL
INSERT INTO spell_effect (variant_id, phase, order_index, effect_type, target_scope, params_json)
SELECT v.id, 'ON_CAST', 0, 'TELEPORT_SYMMETRIC', 'AREA', '{}'
FROM spell_variant v WHERE v.spell_id='XEL_PARADOXE' AND v.kind='NORMAL';

INSERT INTO spell_effect (variant_id, phase, order_index, effect_type, target_scope, params_json)
SELECT v.id, 'ON_CAST', 1, 'DEAL_DAMAGE', 'TARGET', '{"amount":78,"element":"AIR"}'
FROM spell_variant v WHERE v.spell_id='XEL_PARADOXE' AND v.kind='NORMAL';

-- Effets CRIT
INSERT INTO spell_effect (variant_id, phase, order_index, effect_type, target_scope, params_json)
SELECT v.id, 'ON_CAST', 0, 'TELEPORT_SYMMETRIC', 'AREA', '{}'
FROM spell_variant v WHERE v.spell_id='XEL_PARADOXE' AND v.kind='CRIT';

INSERT INTO spell_effect (variant_id, phase, order_index, effect_type, target_scope, params_json)
SELECT v.id, 'ON_CAST', 1, 'DEAL_DAMAGE', 'TARGET', '{"amount":98,"element":"AIR"}'
FROM spell_variant v WHERE v.spell_id='XEL_PARADOXE' AND v.kind='CRIT';
