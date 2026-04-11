import * as cheerio from "cheerio";

export const READ_PAGE_TOOL = {
  name: "read_page",
  description:
    "Acessa uma URL via HTTP e extrai o conteúdo textual estruturado da página. " +
    "Ideal para ler páginas de venda, landing pages e páginas de produto afiliado. " +
    "Retorna título, texto limpo e meta descrição. Em modo 'structured' inclui " +
    "também dados JSON-LD (schema.org) e todas as meta tags. " +
    "Se a página estiver indisponível ou retornar status ≠ 200, retorna " +
    '{"error": "page_unavailable", "url": "..."} sem lançar exceção.',
  input_schema: {
    type: "object",
    properties: {
      url: {
        type: "string",
        description:
          "URL completa da página a ser lida, incluindo o esquema " +
          "(ex: https://exemplo.com/produto).",
      },
      extract_mode: {
        type: "string",
        enum: ["text", "structured"],
        default: "text",
        description:
          "'text': retorna título, texto limpo e meta descrição (padrão). " +
          "'structured': inclui também dados JSON-LD e todas as meta tags.",
      },
    },
    required: ["url"],
  },
};

const _last_call_by_domain = new Map<string, Date>();
const _DOMAIN_BACKOFF_SECONDS = 2.0;

const _HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; AdCraftBot/1.0; +https://adcraft.app/bot)",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
};

export async function executeReadPage(
  url: string,
  extractMode: "text" | "structured" = "text"
): Promise<any> {
  const domain = _extractDomain(url);
  await _applyDomainBackoff(domain);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
      headers: _HEADERS,
      signal: controller.signal,
    });
    
    clearTimeout(timeout);

    if (!response.ok) {
      console.warn(`read_page: status ${response.status} para ${url}`);
      return {
        error: "page_unavailable",
        url,
        reason: `HTTP ${response.status}`,
      };
    }

    const textBuffer = await response.arrayBuffer();
    const decoder = new TextDecoder("utf-8");
    // Limit to 5MB
    const content = decoder.decode(textBuffer.slice(0, 5 * 1024 * 1024));

    const $ = cheerio.load(content);

    const result: any = {
      title: _extractTitle($),
      text: _extractText($),
      meta_description: _extractMeta($, "description"),
    };

    if (extractMode === "structured") {
      result.structured_data = {
        json_ld: _extractJsonLd($),
        meta_tags: _extractAllMeta($),
      };
    }

    return result;
  } catch (error: any) {
    if (error.name === "AbortError") {
      console.warn(`read_page: timeout ao acessar ${url}`);
      return { error: "page_unavailable", url, reason: "timeout" };
    }
    console.warn(`read_page: erro de rede em ${url} - ${error.message}`);
    return { error: "page_unavailable", url, reason: error.message };
  }
}

function _extractDomain(urlStr: string): string {
  try {
    const url = new URL(urlStr);
    return url.hostname.toLowerCase();
  } catch (e) {
    return urlStr;
  }
}

async function _applyDomainBackoff(domain: string): Promise<void> {
  const last = _last_call_by_domain.get(domain);
  if (last) {
    const elapsed = (new Date().getTime() - last.getTime()) / 1000;
    if (elapsed < _DOMAIN_BACKOFF_SECONDS) {
      await new Promise((resolve) => setTimeout(resolve, (_DOMAIN_BACKOFF_SECONDS - elapsed) * 1000));
    }
  }
  _last_call_by_domain.set(domain, new Date());
}

function _extractTitle($: cheerio.CheerioAPI): string {
  return $("title").first().text().trim() || "";
}

function _extractMeta($: cheerio.CheerioAPI, name: string): string {
  let content = $(`meta[name="${name}"]`).attr("content");
  if (!content) {
    content = $(`meta[property="og:${name}"]`).attr("content");
  }
  return content || "";
}

function _extractText($: cheerio.CheerioAPI): string {
  // Remove unwanted elements
  $("script, style, noscript, nav, footer, header, aside").each((_, el) => {
    if ($(el).attr("type") === "application/ld+json") {
      return; 
    }
    $(el).remove();
  });

  // Cheerio get complete text recursively
  const rawText = $.text();
  const lines = rawText.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
  return lines.join("\n");
}

function _extractJsonLd($: cheerio.CheerioAPI): any[] {
  const results: any[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const text = $(el).html() || "";
      const parsed = JSON.parse(text);
      if (parsed) results.push(parsed);
    } catch (e) {
      // Ignore
    }
  });
  return results;
}

function _extractAllMeta($: cheerio.CheerioAPI): Record<string, string> {
  const meta: Record<string, string> = {};
  $("meta").each((_, el) => {
    const key = $(el).attr("name") || $(el).attr("property") || $(el).attr("http-equiv");
    const value = $(el).attr("content");
    if (key && value) {
      meta[key] = value;
    }
  });
  return meta;
}
