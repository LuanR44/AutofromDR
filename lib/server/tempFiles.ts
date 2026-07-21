import { writeFile, unlink, mkdir, readFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { randomUUID } from "crypto";

const UPLOAD_DIR = path.join(tmpdir(), "heygen-ads-uploads");

export async function saveTempFile(buffer: Buffer, extension: string): Promise<string> {
  await mkdir(UPLOAD_DIR, { recursive: true });
  const filePath = path.join(UPLOAD_DIR, `${randomUUID()}.${extension}`);
  await writeFile(filePath, buffer);
  return filePath;
}

export async function readTempFile(filePath: string): Promise<Buffer> {
  return readFile(filePath);
}

export async function deleteTempFile(filePath: string): Promise<void> {
  try {
    await unlink(filePath);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error(`Falha ao remover arquivo temporário ${filePath}:`, err);
    }
  }
}

export async function deleteTempFiles(filePaths: Array<string | null | undefined>): Promise<void> {
  await Promise.all(filePaths.filter((p): p is string => Boolean(p)).map(deleteTempFile));
}
