import { Router } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { sendGoalApprovedEmail, sendGoalRejectedEmail } from '../utils/mailer';
import { teamsGoalApproved, teamsGoalRejected } from '../utils/teamsNotifier';

const router = Router();


async function createNotification(userId: string, title: string, message: string, type = 'info') {
  await prisma.notification.create({ data: { userId, title, message, type } });
}

async function createAuditLog(userId: string, goalId: string | null, actionType: string, oldValue?: any, newValue?: any) {
  await prisma.auditLog.create({
    data: {
      userId, goalId, actionType,
      oldValue: oldValue ? JSON.stringify(oldValue) : null,
      newValue: newValue ? JSON.stringify(newValue) : null,
    },
  });
}

// GET /api/manager/team — get all team members and their goals
router.get('/team', authenticate, requireRole('manager', 'admin'), async (req: AuthRequest, res) => {
  try {
    const managerId = req.user!.id;
    const teamMembers = await prisma.user.findMany({
      where: { reportingManagerId: managerId },
      select: {
        id: true, name: true, email: true, department: true,
        goals: {
          include: {
            goalApprovals: { include: { manager: { select: { name: true } } } },
            quarterlyCheckins: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    res.json(teamMembers);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/manager/stats
router.get('/stats', authenticate, requireRole('manager', 'admin'), async (req: AuthRequest, res) => {
  try {
    const managerId = req.user!.id;
    const teamMembers = await prisma.user.findMany({
      where: { reportingManagerId: managerId },
      include: { goals: true },
    });

    const allGoals = teamMembers.flatMap(m => m.goals);
    res.json({
      teamSize: teamMembers.length,
      totalGoals: allGoals.length,
      pendingReview: allGoals.filter(g => g.status === 'submitted').length,
      approved: allGoals.filter(g => g.status === 'approved' || g.isLocked).length,
      avgProgress: allGoals.length ? Math.round(allGoals.reduce((s, g) => s + g.progressScore, 0) / allGoals.length) : 0,
    });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/manager/goals/:id/approve
router.post('/goals/:id/approve', authenticate, requireRole('manager', 'admin'), async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string;
    const { approvalComments, updatedWeightage, updatedTarget } = req.body;
    const goal = await prisma.goal.findUnique({ where: { id } });
    if (!goal) return res.status(404).json({ error: 'Goal not found' });

    const updateData: any = { status: 'approved', isLocked: true };
    if (updatedWeightage) updateData.weightage = parseFloat(updatedWeightage);
    if (updatedTarget) updateData.target = parseFloat(updatedTarget);

    const updated = await prisma.goal.update({ where: { id }, data: updateData });

    await prisma.goalApproval.create({
      data: {
        goalId: goal.id,
        managerId: req.user!.id,
        approvalStatus: 'approved',
        approvalComments,
        updatedWeightage: updatedWeightage ? parseFloat(updatedWeightage) : null,
        updatedTarget: updatedTarget ? parseFloat(updatedTarget) : null,
      },
    });

    await createNotification(goal.userId, 'Goal Approved ✅', `Your goal "${goal.goalTitle}" has been approved and locked.`, 'success');
    await createAuditLog(req.user!.id, goal.id, 'GOAL_APPROVED', { status: 'submitted' }, { status: 'approved', isLocked: true });

    // Email + Teams (fire-and-forget)
    const employee = await prisma.user.findUnique({ where: { id: goal.userId }, select: { email: true, name: true } });
    if (employee) {
      sendGoalApprovedEmail(employee.email, employee.name, req.user!.name, goal.goalTitle).catch(() => {});
      teamsGoalApproved(goal.userId, req.user!.name, goal.goalTitle).catch(() => {});
    }

    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/manager/goals/:id/reject
router.post('/goals/:id/reject', authenticate, requireRole('manager', 'admin'), async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string;
    const { approvalComments } = req.body;
    const goal = await prisma.goal.findUnique({ where: { id } });
    if (!goal) return res.status(404).json({ error: 'Goal not found' });

    const updated = await prisma.goal.update({ where: { id }, data: { status: 'rejected' } });

    await prisma.goalApproval.create({
      data: { goalId: goal.id, managerId: req.user!.id, approvalStatus: 'rejected', approvalComments },
    });

    await createNotification(goal.userId, 'Goal Rejected ❌', `Your goal "${goal.goalTitle}" has been rejected. Reason: ${approvalComments}`, 'error');
    await createAuditLog(req.user!.id, goal.id, 'GOAL_REJECTED', { status: 'submitted' }, { status: 'rejected', reason: approvalComments });

    // Email + Teams (fire-and-forget)
    const employee = await prisma.user.findUnique({ where: { id: goal.userId }, select: { email: true, name: true } });
    if (employee) {
      sendGoalRejectedEmail(employee.email, employee.name, req.user!.name, goal.goalTitle, approvalComments, false).catch(() => {});
      teamsGoalRejected(goal.userId, req.user!.name, goal.goalTitle, approvalComments, false).catch(() => {});
    }

    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/manager/goals/:id/rework
router.post('/goals/:id/rework', authenticate, requireRole('manager', 'admin'), async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string;
    const { approvalComments } = req.body;
    const goal = await prisma.goal.findUnique({ where: { id } });
    if (!goal) return res.status(404).json({ error: 'Goal not found' });

    const updated = await prisma.goal.update({ where: { id }, data: { status: 'rework' } });

    await prisma.goalApproval.create({
      data: { goalId: goal.id, managerId: req.user!.id, approvalStatus: 'rework', approvalComments },
    });

    await createNotification(goal.userId, 'Goal Needs Rework 🔄', `Your goal "${goal.goalTitle}" needs rework. Comment: ${approvalComments}`, 'warning');
    await createAuditLog(req.user!.id, goal.id, 'GOAL_REWORK_REQUIRED', null, { comment: approvalComments });

    // Email + Teams (fire-and-forget)
    const employee = await prisma.user.findUnique({ where: { id: goal.userId }, select: { email: true, name: true } });
    if (employee) {
      sendGoalRejectedEmail(employee.email, employee.name, req.user!.name, goal.goalTitle, approvalComments, true).catch(() => {});
      teamsGoalRejected(goal.userId, req.user!.name, goal.goalTitle, approvalComments, true).catch(() => {});
    }

    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/manager/goals/:id/checkin — manager adds quarterly check-in comment
router.post('/goals/:id/checkin', authenticate, requireRole('manager', 'admin'), async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string;
    const { quarter, managerComment, actualAchievement, progressStatus } = req.body;
    const checkin = await prisma.quarterlyCheckin.create({
      data: {
        goalId: id,
        userId: req.user!.id,
        quarter,
        actualAchievement: parseFloat(actualAchievement),
        progressStatus,
        managerComment,
      },
    });
    res.json(checkin);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/manager/shared-goal — assign shared KPI to multiple employees
router.post('/shared-goal', authenticate, requireRole('manager', 'admin'), async (req: AuthRequest, res) => {
  try {
    const { goalTitle, goalDescription, thrustArea, target, linkedEmployeeIds } = req.body;

    const sharedGoalRecord = await prisma.sharedGoal.create({
      data: {
        primaryOwnerId: req.user!.id,
        linkedEmployeeIds: JSON.stringify(linkedEmployeeIds),
        goalId: 'shared_' + Date.now(),
      },
    });

    // Create goal for each employee
    for (const empId of linkedEmployeeIds) {
      const goal = await prisma.goal.create({
        data: {
          userId: empId,
          thrustArea,
          goalTitle,
          goalDescription,
          uomType: 'percentage',
          target: parseFloat(target),
          weightage: 10,
          status: 'draft',
          isSharedGoal: true,
          sharedGoalId: sharedGoalRecord.id,
        },
      });
      await createNotification(empId, 'Shared Goal Assigned', `Manager has assigned a shared KPI: "${goalTitle}"`, 'info');
    }

    res.json({ message: 'Shared goal assigned successfully', sharedGoalId: sharedGoalRecord.id });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
