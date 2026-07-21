import { heygenAssetUpload } from "./client";

interface UploadAssetResponse {
  data: {
    asset_id: string;
    url: string;
    mime_type: string;
    size_bytes: number;
  };
}

export interface UploadedImage {
  assetId: string;
  url: string;
}

// POST https://api.heygen.com/v3/assets — usado para a imagem do produto, a imagem do
// cenário/fundo e a foto usada para criar um avatar a partir de imagem.
export async function uploadImageAsset(
  fileBuffer: Buffer,
  mimeType: string,
): Promise<UploadedImage> {
  const result = await heygenAssetUpload<UploadAssetResponse>(fileBuffer, mimeType);
  return {
    assetId: result.data.asset_id,
    url: result.data.url,
  };
}
