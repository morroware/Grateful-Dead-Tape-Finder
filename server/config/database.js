const mysql = require('mysql2/promise');

let pool = null;

function getPool() {
    if (!pool) {
        pool = mysql.createPool({
            host: process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT || '3306', 10),
            user: process.env.DB_USER || 'tapefinder',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'tapefinder',
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
            charset: 'utf8mb4',
            timezone: '+00:00',
            // Reconnect on connection loss
            enableKeepAlive: true,
            keepAliveInitialDelay: 10000
        });
    }
    return pool;
}

async function testConnection() {
    const db = getPool();
    const conn = await db.getConnection();
    await conn.ping();
    conn.release();
    return true;
}

async function query(sql, params) {
    const db = getPool();
    const [rows] = await db.execute(sql, params);
    return rows;
}

async function queryOne(sql, params) {
    const rows = await query(sql, params);
    return rows[0] || null;
}

module.exports = { getPool, testConnection, query, queryOne };
