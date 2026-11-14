"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseCreateQrDto = parseCreateQrDto;
const qr_image_1 = require("../qr-image");
const validation_1 = require("./validation");
const HEX_COLOR = /^#(?:[0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;
function parseOptionalSize(value) {
    if (value === undefined || value === null)
        return { ok: true, value: qr_image_1.QR_IMAGE_DEFAULTS.size };
    if (!Number.isInteger(value) || value < 128 || value > 1024) {
        return (0, validation_1.invalid)('image.size must be an integer between 128 and 1024.');
    }
    return { ok: true, value: value };
}
function parseOptionalMargin(value) {
    if (value === undefined || value === null)
        return { ok: true, value: qr_image_1.QR_IMAGE_DEFAULTS.margin };
    if (!Number.isInteger(value) || value < 0 || value > 16) {
        return (0, validation_1.invalid)('image.margin must be an integer between 0 and 16.');
    }
    return { ok: true, value: value };
}
function parseOptionalErrorCorrection(value) {
    if (value === undefined || value === null) {
        return { ok: true, value: qr_image_1.QR_IMAGE_DEFAULTS.errorCorrectionLevel };
    }
    if (typeof value !== 'string') {
        return (0, validation_1.invalid)('image.errorCorrectionLevel must be one of L, M, Q, H.');
    }
    const normalized = value.trim().toUpperCase();
    if (normalized !== 'L' && normalized !== 'M' && normalized !== 'Q' && normalized !== 'H') {
        return (0, validation_1.invalid)('image.errorCorrectionLevel must be one of L, M, Q, H.');
    }
    return { ok: true, value: normalized };
}
function parseOptionalColor(value, field) {
    if (value === undefined || value === null) {
        return { ok: true, value: field === 'dark' ? qr_image_1.QR_IMAGE_DEFAULTS.dark : qr_image_1.QR_IMAGE_DEFAULTS.light };
    }
    if (typeof value !== 'string' || !HEX_COLOR.test(value.trim())) {
        return (0, validation_1.invalid)(`image.${field} must be a hex colour such as #000000.`);
    }
    return { ok: true, value: value.trim() };
}
/**
 * DTO for `POST /api/v1/qr`.
 *
 * A target is required either as `targetUrl` or as an owned `linkId`; when only
 * `linkId` is sent, the controller encodes that short link's public URL.
 */
function parseCreateQrDto(body) {
    if (!(0, validation_1.isPlainObject)(body)) {
        return (0, validation_1.invalid)('Request body must be a JSON object.');
    }
    let targetUrl;
    if (body.targetUrl !== undefined && body.targetUrl !== null) {
        const parsedTarget = (0, validation_1.parseHttpUrl)(body.targetUrl, 'targetUrl');
        if (!parsedTarget.ok)
            return parsedTarget;
        targetUrl = parsedTarget.value;
    }
    let linkId;
    if (body.linkId !== undefined && body.linkId !== null) {
        if (typeof body.linkId !== 'string') {
            return (0, validation_1.invalid)('linkId must be a string.');
        }
        const parsedId = (0, validation_1.parseResourceId)(body.linkId.trim());
        if (!parsedId.ok)
            return parsedId;
        linkId = parsedId.value;
    }
    if (!targetUrl && !linkId) {
        return (0, validation_1.invalid)('Provide targetUrl or linkId.');
    }
    const title = (0, validation_1.parseOptionalTitle)(body.title);
    if (!title.ok)
        return title;
    const imageBody = body.image === undefined || body.image === null ? {} : body.image;
    if (!(0, validation_1.isPlainObject)(imageBody)) {
        return (0, validation_1.invalid)('image must be a JSON object.');
    }
    const size = parseOptionalSize(imageBody.size);
    if (!size.ok)
        return size;
    const margin = parseOptionalMargin(imageBody.margin);
    if (!margin.ok)
        return margin;
    const errorCorrectionLevel = parseOptionalErrorCorrection(imageBody.errorCorrectionLevel);
    if (!errorCorrectionLevel.ok)
        return errorCorrectionLevel;
    const dark = parseOptionalColor(imageBody.dark, 'dark');
    if (!dark.ok)
        return dark;
    const light = parseOptionalColor(imageBody.light, 'light');
    if (!light.ok)
        return light;
    // `targetUrl` is guaranteed at runtime: the controller resolves it from
    // `linkId` before persistence when only an id was supplied.
    return {
        ok: true,
        value: {
            targetUrl: targetUrl,
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
