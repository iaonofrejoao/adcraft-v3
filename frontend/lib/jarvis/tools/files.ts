// Tools de acesso a arquivos do projeto para o Jarvis Claude agent.
// Scoped ao diretório raiz do projeto (pai do cwd do Next.js).
// Somente leitura — sem escrita ou execução.

import * as fs   from 'fs';
import * as path from 'path';

// Raiz do projeto: c:\dev\AdCraft v2  (pai de frontend/)
const PROJECT_ROOT = path.resolve(process.cwd(), '..');

/** Valida que um caminho resolvido está dentro do PROJECT_ROOT. */
function assertSafe(resolved: string): void {
  const safePath = PROJECT_ROOT.endsWith(path.sep)
    ? PROJECT_ROOT
    : PROJECT_ROOT + path.sep;
  if (!resolved.startsWith(safePath) && resolved !== PROJECT_ROOT) {
    throw new Error(`Acesso negado: caminho fora do projeto`);
  }
}

// Diretórios sempre ignorados nas buscas
const IGNORE_DIRS = new Set([
  'node_modules', '.git', '.next', 'dist', 'build',
  '__pycache__', '.pnpm', '.turbo', 'coverage', '.cache',
]);

// ── read_file ─────────────────────────────────────────────────────────────────

export const READ_FILE_TOOL = {
  name: 'read_file',
  description:
    'Lê o conteúdo de um arquivo do projeto AdCraft. ' +
    'Use para acessar skills de agentes, prompts, documentação, esquemas de banco ' +
    'e código fonte. Caminhos relativos à raiz do projeto (ex: "workers/agents/prompts/jarvis.md"). ' +
    'Retorna o conteúdo textual. Limite: 100KB por arquivo.',
  input_schema: {
    type: 'object' as const,
    properties: {
      file_path: {
        type: 'string',
        description:
          'Caminho relativo à raiz do projeto. ' +
          'Ex: "workers/agents/prompts/avatar_research.md", ' +
          '"frontend/lib/agent-registry.ts", ".claude/skills/frontend-adcraft.md".',
      },
    },
    required: ['file_path'],
  },
};

export async function executeReadFile(
  input: Record<string, unknown>,
): Promise<unknown> {
  const relativePath = (input.file_path as string).replace(/\\/g, '/');

  if (path.isAbsolute(relativePath) || relativePath.includes('..')) {
    return { error: 'Caminho inválido: não use caminhos absolutos ou "..".' };
  }

  const resolved = path.resolve(PROJECT_ROOT, relativePath);

  try {
    assertSafe(resolved);
  } catch (err) {
    return { error: (err as Error).message };
  }

  if (!fs.existsSync(resolved)) {
    return { error: `Arquivo não encontrado: ${relativePath}` };
  }

  const stat = fs.statSync(resolved);
  if (stat.isDirectory()) {
    return { error: `${relativePath} é um diretório. Use list_files para explorar.` };
  }

  const MAX_BYTES = 100 * 1024;
  if (stat.size > MAX_BYTES) {
    return {
      error:     `Arquivo muito grande (${Math.round(stat.size / 1024)}KB). Limite: 100KB.`,
      file_size: stat.size,
    };
  }

  try {
    const content = fs.readFileSync(resolved, 'utf-8');
    return { file_path: relativePath, size_bytes: stat.size, content };
  } catch (err) {
    return { error: `Erro ao ler arquivo: ${(err as Error).message}` };
  }
}

// ── list_files ────────────────────────────────────────────────────────────────

export const LIST_FILES_TOOL = {
  name: 'list_files',
  description:
    'Lista arquivos de um diretório do projeto. ' +
    'Use para explorar a estrutura antes de ler arquivos específicos. ' +
    'Retorna caminhos relativos à raiz. Limite: 200 entradas.',
  input_schema: {
    type: 'object' as const,
    properties: {
      directory: {
        type: 'string',
        description:
          'Caminho relativo à raiz do projeto. ' +
          'Ex: "workers/agents/prompts" (lista prompts), ' +
          '"frontend/lib/jarvis" (explora o Jarvis), ' +
          '".claude/skills" (lista skills).',
      },
      recursive: {
        type: 'boolean',
        description: 'Se true, lista recursivamente. Default false.',
        default: false,
      },
      extension_filter: {
        type: 'string',
        description:
          'Filtro por extensão (sem ponto). Ex: "ts", "md", "json". ' +
          'Omita para listar todos os arquivos.',
      },
    },
    required: ['directory'],
  },
};

function listDir(
  dirPath:  string,
  base:     string,
  recursive: boolean,
  extFilter: string | null,
  results:  string[],
): void {
  if (results.length >= 200) return;

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch { return; }

  for (const entry of entries) {
    if (results.length >= 200) break;

    if (IGNORE_DIRS.has(entry.name)) continue;

    const rel = base ? `${base}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      if (recursive) listDir(path.join(dirPath, entry.name), rel, recursive, extFilter, results);
    } else if (entry.isFile()) {
      if (extFilter) {
        const ext = entry.name.split('.').pop() ?? '';
        if (ext !== extFilter) continue;
      }
      results.push(rel);
    }
  }
}

export async function executeListFiles(
  input: Record<string, unknown>,
): Promise<unknown> {
  const dir       = ((input.directory as string) ?? '.').replace(/\\/g, '/');
  const recursive = (input.recursive as boolean | undefined) ?? false;
  const extFilter = (input.extension_filter as string | undefined) ?? null;

  if (path.isAbsolute(dir) || dir.includes('..')) {
    return { error: 'Caminho inválido: não use caminhos absolutos ou "..".' };
  }

  const resolved = path.resolve(PROJECT_ROOT, dir);
  try {
    assertSafe(resolved);
  } catch (err) {
    return { error: (err as Error).message };
  }

  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
    return { error: `Diretório não encontrado: ${dir}` };
  }

  const files: string[] = [];
  listDir(resolved, dir === '.' ? '' : dir, recursive, extFilter, files);

  return {
    directory:  dir,
    recursive,
    count:      files.length,
    truncated:  files.length >= 200,
    files:      files.sort(),
  };
}

// ── search_in_files ───────────────────────────────────────────────────────────

export const SEARCH_IN_FILES_TOOL = {
  name: 'search_in_files',
  description:
    'Busca texto em arquivos do projeto (grep-like). ' +
    'Use para encontrar onde uma constante é definida, como uma função é usada, ' +
    'ou qual arquivo contém um trecho específico de código ou documentação.',
  input_schema: {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description: 'Texto ou padrão regex a buscar nos arquivos.',
      },
      directory: {
        type: 'string',
        description:
          'Diretório de busca relativo à raiz. Default: raiz do projeto. ' +
          'Ex: "workers" para buscar só nos workers, "frontend/lib" para o lib.',
        default: '.',
      },
      extensions: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Extensões de arquivo a incluir (sem ponto). ' +
          'Default: ["ts", "tsx", "md", "json", "sql", "py"]. ' +
          'Ex: ["ts", "tsx"] para TypeScript.',
      },
      max_results: {
        type: 'integer',
        description: 'Máximo de arquivos com matches. Default 10, máximo 30.',
        default: 10,
      },
    },
    required: ['query'],
  },
};

function walkForSearch(
  dirPath:    string,
  extensions: Set<string>,
  files:      string[],
  limit:      number,
): void {
  if (files.length >= limit) return;

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch { return; }

  for (const entry of entries) {
    if (files.length >= limit) break;
    if (IGNORE_DIRS.has(entry.name)) continue;

    const full = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walkForSearch(full, extensions, files, limit);
    } else if (entry.isFile()) {
      const ext = entry.name.split('.').pop() ?? '';
      if (extensions.has(ext)) files.push(full);
    }
  }
}

export async function executeSearchInFiles(
  input: Record<string, unknown>,
): Promise<unknown> {
  const query      = input.query as string;
  const dir        = ((input.directory as string | undefined) ?? '.').replace(/\\/g, '/');
  const extensions = new Set<string>(
    (input.extensions as string[] | undefined) ?? ['ts', 'tsx', 'md', 'json', 'sql', 'py'],
  );
  const maxResults = Math.min(Math.max(1, (input.max_results as number | undefined) ?? 10), 30);

  if (path.isAbsolute(dir) || dir.includes('..')) {
    return { error: 'Caminho inválido: não use caminhos absolutos ou "..".' };
  }

  const baseDir = path.resolve(PROJECT_ROOT, dir);
  try {
    assertSafe(baseDir);
  } catch (err) {
    return { error: (err as Error).message };
  }

  let regex: RegExp;
  try {
    regex = new RegExp(query, 'gi');
  } catch {
    regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  }

  // Coleta arquivos candidatos
  const candidateFiles: string[] = [];
  walkForSearch(baseDir, extensions, candidateFiles, 5000);

  const matches: Array<{ file: string; hits: Array<{ line: number; text: string }> }> = [];

  for (const filePath of candidateFiles) {
    if (matches.length >= maxResults) break;

    let content: string;
    try {
      const stat = fs.statSync(filePath);
      if (stat.size > 200 * 1024) continue;
      content = fs.readFileSync(filePath, 'utf-8');
    } catch { continue; }

    const lines = content.split('\n');
    const hits: Array<{ line: number; text: string }> = [];

    for (let i = 0; i < lines.length; i++) {
      regex.lastIndex = 0;
      if (regex.test(lines[i])) {
        hits.push({ line: i + 1, text: lines[i].trim().slice(0, 200) });
        if (hits.length >= 5) break;
      }
    }

    if (hits.length > 0) {
      const rel = path.relative(PROJECT_ROOT, filePath).replace(/\\/g, '/');
      matches.push({ file: rel, hits });
    }
  }

  return {
    query,
    directory: dir,
    total_files_with_matches: matches.length,
    results: matches,
  };
}
