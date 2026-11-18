import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { FormError } from "./errors";

export interface IncomingUpload {
  fieldKey: string;
  name: string;
  bytes: Buffer;
}
export interface PrivateFileStore {
  put(key: string, bytes: Buffer): Promise<void>;
  read(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
}

/** Stored outside the public web root. Production requires a persistent private directory. */
export class LocalPrivateFileStore implements PrivateFileStore {
  private location(key: string) {
    if (!/^[a-f0-9-]{36}$/.test(key)) throw new Error("Invalid private object key.");
    const configured = process.env.UPLOAD_DIRECTORY;
    if (!configured && process.env.NODE_ENV === "production")
      throw new Error("UPLOAD_DIRECTORY is required for attachments in production.");
    const directory = resolve(configured || join(process.cwd(), ".data", "uploads"));
    return { directory, file: join(directory, key) };
  }
  async put(key: string, bytes: Buffer) {
    const { directory, file } = this.location(key);
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await writeFile(file, bytes, { flag: "wx", mode: 0o600 });
  }
  async read(key: string) {
    return readFile(this.location(key).file);
  }
  async remove(key: string) {
    await unlink(this.location(key).file).catch((error) => {
      if (error.code !== "ENOENT") throw error;
    });
  }
}

type SupportedMediaType =
  | "image/png"
  | "image/jpeg"
  | "image/webp"
  | "application/pdf"
  | "text/plain";
function detectMediaType(bytes: Buffer): SupportedMediaType {
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
    return "image/png";
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "image/jpeg";
  if (bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP")
    return "image/webp";
  if (bytes.toString("ascii", 0, 5) === "%PDF-") return "application/pdf";
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text)) return "text/plain";
  } catch {
    /* Unsupported binary content. */
  }
  throw new FormError("INVALID", "Upload a PNG, JPEG, WebP, PDF, or UTF-8 text file.");
}

export function prepareUploads(uploads: IncomingUpload[]) {
  if (
    uploads.length > 5 ||
    uploads.reduce((sum, upload) => sum + upload.bytes.length, 0) > 20 * 1024 * 1024
  )
    throw new FormError("INVALID", "Use at most five files and 20 MB per response.");
  return uploads.map((upload) => {
    if (!upload.bytes.length || upload.bytes.length > 10 * 1024 * 1024)
      throw new FormError("INVALID", "Each attachment must contain between 1 byte and 10 MB.");
    const name =
      upload.name
        .split(/[\\/]/)
        .at(-1)!
        .replace(/[\u0000-\u001f\u007f<>:"|?*]/g, "_")
        .trim()
        .slice(0, 200) || "attachment";
    return {
      ...upload,
      name,
      id: randomUUID(),
      objectKey: randomUUID(),
      mediaType: detectMediaType(upload.bytes),
      checksum: createHash("sha256").update(upload.bytes).digest("hex"),
    };
  });
}
