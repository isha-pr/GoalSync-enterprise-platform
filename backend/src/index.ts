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

// ── Global crash protection ─────────────────────────────────────────────────
// Node.js 15+ crashes on unhandled rejections by default.
// Catch them here so a background task (seed, email, escalation)
// never brings down the HTTP server.
process.on('unhandledRejection', (reason) => {
  console.error('⚠️  Unhandled Promise Rejection (caught — server stays up):', reason);
});
process.on('uncaughtException', (err) => {
  console.error('⚠️  Uncaught Exception (caught — server stays up):', err.message);
});

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

// Auto-seed demo users + data on startup (idempotent — safe to run on every restart)
async function ensureDemoUsers() {
  try {
    const hashedPassword = await bcrypt.hash('1234', 10);

    const admin = await prisma.user.upsert({
      where: { email: 'admin@test.com' },
      update: {},
      create: { name: 'Rajesh Kumar', email: 'admin@test.com', password: hashedPassword, role: 'admin', department: 'Human Resources' },
    });

    const manager = await prisma.user.upsert({
      where: { email: 'manager@test.com' },
      update: {},
      create: { name: 'Priya Sharma', email: 'manager@test.com', password: hashedPassword, role: 'manager', department: 'Technology' },
    });

    const employee = await prisma.user.upsert({
      where: { email: 'employee@test.com' },
      update: {},
      create: { name: 'Arjun Patel', email: 'employee@test.com', password: hashedPassword, role: 'employee', department: 'Technology', reportingManagerId: manager.id },
    });

    const emp2 = await prisma.user.upsert({
      where: { email: 'neha@test.com' },
      update: {},
      create: { name: 'Neha Singh', email: 'neha@test.com', password: hashedPassword, role: 'employee', department: 'Technology', reportingManagerId: manager.id },
    });

    const emp3 = await prisma.user.upsert({
      where: { email: 'vikram@test.com' },
      update: {},
      create: { name: 'Vikram Mehta', email: 'vikram@test.com', password: hashedPassword, role: 'employee', department: 'Finance', reportingManagerId: manager.id },
    });

    console.log('✅ Demo users ready (employee / manager / admin — password: 1234)');

    // ── Seed demo goals only if not already present ────────────────────────
    const existingGoals = await prisma.goal.count({ where: { userId: employee.id } });
    if (existingGoals > 0) {
      console.log('ℹ️  Demo data already seeded — skipping');
      return;
    }

    console.log('🌱 Seeding demo goals, approvals, check-ins & escalations...');

    // Goals for main employee (Arjun)
    const goal1 = await prisma.goal.create({ data: {
      userId: employee.id, thrustArea: 'Technical Excellence',
      goalTitle: 'Reduce System Response Time',
      goalDescription: 'Optimize API endpoints to achieve sub-200ms response time across all critical services',
      uomType: 'numeric', higherIsBetter: false, target: 200, achievement: 165,
      weightage: 25, deadline: '2024-12-31', status: 'locked', isLocked: true, progressScore: 82.5,
    }});

    const goal2 = await prisma.goal.create({ data: {
      userId: employee.id, thrustArea: 'Customer Satisfaction',
      goalTitle: 'Improve CSAT Score',
      goalDescription: 'Achieve customer satisfaction score of 90% through improved service delivery',
      uomType: 'percentage', higherIsBetter: true, target: 90, achievement: 87,
      weightage: 20, status: 'approved', isLocked: true, progressScore: 96.67,
    }});

    const goal3 = await prisma.goal.create({ data: {
      userId: employee.id, thrustArea: 'Process Improvement',
      goalTitle: 'Complete Digital Transformation Roadmap',
      goalDescription: 'Deliver all milestones of the Q4 digital transformation project within timeline',
      uomType: 'timeline', higherIsBetter: true, target: 100, achievement: 75,
      weightage: 20, deadline: '2024-12-31', status: 'locked', isLocked: true, progressScore: 75,
    }});

    const goal4 = await prisma.goal.create({ data: {
      userId: employee.id, thrustArea: 'Learning & Development',
      goalTitle: 'Complete Cloud Certification',
      goalDescription: 'Achieve AWS Solutions Architect certification by Q3 2024',
      uomType: 'zero-based', higherIsBetter: true, target: 1, achievement: 1,
      weightage: 15, status: 'locked', isLocked: true, progressScore: 100,
    }});

    const goal5 = await prisma.goal.create({ data: {
      userId: employee.id, thrustArea: 'Team Collaboration',
      goalTitle: 'Knowledge Sharing Sessions',
      goalDescription: 'Conduct minimum 6 technical knowledge sharing sessions with the team',
      uomType: 'numeric', higherIsBetter: true, target: 6, achievement: 4,
      weightage: 20, status: 'submitted', isLocked: false, progressScore: 66.67,
    }});

    // Goal approvals
    await prisma.goalApproval.createMany({ data: [
      { goalId: goal1.id, managerId: manager.id, approvalStatus: 'approved', approvalComments: 'Good target. Ensure monitoring is set up for real-time tracking.', approvedAt: new Date('2024-01-15') },
      { goalId: goal2.id, managerId: manager.id, approvalStatus: 'approved', approvalComments: 'Aligned with Q4 customer excellence initiative.', approvedAt: new Date('2024-01-15') },
      { goalId: goal3.id, managerId: manager.id, approvalStatus: 'approved', approvalComments: 'Critical project. Monthly check-ins required.', approvedAt: new Date('2024-01-15') },
      { goalId: goal4.id, managerId: manager.id, approvalStatus: 'approved', approvalComments: 'Essential for team upskilling.', approvedAt: new Date('2024-01-15') },
    ]});

    // Quarterly check-ins
    await prisma.quarterlyCheckin.createMany({ data: [
      { goalId: goal1.id, userId: employee.id, quarter: 'Q1', actualAchievement: 220, progressStatus: 'on-track', managerComment: 'Good progress. Focus on database query optimization.' },
      { goalId: goal1.id, userId: employee.id, quarter: 'Q2', actualAchievement: 190, progressStatus: 'completed', managerComment: 'Excellent work. Target achieved ahead of schedule.' },
      { goalId: goal2.id, userId: employee.id, quarter: 'Q1', actualAchievement: 82, progressStatus: 'on-track', managerComment: 'Improving steadily. Focus on support ticket resolution time.' },
      { goalId: goal3.id, userId: employee.id, quarter: 'Q1', actualAchievement: 40, progressStatus: 'on-track', managerComment: 'Phase 1 complete. Accelerate phase 2 delivery.' },
    ]});

    // Goals for Neha (emp2)
    const nehaGoal1 = await prisma.goal.create({ data: {
      userId: emp2.id, thrustArea: 'Revenue Growth', goalTitle: 'Upsell Enterprise Accounts',
      goalDescription: 'Achieve 15% upsell revenue from existing enterprise accounts',
      uomType: 'percentage', higherIsBetter: true, target: 15, achievement: 12,
      weightage: 40, status: 'locked', isLocked: true, progressScore: 80,
    }});
    const nehaGoal2 = await prisma.goal.create({ data: {
      userId: emp2.id, thrustArea: 'Customer Success', goalTitle: 'Reduce Churn Rate',
      goalDescription: 'Reduce monthly churn rate to below 2%',
      uomType: 'percentage', higherIsBetter: false, target: 2, achievement: 1.8,
      weightage: 35, status: 'approved', isLocked: true, progressScore: 90,
    }});
    await prisma.goal.create({ data: {
      userId: emp2.id, thrustArea: 'Process Excellence', goalTitle: 'Automate Reporting Dashboard',
      goalDescription: 'Implement automated weekly reports for management review',
      uomType: 'zero-based', higherIsBetter: true, target: 1, achievement: 1,
      weightage: 25, status: 'submitted', isLocked: false, progressScore: 100,
    }});

    await prisma.goalApproval.createMany({ data: [
      { goalId: nehaGoal1.id, managerId: manager.id, approvalStatus: 'approved', approvalComments: 'Strong pipeline. Keep momentum.', approvedAt: new Date('2024-02-01') },
      { goalId: nehaGoal2.id, managerId: manager.id, approvalStatus: 'approved', approvalComments: 'Excellent churn management.', approvedAt: new Date('2024-02-01') },
    ]});

    // Goals for Vikram (emp3)
    await prisma.goal.create({ data: {
      userId: emp3.id, thrustArea: 'Financial Compliance', goalTitle: 'Complete Audit Report',
      goalDescription: 'Deliver Q4 audit report with zero material findings',
      uomType: 'zero-based', higherIsBetter: true, target: 1, achievement: 0,
      weightage: 50, status: 'draft', isLocked: false, progressScore: 0,
    }});
    await prisma.goal.create({ data: {
      userId: emp3.id, thrustArea: 'Cost Reduction', goalTitle: 'Reduce Operational Expenses',
      goalDescription: 'Achieve 10% reduction in operational costs through process improvements',
      uomType: 'percentage', higherIsBetter: false, target: 10, achievement: 6,
      weightage: 50, status: 'submitted', isLocked: false, progressScore: 60,
    }});

    // Demo escalation
    await prisma.escalation.create({ data: {
      type: 'OVERDUE_SUBMISSION', severity: 'high', userId: emp3.id,
      department: emp3.department, reason: 'Goal sheet not submitted within SLA — 14 days overdue',
      daysOverdue: 14, escalationLevel: 2, status: 'open',
    }});

    // Audit logs
    await prisma.auditLog.createMany({ data: [
      { userId: employee.id, goalId: goal1.id, actionType: 'GOAL_CREATED', newValue: JSON.stringify({ title: 'Reduce System Response Time' }) },
      { userId: employee.id, goalId: goal1.id, actionType: 'GOAL_SUBMITTED' },
      { userId: manager.id, goalId: goal1.id, actionType: 'GOAL_APPROVED', newValue: JSON.stringify({ status: 'approved' }) },
      { userId: employee.id, goalId: goal5.id, actionType: 'GOAL_CREATED', newValue: JSON.stringify({ title: 'Knowledge Sharing Sessions' }) },
      { userId: employee.id, goalId: goal5.id, actionType: 'GOAL_SUBMITTED' },
    ]});

    // Welcome notifications
    await prisma.notification.createMany({ data: [
      { userId: employee.id, title: '🎉 Welcome to GoalSync!', message: 'Your demo account is ready. Explore your goals dashboard.', type: 'success', status: 'unread' },
      { userId: manager.id, title: '📋 Team Goal Submitted', message: 'Arjun Patel has submitted a goal for your review: "Knowledge Sharing Sessions"', type: 'warning', status: 'unread' },
      { userId: admin.id, title: '⚠️ Escalation Alert', message: 'Vikram Mehta has an overdue goal submission (14 days). Escalation level 2 triggered.', type: 'error', status: 'unread' },
    ]});

    console.log('✅ Demo data seeded successfully!');
  } catch (err) {
    console.error('⚠️  Auto-seed warning:', err);
  }
}

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);

  // Fire-and-forget background tasks — wrapped so any error never crashes server
  setImmediate(async () => {
    try {
      await ensureDemoUsers();
    } catch (e) {
      console.error('⚠️  Seed error (non-fatal):', e);
    }

    setTimeout(async () => {
      try {
        await runEscalationCheck();
        setInterval(async () => {
          try { await runEscalationCheck(); } catch (e) { console.error('⚠️  Escalation error:', e); }
        }, 60 * 60 * 1000);
        console.log('⚡ Escalation engine scheduled (hourly)');
      } catch (e) {
        console.error('⚠️  Escalation engine failed to start (non-fatal):', e);
      }
    }, 10000);
  });
});

export default app;

