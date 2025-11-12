-- ============================
-- PASSIVES
-- ============================

CREATE TABLE IF NOT EXISTS passive (
                                       id          VARCHAR(64) PRIMARY KEY,
    class_id    VARCHAR(32) NOT NULL,      -- 'XEL'
    name        VARCHAR(128) NOT NULL,
    description CLOB
    );

CREATE TABLE IF NOT EXISTS passive_effect (
                                              id            IDENTITY PRIMARY KEY,
                                              passive_id    VARCHAR(64) NOT NULL,
    trigger       VARCHAR(32) NOT NULL,
    order_index   INT NOT NULL DEFAULT 0,
    effect_type   VARCHAR(64) NOT NULL,
    target_scope  VARCHAR(32) NOT NULL,
    params_json   CLOB,
    cond_group_id BIGINT,
    FOREIGN KEY (passive_id) REFERENCES passive(id),
    FOREIGN KEY (cond_group_id) REFERENCES effect_condition_group(id)
    );
