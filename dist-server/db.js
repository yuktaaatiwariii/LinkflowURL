"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDatabasePool = getDatabasePool;
exports.query = query;
const pg_1 = require("pg");
let pool = null;
function getDatabasePool() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        return null;
    }
    if (!pool) {
        const config = {
            connectionString,
            ssl: connectionString.includes('localhost') || connectionString.includes('127.0.0.1')
                ? false
                : { rejectUnauthorized: false },
            max: 10,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000,
        };
        pool = new pg_1.Pool(config);
        pool.on('error', (err) => {
            console.error('[PostgreSQL Pool Error]:', err.message);
        });
    }
    return pool;
}
async function query(text, params) {
    const dbPool = getDatabasePool();
    if (!dbPool) {
        throw new Error('DATABASE_URL is not configured in the server environment.');
    }
    const client = await dbPool.connect();
    try {
        const res = await client.query(text, params);
        return res.rows;
    }
    finally {
        client.release();
    }
}
