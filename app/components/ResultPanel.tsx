"use client";

import type { VideoFormat } from "@/lib/types";

interface ResultPanelProps {
  videoUrl: string;
  durationSeconds: number | null;
  format: VideoFormat;
  onRegenerate: () => void;
}

export function ResultPanel({ videoUrl, durationSeconds, format, onRegenerate }: ResultPanelProps) {
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-neutral-700 bg-neutral-900 p-4">
      <video src={videoUrl} controls className="w-full rounded-md bg-black" />
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-neutral-300">
        <span>
          Duração final:{" "}
          <strong>{durationSeconds ? `${Math.round(durationSeconds)}s` : "—"}</strong>
        </span>
        <span>
          Formato: <strong>{format}</strong>
        </span>
      </div>
      <div className="flex gap-3">
        <a
          href={videoUrl}
          download
          target="_blank"
          rel="noreferrer"
          className="rounded-md bg-white px-4 py-2 text-sm font-medium text-black hover:bg-neutral-200"
        >
          Baixar vídeo
        </a>
        <button
          type="button"
          onClick={onRegenerate}
          className="rounded-md border border-neutral-600 px-4 py-2 text-sm font-medium text-neutral-200 hover:border-neutral-400"
        >
          Gerar novamente
        </button>
      </div>
    </div>
  );
}
