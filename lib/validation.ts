import { z } from "zod";
import { SUPPORTED_LANGUAGES } from "./languages";

export const ALLOWED_IMAGE_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export function validateImageFile(file: File): string | null {
  if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_MIME_TYPES)[number])) {
    return "Formato de imagem inválido. Use PNG, JPG/JPEG ou WebP.";
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return "Imagem muito grande. O limite é 10MB.";
  }
  if (file.size === 0) {
    return "O arquivo de imagem está vazio.";
  }
  return null;
}

const languageCodes = SUPPORTED_LANGUAGES.map((l) => l.code) as [string, ...string[]];

export const GenerateFormSchema = z
  .object({
    productName: z.string().trim().min(1, "Informe o nome do produto.").max(200),
    copy: z.string().trim().min(1, "Informe a copy que o avatar deve falar."),
    durationMinutes: z.coerce.number().min(0.1, "Duração mínima é 0.1 minuto.").max(30, "Duração máxima é 30 minutos."),
    language: z.enum(languageCodes, { message: "Idioma inválido." }),
    voiceId: z.string().trim().min(1, "Selecione uma voz."),
    format: z.enum(["9:16", "16:9", "1:1"], { message: "Formato de vídeo inválido." }),
    avatarMode: z.enum(["existing", "upload"], { message: "Modo de avatar inválido." }),
    avatarId: z.string().trim().optional(),
    behaviorNotes: z.string().trim().max(1000).optional(),
    tone: z.string().trim().max(200).optional(),
    facialExpressions: z.string().trim().max(200).optional(),
    gestures: z.string().trim().max(200).optional(),
    scenario: z.string().trim().max(300).optional(),
    backgroundColor: z
      .string()
      .trim()
      .regex(/^#[0-9a-fA-F]{6}$/, "Cor de fundo inválida.")
      .optional(),
    productDisplayMode: z.enum(["product_background", "scenario_background"], {
      message: "Opção de apresentação do produto inválida.",
    }),
    captions: z.coerce.boolean(),
    idempotencyKey: z.string().trim().min(1, "idempotencyKey é obrigatório."),
  })
  .superRefine((value, ctx) => {
    if (value.avatarMode === "existing" && !value.avatarId) {
      ctx.addIssue({
        code: "custom",
        path: ["avatarId"],
        message: "Selecione um avatar existente.",
      });
    }
  });

export type GenerateFormData = z.infer<typeof GenerateFormSchema>;
