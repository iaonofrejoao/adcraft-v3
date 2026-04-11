// Cliente VEO 3 via Vertex AI REST API.
// Fase 4.1 — PRD seção 5 (video generation).
//
// Vars de ambiente requeridas:
//   GOOGLE_CLOUD_PROJECT      — GCP project ID
//   GOOGLE_CLOUD_LOCATION     — ex: "us-central1"
//   GOOGLE_APPLICATION_CREDENTIALS — path para service account JSON
//                              OU GOOGLE_API_KEY (para acesso via API key)
//
// Fluxo:
//   1. generateVideoClip(prompt, opts) → envia predictLongRunning
//   2. pollOperation(operationName)    → aguarda até done=true ou timeout
//   3. Retorna Buffer com bytes do MP4 gerado

import { GoogleAuth } from 'google-auth-library';

// ── Configuração ──────────────────────────────────────────────────────────────

const VEO3_MODEL         = 'veo-3.0-generate-001';
const POLL_INTERVAL_MS   = 10_000;   // 10 segundos
const MAX_POLL_ATTEMPTS  = 72;       // 72 × 10s = 12 minutos máximo por clipe

export type AspectRatioVeo = '9:16' | '1:1' | '16:9' | '4:5';

export interface GenerateClipOptions {
  /** Duração do clipe em segundos. VEO 3 aceita 5–8 s por clipe. */
  durationSeconds?: number;
  /** Aspect ratio do vídeo. Default: "9:16" (mobile-first). */
  aspectRatio?: AspectRatioVeo;
  /** Se o VEO 3 deve gerar áudio nativo. Default: false. */
  generateAudio?: boolean;
  /** Número de variações geradas (escolhemos a primeira). Default: 1. */
  sampleCount?: number;
}

export interface GeneratedClip {
  /** Bytes do MP4 gerado pelo VEO 3. */
  videoBuffer: Buffer;
  /** URI no GCS (se disponível na resposta). */
  gcsUri?: string;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

const auth = new GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/cloud-platform'],
});

async function getAccessToken(): Promise<string> {
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  const token = tokenResponse?.token ?? tokenResponse as unknown as string;
  if (!token) throw new Error('veo3-client: não foi possível obter access token do Google Auth.');
  return token;
}

function vertexAiBase(): string {
  const location = process.env.GOOGLE_CLOUD_LOCATION ?? 'us-central1';
  return `https://${location}-aiplatform.googleapis.com/v1`;
}

function projectPath(): string {
  const project  = process.env.GOOGLE_CLOUD_PROJECT;
  const location = process.env.GOOGLE_CLOUD_LOCATION ?? 'us-central1';
  if (!project) throw new Error('veo3-client: GOOGLE_CLOUD_PROJECT não definido.');
  return `projects/${project}/locations/${location}`;
}

// ── Geração de clipe ──────────────────────────────────────────────────────────

/**
 * Gera um único clipe de vídeo a partir de um prompt textual via VEO 3.
 *
 * @param prompt  Descrição em linguagem natural da cena a ser gerada.
 * @param opts    Opções de duração, aspect ratio e áudio.
 * @returns       Buffer com bytes do MP4.
 */
export async function generateVideoClip(
  prompt: string,
  opts: GenerateClipOptions = {},
): Promise<GeneratedClip> {
  const {
    durationSeconds = 8,
    aspectRatio     = '9:16',
    generateAudio   = false,
    sampleCount     = 1,
  } = opts;

  const token = await getAccessToken();
  const base  = vertexAiBase();
  const path  = projectPath();

  // ── 1. Submete a operação longa ───────────────────────────────────────────
  const predictUrl = `${base}/${path}/publishers/google/models/${VEO3_MODEL}:predictLongRunning`;

  const requestBody = {
    instances: [
      {
        prompt,
        generate_audio: generateAudio,
      },
    ],
    parameters: {
      aspectRatio,
      sampleCount,
      durationSeconds,
    },
  };

  const submitResp = await fetch(predictUrl, {
    method:  'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!submitResp.ok) {
    const body = await submitResp.text();
    throw new Error(
      `veo3-client: predictLongRunning falhou (${submitResp.status}): ${body.slice(0, 400)}`,
    );
  }

  const submitData = (await submitResp.json()) as { name?: string };
  const operationName = submitData.name;
  if (!operationName) {
    throw new Error('veo3-client: resposta sem nome de operação.');
  }

  // ── 2. Aguarda conclusão via polling ──────────────────────────────────────
  const clip = await pollOperation(operationName, token);
  return clip;
}

// ── Polling ───────────────────────────────────────────────────────────────────

interface OperationResponse {
  done?:     boolean;
  error?:    { code: number; message: string };
  response?: {
    predictions?: Array<{
      bytesBase64Encoded?: string;
      gcsUri?:             string;
    }>;
    videos?: Array<{
      gcsUri?:        string;
      encodedVideo?:  string;
    }>;
  };
}

async function pollOperation(
  operationName: string,
  token: string,
): Promise<GeneratedClip> {
  const base     = vertexAiBase();
  // O operationName vem como "projects/.../operations/..." — usamos como path absoluto
  const pollUrl  = `${base}/${operationName}`;

  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    await sleep(POLL_INTERVAL_MS);

    const resp = await fetch(pollUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(
        `veo3-client: polling de operação falhou (${resp.status}): ${body.slice(0, 400)}`,
      );
    }

    const data: OperationResponse = await resp.json();

    if (data.error) {
      throw new Error(
        `veo3-client: operação VEO 3 retornou erro ${data.error.code}: ${data.error.message}`,
      );
    }

    if (!data.done) continue;

    // ── Extrai vídeo da resposta ──────────────────────────────────────────
    const clip = extractClip(data);
    if (!clip) {
      throw new Error('veo3-client: operação concluída mas sem vídeo na resposta.');
    }

    return clip;
  }

  throw new Error(
    `veo3-client: timeout após ${MAX_POLL_ATTEMPTS} tentativas de polling (operação: ${operationName}).`,
  );
}

function extractClip(data: OperationResponse): GeneratedClip | null {
  const response = data.response;
  if (!response) return null;

  // Formato predictions (Vertex AI Predict)
  const predictions = response.predictions;
  if (predictions && predictions.length > 0) {
    const pred = predictions[0];
    if (pred.bytesBase64Encoded) {
      return {
        videoBuffer: Buffer.from(pred.bytesBase64Encoded, 'base64'),
        gcsUri:      pred.gcsUri,
      };
    }
  }

  // Formato videos (resposta alternativa do VEO)
  const videos = response.videos;
  if (videos && videos.length > 0) {
    const vid = videos[0];
    if (vid.encodedVideo) {
      return {
        videoBuffer: Buffer.from(vid.encodedVideo, 'base64'),
        gcsUri:      vid.gcsUri,
      };
    }
    if (vid.gcsUri) {
      // GCS URI sem base64 inline — precisaria de download via GCS client
      // Por ora, lança erro orientativo
      throw new Error(
        `veo3-client: vídeo disponível em GCS mas download direto não implementado. ` +
        `URI: ${vid.gcsUri}. Configure generate_audio=false para obter bytes inline.`,
      );
    }
  }

  return null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
