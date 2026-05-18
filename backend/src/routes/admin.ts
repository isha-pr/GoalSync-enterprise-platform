import { Router } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { sendAccessApprovedEmail } from '../utils/mailer';
import { teamsAccessApproved } from '../utils/teamsNotifier';

const router = Router();


// Admin roles: 'admin' and 'hr' both get full access
const ADMIN_ROLES = ['admin', 'hr'];

async function createAuditLog(userId: string, goalId: string | null, actionType: string, oldValue?: any, newValue?: any) {
  await prisma.auditLog.create({
    data: {
      userId, goalId, actionType,
      oldValue: oldValue ? JSON.stringify(oldValue) : null,
      newValue: newValue ? JSON.stringify(newValue) : null,
    },
  });
}

// ─── OVERVIEW & STATS ────────────────────────────────────────────────────────

// GET /api/admin/overview
router.get('/overview', authenticate, requireRole(...ADMIN_ROLES), async (req: AuthRequest, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { role: 'employee' },
      include: {
        goals: {
          include: { quarterlyCheckins: true },
        },
      },
    });

    const overview = users.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      department: u.department,
      totalGoals: u.goals.length,
      submitted: u.goals.filter(g => g.status !== 'draft').length,
      approved: u.goals.filter(g => g.status === 'approved' || g.isLocked).length,
      locked: u.goals.filter(g => g.isLocked).length,
      checkinsCompleted: u.goals.flatMap(g => g.quarterlyCheckins).length,
      avgProgress: u.goals.length
        ? Math.round(u.goals.reduce((s, g) => s + g.progressScore, 0) / u.goals.length)
        : 0,
    }));

    res.json(overview);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/admin/stats
router.get('/stats', authenticate, requireRole(...ADMIN_ROLES), async (req: AuthRequest, res) => {
  try {
    const [totalUsers, totalGoals, lockedGoals, submittedGoals, checkins, managers] = await Promise.all([
      prisma.user.count({ where: { role: 'employee' } }),
      prisma.goal.count(),
      prisma.goal.count({ where: { isLocked: true } }),
      prisma.goal.count({ where: { status: { in: ['submitted', 'approved'] } } }),
      prisma.quarterlyCheckin.count(),
      prisma.user.count({ where: { role: 'manager' } }),
    ]);

    const employees = await prisma.user.findMany({
      where: { role: 'employee' },
      include: { goals: true },
    });

    const deptMap: Record<string, { total: number; progress: number }> = {};
    employees.forEach(emp => {
      if (!deptMap[emp.department]) deptMap[emp.department] = { total: 0, progress: 0 };
      deptMap[emp.department].total += emp.goals.length;
      deptMap[emp.department].progress += emp.goals.reduce((s, g) => s + g.progressScore, 0);
    });

    const departmentStats = Object.entries(deptMap).map(([dept, data]) => ({
      department: dept,
      goalCount: data.total,
      avgProgress: data.total ? Math.round(data.progress / data.total) : 0,
    }));

    res.json({
      totalUsers, totalGoals, lockedGoals, submittedGoals, checkins, managers,
      goalSubmissionRate: totalUsers ? Math.round((submittedGoals / (totalGoals || 1)) * 100) : 0,
      departmentStats,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/admin/all-goals
router.get('/all-goals', authenticate, requireRole(...ADMIN_ROLES), async (req: AuthRequest, res) => {
  try {
    const goals = await prisma.goal.findMany({
      include: {
        user: { select: { name: true, email: true, department: true } },
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

// POST /api/admin/goals/:id/unlock
router.post('/goals/:id/unlock', authenticate, requireRole(...ADMIN_ROLES), async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string;
    const goal = await prisma.goal.findUnique({ where: { id } });
    if (!goal) return res.status(404).json({ error: 'Goal not found' });

    const updated = await prisma.goal.update({
      where: { id },
      data: { isLocked: false, status: 'approved' },
    });

    await createAuditLog(req.user!.id, goal.id, 'GOAL_UNLOCKED', { isLocked: true }, { isLocked: false });

    await prisma.notification.create({
      data: {
        userId: goal.userId,
        title: 'Goal Unlocked 🔓',
        message: `Admin has unlocked your goal "${goal.goalTitle}" for editing.`,
        type: 'info',
      },
    });

    res.json(updated);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/admin/audit
router.get('/audit', authenticate, requireRole(...ADMIN_ROLES), async (req: AuthRequest, res) => {
  try {
    const logs = await prisma.auditLog.findMany({
      include: {
        user: { select: { name: true, email: true, role: true } },
        goal: { select: { goalTitle: true } },
      },
      orderBy: { changedAt: 'desc' },
      take: 200,
    });
    res.json(logs);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── USER MANAGEMENT ─────────────────────────────────────────────────────────

// GET /api/admin/users — Full user list
router.get('/users', authenticate, requireRole(...ADMIN_ROLES), async (req: AuthRequest, res) => {
  try {
    const users = await (prisma.user.findMany as any)({
      select: {
        id: true, name: true, email: true, role: true,
        department: true, createdAt: true, isActive: true,
        reportingManagerId: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    // Normalize isActive (may not exist in schema)
    const normalized = users.map((u: any) => ({
      ...u,
      isActive: u.isActive !== false,
    }));
    res.json(normalized);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/admin/users/:id/role — Change user role
router.patch('/users/:id/role', authenticate, requireRole(...ADMIN_ROLES), async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string;
    const { role } = req.body;
    const validRoles = ['employee', 'manager', 'hr', 'admin'];
    if (!validRoles.includes(role))
      return res.status(400).json({ error: 'Invalid role. Valid roles: employee, manager, hr, admin' });

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Prevent downgrading own account
    if (req.user!.id === id && !['admin', 'hr'].includes(role)) {
      return res.status(400).json({ error: 'Cannot change your own admin/HR role to a lower role' });
    }

    const updated = await prisma.user.update({ where: { id }, data: { role } });
    await createAuditLog(req.user!.id, null, 'ROLE_CHANGED',
      { role: user.role }, { role, userId: id, name: user.name });

    // Notify user of role change
    await prisma.notification.create({
      data: {
        userId: id,
        title: '🔄 Role Updated',
        message: `Your account role has been updated to ${role} by the administrator.`,
        type: 'info',
        status: 'unread',
      },
    });

    res.json({ message: 'Role updated', user: updated });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/admin/users/:id/toggle-active — Activate / Deactivate account
router.patch('/users/:id/toggle-active', authenticate, requireRole(...ADMIN_ROLES), async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string;
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (req.user!.id === id) {
      return res.status(400).json({ error: 'Cannot deactivate your own account' });
    }

    const currentActive = (user as any).isActive !== false;
    const updated = await (prisma.user.update as any)({
      where: { id },
      data: { isActive: !currentActive },
    });

    await createAuditLog(req.user!.id, null,
      !currentActive ? 'ACCOUNT_ACTIVATED' : 'ACCOUNT_DEACTIVATED',
      { isActive: currentActive }, { isActive: !currentActive, userId: id });

    // Notify user
    await prisma.notification.create({
      data: {
        userId: id,
        title: !currentActive ? '✅ Account Activated' : '⛔ Account Deactivated',
        message: !currentActive
          ? 'Your GoalSync account has been activated by the administrator.'
          : 'Your GoalSync account has been deactivated. Contact HR if this is a mistake.',
        type: !currentActive ? 'success' : 'warning',
        status: 'unread',
      },
    });

    res.json({ message: !currentActive ? 'Account activated' : 'Account deactivated', isActive: !currentActive });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── ACCESS REQUESTS ─────────────────────────────────────────────────────────

// GET /api/admin/access-requests — All access requests with enriched status
router.get('/access-requests', authenticate, requireRole(...ADMIN_ROLES), async (req: AuthRequest, res) => {
  try {
    const requests = await prisma.notification.findMany({
      where: { type: 'access_request' },
      orderBy: { createdAt: 'desc' },
    });

    const parsed = await Promise.all(requests.map(async r => {
      let data: any = {};
      try { data = JSON.parse(r.message); } catch {}

      // Determine real status from embedded decision or unread/read state
      let status: 'pending' | 'approved' | 'rejected' = 'pending';
      if (r.status === 'unread') {
        status = 'pending';
      } else if (data._decision === 'rejected') {
        status = 'rejected';
      } else if (data._decision === 'approved') {
        status = 'approved';
      } else {
        // Legacy: check if user was actually created
        const userExists = await prisma.user.findUnique({ where: { email: data.email } });
        status = userExists ? 'approved' : 'rejected';
      }

      return {
        id: r.id,
        status,
        submittedAt: r.createdAt,
        rejectionReason: data._rejectionReason || null,
        approvedRole: data._approvedRole || null,
        reviewedAt: data._reviewedAt || null,
        reviewedBy: data._reviewedBy || null,
        fullName: data.fullName,
        email: data.email,
        employeeId: data.employeeId,
        department: data.department,
        requestedRole: data.requestedRole || 'employee',
        managerName: data.managerName,
        reason: data.reason,
      };
    }));

    res.json(parsed);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/admin/access-requests/:id/approve — Approve and create user account
router.post('/access-requests/:id/approve', authenticate, requireRole(...ADMIN_ROLES), async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string;
    const notif = await prisma.notification.findUnique({ where: { id } });
    if (!notif) return res.status(404).json({ error: 'Request not found' });

    let data: any = {};
    try { data = JSON.parse(notif.message); } catch {
      return res.status(400).json({ error: 'Invalid request data' });
    }

    // Check if already processed
    if (data._decision) {
      return res.status(409).json({ error: `Request already ${data._decision}` });
    }

    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      await prisma.notification.update({ where: { id }, data: { status: 'read' } });
      return res.json({ message: 'Account already exists', tempPassword: null });
    }

    const assignedRole = req.body.overrideRole || data.requestedRole || 'employee';
    const tempPassword = 'Welcome@123';
    const hashed = await bcrypt.hash(tempPassword, 10);

    // Find manager if specified
    let reportingManagerId: string | undefined;
    if (data.managerName) {
      const mgr = await prisma.user.findFirst({
        where: { name: { contains: data.managerName }, role: 'manager' },
      });
      if (mgr) reportingManagerId = mgr.id;
    }

    const newUser = await prisma.user.create({
      data: {
        name: data.fullName,
        email: data.email,
        password: hashed,
        role: assignedRole,
        department: data.department || 'General',
        reportingManagerId,
      },
    });

    // Embed decision in notification JSON
    const updatedData = {
      ...data,
      _decision: 'approved',
      _approvedRole: assignedRole,
      _reviewedAt: new Date().toISOString(),
      _reviewedBy: req.user!.name,
    };
    await prisma.notification.update({
      where: { id },
      data: { status: 'read', message: JSON.stringify(updatedData) },
    });

    // Welcome notification
    await prisma.notification.create({
      data: {
        userId: newUser.id,
        title: '🎉 Access Approved — Welcome to GoalSync',
        message: `Your access request has been approved. Your temporary password is: ${tempPassword}. Please change it after first login.`,
        type: 'success',
        status: 'unread',
      },
    });

    await createAuditLog(req.user!.id, null, 'ACCESS_REQUEST_APPROVED', null,
      { email: data.email, role: assignedRole, reviewedBy: req.user!.name });

    // Email + Teams (fire-and-forget)
    sendAccessApprovedEmail(newUser.email, newUser.name, tempPassword, assignedRole).catch(() => {});
    teamsAccessApproved(newUser.id, newUser.name, assignedRole).catch(() => {});

    res.json({ message: 'Account created successfully', userId: newUser.id, tempPassword });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/admin/access-requests/:id/reject — Reject access request with reason
router.post('/access-requests/:id/reject', authenticate, requireRole(...ADMIN_ROLES), async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string;
    const { reason } = req.body;
    const notif = await prisma.notification.findUnique({ where: { id } });
    if (!notif) return res.status(404).json({ error: 'Request not found' });

    let data: any = {};
    try { data = JSON.parse(notif.message); } catch {}

    if (data._decision) {
      return res.status(409).json({ error: `Request already ${data._decision}` });
    }

    // Embed decision and rejection reason in notification JSON
    const updatedData = {
      ...data,
      _decision: 'rejected',
      _rejectionReason: reason || 'No reason provided',
      _reviewedAt: new Date().toISOString(),
      _reviewedBy: req.user!.name,
    };

    await prisma.notification.update({
      where: { id },
      data: { status: 'read', message: JSON.stringify(updatedData) },
    });

    await createAuditLog(req.user!.id, null, 'ACCESS_REQUEST_REJECTED', null,
      { notifId: id, reason, reviewedBy: req.user!.name });

    res.json({ message: 'Request rejected' });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── PRIVILEGED ACCOUNT CREATION ─────────────────────────────────────────────

// POST /api/admin/create-privileged-account — Create Admin/HR account via admin panel
router.post('/create-privileged-account', authenticate, requireRole(...ADMIN_ROLES), async (req: AuthRequest, res) => {
  const { adminSecretKey, name, email, password, department, role } = req.body;

  const validKey = process.env.ADMIN_SECRET_KEY || 'GOALSYNC-ADMIN-2024-ENTERPRISE';
  if (!adminSecretKey || adminSecretKey !== validKey) {
    return res.status(403).json({
      error: 'invalid_admin_key',
      message: 'Invalid Admin Secret Key. Unauthorized privileged account creation blocked.',
    });
  }

  const validRoles = ['admin', 'hr', 'manager'];
  if (!role || !validRoles.includes(role)) {
    return res.status(400).json({ error: 'Role must be admin, hr, or manager for privileged creation' });
  }

  if (!name || !email || !password || !department) {
    return res.status(400).json({ error: 'All fields required: name, email, password, department, role' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'account_exists', message: 'An account with this email already exists.' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const newUser = await prisma.user.create({
      data: { name, email, password: hashed, role, department },
    });

    await createAuditLog(req.user!.id, null, 'PRIVILEGED_ACCOUNT_CREATED', null,
      { email, role, name, createdBy: req.user!.name });

    res.status(201).json({
      message: `${role.toUpperCase()} account created successfully.`,
      user: { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role, department: newUser.department },
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
