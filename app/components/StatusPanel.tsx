"use client";

import type { VideoStatusResponse } from "@/lib/types";

interface StatusPanelProps {
  status: VideoStatusResponse | null;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Na fila de processamento…",
  processing: "Processando o vídeo…",
  completed: "Concluído",
  failed: "Falhou",
};

export function StatusPanel({ status }: StatusPanelProps) {
  if (!status) return null;

  return (
    <div className="rounded-lg border border-neutral-700 bg-neutral-900 p-4">
      <div className="flex items-center gap-3">
        {(status.status === "pending" || status.status === "processing") && (
          <span className="h-3 w-3 animate-pulse rounded-full bg-yellow-400" />
        )}
        {status.status === "completed" && <span className="h-3 w-3 rounded-full bg-green-400" />}
        {status.status === "failed" && <span className="h-3 w-3 rounded-full bg-red-400" />}
        <p className="text-sm text-neutral-200">
          {STATUS_LABELS[status.status] ?? status.status}
        </p>
      </div>
      {status.status === "failed" && status.error && (
        <p className="mt-2 text-xs text-red-400">{status.error}</p>
      )}
    </div>
  );
}
