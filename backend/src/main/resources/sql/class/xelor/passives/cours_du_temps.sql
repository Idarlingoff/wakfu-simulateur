-- =========================================
-- COURS DU TEMPS
-- =========================================

-- nettoyage si déjà présent
DELETE FROM passive_effect WHERE passive_id = 'XEL_COURS_TEMPS';
DELETE FROM passive WHERE id = 'XEL_COURS_TEMPS';

INSERT INTO passive (id, class_id, name, description) VALUES
    ('XEL_COURS_TEMPS','XEL','Cours du temps',
     'À chaque transposition causée par le Xélor : +1 PA si Distorsion actif, sinon +1 PW. Distorsion a 3 tours de relance.');

INSERT INTO effect_condition_group (op) VALUES ('AND');
INSERT INTO effect_condition_group (op) VALUES ('AND');

INSERT INTO effect_condition (group_id, cond_type, params_json)
SELECT MAX(id)-1, 'STATUS_ACTIVE', '{"status":"DISTORTION_ACTIVE"}' FROM effect_condition_group;

INSERT INTO effect_condition (group_id, cond_type, params_json)
SELECT MAX(id),   'STATUS_INACTIVE', '{"status":"DISTORTION_ACTIVE"}' FROM effect_condition_group;

-- ========== Modèle 1 : ON_TRANSPOSE ==========
-- Si Distorsion ACTIVE -> +1 PA par transposition
INSERT INTO passive_effect (passive_id, trigger, order_index, effect_type, target_scope, params_json, cond_group_id)
VALUES ('XEL_COURS_TEMPS','ON_TRANSPOSE',0,'ADD_AP','SELF','{"amount":1}',
        (SELECT MAX(id)-1 FROM effect_condition_group));

-- Sinon -> +1 PW par transposition
INSERT INTO passive_effect (passive_id, trigger, order_index, effect_type, target_scope, params_json, cond_group_id)
VALUES ('XEL_COURS_TEMPS','ON_TRANSPOSE',1,'ADD_PW','SELF','{"amount":1}',
        (SELECT MAX(id) FROM effect_condition_group));

-- ========== Modèle 2 : ON_SWAP ==========
-- Si Distorsion ACTIVE -> +2 PA pour un échange
INSERT INTO passive_effect (passive_id, trigger, order_index, effect_type, target_scope, params_json, cond_group_id)
VALUES ('XEL_COURS_TEMPS','ON_SWAP',0,'ADD_AP','SELF','{"amount":2}',
        (SELECT MAX(id)-1 FROM effect_condition_group));

-- Sinon -> +2 PW pour un échange
INSERT INTO passive_effect (passive_id, trigger, order_index, effect_type, target_scope, params_json, cond_group_id)
VALUES ('XEL_COURS_TEMPS','ON_SWAP',1,'ADD_PW','SELF','{"amount":2}',
        (SELECT MAX(id) FROM effect_condition_group));

INSERT INTO passive_effect (passive_id, trigger, order_index, effect_type, target_scope, params_json)
VALUES ('XEL_COURS_TEMPS','ON_PASSIVE_EQUIPPED',10,'SET_SPELL_BASE_COOLDOWN','SELF',
        '{"spellId":"XEL_DISTO","cooldown":3}');
