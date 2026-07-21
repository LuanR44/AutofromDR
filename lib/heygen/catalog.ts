import { heygenJsonRequest } from "./client";
import type { AvatarOption, VoiceOption } from "../types";

const CACHE_TTL_MS = 5 * 60_000;
const DEFAULT_MAX_PAGES = 30; // teto de segurança para não paginar indefinidamente

interface PaginatedResponse<T> {
  data: T[];
  has_more: boolean;
  next_token?: string | null;
}

async function fetchAllPages<T>(
  path: string,
  pageSize: number,
  maxPages: number = DEFAULT_MAX_PAGES,
  extraParams: Record<string, string> = {},
): Promise<T[]> {
  const items: T[] = [];
  let nextToken: string | undefined;

  for (let page = 0; page < maxPages; page++) {
    const params = new URLSearchParams({ limit: String(pageSize), ...extraParams });
    if (nextToken) params.set("token", nextToken);

    const response = await heygenJsonRequest<PaginatedResponse<T>>(`${path}?${params}`, {
      method: "GET",
    });
    items.push(...response.data);

    if (!response.has_more || !response.next_token) break;
    nextToken = response.next_token;
  }

  return items;
}

// GET /v3/avatars retorna GRUPOS de avatar (ex.: "Marco"); o `id` desse grupo NÃO é aceito
// como avatar_id em POST /v3/videos. É preciso usar o `id` de um "look" específico do grupo,
// listado em /v3/avatars/looks — por isso o catálogo de avatares usa este último endpoint
// diretamente (cada item já é um avatar_id diretamente utilizável na geração de vídeo).
//
// Filtramos por avatar_type=studio_avatar: testado na prática, é o único tipo em que o
// `background` da geração de vídeo substitui a cena inteira atrás do avatar (chroma-key real).
// Nos tipos "photo_avatar" e "digital_twin" o `background` só preenche as bordas de
// letterbox/pillarbox quando a proporção do vídeo não bate com a foto original do avatar — a
// cena de fundo original da foto continua visível atrás do avatar.
interface AvatarLookApiItem {
  id: string;
  name: string;
  preview_image_url?: string;
  gender?: string;
  status: string;
}

interface VoiceApiItem {
  voice_id: string;
  name: string;
  language: string;
  gender?: string;
  preview_audio_url?: string;
}

let avatarsCache: { data: AvatarOption[]; expiresAt: number } | null = null;
let voicesCache: { data: VoiceOption[]; expiresAt: number } | null = null;

export async function listAvatars(): Promise<AvatarOption[]> {
  if (avatarsCache && avatarsCache.expiresAt > Date.now()) {
    return avatarsCache.data;
  }
  // Limitamos a um número prático de páginas para manter o carregamento rápido (o catálogo
  // completo de looks é muito maior que o de avatares agrupados).
  const items = await fetchAllPages<AvatarLookApiItem>("/v3/avatars/looks", 50, 10, {
    avatar_type: "studio_avatar",
  });
  const avatars: AvatarOption[] = items
    .filter((a) => a.status === "completed")
    .map((a) => ({
      avatarId: a.id,
      name: a.name,
      previewImageUrl: a.preview_image_url ?? null,
      gender: a.gender ?? null,
    }));
  avatarsCache = { data: avatars, expiresAt: Date.now() + CACHE_TTL_MS };
  return avatars;
}

export async function listVoices(): Promise<VoiceOption[]> {
  if (voicesCache && voicesCache.expiresAt > Date.now()) {
    return voicesCache.data;
  }
  const items = await fetchAllPages<VoiceApiItem>("/v3/voices", 100);
  const voices: VoiceOption[] = items.map((v) => ({
    voiceId: v.voice_id,
    name: v.name,
    language: v.language,
    gender: v.gender ?? null,
    previewAudioUrl: v.preview_audio_url ?? null,
  }));
  voicesCache = { data: voices, expiresAt: Date.now() + CACHE_TTL_MS };
  return voices;
}
