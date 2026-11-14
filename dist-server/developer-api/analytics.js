"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLinkDailyClicks = getLinkDailyClicks;
exports.getUserDailyClicks = getUserDailyClicks;
const db_1 = require("../db");
const notifications_1 = require("../notifications");
function dayKey(date) {
    return date.toISOString().slice(0, 10);
}
function recentDays(days) {
    const today = Date.now();
    const keys = [];
    for (let offset = days - 1; offset >= 0; offset -= 1) {
        keys.push(dayKey(new Date(today - offset * 24 * 60 * 60 * 1000)));
    }
    return keys;
}
/**
 * Daily click series for a link, backed by the existing `link_daily_clicks`
 * aggregate (PostgreSQL) or `notificationMemoryStore` (in-memory fallback).
 *
 * The caller must verify link ownership before calling this function; the
 * queries themselves are scoped only by link id because ownership was already
 * established through the owner-checked link lookup.
 */
async function getLinkDailyClicks(linkId, days) {
    const keys = recentDays(days);
    const counts = new Map();
    if ((0, db_1.getDatabasePool)()) {
        try {
            const rows = await (0, db_1.query)(`SELECT TO_CHAR(day, 'YYYY-MM-DD') AS date, clicks
         FROM link_daily_clicks
         WHERE link_id = $1
           AND day > CURRENT_DATE - $2::int
         ORDER BY day ASC`, [linkId, days]);
            for (const row of rows) {
                counts.set(row.date, Number(row.clicks) || 0);
            }
            return keys.map((date) => ({ date, clicks: counts.get(date) || 0 }));
        }
        catch (err) {
            console.warn('[PostgreSQL getLinkDailyClicks fallback to memory]:', err.message);
        }
    }
    for (const date of keys) {
        counts.set(date, notifications_1.notificationMemoryStore.getDailyClicks(linkId, date));
    }
    return keys.map((date) => ({ date, clicks: counts.get(date) || 0 }));
}
/**
 * Daily click series summed across every link owned by one user.
 *
 * `linkIds` is only used by the in-memory fallback; the PostgreSQL query is
 * scoped by `user_id` and never trusts caller-supplied ids.
 */
async function getUserDailyClicks(userId, linkIds, days) {
    const keys = recentDays(days);
    const counts = new Map();
    if ((0, db_1.getDatabasePool)()) {
        try {
            const rows = await (0, db_1.query)(`SELECT TO_CHAR(d.day, 'YYYY-MM-DD') AS date, SUM(d.clicks)::int AS clicks
         FROM link_daily_clicks d
         JOIN links l ON l.id = d.link_id
         WHERE l.user_id = $1
           AND d.day > CURRENT_DATE - $2::int
         GROUP BY d.day
         ORDER BY d.day ASC`, [userId, days]);
            for (const row of rows) {
                counts.set(row.date, Number(row.clicks) || 0);
            }
        }
        catch (err) {
            console.warn('[PostgreSQL getUserDailyClicks fallback to memory]:', err.message);
        }
    }
    else {
        for (const linkId of linkIds) {
            for (const date of keys) {
                counts.set(date, (counts.get(date) || 0) + notifications_1.notificationMemoryStore.getDailyClicks(linkId, date));
            }
        }
    }
    return keys.map((date) => ({ date, clicks: counts.get(date) || 0 }));
}
