require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');

const PORT = process.env.PORT || 4000;

async function start() {
  try {
    await connectDB();
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log('='.repeat(50));
      console.log(`✓ E-Wallet backend is running`);
      console.log(`✓ Port: ${PORT}`);
      console.log(`✓ API: http://localhost:${PORT}/api`);
      console.log(`✓ Health: http://localhost:${PORT}/health`);
      console.log('='.repeat(50));
    });

    // Handle port already in use error
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`\nERROR: Port ${PORT} is already in use.`);
        console.error('Kill the process or use a different PORT env variable.');
        process.exit(1);
      }
      throw err;
    });
  } catch (err) {
    console.error('Failed to connect to database:', err.message);
    console.log('\nStarting server without database connection...');
    app.listen(PORT, '0.0.0.0', () => {
      console.log('='.repeat(50));
      console.log(`⚠ E-Wallet backend is running (NO DATABASE)`);
      console.log(`✓ Port: ${PORT}`);
      console.log(`✓ API: http://localhost:${PORT}/api`);
      console.log(`⚠ Database connection failed - some features will not work`);
      console.log('='.repeat(50));
    });
  }
}

start();
