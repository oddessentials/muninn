import type { RequestHandler } from '@sveltejs/kit';
import { getDb } from '$lib/server/db/client';
import { env } from '$lib/server/env';
import { empty, errorResponse, guarded } from '$lib/server/http/respond';
import { recordRejectedBatch } from '$lib/server/ingest/ingest';
import { signatureHeader, timestampHeader, verifyMapSignature } from '$lib/server/ingest/signature';
import { storeMapImage } from '$lib/server/read/world';

const maxMapBytes = 16 * 1024 * 1024;
const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export const POST: RequestHandler = ({ request }) =>
  guarded(async () => {
    const receivedAt = new Date();
    const declared = Number(request.headers.get('content-length') ?? '0');
    if (declared > maxMapBytes) {
      await recordRejectedBatch(413, receivedAt);
      return errorResponse(413, 'payload_too_large', 'the image exceeds 16 MB');
    }
    const body = Buffer.from(await request.arrayBuffer());
    if (body.length > maxMapBytes) {
      await recordRejectedBatch(413, receivedAt);
      return errorResponse(413, 'payload_too_large', 'the image exceeds 16 MB');
    }
    const check = verifyMapSignature(
      env.telemetrySecret,
      request.headers.get(timestampHeader),
      request.headers.get(signatureHeader),
      body
    );
    if (!check.ok) {
      await recordRejectedBatch(401, receivedAt);
      return errorResponse(401, 'unauthorized', `signature check failed: ${check.failure}`);
    }
    const worldUid = Number(request.headers.get('x-world-uid'));
    const size = Number(request.headers.get('x-map-size'));
    const radius = Number(request.headers.get('x-map-radius'));
    if (!Number.isSafeInteger(worldUid) || !Number.isInteger(size) || size < 1 || !(radius >= 1)) {
      await recordRejectedBatch(422, receivedAt);
      return errorResponse(
        422,
        'unprocessable',
        'X-World-Uid, X-Map-Size and X-Map-Radius are required'
      );
    }
    if (body.length < 33 || !body.subarray(0, 8).equals(pngSignature)) {
      await recordRejectedBatch(422, receivedAt);
      return errorResponse(422, 'unprocessable', 'the body is not a PNG');
    }
    const width = body.readUInt32BE(16);
    const height = body.readUInt32BE(20);
    if (width !== size || height !== size) {
      await recordRejectedBatch(422, receivedAt);
      return errorResponse(
        422,
        'unprocessable',
        `the PNG is ${width}x${height} but X-Map-Size is ${size}`
      );
    }
    await storeMapImage(getDb(), worldUid, body, size, radius, receivedAt);
    return empty(204);
  });
