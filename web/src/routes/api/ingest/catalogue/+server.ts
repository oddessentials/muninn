import type { RequestHandler } from '@sveltejs/kit';
import type { ComfortCatalogueUpload } from '$lib/api/types';
import { getDb } from '$lib/server/db/client';
import { secrets } from '$lib/server/auth/secrets';
import { empty, errorResponse, guarded } from '$lib/server/http/respond';
import { recordRejectedBatch } from '$lib/server/ingest/ingest';
import { signatureHeader, timestampHeader, verifyMapSignature } from '$lib/server/ingest/signature';
import { validateAgainst } from '$lib/server/ingest/validate';
import { storeComfortCatalogue } from '$lib/server/read/comfort';

const maxCatalogueBytes = 512 * 1024;
const refusalCodes = {
  401: 'unauthorized',
  413: 'payload_too_large',
  422: 'unprocessable'
} as const;

async function refuse(
  status: keyof typeof refusalCodes,
  message: string,
  receivedAt: Date
): Promise<Response> {
  await recordRejectedBatch(status, receivedAt);
  return errorResponse(status, refusalCodes[status], message);
}

function parseJson(body: Buffer): unknown {
  try {
    return JSON.parse(body.toString('utf8'));
  } catch {
    return undefined;
  }
}

function unstorable(upload: ComfortCatalogueUpload): string | null {
  const year = new Date(upload.generated_at).getUTCFullYear();
  if (!(year >= 1970 && year <= 9999)) return 'generated_at is not a storable instant';
  if (JSON.stringify(upload).includes('\\u0000')) return 'a text field contains a NUL character';
  const seen = new Set<string>();
  for (const piece of upload.pieces) {
    if (seen.has(piece.prefab)) return `piece ${piece.prefab} appears twice`;
    seen.add(piece.prefab);
  }
  return null;
}

export const POST: RequestHandler = ({ request }) =>
  guarded(async () => {
    const receivedAt = new Date();
    const declared = Number(request.headers.get('content-length') ?? '0');
    if (declared > maxCatalogueBytes) {
      return refuse(413, 'the catalogue exceeds 512 KB', receivedAt);
    }
    const body = Buffer.from(await request.arrayBuffer());
    if (body.length > maxCatalogueBytes) {
      return refuse(413, 'the catalogue exceeds 512 KB', receivedAt);
    }
    const check = verifyMapSignature(
      await secrets.telemetrySecret(),
      request.headers.get(timestampHeader),
      request.headers.get(signatureHeader),
      body
    );
    if (!check.ok) return refuse(401, `signature check failed: ${check.failure}`, receivedAt);
    const document = parseJson(body);
    if (document === undefined) return refuse(422, 'the body is not JSON', receivedAt);
    const problem = validateAgainst('ComfortCatalogueUpload', document);
    if (problem) return refuse(422, problem, receivedAt);
    const upload = document as ComfortCatalogueUpload;
    const trouble = unstorable(upload);
    if (trouble) return refuse(422, trouble, receivedAt);
    await storeComfortCatalogue(getDb(), upload, receivedAt);
    return empty(204);
  });
