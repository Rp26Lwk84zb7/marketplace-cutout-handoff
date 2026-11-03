import { createServer } from "node:http";
import { z } from "zod";
import { call, handoff, InfraiError } from "./cutout_service.js";

const request = z.object({
  sellerId: z.string().regex(/^[a-zA-Z0-9_-]+$/),
  listingId: z.string().regex(/^[a-zA-Z0-9_-]+$/),
  revision: z.string().regex(/^[a-zA-Z0-9_-]+$/),
  image: z.string().url(),
}).strict();

const key = process.env.INFRAI_API_KEY;
const bucket = process.env.INFRAI_BUCKET ?? "marketplace-cutouts";
if (!key) throw new Error("Set INFRAI_API_KEY");

// Provision the bucket once before accepting listing work.
try {
  await call("/v1/storage/bucket/create", { name: bucket }, key);
} catch (error) {
  if (!(error instanceof InfraiError && error.status === 409)) throw error;
}

createServer(async (req, res) => {
  if (req.method !== "POST" || req.url !== "/listings/cutout") {
    res.writeHead(404).end();
    return;
  }
  try {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const input = request.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    const result = await handoff({
      sellerId: input.sellerId,
      listingId: input.listingId,
      revision: input.revision,
      image: input.image,
      bucket,
    }, key);
    res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(result));
  } catch (error) {
    const status = error instanceof z.ZodError || error instanceof SyntaxError ? 400
      : error instanceof InfraiError && error.status >= 400 && error.status < 500 ? error.status : 502;
    res.writeHead(status, { "Content-Type": "application/json" }).end(JSON.stringify({ error: error instanceof Error ? error.message : "Request failed" }));
  }
}).listen(Number(process.env.PORT ?? 3000), () => console.log("Cutout service listening"));
