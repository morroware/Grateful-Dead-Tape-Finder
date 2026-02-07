#!/usr/bin/env node

/**
 * Tape Finder Installation Script
 *
 * Sets up the MySQL database, creates tables, and creates the initial admin user.
 *
 * Usage:
 *   1. Copy .env.example to .env and fill in your MySQL credentials
 *   2. Run: node install.js
 *
 * For cPanel shared hosting:
 *   1. Create a MySQL database and user via cPanel
 *   2. Update .env with those credentials
 *   3. Run this script via SSH or cPanel Terminal
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Load .env if it exists
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
} else {
    console.log('\n  No .env file found. Starting interactive setup...\n');
}

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function ask(question, defaultValue) {
    return new Promise(resolve => {
        const prompt = defaultValue ? `${question} [${defaultValue}]: ` : `${question}: `;
        rl.question(prompt, answer => {
            resolve(answer.trim() || defaultValue || '');
        });
    });
}

async function main() {
    console.log('');
    console.log('  ╔══════════════════════════════════════════╗');
    console.log('  ║   Live Music Archive - Tape Finder       ║');
    console.log('  ║   Installation Script                    ║');
    console.log('  ╚══════════════════════════════════════════╝');
    console.log('');

    // Gather configuration
    let config = {};

    if (!process.env.DB_HOST) {
        console.log('  Database Configuration');
        console.log('  ──────────────────────');
        config.DB_HOST = await ask('  MySQL Host', 'localhost');
        config.DB_PORT = await ask('  MySQL Port', '3306');
        config.DB_USER = await ask('  MySQL Username', 'tapefinder');
        config.DB_PASSWORD = await ask('  MySQL Password', '');
        config.DB_NAME = await ask('  Database Name', 'tapefinder');
        console.log('');
        console.log('  Admin Account');
        console.log('  ──────────────────────');
        config.ADMIN_USERNAME = await ask('  Admin Username', 'admin');
        config.ADMIN_EMAIL = await ask('  Admin Email', 'admin@example.com');
        config.ADMIN_PASSWORD = await ask('  Admin Password', '');
        console.log('');
        config.PORT = await ask('  Server Port', '3001');
        config.FRONTEND_ORIGIN = await ask('  Frontend Origin URL', '*');
        console.log('');

        // Generate session secret
        const crypto = require('crypto');
        config.SESSION_SECRET = crypto.randomBytes(32).toString('hex');
        config.SEARCH_CACHE_TTL = '21600';
        config.SHOW_CACHE_TTL = '86400';
        config.ARCHIVE_API_BASE = 'https://archive.org';

        // Write .env
        const envContent = Object.entries(config)
            .map(([key, value]) => `${key}=${value}`)
            .join('\n');

        fs.writeFileSync(envPath, envContent);
        console.log('  .env file created successfully.');
        console.log('');

        // Reload env
        require('dotenv').config({ path: envPath });
    } else {
        config = {
            DB_HOST: process.env.DB_HOST,
            DB_PORT: process.env.DB_PORT || '3306',
            DB_USER: process.env.DB_USER,
            DB_PASSWORD: process.env.DB_PASSWORD,
            DB_NAME: process.env.DB_NAME || 'tapefinder',
            ADMIN_USERNAME: process.env.ADMIN_USERNAME || 'admin',
            ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'admin@example.com',
            ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'admin123'
        };
        console.log('  Using configuration from .env file.');
        console.log('');
    }

    // Connect to MySQL
    console.log('  Connecting to MySQL...');
    const mysql = require('mysql2/promise');

    let connection;
    try {
        // First connect without database to create it
        connection = await mysql.createConnection({
            host: config.DB_HOST,
            port: parseInt(config.DB_PORT, 10),
            user: config.DB_USER,
            password: config.DB_PASSWORD
        });

        console.log('  Connected to MySQL server.');

        // Create database if not exists
        await connection.execute(`CREATE DATABASE IF NOT EXISTS \`${config.DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
        console.log(`  Database "${config.DB_NAME}" ready.`);

        await connection.execute(`USE \`${config.DB_NAME}\``);

        // Create tables
        console.log('  Creating tables...');

        // Read and execute schema
        const schemaPath = path.join(__dirname, 'schema', 'init.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');

        // Split by semicolons and execute each statement
        const statements = schema
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('CREATE DATABASE') && !s.startsWith('USE'));

        for (const stmt of statements) {
            try {
                await connection.execute(stmt);
            } catch (err) {
                // Ignore "already exists" errors
                if (!err.message.includes('already exists')) {
                    console.warn(`  Warning: ${err.message}`);
                }
            }
        }

        console.log('  Tables created successfully.');

        // Create admin user
        console.log('  Creating admin user...');
        const bcrypt = require('bcrypt');
        const passwordHash = await bcrypt.hash(config.ADMIN_PASSWORD, 12);

        try {
            await connection.execute(
                `INSERT INTO users (username, email, password_hash, display_name, is_admin)
                 VALUES (?, ?, ?, ?, TRUE)
                 ON DUPLICATE KEY UPDATE is_admin = TRUE, password_hash = VALUES(password_hash)`,
                [config.ADMIN_USERNAME, config.ADMIN_EMAIL, passwordHash, config.ADMIN_USERNAME]
            );
            console.log(`  Admin user "${config.ADMIN_USERNAME}" created.`);
        } catch (err) {
            console.log(`  Admin user: ${err.message}`);
        }

        await connection.end();

        console.log('');
        console.log('  ╔══════════════════════════════════════════╗');
        console.log('  ║   Installation Complete!                 ║');
        console.log('  ╚══════════════════════════════════════════╝');
        console.log('');
        console.log('  Next steps:');
        console.log('');
        console.log('    1. Install dependencies:   npm install');
        console.log('    2. Start the server:       npm start');
        console.log(`    3. Open in browser:        http://localhost:${config.PORT || 3001}`);
        console.log(`    4. Admin panel:            http://localhost:${config.PORT || 3001}/admin.html`);
        console.log('');
        console.log('  Admin login:');
        console.log(`    Email:    ${config.ADMIN_EMAIL}`);
        console.log(`    Password: ${config.ADMIN_PASSWORD}`);
        console.log('');

    } catch (error) {
        console.error('');
        console.error('  Installation failed:', error.message);
        console.error('');
        console.error('  Common issues:');
        console.error('    - MySQL is not running');
        console.error('    - Wrong credentials in .env');
        console.error('    - User lacks CREATE DATABASE permission');
        console.error('    - For cPanel: create the database first via cPanel MySQL Databases');
        console.error('');
        process.exit(1);
    }

    rl.close();
}

main();
