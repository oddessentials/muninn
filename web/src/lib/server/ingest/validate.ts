import Ajv2020, { type ErrorObject, type ValidateFunction } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import type { IngestBatch } from '$lib/api/types';
import { getContract } from '../openapi';

function rewriteRefs(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((entry) => rewriteRefs(entry));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (key === 'discriminator') continue;
      if (
        key === '$ref' &&
        typeof entry === 'string' &&
        entry.startsWith('#/components/schemas/')
      ) {
        out[key] = `#/$defs/${entry.slice('#/components/schemas/'.length)}`;
        continue;
      }
      out[key] = rewriteRefs(entry);
    }
    return out;
  }
  return value;
}

let ajv: Ajv2020 | null = null;
const validators = new Map<string, ValidateFunction>();

export function schemaValidator(schemaName: string): ValidateFunction {
  const cached = validators.get(schemaName);
  if (cached) return cached;
  if (!ajv) {
    ajv = new Ajv2020({ strict: false, allErrors: false });
    addFormats(ajv);
    ajv.addSchema({
      $id: 'contract',
      $defs: rewriteRefs(getContract().components.schemas)
    });
  }
  const validator = ajv.compile({ $ref: `contract#/$defs/${schemaName}` });
  validators.set(schemaName, validator);
  return validator;
}

export function describeErrors(errors: ErrorObject[] | null | undefined): string {
  if (!errors || errors.length === 0) return 'the document does not match the contract';
  const first = errors[0]!;
  const path = first.instancePath || '/';
  const extra =
    first.params && typeof first.params === 'object' && 'additionalProperty' in first.params
      ? ` (${String((first.params as { additionalProperty: unknown }).additionalProperty)})`
      : '';
  return `${path} ${first.message ?? 'is invalid'}${extra}`;
}

export interface BatchValidation {
  ok: boolean;
  message: string | null;
  batch: IngestBatch | null;
}

export function validateBatch(document: unknown): BatchValidation {
  const validator = schemaValidator('IngestBatch');
  if (!validator(document)) {
    return { ok: false, message: describeErrors(validator.errors), batch: null };
  }
  const batch = document as IngestBatch;
  const seen = new Set<string>();
  for (const event of batch.events) {
    if (seen.has(event.id)) {
      return { ok: false, message: `event ${event.id} appears twice in the batch`, batch: null };
    }
    seen.add(event.id);
    if (Number.isNaN(new Date(event.ts).getTime())) {
      return { ok: false, message: `event ${event.id} has an invalid ts`, batch: null };
    }
  }
  return { ok: true, message: null, batch };
}

export function validateAgainst(schemaName: string, document: unknown): string | null {
  const validator = schemaValidator(schemaName);
  return validator(document) ? null : describeErrors(validator.errors);
}
