import { NextResponse } from "next/server";
import { listVoices, HeygenApiError } from "@/lib/heygen";

export async function GET() {
  try {
    const voices = await listVoices();
    return NextResponse.json({ voices });
  } catch (err) {
    console.error("Erro ao listar vozes:", err);
    const status = err instanceof HeygenApiError ? err.status : 500;
    return NextResponse.json(
      { error: "Não foi possível carregar as vozes da HeyGen." },
      { status },
    );
  }
}
