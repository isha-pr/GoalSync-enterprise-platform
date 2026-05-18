import prisma from '../lib/prisma';
import { sendEscalationAlertEmail } from './mailer';
import { teamsEscalationAlert } from './teamsNotifier';



const DAYS_MS = 24 * 60 * 60 * 1000;

// ── Fixed SLA Rules ───────────────────────────────────────────
const SUBMIT_SLA_DAYS   = 7;   // employee must submit draft within 7 days
const APPROVAL_SLA_DAYS = 5;   // manager must approve within 5 days of submission
const CHECKIN_QUARTER   = 'Q1';
const CHECKIN_DUE_DATE  = new Date('2025-03-31');

// Escalation level thresholds (days beyond initial SLA)
const LEVEL_2_EXTRA = 3;  // +3 days → escalate to manager (day 10 for submit, day 8 for approval)
const LEVEL_3_EXTRA = 7;  // +7 days → escalate to HR/Admin (day 14 for submit, day 12 for approval)

// ── Helpers ──────────────────────────────────────────────────
async function createNotification(userId: string, title: string, message: string, type: string) {
  try {
    await prisma.notification.create({ data: { userId, title, message, type, status: 'unread' } });
  } catch {}
}

async function notifyAdminsAndHR(title: string, message: string) {
  const privileged = await prisma.user.findMany({ where: { role: { in: ['admin'] } } });
  for (const u of privileged) {
    await createNotification(u.id, title, message, 'error');
  }
}

function calcLevel(daysOverdue: number): number {
  if (daysOverdue >= LEVEL_3_EXTRA) return 3;
  if (daysOverdue >= LEVEL_2_EXTRA) return 2;
  return 1;
}

// ── Overdue Submissions ──────────────────────────────────────
async function checkOverdueSubmissions(now: Date) {
  const drafts = await prisma.goal.findMany({
    where: { status: 'draft' },
    include: { user: true },
  });

  for (const goal of drafts) {
    const ageDays    = Math.floor((now.getTime() - new Date(goal.createdAt).getTime()) / DAYS_MS);
    if (ageDays <= SUBMIT_SLA_DAYS) continue;

    const daysOverdue = ageDays - SUBMIT_SLA_DAYS;
    const newLevel    = calcLevel(daysOverdue);

    const existing = await prisma.escalation.findFirst({
      where: { goalId: goal.id, type: 'OVERDUE_SUBMISSION', status: { not: 'resolved' } },
    });

    if (!existing) {
      await prisma.escalation.create({
        data: {
          type: 'OVERDUE_SUBMISSION', severity: 'high',
          userId: goal.userId, goalId: goal.id,
          department: goal.user.department,
          reason: `"${goal.goalTitle}" has been in draft for ${ageDays} days (SLA: ${SUBMIT_SLA_DAYS} days)`,
          daysOverdue, escalationLevel: newLevel, status: 'open',
        },
      });

      // Level 1 — notify employee
      await createNotification(goal.userId, '⚠️ Goal Submission Overdue',
        `Your goal "${goal.goalTitle}" is ${daysOverdue} days overdue. Please submit immediately.`, 'warning');

      // Level 2 — notify manager
      if (newLevel >= 2 && goal.user.reportingManagerId) {
        await createNotification(goal.user.reportingManagerId, '🔔 Team Member Goal Overdue',
          `${goal.user.name}'s goal "${goal.goalTitle}" is ${daysOverdue} days overdue. Follow up required.`, 'error');
        const mgr = await prisma.user.findUnique({ where: { id: goal.user.reportingManagerId }, select: { email: true, name: true } });
        if (mgr) {
          sendEscalationAlertEmail(mgr.email, mgr.name, goal.user.name, goal.user.department, `Goal "${goal.goalTitle}" unsubmitted`, newLevel, daysOverdue).catch(() => {});
          teamsEscalationAlert(goal.user.reportingManagerId, goal.user.name, goal.goalTitle, `Goal unsubmitted (${daysOverdue}d overdue)`, daysOverdue, newLevel).catch(() => {});
        }
      }

      // Level 3 — notify HR/Admin
      if (newLevel >= 3) {
        await notifyAdminsAndHR('🚨 HR Escalation: Unsubmitted Goal',
          `${goal.user.name} (${goal.user.department}) has not submitted "${goal.goalTitle}" — ${daysOverdue} days overdue.`);
        const admins = await prisma.user.findMany({ where: { role: 'admin' }, select: { id: true, email: true, name: true } });
        for (const admin of admins) {
          sendEscalationAlertEmail(admin.email, admin.name, goal.user.name, goal.user.department, `Goal "${goal.goalTitle}" unsubmitted`, newLevel, daysOverdue).catch(() => {});
          teamsEscalationAlert(admin.id, goal.user.name, goal.goalTitle, `CRITICAL: unsubmitted ${daysOverdue}d overdue`, daysOverdue, newLevel).catch(() => {});
        }
      }

    } else if (existing.escalationLevel < newLevel) {
      await prisma.escalation.update({ where: { id: existing.id }, data: { daysOverdue, escalationLevel: newLevel } });

      if (newLevel === 2 && goal.user.reportingManagerId) {
        await createNotification(goal.user.reportingManagerId, '🔔 Escalation Level 2: Goal Still Overdue',
          `${goal.user.name}'s goal "${goal.goalTitle}" remains unsubmitted (${daysOverdue} days overdue).`, 'error');
      }
      if (newLevel === 3) {
        await notifyAdminsAndHR('🚨 Critical Escalation Level 3',
          `${goal.user.name} — "${goal.goalTitle}" unsubmitted for ${daysOverdue} days. Immediate HR action required.`);
      }
    } else {
      await prisma.escalation.update({ where: { id: existing.id }, data: { daysOverdue } });
    }
  }
}

// ── Overdue Approvals ────────────────────────────────────────
async function checkOverdueApprovals(now: Date) {
  const submitted = await prisma.goal.findMany({
    where: { status: 'submitted' },
    include: { user: true },
  });

  for (const goal of submitted) {
    const ageDays    = Math.floor((now.getTime() - new Date(goal.updatedAt).getTime()) / DAYS_MS);
    if (ageDays <= APPROVAL_SLA_DAYS) continue;

    const daysOverdue = ageDays - APPROVAL_SLA_DAYS;
    const newLevel    = calcLevel(daysOverdue);

    const existing = await prisma.escalation.findFirst({
      where: { goalId: goal.id, type: 'OVERDUE_APPROVAL', status: { not: 'resolved' } },
    });

    if (!existing) {
      await prisma.escalation.create({
        data: {
          type: 'OVERDUE_APPROVAL', severity: 'medium',
          userId: goal.userId, goalId: goal.id,
          department: goal.user.department,
          reason: `"${goal.goalTitle}" awaiting approval for ${ageDays} days (SLA: ${APPROVAL_SLA_DAYS} days)`,
          daysOverdue, escalationLevel: newLevel, status: 'open',
        },
      });

      if (goal.user.reportingManagerId) {
        await createNotification(goal.user.reportingManagerId, '⏳ Approval SLA Breached',
          `${goal.user.name}'s goal "${goal.goalTitle}" has been pending approval for ${ageDays} days.`, 'warning');
      }
      if (newLevel >= 3) {
        await notifyAdminsAndHR('🚨 Manager Approval Overdue',
          `${goal.user.name}'s goal has been pending approval for ${ageDays} days without action.`);
      }

    } else if (existing.escalationLevel < newLevel) {
      await prisma.escalation.update({ where: { id: existing.id }, data: { daysOverdue, escalationLevel: newLevel } });
      if (newLevel >= 3) {
        await notifyAdminsAndHR('🚨 Approval Escalation Level 3',
          `"${goal.goalTitle}" still pending manager review after ${ageDays} days.`);
      }
    } else {
      await prisma.escalation.update({ where: { id: existing.id }, data: { daysOverdue } });
    }
  }
}

// ── Missing Check-ins ────────────────────────────────────────
async function checkMissingCheckins(now: Date) {
  if (now < CHECKIN_DUE_DATE) return; // not due yet

  const approvedGoals = await prisma.goal.findMany({
    where: { status: 'approved' },
    include: { user: true, quarterlyCheckins: true },
  });

  for (const goal of approvedGoals) {
    if (goal.quarterlyCheckins.some(c => c.quarter === CHECKIN_QUARTER)) continue;

    const daysOverdue = Math.max(0, Math.floor((now.getTime() - CHECKIN_DUE_DATE.getTime()) / DAYS_MS));

    const existing = await prisma.escalation.findFirst({
      where: { goalId: goal.id, type: 'MISSING_CHECKIN', status: { not: 'resolved' } },
    });

    if (!existing) {
      await prisma.escalation.create({
        data: {
          type: 'MISSING_CHECKIN', severity: 'low',
          userId: goal.userId, goalId: goal.id,
          department: goal.user.department,
          reason: `${CHECKIN_QUARTER} check-in not completed for "${goal.goalTitle}" (due ${CHECKIN_DUE_DATE.toDateString()})`,
          daysOverdue, escalationLevel: daysOverdue >= 7 ? 2 : 1, status: 'open',
        },
      });
      await createNotification(goal.userId, `📅 ${CHECKIN_QUARTER} Check-in Overdue`,
        `Please complete your ${CHECKIN_QUARTER} check-in for "${goal.goalTitle}". It is ${daysOverdue} days overdue.`, 'warning');
    } else {
      await prisma.escalation.update({ where: { id: existing.id }, data: { daysOverdue } });
    }
  }
}

// ── Public entry point ───────────────────────────────────────
export async function runEscalationCheck(): Promise<{ checked: number; timestamp: string }> {
  const now = new Date();
  console.log(`⚡ [EscalationEngine] Running at ${now.toISOString()}`);
  let checked = 0;
  try {
    await checkOverdueSubmissions(now); checked++;
    await checkOverdueApprovals(now);   checked++;
    await checkMissingCheckins(now);    checked++;
    console.log(`✅ [EscalationEngine] Done — ${checked} checks completed`);
  } catch (err) {
    console.error('❌ [EscalationEngine] Error:', err);
  }
  return { checked, timestamp: now.toISOString() };
}
