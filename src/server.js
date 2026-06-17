'use strict';
require('dotenv').config();

const app = require('./app');
const prisma = require('./config/db');
const config = require('./config/env');

const PORT = config.port;

// ─── Global Error Handlers (registered before anything else) ──────────────────
process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled Rejection:', reason);
});

process.on('uncaughtException', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error('');
    console.error('🚫 ──────────────────────────────────────────────────────────');
    console.error(`   PORT ${PORT} IS ALREADY IN USE!`);
    console.error('   Another server instance is running on this port.');
    console.error('');
    console.error('   FIX → Run in PowerShell:  taskkill /IM node.exe /F');
    console.error('   Then restart:             npm run dev');
    console.error('🚫 ──────────────────────────────────────────────────────────');
    console.error('');
    process.exit(0); // exit 0 so nodemon does NOT restart in a crash loop
  } else {
    console.error('❌ Uncaught Exception:', err);
    process.exit(1);
  }
});

async function startServer() {
  try {
    // Test DB connection
    await prisma.$connect();
    console.log('✅ Database connected successfully');

    const server = app.listen(PORT);

    server.on('listening', () => {
      console.log('');
      console.log('🦷 ─────────────────────────────────────────────────');
      console.log(`   Dental HMS SaaS Backend`);
      console.log(`   Environment : ${config.nodeEnv}`);
      console.log(`   Server      : http://localhost:${PORT}`);
      console.log(`   Health      : http://localhost:${PORT}/health`);
      console.log(`   API Base    : http://localhost:${PORT}/api/v1`);
      console.log('🦷 ─────────────────────────────────────────────────');
      console.log('');
    });

    // Handle port-in-use at the server level too
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error('');
        console.error('🚫 ──────────────────────────────────────────────────────────');
        console.error(`   PORT ${PORT} IS ALREADY IN USE!`);
        console.error('   FIX → Run in PowerShell:  taskkill /IM node.exe /F');
        console.error('   Then restart:             npm run dev');
        console.error('🚫 ──────────────────────────────────────────────────────────');
        console.error('');
        process.exit(0);
      } else {
        console.error('❌ Server error:', err);
        process.exit(1);
      }
    });

    // Graceful shutdown on signals
    const shutdown = async (signal) => {
      console.log(`\n🔴 ${signal} received. Shutting down gracefully...`);
      server.close(async () => {
        await prisma.$disconnect();
        console.log('✅ Database disconnected. Server closed.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (err) {
    console.error('❌ Failed to start server:', err.message);
    await prisma.$disconnect();
    process.exit(1);
  }
}

startServer();
