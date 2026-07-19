-- ============================
-- PASSIVES
-- ============================

CREATE TABLE IF NOT EXISTS passive (
                                       id          VARCHAR(64) PRIMARY KEY,
    class_id    VARCHAR(32) NOT NULL,      -- 'XEL'
    name        VARCHAR(128) NOT NULL,
    description CLOB,
    icon_id     INT,
    -- Voir creation_tables_spells.sql : meme garantie pour l'index par icon_id du
    -- decodage de code deck, les passifs partageant l'espace d'icones des sorts.
    CONSTRAINT uq_passive_class_icon UNIQUE (class_id, icon_id)
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
