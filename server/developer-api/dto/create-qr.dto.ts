import type { CreateQrInput } from '../interfaces/api-developer.interface';
import { QR_IMAGE_DEFAULTS } from '../qr-image';
import {
  invalid,
  isPlainObject,
  parseHttpUrl,
  parseOptionalTitle,
  parseResourceId,
  type ValidationResult,
} from './validation';

export interface CreateQrDto extends CreateQrInput {
  image: {
    size: number;
    margin: number;
    errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H';
    dark: string;
    light: string;
  };
}

const HEX_COLOR = /^#(?:[0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;

function parseOptionalSize(value: unknown): ValidationResult<number> {
  if (value === undefined || value === null) return { ok: true, value: QR_IMAGE_DEFAULTS.size };
  if (!Number.isInteger(value) || (value as number) < 128 || (value as number) > 1024) {
    return invalid('image.size must be an integer between 128 and 1024.');
  }
  return { ok: true, value: value as number };
}

function parseOptionalMargin(value: unknown): ValidationResult<number> {
  if (value === undefined || value === null) return { ok: true, value: QR_IMAGE_DEFAULTS.margin };
  if (!Number.isInteger(value) || (value as number) < 0 || (value as number) > 16) {
    return invalid('image.margin must be an integer between 0 and 16.');
  }
  return { ok: true, value: value as number };
}

function parseOptionalErrorCorrection(
  value: unknown
): ValidationResult<'L' | 'M' | 'Q' | 'H'> {
  if (value === undefined || value === null) {
    return { ok: true, value: QR_IMAGE_DEFAULTS.errorCorrectionLevel };
  }
  if (typeof value !== 'string') {
    return invalid('image.errorCorrectionLevel must be one of L, M, Q, H.');
  }
  const normalized = value.trim().toUpperCase();
  if (normalized !== 'L' && normalized !== 'M' && normalized !== 'Q' && normalized !== 'H') {
    return invalid('image.errorCorrectionLevel must be one of L, M, Q, H.');
  }
  return { ok: true, value: normalized };
}

function parseOptionalColor(value: unknown, field: string): ValidationResult<string> {
  if (value === undefined || value === null) {
    return { ok: true, value: field === 'dark' ? QR_IMAGE_DEFAULTS.dark : QR_IMAGE_DEFAULTS.light };
  }
  if (typeof value !== 'string' || !HEX_COLOR.test(value.trim())) {
    return invalid(`image.${field} must be a hex colour such as #000000.`);
  }
  return { ok: true, value: value.trim() };
}

/**
 * DTO for `POST /api/v1/qr`.
 *
 * A target is required either as `targetUrl` or as an owned `linkId`; when only
 * `linkId` is sent, the controller encodes that short link's public URL.
 */
export function parseCreateQrDto(body: unknown): ValidationResult<CreateQrDto> {
  if (!isPlainObject(body)) {
    return invalid('Request body must be a JSON object.');
  }

  let targetUrl: string | undefined;
  if (body.targetUrl !== undefined && body.targetUrl !== null) {
    const parsedTarget = parseHttpUrl(body.targetUrl, 'targetUrl');
    if (!parsedTarget.ok) return parsedTarget;
    targetUrl = parsedTarget.value;
  }

  let linkId: string | undefined;
  if (body.linkId !== undefined && body.linkId !== null) {
    if (typeof body.linkId !== 'string') {
      return invalid('linkId must be a string.');
    }
    const parsedId = parseResourceId(body.linkId.trim());
    if (!parsedId.ok) return parsedId;
    linkId = parsedId.value;
  }

  if (!targetUrl && !linkId) {
    return invalid('Provide targetUrl or linkId.');
  }

  const title = parseOptionalTitle(body.title);
  if (!title.ok) return title;

  const imageBody = body.image === undefined || body.image === null ? {} : body.image;
  if (!isPlainObject(imageBody)) {
    return invalid('image must be a JSON object.');
  }

  const size = parseOptionalSize(imageBody.size);
  if (!size.ok) return size;
  const margin = parseOptionalMargin(imageBody.margin);
  if (!margin.ok) return margin;
  const errorCorrectionLevel = parseOptionalErrorCorrection(imageBody.errorCorrectionLevel);
  if (!errorCorrectionLevel.ok) return errorCorrectionLevel;
  const dark = parseOptionalColor(imageBody.dark, 'dark');
  if (!dark.ok) return dark;
  const light = parseOptionalColor(imageBody.light, 'light');
  if (!light.ok) return light;

  // `targetUrl` is guaranteed at runtime: the controller resolves it from
  // `linkId` before persistence when only an id was supplied.
  return {
    ok: true,
    value: {
      targetUrl: targetUrl as string,
      title: title.value,
      linkId,
      image: {
        size: size.value,
        margin: margin.value,
        errorCorrectionLevel: errorCorrectionLevel.value,
        dark: dark.value,
        light: light.value,
      },
    },
  };
}
