import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { db, initDatabase } from './db/database.js';
import { seedData } from './db/seed.js';
import customerRoutes from './routes/customer.routes.js';
import brokerRoutes from './routes/broker.routes.js';
import aiRoutes from './routes/ai.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize database
initDatabase();

// Check if seeding is needed
try {
  const count = db.prepare('SELECT COUNT(*) as count FROM customers').get().count;
  if (count === 0) {
    console.log('Seeding initial data...');
    seedData();
  }
} catch (e) {
  console.log('Seeding initial database...');
  seedData();
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Security Headers (Defense in depth)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Simple in-memory rate limiter for resource-intensive AI endpoints
const aiRequestTracker = new Map();
const AI_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_AI_REQUESTS_PER_WINDOW = 20;

app.use('/api/ai', (req, res, next) => {
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  const now = Date.now();
  const clientData = aiRequestTracker.get(ip) || { count: 0, resetTime: now + AI_RATE_LIMIT_WINDOW_MS };

  if (now > clientData.resetTime) {
    clientData.count = 1;
    clientData.resetTime = now + AI_RATE_LIMIT_WINDOW_MS;
  } else {
    clientData.count++;
  }

  aiRequestTracker.set(ip, clientData);

  if (clientData.count > MAX_AI_REQUESTS_PER_WINDOW) {
    return res.status(429).json({
      error: 'คำขอใช้งาน AI บ่อยเกินไป กรุณารอสักครู่ (Too Many Requests)'
    });
  }

  next();
});

// Serve static frontend files
const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir));

// API Routes
app.use('/api/customer', customerRoutes);
app.use('/api/broker', brokerRoutes);
app.use('/api/ai', aiRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Coverage Pulse API',
    timestamp: new Date().toISOString(),
    database: 'SQLite (node:sqlite active)'
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`===================================================`);
  console.log(`  Coverage Pulse Platform is running!             `);
  console.log(`  Portal Switcher : http://localhost:${PORT}/        `);
  console.log(`  Customer Portal : http://localhost:${PORT}/customer`);
  console.log(`  Broker Portal   : http://localhost:${PORT}/broker  `);
  console.log(`===================================================`);
});
