const API_BASE_URL = "https://api.heygen.com";
const REQUEST_TIMEOUT_MS = 30_000;

export class HeygenApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly isRateLimit: boolean = false,
    public readonly code: string | null = null,
  ) {
    super(message);
    this.name = "HeygenApiError";
  }
}

function getApiKey(): string {
  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) {
    throw new Error(
      "HEYGEN_API_KEY não configurada. Defina a variável de ambiente no arquivo .env.local.",
    );
  }
  return apiKey;
}

async function withTimeout<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number = REQUEST_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fn(controller.signal);
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new HeygenApiError("Tempo limite excedido ao chamar a API da HeyGen.", 504);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

async function parseError(response: Response): Promise<{ message: string; code: string | null }> {
  try {
    const body = (await response.json()) as {
      message?: string;
      error?: { message?: string; code?: string } | string;
    };
    if (typeof body.error === "string") return { message: body.error, code: null };
    if (body.error?.message) return { message: body.error.message, code: body.error.code ?? null };
    if (body.message) return { message: body.message, code: null };
  } catch {
    // corpo não era JSON
  }
  return { message: `HeyGen respondeu com status ${response.status}`, code: null };
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (response.status === 429) {
    throw new HeygenApiError(
      "Limite de requisições da HeyGen atingido. Tente novamente em instantes.",
      429,
      true,
    );
  }
  if (!response.ok) {
    const { message, code } = await parseError(response);
    throw new HeygenApiError(message, response.status, false, code);
  }
  return (await response.json()) as T;
}

export async function heygenJsonRequest<T>(
  path: string,
  init: { method: "GET" | "POST" | "DELETE"; body?: unknown; timeoutMs?: number },
): Promise<T> {
  return withTimeout(async (signal) => {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: init.method,
      headers: {
        "X-Api-Key": getApiKey(),
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal,
    });
    return handleResponse<T>(response);
  }, init.timeoutMs);
}

// POST /v3/assets — upload multipart/form-data (imagens até 32MB).
export async function heygenAssetUpload<T>(fileBuffer: Buffer, mimeType: string): Promise<T> {
  return withTimeout(async (signal) => {
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(fileBuffer)], { type: mimeType }), "upload");
    const response = await fetch(`${API_BASE_URL}/v3/assets`, {
      method: "POST",
      headers: { "X-Api-Key": getApiKey() },
      body: form,
      signal,
    });
    return handleResponse<T>(response);
  });
}
