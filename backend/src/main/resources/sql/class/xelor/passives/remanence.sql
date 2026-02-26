-- =========================================
-- RÉMANENCE
-- =========================================

-- nettoyage si déjà présent
DELETE FROM passive_effect WHERE passive_id = 'XEL_REMANENCE';
DELETE FROM passive WHERE id = 'XEL_REMANENCE';

INSERT INTO passive (id, class_id, name, description) VALUES
    ('XEL_REMANENCE','XEL','Rémanence',
     'Les invocations ne bloquent plus la ligne de vue. +1 Sinistro max et +1 Rouage max.');

-- LOS : les invocations du lanceur ne bloquent plus
INSERT INTO passive_effect (passive_id, trigger, order_index, effect_type, target_scope, params_json)
VALUES
    ('XEL_REMANENCE','ALWAYS',0,'SUMMONS_IGNORE_LOS','SELF','{"value":true}');

-- +1 limite de SINISTRO
INSERT INTO passive_effect (passive_id, trigger, order_index, effect_type, target_scope, params_json)
VALUES
    ('XEL_REMANENCE','ON_PASSIVE_EQUIPPED',1,'INCREASE_MECHANISM_LIMIT','SELF',
     '{"kind":"SINISTRO","delta":1}');

-- +1 limite de ROUAGE
INSERT INTO passive_effect (passive_id, trigger, order_index, effect_type, target_scope, params_json)
VALUES
    ('XEL_REMANENCE','ON_PASSIVE_EQUIPPED',2,'INCREASE_MECHANISM_LIMIT','SELF',
     '{"kind":"ROUAGE","delta":1}');
