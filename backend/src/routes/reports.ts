import { Router } from 'express';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();


// GET /api/reports/achievements
router.get('/achievements', authenticate, async (req: AuthRequest, res) => {
  try {
    const where: any = {};
    if (req.user!.role === 'employee') where.userId = req.user!.id;

    const goals = await prisma.goal.findMany({
      where,
      include: {
        user: { select: { name: true, department: true } },
        quarterlyCheckins: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const report = goals.map(g => ({
      id: g.id,
      employeeName: g.user.name,
      department: g.user.department,
      thrustArea: g.thrustArea,
      goalTitle: g.goalTitle,
      uomType: g.uomType,
      target: g.target,
      achievement: g.achievement,
      progressScore: Math.round(g.progressScore * 10) / 10,
      status: g.status,
      isLocked: g.isLocked,
      weightage: g.weightage,
      lastCheckin: g.quarterlyCheckins.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0] || null,
    }));

    res.json(report);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/reports/completion
router.get('/completion', authenticate, async (req: AuthRequest, res) => {
  try {
    const [q1, q2, q3, q4] = await Promise.all([
      prisma.quarterlyCheckin.count({ where: { quarter: 'Q1' } }),
      prisma.quarterlyCheckin.count({ where: { quarter: 'Q2' } }),
      prisma.quarterlyCheckin.count({ where: { quarter: 'Q3' } }),
      prisma.quarterlyCheckin.count({ where: { quarter: 'Q4' } }),
    ]);

    const totalGoals = await prisma.goal.count();
    const submitted  = await prisma.goal.count({ where: { status: { in: ['submitted', 'approved', 'locked'] } } });
    const locked     = await prisma.goal.count({ where: { isLocked: true } });

    res.json({
      quarterly: [
        { quarter: 'Q1', checkins: q1 },
        { quarter: 'Q2', checkins: q2 },
        { quarter: 'Q3', checkins: q3 },
        { quarter: 'Q4', checkins: q4 },
      ],
      goalSubmission: { total: totalGoals, submitted, locked },
    });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/reports/analytics — deep analytics for QoQ, heatmap, distribution
router.get('/analytics', authenticate, async (req: AuthRequest, res) => {
  try {
    const goals = await prisma.goal.findMany({
      include: {
        user: { select: { id: true, name: true, department: true, reportingManagerId: true } },
        quarterlyCheckins: true,
      },
    });

    const checkins = await prisma.quarterlyCheckin.findMany({
      include: { user: { select: { name: true, department: true, reportingManagerId: true } } },
    });

    const managers = await prisma.user.findMany({
      where: { role: 'manager' },
      include: {
        goals: {
          include: { user: { select: { department: true } } },
        },
      },
    });

    const employees = await prisma.user.findMany({ where: { role: 'employee' } });

    // ── 1. QoQ Trends by Department ────────────────────────────────────
    // For each department × quarter, compute avg actualAchievement from check-ins
    const deptSet = [...new Set(goals.map(g => g.user.department))];
    const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];

    const qoqTrends = deptSet.map(dept => {
      const row: Record<string, any> = { department: dept };
      for (const q of QUARTERS) {
        const qCheckins = checkins.filter(c => c.user.department === dept && c.quarter === q);
        row[q] = qCheckins.length
          ? Math.round(qCheckins.reduce((s, c) => s + c.actualAchievement, 0) / qCheckins.length)
          : 0;
      }
      return row;
    });

    // ── 2. Department Heatmap ──────────────────────────────────────────
    const deptHeatmap = deptSet.map(dept => {
      const dGoals = goals.filter(g => g.user.department === dept);
      const locked     = dGoals.filter(g => g.isLocked).length;
      const approved   = dGoals.filter(g => g.status === 'approved').length;
      const submitted  = dGoals.filter(g => g.status === 'submitted').length;
      const draft      = dGoals.filter(g => g.status === 'draft').length;
      const escalated  = dGoals.filter(g => g.status === 'rejected' || g.status === 'rework').length;
      const avgProg    = dGoals.length ? Math.round(dGoals.reduce((s, g) => s + g.progressScore, 0) / dGoals.length) : 0;
      const completionRate = dGoals.length ? Math.round((locked / dGoals.length) * 100) : 0;
      return { department: dept, goalCount: dGoals.length, locked, approved, submitted, draft, escalated, avgProgress: avgProg, completionRate };
    }).sort((a, b) => b.completionRate - a.completionRate);

    // ── 3. Goal Distribution ───────────────────────────────────────────
    // By Thrust Area
    const thrustMap: Record<string, { count: number; totalProg: number }> = {};
    goals.forEach(g => {
      if (!thrustMap[g.thrustArea]) thrustMap[g.thrustArea] = { count: 0, totalProg: 0 };
      thrustMap[g.thrustArea].count++;
      thrustMap[g.thrustArea].totalProg += g.progressScore;
    });
    const byThrustArea = Object.entries(thrustMap).map(([name, d]) => ({
      name, count: d.count, avgProgress: Math.round(d.totalProg / d.count),
    })).sort((a, b) => b.count - a.count);

    // By UoM Type
    const uomMap: Record<string, number> = {};
    goals.forEach(g => { uomMap[g.uomType] = (uomMap[g.uomType] || 0) + 1; });
    const byUomType = Object.entries(uomMap).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);

    // By Status
    const statusMap: Record<string, number> = {};
    goals.forEach(g => {
      const s = g.isLocked ? 'locked' : g.status;
      statusMap[s] = (statusMap[s] || 0) + 1;
    });
    const byStatus = Object.entries(statusMap).map(([status, count]) => ({ status, count }));

    // ── 4. Manager Check-in Completion Rates ──────────────────────────
    const managerCheckinStats = managers.map(mgr => {
      // Team = employees who report to this manager
      const teamEmpIds = employees.filter(e => e.reportingManagerId === mgr.id).map(e => e.id);
      const teamGoals = goals.filter(g => teamEmpIds.includes(g.userId));

      const qStats: Record<string, any> = {};
      for (const q of QUARTERS) {
        const goalsWithCheckin = teamGoals.filter(g => g.quarterlyCheckins.some(c => c.quarter === q)).length;
        qStats[q] = teamGoals.length ? Math.round((goalsWithCheckin / teamGoals.length) * 100) : 0;
      }

      const pendingApprovals = teamGoals.filter(g => g.status === 'submitted').length;
      const delayedApprovals = teamGoals.filter(g => {
        if (g.status !== 'submitted') return false;
        const ageDays = (Date.now() - new Date(g.updatedAt).getTime()) / (24 * 60 * 60 * 1000);
        return ageDays > 5;
      }).length;

      return {
        managerId: mgr.id,
        managerName: mgr.name,
        department: mgr.department,
        teamSize: teamEmpIds.length,
        totalTeamGoals: teamGoals.length,
        pendingApprovals,
        delayedApprovals,
        ...qStats,
        overallCheckinRate: QUARTERS.reduce((s, q) => s + (qStats[q] || 0), 0) / QUARTERS.length,
      };
    });

    res.json({ qoqTrends, deptHeatmap, byThrustArea, byUomType, byStatus, managerCheckinStats });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
