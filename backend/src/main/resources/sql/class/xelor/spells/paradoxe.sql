-- ============================
--  PARADOXE
-- ============================

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

INSERT INTO spell_effect (variant_id, phase, order_index, effect_type, target_scope, params_json) VALUES
                                                                                                      (5,'ON_CAST',0,'TELEPORT_SYMMETRIC','AREA','{}'),
                                                                                                      (5,'ON_CAST',1,'DEAL_DAMAGE','TARGET','{"amount":78,"element":"AIR"}'),
                                                                                                      (6,'ON_CAST',0,'TELEPORT_SYMMETRIC','AREA','{}'),
                                                                                                      (6,'ON_CAST',1,'DEAL_DAMAGE','TARGET','{"amount":98,"element":"AIR"}');