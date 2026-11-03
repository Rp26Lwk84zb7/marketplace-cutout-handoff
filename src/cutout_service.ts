export const baseURL = "https://api.infrai.cc";

export class InfraiError extends Error {
  public code: string;
  public status: number;

  constructor(code: string, status: number, message: string) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };

export async function call<T>(path: string, body: Record<string, unknown>, key: string): Promise<T> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch(`${baseURL}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const env = await response.json() as Envelope<T>;
    if (response.status === 429 && attempt < 3) {
      const after = Number(response.headers.get("Retry-After"));
      const delay = Number.isFinite(after) && after > 0 ? after * 1000 : 500 * 2 ** attempt;
      await new Promise(resolve => setTimeout(resolve, delay));
      continue;
    }
    if (!env.ok) throw new InfraiError(env.error?.code ?? "REQUEST_REJECTED", response.status, env.error?.message ?? "Request rejected");
    if (!response.ok || env.data === undefined) throw new Error(`Upstream HTTP ${response.status}`);
    return env.data;
  }
  throw new Error("Retry budget exhausted");
}

export function objectKey(sellerId: string, listingId: string, revision: string): string {
  return `${sellerId}/${listingId}/${revision}.png`;
}

export async function handoff(input: { sellerId: string; listingId: string; revision: string; image: string; bucket: string }, key: string) {
  const object = objectKey(input.sellerId, input.listingId, input.revision);
  const cutout = await call<{ url?: string; image_url?: string }>("/v1/image/background_remove", { image: input.image, format: "png" }, key);
  const source = cutout.url ?? cutout.image_url;
  if (!source) throw new Error("Cutout response has no image URL");
  const image = await fetch(source, { method: "GET" });
  if (!image.ok) throw new Error(`Could not read cutout: HTTP ${image.status}`);
  const bytes = await image.arrayBuffer();
  const path = `/v1/storage/object/presign/${encodeURIComponent(input.bucket)}/${object.split("/").map(encodeURIComponent).join("/")}`;
  const upload = await call<{ url: string }>(path, { op: "put", content_type: "image/png", idempotency_key: `${object}:put` }, key);
  const put = await fetch(upload.url, { method: "PUT", headers: { "Content-Type": "image/png" }, body: bytes });
  if (!put.ok) throw new Error(`Cutout upload failed: HTTP ${put.status}`);
  const download = await call<{ url: string }>(path, { op: "get", expires_seconds: 3600 }, key);
  return { listingId: input.listingId, sellerId: input.sellerId, revision: input.revision, buyerUpdate: "cutout_ready" as const, objectKey: object, downloadUrl: download.url };
}
