-- =========================================
-- CONNAISSANCE DU PASSÉ
-- =========================================

-- nettoyage si déjà présent
DELETE FROM passive_effect WHERE passive_id = 'XEL_CONNAISSANCE_PASSE';
DELETE FROM passive WHERE id = 'XEL_CONNAISSANCE_PASSE';

INSERT INTO passive (id, class_id, name, description) VALUES
    ('XEL_CONNAISSANCE_PASSE','XEL','Connaissance du passé',
     'À chaque tour de cadran : +2 PW. Gagnera +2 PA en début de tour. '
         'Le Cadran coûte +2 PW et son temps de relance augmente de 1.');

-- +2 PW à chaque tour de cadran
INSERT INTO passive_effect (passive_id, trigger, order_index, effect_type, target_scope, params_json)
VALUES
    ('XEL_CONNAISSANCE_PASSE','ON_HOUR_WRAPPED',0,'ADD_PW','SELF','{"amount":2}');

-- +2 PA en début de tour
INSERT INTO passive_effect (passive_id, trigger, order_index, effect_type, target_scope, params_json)
VALUES
    ('XEL_CONNAISSANCE_PASSE','ON_CASTER_TURN_START',0,'ADD_AP','SELF','{"amount":2}');

-- Cadran : +2 PW de coût
INSERT INTO passive_effect (passive_id, trigger, order_index, effect_type, target_scope, params_json)
VALUES
    ('XEL_CONNAISSANCE_PASSE','ON_PASSIVE_EQUIPPED',1,'ADD_SPELL_EXTRA_COST','SELF',
     '{"spellId":"XEL_CADRAN","resource":"PW","extra":2}');

-- Cadran : +1 cd
INSERT INTO passive_effect (passive_id, trigger, order_index, effect_type, target_scope, params_json)
VALUES
    ('XEL_CONNAISSANCE_PASSE','ON_PASSIVE_EQUIPPED',2,'ADD_SPELL_COOLDOWN_DELTA','SELF',
     '{"spellId":"XEL_CADRAN","delta":1}');
