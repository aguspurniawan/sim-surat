import 'dotenv/config';

import express from 'express';
import http from 'http';
import path from 'path';
import cors from 'cors';
import { Server as SocketIOServer } from 'socket.io';
import { createServer as createViteServer } from 'vite';

import { connectDB } from './src/server/config/database';
import { seedInitialData } from './src/server/config/seed';
import { apiRouter } from './src/server/routes/api.routes';
import { startTelegramBot } from './src/server/integrations/telegram/telegram.bot';

import fs from 'fs';

const uploadsDir = path.join(process.cwd(), 'uploads');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

async function startServer() {
  const app = express();
  const PORT = 3005;
  const server = http.createServer(app);

  const io = new SocketIOServer(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  app.use('/uploads', express.static(uploadsDir));

  // Database harus siap terlebih dahulu
  await connectDB();
  await seedInitialData();

  console.log('✅ Database siap.');

  // Baru aktifkan Telegram
  startTelegramBot();

  io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    socket.on('join_unit', (unitCode) => {
      socket.join(`unit_${unitCode}`);
    });
  });

  app.use((req: any, res, next) => {
    req.io = io;
    next();
  });

  app.use('/api', apiRouter);

  // Fallback for unexpected database errors
  app.use((err: any, req: any, res: any, next: any) => {
    if (err.name === 'MongooseError' || err.name === 'MongoNetworkError' || (err.message && err.message.includes('buffering timed out'))) {
      console.warn('[AI Studio] Database offline — returning fallback');
      if (req.method === 'GET') {
        return res.json(req.path.endsWith('s') || req.path.endsWith('s/') ? [] : {});
      }
      return res.status(503).json({ error: 'Service temporarily unavailable (database offline)' });
    }
    next(err);
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
      },
      appType: 'spa',
    });

    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');

    app.use(express.static(distPath));

    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(
      `🚀 Sistem Surat berjalan di http://0.0.0.0:${PORT}`
    );
  });
}

startServer().catch((err) => {
  console.error('❌ Fatal Server Startup Error:', err);
  process.exit(1);
});