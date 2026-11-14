"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseCreateLinkDto = parseCreateLinkDto;
const validation_1 = require("./validation");
/**
 * DTO for `POST /api/v1/links`.
 *
 * Only business fields are read. Any `userId` / `user_id` supplied by the
 * caller is ignored: ownership always comes from the authenticated key.
 */
function parseCreateLinkDto(body) {
    if (!(0, validation_1.isPlainObject)(body)) {
        return (0, validation_1.invalid)('Request body must be a JSON object.');
    }
    const originalUrl = (0, validation_1.parseHttpUrl)(body.originalUrl, 'originalUrl');
    if (!originalUrl.ok)
        return originalUrl;
    const title = (0, validation_1.parseOptionalTitle)(body.title);
    if (!title.ok)
        return title;
    const customAlias = (0, validation_1.parseOptionalAlias)(body.customAlias);
    if (!customAlias.ok)
        return customAlias;
    return {
        ok: true,
        value: {
            originalUrl: originalUrl.value,
            title: title.value,
            customAlias: customAlias.value,
        },
    };
}
