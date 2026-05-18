import { Router } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { runEscalationCheck } from '../utils/escalationEngine';

const router = Router();


const DAYS_MS = 24 * 60 * 60 * 1000;

// ── GET /api/escalations ─────────────────────────────────────
// Returns stored escalation records from DB (+ dynamic fallback computed ones)
router.get('/', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res) => {
  try {
    const { status, type } = req.query as { status?: string; type?: string };

    const where: any = {};
    if (status && status !== 'all') where.status = status;
    if (type && type !== 'all') where.type = type;

    const records = await prisma.escalation.findMany({
      where,
      orderBy: [{ severity: 'asc' }, { daysOverdue: 'desc' }],
    });

    // Enrich with user/goal info
    const enriched = await Promise.all(records.map(async (e) => {
      const user = await prisma.user.findUnique({ where: { id: e.userId }, select: { name: true, email: true, department: true } });
      const goal = e.goalId ? await prisma.goal.findUnique({ where: { id: e.goalId }, select: { goalTitle: true } }) : null;
      const resolverName = e.resolvedBy
        ? (await prisma.user.findUnique({ where: { id: e.resolvedBy }, select: { name: true } }))?.name
        : null;

      return {
        ...e,
        employee: user?.name ?? 'Unknown',
        email: user?.email ?? '',
        department: e.department,
        goalTitle: goal?.goalTitle ?? '—',
        resolverName,
        label: {
          OVERDUE_SUBMISSION: 'Goal Not Submitted',
          OVERDUE_APPROVAL:   'Pending Review Overdue',
          MISSING_CHECKIN:    'Check-in Missing',
        }[e.type] ?? e.type,
      };
    }));

    const all = enriched;
    const summary = {
      total:              all.length,
      open:               all.filter(e => e.status === 'open').length,
      acknowledged:       all.filter(e => e.status === 'acknowledged').length,
      resolved:           all.filter(e => e.status === 'resolved').length,
      high:               all.filter(e => e.severity === 'high').length,
      medium:             all.filter(e => e.severity === 'medium').length,
      low:                all.filter(e => e.severity === 'low').length,
      overdueSubmissions: all.filter(e => e.type === 'OVERDUE_SUBMISSION').length,
      overdueApprovals:   all.filter(e => e.type === 'OVERDUE_APPROVAL').length,
      missingCheckins:    all.filter(e => e.type === 'MISSING_CHECKIN').length,
      level3:             all.filter(e => e.escalationLevel === 3).length,
    };

    const slaRules = [
      { rule: 'Goal Submission SLA',     threshold: '7 days',  level2: '10 days', level3: '14 days', scope: 'Employee → Manager → HR', severity: 'high' },
      { rule: 'Approval Turnaround SLA', threshold: '5 days',  level2: '8 days',  level3: '12 days', scope: 'Manager → HR → Admin',    severity: 'medium' },
      { rule: 'Q1 Check-in Deadline',    threshold: 'Mar 31',  level2: '+7 days', level3: '—',       scope: 'Employee → Manager',       severity: 'low' },
    ];

    res.json({ escalations: enriched, summary, slaRules });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/escalations/run ────────────────────────────────
// Manually trigger escalation engine check
router.post('/run', authenticate, requireRole('admin'), async (req: AuthRequest, res) => {
  try {
    const result = await runEscalationCheck();
    res.json({ message: 'Escalation engine run complete', ...result });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── PUT /api/escalations/:id/acknowledge ─────────────────────
router.put('/:id/acknowledge', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res) => {
  try {
    const updated = await prisma.escalation.update({
      where: { id: req.params.id },
      data: { status: 'acknowledged' },
    });
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── PUT /api/escalations/:id/resolve ────────────────────────
router.put('/:id/resolve', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res) => {
  try {
    const updated = await prisma.escalation.update({
      where: { id: req.params.id },
      data: { status: 'resolved', resolvedAt: new Date(), resolvedBy: req.user!.id },
    });
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/escalations/manager-stats ───────────────────────
router.get('/manager-stats', authenticate, requireRole('admin', 'manager'), async (req: AuthRequest, res) => {
  try {
    const managers = await prisma.user.findMany({
      where: { role: 'manager' },
      include: {
        goalApprovals: {
          include: { goal: { select: { goalTitle: true, updatedAt: true, status: true } } },
        },
      },
    });

    const stats = managers.map(m => {
      const approvals = m.goalApprovals;
      const approved  = approvals.filter(a => a.approvalStatus === 'approved');
      const turnaround = approved
        .filter(a => a.goal?.updatedAt)
        .map(a => Math.max(0, Math.abs((new Date(a.approvedAt).getTime() - new Date(a.goal!.updatedAt).getTime()) / DAYS_MS)));

      return {
        id: m.id, name: m.name, department: m.department,
        totalReviewed: approvals.length,
        approved: approved.length,
        rejected: approvals.filter(a => a.approvalStatus === 'rejected').length,
        rework:   approvals.filter(a => a.approvalStatus === 'rework').length,
        avgTurnaroundDays: turnaround.length ? Math.round(turnaround.reduce((s, d) => s + d, 0) / turnaround.length) : 0,
        approvalRate: approvals.length ? Math.round((approved.length / approvals.length) * 100) : 0,
      };
    });

    res.json(stats);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
