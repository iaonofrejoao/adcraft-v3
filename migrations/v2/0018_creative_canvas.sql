-- Canvas Criativos: tabelas para o pipeline visual de geração de imagens e vídeos

CREATE TABLE creative_canvases (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id          uuid NOT NULL REFERENCES products(id),
  copy_combination_id uuid NOT NULL REFERENCES copy_combinations(id) UNIQUE,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

CREATE TABLE canvas_nodes (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canvas_id         uuid NOT NULL REFERENCES creative_canvases(id) ON DELETE CASCADE,
  type              text NOT NULL,   -- 'copy'|'personagem'|'cenario'|'produto'|'adicional'|'frame'|'video'
  label             text,
  position_x        float NOT NULL DEFAULT 0,
  position_y        float NOT NULL DEFAULT 0,
  prompt            text,
  config            jsonb DEFAULT '{}',  -- { count, aspect_ratio, model, scene_index? }
  generation_status text DEFAULT 'idle', -- 'idle'|'generating'|'done'|'error'
  error_message     text,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

CREATE TABLE canvas_edges (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canvas_id      uuid NOT NULL REFERENCES creative_canvases(id) ON DELETE CASCADE,
  source_node_id uuid NOT NULL REFERENCES canvas_nodes(id) ON DELETE CASCADE,
  target_node_id uuid NOT NULL REFERENCES canvas_nodes(id) ON DELETE CASCADE,
  created_at     timestamptz DEFAULT now()
);

CREATE TABLE canvas_node_outputs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id       uuid NOT NULL REFERENCES canvas_nodes(id) ON DELETE CASCADE,
  output_type   text NOT NULL,  -- 'image'|'video'
  drive_file_id text,
  drive_url     text,
  is_active     boolean DEFAULT true,
  created_at    timestamptz DEFAULT now()
);
