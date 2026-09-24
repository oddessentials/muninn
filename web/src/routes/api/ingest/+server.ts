import type { RequestHandler } from '@sveltejs/kit';
import { env } from '$lib/server/env';
import { getDb } from '$lib/server/db/client';
import { errorResponse, guarded, privateJson } from '$lib/server/http/respond';
import { ingestBatch, maxBatchBytes, recordRejectedBatch } from '$lib/server/ingest/ingest';
import {
  signatureHeader,
  timestampHeader,
  verifyBatchSignature
} from '$lib/server/ingest/signature';
import { validateBatch } from '$lib/server/ingest/validate';
import { isRunning } from '$lib/server/jobs/runner';
import { collectForPlugin } from '$lib/server/read/announcements';
import { publishAfterIngest } from '$lib/server/stream/publish';

export const POST: RequestHandler = ({ request }) =>
  guarded(async () => {
    const receivedAt = new Date();
    if (isRunning('projections_rebuild')) {
      return errorResponse(503, 'unavailable', 'projections are being rebuilt; retry shortly');
    }
    const declared = Number(request.headers.get('content-length') ?? '0');
    if (declared > maxBatchBytes) {
      await recordRejectedBatch(413, receivedAt);
      return errorResponse(413, 'payload_too_large', 'the batch exceeds 1 MB');
    }
    const body = new Uint8Array(await request.arrayBuffer());
    if (body.length > maxBatchBytes) {
      await recordRejectedBatch(413, receivedAt);
      return errorResponse(413, 'payload_too_large', 'the batch exceeds 1 MB');
    }
    const check = verifyBatchSignature(
      env.telemetrySecret,
      request.headers.get(timestampHeader),
      request.headers.get(signatureHeader),
      body
    );
    if (!check.ok) {
      await recordRejectedBatch(401, receivedAt);
      return errorResponse(401, 'unauthorized', `signature check failed: ${check.failure}`);
    }
    let document: unknown;
    try {
      document = JSON.parse(Buffer.from(body).toString('utf8'));
    } catch {
      await recordRejectedBatch(422, receivedAt);
      return errorResponse(422, 'unprocessable', 'the body is not valid JSON');
    }
    const validation = validateBatch(document);
    if (!validation.ok || !validation.batch) {
      await recordRejectedBatch(422, receivedAt);
      return errorResponse(422, 'unprocessable', validation.message ?? 'malformed batch');
    }
    const outcome = await ingestBatch(validation.batch, receivedAt);
    await publishAfterIngest(
      [...outcome.acceptedEvents, ...outcome.effects.syntheticEvents],
      outcome.effects
    );
    const announcements = await collectForPlugin(getDb(), new Date());
    return privateJson({
      accepted: outcome.accepted,
      duplicates: outcome.duplicates,
      last_seq: outcome.lastSeq,
      announcements
    });
  });
