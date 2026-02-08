/**
 * Phusion Passenger entry point for cPanel Node.js hosting.
 *
 * cPanel's "Setup Node.js App" feature uses Passenger, which requires:
 *   1. An app.js file that exports or starts the Express app
 *   2. The app to bind to the port Passenger provides (process.env.PORT)
 *
 * Set these in cPanel > Setup Node.js App:
 *   Application root:   /home/youruser/Grateful-Dead-Tape-Finder/server
 *   Application URL:     /  (or a subdirectory)
 *   Startup file:        app.js
 */

const app = require('./index');
const { testConnection } = require('./config/database');

// Passenger provides PORT automatically
const PORT = process.env.PORT || 3001;

(async function start() {
    try {
        await testConnection();
        console.log('Database connected');
    } catch (error) {
        console.error('Database connection failed:', error.message);
        console.error('Check your .env file and MySQL credentials.');
    }

    app.listen(PORT, () => {
        console.log(`Tape Finder running on port ${PORT} (Passenger)`);
    });
})();
