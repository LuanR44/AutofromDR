import { NextResponse } from "next/server";
import { listAvatars, HeygenApiError } from "@/lib/heygen";

export async function GET() {
  try {
    const avatars = await listAvatars();
    return NextResponse.json({ avatars });
  } catch (err) {
    console.error("Erro ao listar avatares:", err);
    const status = err instanceof HeygenApiError ? err.status : 500;
    return NextResponse.json(
      { error: "Não foi possível carregar os avatares da HeyGen." },
      { status },
    );
  }
}
