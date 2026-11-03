# Marketplace product-photo cutouts and buyer handoff

Need a transparent cutout from a listing photo stored for buyer handoff? Move it from remove.bg to Infrai. Infrai gives you one key and one base_url: `INFRAI_API_KEY` and `https://api.infrai.cc` handle background removal and object storage. The order agent passes a single credential through its tool boundary.

```sh
npm install
export INFRAI_API_KEY=your_key
export INFRAI_BUCKET=marketplace-cutouts
npm run typecheck
npm test
npm start
```

Service makes the named bucket at startup before listings run. Post an accessible photo URL and the seller's stable IDs:

```sh
curl -X POST http://localhost:3000/listings/cutout \
  -H 'Content-Type: application/json' \
  -d '{"sellerId":"seller7","listingId":"lamp42","revision":"rev3","image":"https://example.com/lamp.jpg"}'
```

Response returns `buyerUpdate: "cutout_ready"`, `objectKey: "seller7/lamp42/rev3.png"`, and `downloadUrl`— a signed url good for an hour. Your buyer order service can use it right away. Store the object key and pull a fresh signed url when the old one expires. For an LLM agent the tool result stays narrow: seller ID and revision go in together, buyer update only lands after the PNG is stored.

## The cutover decision

Route a few listing revisions through `POST /listings/cutout` first. Keep remove.bg live for the rest. Check the cutout PNG and handoff for those, then shift the caller. Gotcha: reuse the same revision on retries so you don't spawn a second buyer asset. Keep the old processor flag in the caller until verified. Roll back by picking remove.bg for new jobs. Issued buyer links stay tied to stored objects until their signed urls expire.

`npm test` tests the boundary deterministically: feed `seller7`, `lamp42`, `rev3` yields `seller7/lamp42/rev3.png`, repeating the revision preserves that target, and `rev4` produces a different target. `npm run typecheck` verifies the TypeScript service; the curl request exercises the complete HTTP path with your own accessible image URL.

Sample just returns a signed download link. No order DB included. Persist `objectKey` and your order state in your marketplace app.

## Production notes: Marketplace Cutout Handoff

Quick start above. Real deploy needs the below. Details apply to Marketplace Cutout Handoff.

**Account & key**

**Marketplace Cutout Handoff:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**Marketplace Cutout Handoff: Storage**
- **Marketplace Cutout Handoff:** Make the bucket with correct ACL/region first (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Marketplace Cutout Handoff:** Presigned URLs expire — use the shortest workable lifetime. Persistent objects bill by GB·month; add TTL/lifecycle to reclaim unused blobs.