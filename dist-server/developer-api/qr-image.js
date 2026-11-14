"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QR_IMAGE_DEFAULTS = void 0;
exports.renderQrDataUrl = renderQrDataUrl;
exports.describeQrImage = describeQrImage;
const qrcode_1 = __importDefault(require("qrcode"));
exports.QR_IMAGE_DEFAULTS = {
    size: 512,
    margin: 2,
    errorCorrectionLevel: 'M',
    dark: '#000000',
    light: '#FFFFFF',
};
async function renderQrDataUrl(targetUrl, options = exports.QR_IMAGE_DEFAULTS) {
    return qrcode_1.default.toDataURL(targetUrl, {
        type: 'image/png',
        errorCorrectionLevel: options.errorCorrectionLevel,
        margin: options.margin,
        width: options.size,
        color: {
            dark: options.dark,
            light: options.light,
        },
    });
}
function describeQrImage(dataUrl, options = exports.QR_IMAGE_DEFAULTS) {
    return {
        mimeType: 'image/png',
        encoding: 'data-uri',
        dataUrl,
        width: options.size,
        margin: options.margin,
        errorCorrectionLevel: options.errorCorrectionLevel,
        dark: options.dark,
        light: options.light,
    };
}
