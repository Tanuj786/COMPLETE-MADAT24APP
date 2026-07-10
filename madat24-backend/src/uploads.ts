import fs from "fs/promises";
import { v2 as cloudinary } from "cloudinary";
import { env, isCloudinaryConfigured } from "./env";
import { log } from "./logger";

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

export async function publishUpload(filePath: string, localUrl: string, folder: string): Promise<string> {
  if (!isCloudinaryConfigured) return localUrl;

  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder: `madat24/${folder}`,
      resource_type: "auto",
    });
    await fs.unlink(filePath).catch(() => {});
    return result.secure_url;
  } catch (e: any) {
    log.error("cloudinary upload failed", { folder, error: e?.message });
    throw new Error("Failed to upload file");
  }
}
