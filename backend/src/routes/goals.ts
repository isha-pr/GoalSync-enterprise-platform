import { Router } from 'express';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { sendGoalSubmittedEmail } from '../utils/mailer';
import { teamsGoalSubmitted } from '../utils/teamsNotifier';

const router = Router();


function calcProgressScore(uomType: string, higherIsBetter: boolean, target: number, achievement: number): number {
  if (!achievement || !target) return 0;
  if (uomType === 'zero-based') return achievement === 0 ? 100 : 0;
  if (uomType === 'numeric' || uomType === 'percentage') {
    if (higherIsBetter) return Math.min((achievement / target) * 100, 100);
    else return Math.min((target / achievement) * 100, 100);
  }
  if (uomType === 'timeline') return Math.min((achievement / target) * 100, 100);
  return 0;
}

async function createAuditLog(userId: string, goalId: string | null, actionType: string, oldValue?: any, newValue?: any) {
  await prisma.auditLog.create({
    data: {
      userId,
      goalId,
      actionType,
      oldValue: oldValue ? JSON.stringify(oldValue) : null,
      newValue: newValue ? JSON.stringify(newValue) : null,
    },
  });
}

async function createNotification(userId: string, title: string, message: string, type = 'info') {
  await prisma.notification.create({ data: { userId, title, message, type } });
}

// GET /api/goals — get current user's goals
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const goals = await prisma.goal.findMany({
      where: { userId: req.user!.id },
      include: {
        goalApprovals: { include: { manager: { select: { name: true } } } },
        quarterlyCheckins: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(goals);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/goals/stats — dashboard stats
router.get('/stats', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const goals = await prisma.goal.findMany({ where: { userId } });
    const totalWeightage = goals.reduce((s, g) => s + g.weightage, 0);
    const avgProgress = goals.length ? goals.reduce((s, g) => s + g.progressScore, 0) / goals.length : 0;

    res.json({
      total: goals.length,
      draft: goals.filter(g => g.status === 'draft').length,
      submitted: goals.filter(g => g.status === 'submitted').length,
      approved: goals.filter(g => g.status === 'approved').length,
      locked: goals.filter(g => g.isLocked).length,
      rework: goals.filter(g => g.status === 'rework').length,
      totalWeightage,
      avgProgress: Math.round(avgProgress * 10) / 10,
    });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/goals — create goal
router.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const existingGoals = await prisma.goal.findMany({ where: { userId } });

    if (existingGoals.length >= 8) {
      return res.status(400).json({ error: 'Maximum 8 goals allowed per employee' });
    }

    const { thrustArea, goalTitle, goalDescription, uomType, higherIsBetter, target, weightage, deadline, isSharedGoal } = req.body;

    if (weightage < 10) {
      return res.status(400).json({ error: 'Minimum weightage per goal is 10%' });
    }

    const totalWeightage = existingGoals.reduce((s, g) => s + g.weightage, 0) + weightage;
    if (totalWeightage > 100) {
      return res.status(400).json({ error: `Total weightage cannot exceed 100%. Current: ${existingGoals.reduce((s, g) => s + g.weightage, 0)}%, Adding: ${weightage}%` });
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, department: true } });

    const goal = await prisma.goal.create({
      data: {
        userId,
        thrustArea,
        goalTitle,
        goalDescription,
        uomType,
        higherIsBetter: higherIsBetter !== false,
        target: parseFloat(target),
        weightage: parseFloat(weightage),
        deadline,
        isSharedGoal: !!isSharedGoal,
      },
    });

    await createAuditLog(userId, goal.id, 'GOAL_CREATED', null, { title: goalTitle, weightage });
    res.status(201).json(goal);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/goals/:id — update goal
router.put('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const goal = await prisma.goal.findUnique({ where: { id: req.params.id } });
    if (!goal) return res.status(404).json({ error: 'Goal not found' });
    if (goal.userId !== req.user!.id) return res.status(403).json({ error: 'Forbidden' });
    if (goal.isLocked) return res.status(400).json({ error: 'Goal is locked and cannot be edited' });

    const oldValues = { ...goal };
    const updated = await prisma.goal.update({
      where: { id: req.params.id },
      data: {
        ...req.body,
        target: req.body.target ? parseFloat(req.body.target) : undefined,
        weightage: req.body.weightage ? parseFloat(req.body.weightage) : undefined,
        achievement: req.body.achievement ? parseFloat(req.body.achievement) : undefined,
      },
    });

    await createAuditLog(req.user!.id, goal.id, 'GOAL_UPDATED', oldValues, req.body);
    res.json(updated);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/goals/:id
router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const goal = await prisma.goal.findUnique({ where: { id: req.params.id } });
    if (!goal) return res.status(404).json({ error: 'Goal not found' });
    if (goal.userId !== req.user!.id) return res.status(403).json({ error: 'Forbidden' });
    if (goal.isLocked) return res.status(400).json({ error: 'Cannot delete locked goal' });

    await prisma.goal.delete({ where: { id: req.params.id } });
    res.json({ message: 'Goal deleted' });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/goals/:id/submit — submit goal sheet
router.post('/:id/submit', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const goals = await prisma.goal.findMany({ where: { userId } });
    const totalWeightage = goals.reduce((s, g) => s + g.weightage, 0);

    if (Math.abs(totalWeightage - 100) > 0.01) {
      return res.status(400).json({ error: `Total weightage must be exactly 100%. Currently: ${totalWeightage}%` });
    }

    const goal = await prisma.goal.update({
      where: { id: req.params.id },
      data: { status: 'submitted' },
    });

    // Notify manager — in-app
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user?.reportingManagerId) {
      await createNotification(
        user.reportingManagerId,
        'Goal Submitted for Review',
        `${req.user!.name} has submitted a goal for your approval: "${goal.goalTitle}"`,
        'warning'
      );
      // Email + Teams (fire-and-forget)
      const mgr = await prisma.user.findUnique({ where: { id: user.reportingManagerId }, select: { email: true, name: true } });
      if (mgr) {
        sendGoalSubmittedEmail(mgr.email, mgr.name, user.name, goal.goalTitle, goal.id).catch(() => {});
        teamsGoalSubmitted(user.reportingManagerId, user.name, goal.goalTitle, user.department).catch(() => {});
      }
    }

    await createAuditLog(userId, goal.id, 'GOAL_SUBMITTED');
    res.json(goal);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/goals/:id/submit-all — submit all draft goals
router.post('/submit-all', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const goals = await prisma.goal.findMany({ where: { userId } });
    const totalWeightage = goals.reduce((s, g) => s + g.weightage, 0);

    if (Math.abs(totalWeightage - 100) > 0.01) {
      return res.status(400).json({ error: `Total weightage must be exactly 100%. Currently: ${totalWeightage}%` });
    }

    if (goals.length === 0) {
      return res.status(400).json({ error: 'No goals to submit' });
    }

    await prisma.goal.updateMany({
      where: { userId, status: 'draft' },
      data: { status: 'submitted' },
    });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user?.reportingManagerId) {
      await createNotification(
        user.reportingManagerId,
        'Goal Sheet Submitted',
        `${req.user!.name} has submitted their complete goal sheet (${goals.length} goals) for your review.`,
        'warning'
      );
      const mgr = await prisma.user.findUnique({ where: { id: user.reportingManagerId }, select: { email: true, name: true } });
      if (mgr) {
        sendGoalSubmittedEmail(mgr.email, mgr.name, user.name, `Goal Sheet (${goals.length} goals)`, 'all').catch(() => {});
        teamsGoalSubmitted(user.reportingManagerId, user.name, `Full Goal Sheet — ${goals.length} goals`, user.department).catch(() => {});
      }
    }

    res.json({ message: 'All goals submitted successfully' });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/goals/:id/checkin — add quarterly check-in
router.post('/:id/checkin', authenticate, async (req: AuthRequest, res) => {
  try {
    const { quarter, actualAchievement, progressStatus } = req.body;
    const goal = await prisma.goal.findUnique({ where: { id: req.params.id } });
    if (!goal) return res.status(404).json({ error: 'Goal not found' });

    const progressScore = calcProgressScore(goal.uomType, goal.higherIsBetter, goal.target, parseFloat(actualAchievement));

    const checkin = await prisma.quarterlyCheckin.create({
      data: {
        goalId: req.params.id,
        userId: req.user!.id,
        quarter,
        actualAchievement: parseFloat(actualAchievement),
        progressStatus,
      },
    });

    // Update goal achievement + progress score
    await prisma.goal.update({
      where: { id: req.params.id },
      data: { achievement: parseFloat(actualAchievement), progressScore },
    });

    await createAuditLog(req.user!.id, goal.id, 'CHECKIN_ADDED', null, { quarter, actualAchievement, progressScore });
    res.json(checkin);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
