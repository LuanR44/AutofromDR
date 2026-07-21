import { NextResponse } from "next/server";
import {
  uploadImageAsset,
  generateVideo,
  HeygenApiError,
  type VideoCharacter,
  type VideoBackground,
  type VideoAspectRatio,
} from "@/lib/heygen";
import { saveTempFile, readTempFile, deleteTempFiles } from "@/lib/server/tempFiles";
import { getIdempotentResult, saveIdempotentResult } from "@/lib/server/idempotency";
import { GenerateFormSchema, validateImageFile } from "@/lib/validation";
import { getLanguageByCode } from "@/lib/languages";
import { estimateSpeechDurationSeconds } from "@/lib/script";
import type { GenerateVideoResponse } from "@/lib/types";

const DEFAULT_BACKGROUND_COLOR = "#f5f5f5";

function extractionExtensionFromMime(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const rawFields = {
    productName: formData.get("productName")?.toString() ?? "",
    copy: formData.get("copy")?.toString() ?? "",
    durationMinutes: formData.get("durationMinutes")?.toString() ?? "",
    language: formData.get("language")?.toString() ?? "",
    voiceId: formData.get("voiceId")?.toString() ?? "",
    format: formData.get("format")?.toString() ?? "",
    avatarMode: formData.get("avatarMode")?.toString() ?? "",
    avatarId: formData.get("avatarId")?.toString() || undefined,
    behaviorNotes: formData.get("behaviorNotes")?.toString() || undefined,
    tone: formData.get("tone")?.toString() || undefined,
    facialExpressions: formData.get("facialExpressions")?.toString() || undefined,
    gestures: formData.get("gestures")?.toString() || undefined,
    scenario: formData.get("scenario")?.toString() || undefined,
    backgroundColor: formData.get("backgroundColor")?.toString() || undefined,
    productDisplayMode: formData.get("productDisplayMode")?.toString() ?? "",
    captions: formData.get("captions")?.toString() ?? "false",
    idempotencyKey: formData.get("idempotencyKey")?.toString() ?? "",
  };

  const parsed = GenerateFormSchema.safeParse(rawFields);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return NextResponse.json(
      { error: firstIssue?.message ?? "Dados do formulário inválidos." },
      { status: 400 },
    );
  }
  const fields = parsed.data;

  const cached = getIdempotentResult(fields.idempotencyKey);
  if (cached) {
    return NextResponse.json(cached);
  }

  const productImageFile = formData.get("productImage");
  if (!(productImageFile instanceof File)) {
    return NextResponse.json({ error: "Envie a imagem do produto." }, { status: 400 });
  }
  const productImageError = validateImageFile(productImageFile);
  if (productImageError) {
    return NextResponse.json({ error: productImageError }, { status: 400 });
  }

  let avatarImageFile: File | null = null;
  if (fields.avatarMode === "upload") {
    const candidate = formData.get("avatarImage");
    if (!(candidate instanceof File)) {
      return NextResponse.json(
        { error: "Envie uma imagem para criação do avatar." },
        { status: 400 },
      );
    }
    const avatarImageError = validateImageFile(candidate);
    if (avatarImageError) {
      return NextResponse.json({ error: avatarImageError }, { status: 400 });
    }
    avatarImageFile = candidate;
  }

  let backgroundImageFile: File | null = null;
  const backgroundCandidate = formData.get("backgroundImage");
  if (backgroundCandidate instanceof File && backgroundCandidate.size > 0) {
    const backgroundImageError = validateImageFile(backgroundCandidate);
    if (backgroundImageError) {
      return NextResponse.json({ error: backgroundImageError }, { status: 400 });
    }
    backgroundImageFile = backgroundCandidate;
  }

  const tempPaths: string[] = [];

  try {
    const productImagePath = await saveTempFile(
      Buffer.from(await productImageFile.arrayBuffer()),
      extractionExtensionFromMime(productImageFile.type),
    );
    tempPaths.push(productImagePath);

    let avatarImagePath: string | null = null;
    if (avatarImageFile) {
      avatarImagePath = await saveTempFile(
        Buffer.from(await avatarImageFile.arrayBuffer()),
        extractionExtensionFromMime(avatarImageFile.type),
      );
      tempPaths.push(avatarImagePath);
    }

    let backgroundImagePath: string | null = null;
    if (backgroundImageFile) {
      backgroundImagePath = await saveTempFile(
        Buffer.from(await backgroundImageFile.arrayBuffer()),
        extractionExtensionFromMime(backgroundImageFile.type),
      );
      tempPaths.push(backgroundImagePath);
    }

    const productImageBuffer = await readTempFile(productImagePath);
    const productAsset = await uploadImageAsset(productImageBuffer, productImageFile.type);

    let scenarioBackgroundAssetId: string | null = null;
    if (backgroundImagePath && backgroundImageFile) {
      const backgroundBuffer = await readTempFile(backgroundImagePath);
      const backgroundAsset = await uploadImageAsset(backgroundBuffer, backgroundImageFile.type);
      scenarioBackgroundAssetId = backgroundAsset.assetId;
    }

    let character: VideoCharacter;
    if (fields.avatarMode === "upload" && avatarImagePath && avatarImageFile) {
      const avatarBuffer = await readTempFile(avatarImagePath);
      const avatarAsset = await uploadImageAsset(avatarBuffer, avatarImageFile.type);
      character = { type: "image", image: { type: "asset_id", asset_id: avatarAsset.assetId } };
    } else {
      character = { type: "avatar", avatar_id: fields.avatarId as string };
    }

    const background: VideoBackground =
      fields.productDisplayMode === "product_background"
        ? { type: "image", asset_id: productAsset.assetId }
        : scenarioBackgroundAssetId
          ? { type: "image", asset_id: scenarioBackgroundAssetId }
          : { type: "color", value: fields.backgroundColor ?? DEFAULT_BACKGROUND_COLOR };

    const language = getLanguageByCode(fields.language);
    const estimatedDurationSeconds = estimateSpeechDurationSeconds(
      fields.copy,
      language.wordsPerMinute,
    );

    const videoId = await generateVideo({
      title: `${fields.productName} - Vídeo publicitário`,
      character,
      script: fields.copy,
      voiceId: fields.voiceId,
      aspectRatio: fields.format as VideoAspectRatio,
      background,
      caption: fields.captions,
    });

    const result: GenerateVideoResponse = {
      videoId,
      requestedDurationSeconds: fields.durationMinutes * 60,
      estimatedDurationSeconds,
    };

    saveIdempotentResult(fields.idempotencyKey, result);

    return NextResponse.json(result);
  } catch (err) {
    console.error("Erro ao gerar vídeo na HeyGen:", err);
    if (err instanceof HeygenApiError) {
      let message = "Falha ao comunicar com a HeyGen. Tente novamente.";
      if (err.isRateLimit) {
        message = err.message;
      } else if (err.code === "insufficient_credit") {
        message = "Créditos insuficientes na conta HeyGen. Adicione créditos e tente novamente.";
      } else if (/no face detected/i.test(err.message)) {
        message =
          "Nenhum rosto foi detectado na imagem enviada para criar o avatar. Envie uma foto de retrato: um rosto humano de frente, nítido e bem iluminado.";
      } else if (err.status === 400) {
        // Repassa o motivo real da HeyGen para erros de validação, em vez de uma mensagem genérica.
        message = `A HeyGen recusou a solicitação: ${err.message}`;
      }
      return NextResponse.json({ error: message }, { status: err.status });
    }
    return NextResponse.json(
      { error: "Erro inesperado ao gerar o vídeo. Tente novamente." },
      { status: 500 },
    );
  } finally {
    await deleteTempFiles(tempPaths);
  }
}
