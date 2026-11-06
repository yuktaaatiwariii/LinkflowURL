"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const index_1 = require("./index");
const schema_1 = require("./schema");
const db_1 = require("./db");
const PORT = process.env.PORT || 3000;
const server = (0, index_1.createServer)();
server.listen(PORT, async () => {
    console.log(`[LinkFlow Backend] Server listening on port ${PORT}`);
    if ((0, db_1.getDatabasePool)()) {
        console.log('[LinkFlow Backend] Connected to PostgreSQL DATABASE_URL. Running migrations...');
        await (0, schema_1.runMigrations)();
    }
    else {
        console.warn('[LinkFlow Backend] WARNING: DATABASE_URL is not set. Running with in-memory persistence. Data will be lost on restart. Configure DATABASE_URL for production use.');
    }
});
