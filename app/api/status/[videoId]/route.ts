import { NextResponse } from "next/server";
import { getVideoStatus, HeygenApiError } from "@/lib/heygen";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ videoId: string }> },
) {
  const { videoId } = await params;
  if (!videoId) {
    return NextResponse.json({ error: "videoId é obrigatório." }, { status: 400 });
  }

  try {
    const status = await getVideoStatus(videoId);
    return NextResponse.json(status);
  } catch (err) {
    console.error(`Erro ao consultar status do vídeo ${videoId}:`, err);
    const status = err instanceof HeygenApiError ? err.status : 500;
    return NextResponse.json(
      { error: "Não foi possível consultar o status do vídeo." },
      { status },
    );
  }
}
