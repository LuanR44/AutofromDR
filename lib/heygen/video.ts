import { heygenJsonRequest } from "./client";
import type { HeygenVideoStatus } from "../types";

export type VideoAspectRatio = "16:9" | "9:16" | "4:5" | "5:4" | "1:1" | "auto";

export type VideoCharacter =
  | { type: "avatar"; avatar_id: string }
  | { type: "image"; image: { type: "asset_id"; asset_id: string } };

export type VideoBackground =
  | { type: "color"; value: string }
  | { type: "image"; asset_id: string };

export interface GenerateVideoParams {
  title: string;
  character: VideoCharacter;
  script: string;
  voiceId: string;
  aspectRatio: VideoAspectRatio;
  background: VideoBackground;
  caption: boolean;
}

interface GenerateVideoApiResponse {
  data: { video_id: string };
}

export async function generateVideo(params: GenerateVideoParams): Promise<string> {
  const body = {
    ...params.character,
    title: params.title,
    script: params.script,
    voice_id: params.voiceId,
    aspect_ratio: params.aspectRatio,
    background: params.background,
    // Os avatares do catálogo (avatar_type=studio_avatar) só suportam o engine avatar_iii —
    // sem isso a API assume avatar_iv por padrão e rejeita a geração.
    ...(params.character.type === "avatar" ? { engine: { type: "avatar_iii" } } : {}),
    ...(params.caption ? { caption: {} } : {}),
  };

  const response = await heygenJsonRequest<GenerateVideoApiResponse>("/v3/videos", {
    method: "POST",
    body,
  });
  return response.data.video_id;
}

interface VideoStatusApiResponse {
  data: {
    video_id?: string;
    status: HeygenVideoStatus;
    video_url?: string | null;
    thumbnail_url?: string | null;
    duration?: number | null;
    error?: { message?: string } | string | null;
  };
}

export interface VideoStatusResult {
  status: HeygenVideoStatus;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  error: string | null;
}

export async function getVideoStatus(videoId: string): Promise<VideoStatusResult> {
  const response = await heygenJsonRequest<VideoStatusApiResponse>(
    `/v3/videos/${encodeURIComponent(videoId)}`,
    { method: "GET" },
  );
  const { data } = response;
  let errorMessage: string | null = null;
  if (typeof data.error === "string") errorMessage = data.error;
  else if (data.error?.message) errorMessage = data.error.message;

  return {
    status: data.status,
    videoUrl: data.video_url ?? null,
    thumbnailUrl: data.thumbnail_url ?? null,
    durationSeconds: data.duration ?? null,
    error: errorMessage,
  };
}
