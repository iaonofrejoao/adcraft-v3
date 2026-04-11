-- 1. Criação do SKU trigger nas tabelas de Produtos
ALTER TABLE products ADD COLUMN IF NOT EXISTS sku char(4) UNIQUE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS slug text;

CREATE OR REPLACE FUNCTION generate_random_sku()
RETURNS TRIGGER AS $$
DECLARE
    new_sku char(4);
    is_unique boolean := false;
BEGIN
    WHILE NOT is_unique LOOP
        new_sku := substr(md5(random()::text), 1, 4);
        SELECT NOT EXISTS(SELECT 1 FROM products WHERE sku = new_sku) INTO is_unique;
    END LOOP;
    
    NEW.sku := upper(new_sku);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_generate_sku ON products;
CREATE TRIGGER trigger_generate_sku
BEFORE INSERT ON products
FOR EACH ROW
WHEN (NEW.sku IS NULL)
EXECUTE FUNCTION generate_random_sku();

ALTER TABLE niches ADD COLUMN IF NOT EXISTS embedding_anchor text;

-- Criação do Index para Vector (requer 'vector' extension de 000)
CREATE INDEX IF NOT EXISTS idx_embeddings_hnsw ON embeddings USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_embeddings_source ON embeddings (source_table, source_id);

-- 2. Trigger de validação em copy_combinations
CREATE OR REPLACE FUNCTION validate_copy_components_approved()
RETURNS TRIGGER AS $$
DECLARE
    v_hook_appr text;
    v_body_appr text;
    v_cta_appr text;
BEGIN
    SELECT approval_status INTO v_hook_appr FROM copy_components WHERE id = NEW.hook_id;
    SELECT approval_status INTO v_body_appr FROM copy_components WHERE id = NEW.body_id;
    SELECT approval_status INTO v_cta_appr FROM copy_components WHERE id = NEW.cta_id;

    IF v_hook_appr IS DISTINCT FROM 'approved' THEN
        RAISE EXCEPTION 'Hook component is not approved.';
    END IF;

    IF v_body_appr IS DISTINCT FROM 'approved' THEN
        RAISE EXCEPTION 'Body component is not approved.';
    END IF;

    IF v_cta_appr IS DISTINCT FROM 'approved' THEN
        RAISE EXCEPTION 'CTA component is not approved.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_copy_combinations_validation ON copy_combinations;
CREATE TRIGGER trigger_copy_combinations_validation
BEFORE INSERT ON copy_combinations
FOR EACH ROW
EXECUTE FUNCTION validate_copy_components_approved();

-- 3. Função de polling SKIP LOCKED
CREATE OR REPLACE FUNCTION fetch_next_pending_task()
RETURNS SETOF tasks AS $$
BEGIN
    RETURN QUERY
    UPDATE tasks
    SET status = 'running', started_at = NOW()
    WHERE id = (
        SELECT id
        FROM tasks
        WHERE status = 'pending'
        -- Verifica se TODAS as dependências já estão concluídas
        AND NOT EXISTS (
            SELECT 1 
            FROM tasks t2 
            WHERE t2.id = ANY(tasks.depends_on) AND t2.status != 'completed'
        )
        ORDER BY created_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
    )
    RETURNING *;
END;
$$ LANGUAGE plpgsql;

-- 4. RLS tables
ALTER TABLE pipelines ENABLE ROW LEVEL SECURITY;
CREATE POLICY policy_pipelines_user
ON pipelines
FOR ALL
USING (user_id = auth.uid());

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY policy_conversations_user
ON conversations
FOR ALL
USING (user_id = auth.uid());
