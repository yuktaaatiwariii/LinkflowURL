"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const os_1 = __importDefault(require("os"));
dotenv_1.default.config();
const index_1 = require("./index");
const schema_1 = require("./schema");
const db_1 = require("./db");
const notifications_1 = require("./notifications");
const PORT = Number(process.env.PORT) || 3000;
// Bind to every interface so emulators (10.0.2.2) and physical devices on the
// same LAN can reach the API, not just the machine's loopback adapter.
const HOST = process.env.HOST || '0.0.0.0';
function getLanAddresses() {
    const addresses = [];
    const interfaces = os_1.default.networkInterfaces();
    for (const entries of Object.values(interfaces)) {
        for (const entry of entries || []) {
            if (entry.family === 'IPv4' && !entry.internal) {
                addresses.push(entry.address);
            }
        }
    }
    return addresses;
}
const server = (0, index_1.createServer)();
server.listen(PORT, HOST, async () => {
    console.log(`[LinkFlow Backend] Server listening on ${HOST}:${PORT}`);
    console.log(`[LinkFlow Backend] Local:  http://localhost:${PORT}`);
    const lanAddresses = getLanAddresses();
    if (lanAddresses.length === 0) {
        console.warn('[LinkFlow Backend] No LAN IPv4 address detected. Emulators can still use the loopback alias.');
    }
    else {
        for (const address of lanAddresses) {
            console.log(`[LinkFlow Backend] LAN:    http://${address}:${PORT}`);
        }
        console.log('[LinkFlow Backend] If a physical phone cannot connect, allow this port through ' +
            'the OS firewall (Windows: allow node.exe on Private networks) and keep both ' +
            'devices on the same network.');
    }
    if (!process.env.EXPO_PUBLIC_API_URL) {
        console.log('[LinkFlow Backend] Hint: the mobile app derives the API host from the Expo ' +
            'dev-server address. If you use `expo start --tunnel`, set EXPO_PUBLIC_API_URL ' +
            'to a publicly reachable URL for this backend.');
    }
    if ((0, db_1.getDatabasePool)()) {
        console.log('[LinkFlow Backend] Connected to PostgreSQL DATABASE_URL. Running migrations...');
        const result = await (0, schema_1.runMigrations)();
        console.log(`[LinkFlow Backend] Migrations: ${result.message}`);
    }
    else {
        console.warn('[LinkFlow Backend] WARNING: DATABASE_URL is not set. Running with in-memory persistence. Data will be lost on restart. Configure DATABASE_URL for production use.');
    }
    // Scheduled notification processors (expiration reminders + daily performance
    // thresholds). unref'd so timers never keep the process alive on their own.
    const notificationIntervalMs = Number(process.env.NOTIFICATION_CHECK_INTERVAL_MS) || 15 * 60 * 1000;
    const runNotificationChecks = () => {
        void (0, notifications_1.checkExpiringLinks)();
        void (0, notifications_1.checkLinkPerformanceNotifications)();
    };
    const notificationTimer = setInterval(runNotificationChecks, notificationIntervalMs);
    notificationTimer?.unref?.();
    // First pass shortly after boot so reminders fire without waiting a full interval.
    const bootTimer = setTimeout(runNotificationChecks, 15_000);
    bootTimer?.unref?.();
    console.log(`[LinkFlow Backend] Notification checks scheduled every ${Math.round(notificationIntervalMs / 60000)} min.`);
});
server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`[LinkFlow Backend] Port ${PORT} is already in use. Stop the other process or set PORT.`);
    }
    else {
        console.error('[LinkFlow Backend] Server error:', err.message);
    }
    process.exitCode = 1;
});
