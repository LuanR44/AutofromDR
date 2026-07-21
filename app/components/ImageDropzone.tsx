"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const ACCEPTED_TYPES = "image/png,image/jpeg,image/webp";
const MAX_SIZE_BYTES = 10 * 1024 * 1024;

interface ImageDropzoneProps {
  label: string;
  hint?: string;
  required?: boolean;
  file: File | null;
  onChange: (file: File | null) => void;
}

export function ImageDropzone({ label, hint, required, file, onChange }: ImageDropzoneProps) {
  const [localError, setLocalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function handleFileSelected(selected: File | null) {
    setLocalError(null);
    if (!selected) {
      onChange(null);
      return;
    }
    if (!["image/png", "image/jpeg", "image/webp"].includes(selected.type)) {
      setLocalError("Formato inválido. Use PNG, JPG/JPEG ou WebP.");
      onChange(null);
      return;
    }
    if (selected.size > MAX_SIZE_BYTES) {
      setLocalError("Imagem muito grande. O limite é 10MB.");
      onChange(null);
      return;
    }
    onChange(selected);
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-neutral-200">
        {label}
        {required && <span className="text-red-400"> *</span>}
      </label>
      <div className="flex items-start gap-4">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="shrink-0 rounded-md border border-dashed border-neutral-600 px-4 py-2 text-sm text-neutral-300 hover:border-neutral-400 hover:text-white transition-colors"
        >
          {file ? "Trocar imagem" : "Selecionar imagem"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          className="hidden"
          onChange={(e) => handleFileSelected(e.target.files?.[0] ?? null)}
        />
        {previewUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt={`Prévia: ${label}`}
            className="h-20 w-20 rounded-md object-cover border border-neutral-700"
          />
        )}
      </div>
      {hint && !localError && <p className="text-xs text-neutral-500">{hint}</p>}
      {localError && <p className="text-xs text-red-400">{localError}</p>}
    </div>
  );
}
