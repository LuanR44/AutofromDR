import type { GenerateVideoResponse } from "../types";

// Cache em memória do processo (sem banco de dados) para evitar a criação de
// vídeos duplicados quando o cliente reenvia a mesma requisição (ex.: retry de rede).
// Limitação: reinicia quando o servidor é reiniciado e não é compartilhado entre instâncias.

interface IdempotencyRecord {
  result: GenerateVideoResponse;
  expiresAt: number;
}

const TTL_MS = 60 * 60_000;
const store = new Map<string, IdempotencyRecord>();

function cleanupExpired(): void {
  const now = Date.now();
  for (const [key, record] of store) {
    if (record.expiresAt < now) store.delete(key);
  }
}

export function getIdempotentResult(key: string): GenerateVideoResponse | null {
  cleanupExpired();
  const record = store.get(key);
  if (!record || record.expiresAt < Date.now()) return null;
  return record.result;
}

export function saveIdempotentResult(key: string, result: GenerateVideoResponse): void {
  store.set(key, { result, expiresAt: Date.now() + TTL_MS });
}
