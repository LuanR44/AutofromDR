// Tipos compartilhados entre frontend e backend

export type VideoFormat = "9:16" | "16:9" | "1:1";

export type ProductDisplayMode = "product_background" | "scenario_background";

export type AvatarMode = "existing" | "upload";

export interface AvatarOption {
  avatarId: string;
  name: string;
  previewImageUrl: string | null;
  gender: string | null;
}

export interface VoiceOption {
  voiceId: string;
  name: string;
  language: string;
  gender: string | null;
  previewAudioUrl: string | null;
}

export interface GenerateVideoResponse {
  videoId: string;
  requestedDurationSeconds: number;
  estimatedDurationSeconds: number;
}

export type HeygenVideoStatus = "pending" | "processing" | "completed" | "failed";

export interface VideoStatusResponse {
  status: HeygenVideoStatus;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  error: string | null;
}

export interface ApiErrorBody {
  error: string;
}
