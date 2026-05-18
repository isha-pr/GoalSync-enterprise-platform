import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import prisma from './lib/prisma';
import bcrypt from 'bcryptjs';
import authRoutes from './routes/auth';
import goalRoutes from './routes/goals';
import managerRoutes from './routes/manager';
import adminRoutes from './routes/admin';
import reportRoutes from './routes/reports';
import notificationRoutes from './routes/notifications';
import escalationRoutes from './routes/escalations';
import { runEscalationCheck } from './utils/escalationEngine';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
// Prisma singleton imported from ./lib/prisma

// Allowed origins — covers local dev + any Vercel preview/production URL
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://127.0.0.1:3000',
  process.env.FRONTEND_URL, // set in Render dashboard: https://your-app.vercel.app
].filter(Boolean) as string[];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (curl, Postman, server-to-server)
    if (!origin) return callback(null, true);
    // Allow any vercel.app subdomain (covers all preview + production deployments)
    if (origin.endsWith('.vercel.app')) return callback(null, true);
    // Allow explicitly listed origins
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/goals', goalRoutes);
app.use('/api/manager', managerRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/escalations', escalationRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Goal Tracking Portal API running', timestamp: new Date() });
});

// Auto-seed demo users on startup (idempotent — upsert never duplicates)
async function ensureDemoUsers() {
  try {
    const hashedPassword = await bcrypt.hash('1234', 10);

    const manager = await prisma.user.upsert({
      where: { email: 'manager@test.com' },
      update: {},
      create: {
        name: 'Priya Sharma',
        email: 'manager@test.com',
        password: hashedPassword,
        role: 'manager',
        department: 'Technology',
      },
    });

    await prisma.user.upsert({
      where: { email: 'employee@test.com' },
      update: {},
      create: {
        name: 'Arjun Patel',
        email: 'employee@test.com',
        password: hashedPassword,
        role: 'employee',
        department: 'Technology',
        reportingManagerId: manager.id,
      },
    });

    await prisma.user.upsert({
      where: { email: 'admin@test.com' },
      update: {},
      create: {
        name: 'Rajesh Kumar',
        email: 'admin@test.com',
        password: hashedPassword,
        role: 'admin',
        department: 'Human Resources',
      },
    });

    console.log('✅ Demo users ready (employee / manager / admin — password: 1234)');
  } catch (err) {
    console.error('⚠️  Auto-seed warning:', err);
  }
}

app.listen(PORT, async () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  await ensureDemoUsers();

  // Start escalation engine: first run 5s after boot, then every hour
  setTimeout(async () => {
    await runEscalationCheck();
    setInterval(runEscalationCheck, 60 * 60 * 1000); // every 1 hour
    console.log('⚡ Escalation engine scheduled (hourly)');
  }, 5000);
});

export default app;

