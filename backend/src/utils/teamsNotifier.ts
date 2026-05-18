/**
 * Simulated Microsoft Teams Adaptive Card Notification System
 *
 * In a real Teams bot integration, these payloads would be POSTed to
 * a Teams Incoming Webhook URL. Here they are stored as in-app
 * notifications with type='teams_card' containing the Adaptive Card JSON,
 * so the frontend can render them in a Teams-style card UI.
 */

import prisma from '../lib/prisma';

const APP = process.env.FRONTEND_URL || 'http://localhost:3000';

export interface TeamsCard {
  type: 'AdaptiveCard';
  version: string;
  body: any[];
  actions?: any[];
}

function buildCard(
  title: string,
  subtitle: string,
  facts: { label: string; value: string }[],
  actions: { label: string; url: string; style?: string }[]
): TeamsCard {
  return {
    type: 'AdaptiveCard',
    version: '1.4',
    body: [
      {
        type: 'Container',
        style: 'emphasis',
        items: [
          { type: 'TextBlock', text: '🎯 GoalSync Enterprise', size: 'Small', weight: 'Bolder', color: 'Accent' },
          { type: 'TextBlock', text: title, size: 'Large', weight: 'Bolder', wrap: true },
          { type: 'TextBlock', text: subtitle, size: 'Small', wrap: true, spacing: 'None', isSubtle: true },
        ],
      },
      {
        type: 'FactSet',
        facts: facts.map(f => ({ title: f.label, value: f.value })),
        spacing: 'Medium',
      },
    ],
    actions: actions.map(a => ({
      type: 'Action.OpenUrl',
      title: a.label,
      url: a.url,
      style: a.style ?? 'default',
    })),
  };
}

async function storeTeamsCard(userId: string, title: string, card: TeamsCard) {
  try {
    await prisma.notification.create({
      data: {
        userId,
        title,
        message: JSON.stringify({ _teamsCard: true, card }),
        type: 'teams_card',
        status: 'unread',
      },
    });
    // Simulate webhook post log
    console.log(`📨 [Teams] Card queued for user ${userId}: "${title}"`);
  } catch (err) {
    console.error('[Teams] Failed to store card:', err);
  }
}

// ── Teams card: Goal submitted → manager ────────────────────────────────────
export async function teamsGoalSubmitted(
  managerId: string,
  employeeName: string,
  goalTitle: string,
  department: string
) {
  const card = buildCard(
    `${employeeName} submitted a goal for review`,
    `New goal awaiting your approval — SLA: 5 business days`,
    [
      { label: 'Employee', value: employeeName },
      { label: 'Department', value: department },
      { label: 'Goal', value: goalTitle },
      { label: 'SLA Deadline', value: '5 business days from today' },
    ],
    [
      { label: '🔍 Review Now', url: `${APP}/manager/approvals`, style: 'positive' },
      { label: '✅ Open Team Goals', url: `${APP}/manager/team`, style: 'default' },
    ]
  );
  await storeTeamsCard(managerId, `📋 Goal Review: ${employeeName} — "${goalTitle}"`, card);
}

// ── Teams card: Goal approved → employee ────────────────────────────────────
export async function teamsGoalApproved(
  employeeId: string,
  managerName: string,
  goalTitle: string
) {
  const card = buildCard(
    `✅ Your goal has been approved`,
    `${managerName} approved your goal. It is now locked and active.`,
    [
      { label: 'Goal', value: goalTitle },
      { label: 'Approved by', value: managerName },
      { label: 'Status', value: '✅ Approved & Locked' },
      { label: 'Next Step', value: 'Complete quarterly check-ins' },
    ],
    [
      { label: '🎯 View My Goals', url: `${APP}/employee/goals`, style: 'positive' },
      { label: '📅 Add Check-in', url: `${APP}/employee/goals`, style: 'default' },
    ]
  );
  await storeTeamsCard(employeeId, `✅ Goal Approved: "${goalTitle}"`, card);
}

// ── Teams card: Goal rejected/rework → employee ──────────────────────────────
export async function teamsGoalRejected(
  employeeId: string,
  managerName: string,
  goalTitle: string,
  reason: string,
  isRework = false
) {
  const card = buildCard(
    isRework ? `🔄 Goal sent for rework` : `❌ Goal rejected`,
    `${managerName} has ${isRework ? 'requested changes to' : 'rejected'} your goal. Please review the feedback.`,
    [
      { label: 'Goal', value: goalTitle },
      { label: 'Reviewed by', value: managerName },
      { label: 'Action Required', value: isRework ? 'Update and resubmit' : 'Revise goal' },
      { label: 'Manager Comment', value: reason || 'See GoalSync for details' },
    ],
    [
      { label: isRework ? '🔄 Update Goal' : '📝 Edit Goal', url: `${APP}/employee/goals`, style: 'default' },
    ]
  );
  await storeTeamsCard(employeeId, `${isRework ? '🔄' : '❌'} Goal ${isRework ? 'Rework' : 'Rejected'}: "${goalTitle}"`, card);
}

// ── Teams card: Escalation alert → manager / admin ──────────────────────────
export async function teamsEscalationAlert(
  recipientId: string,
  employeeName: string,
  goalTitle: string,
  reason: string,
  daysOverdue: number,
  escalationLevel: number
) {
  const levelLabel = escalationLevel === 3 ? '🚨 Level 3 — HR Escalation' :
                     escalationLevel === 2 ? '🔔 Level 2 — Manager Alert' : '⚠️ Level 1 — Employee Reminder';
  const card = buildCard(
    `${employeeName} — Goal SLA Breach`,
    `${levelLabel}: ${reason}`,
    [
      { label: 'Employee', value: employeeName },
      { label: 'Goal', value: goalTitle },
      { label: 'Days Overdue', value: `${daysOverdue} days` },
      { label: 'Escalation Level', value: levelLabel },
    ],
    [
      { label: '🚨 Open Escalation Dashboard', url: `${APP}/admin/escalations`, style: 'destructive' },
      { label: '👤 View Employee Goals', url: `${APP}/admin`, style: 'default' },
    ]
  );
  await storeTeamsCard(recipientId, `🚨 SLA Escalation: ${employeeName} (${daysOverdue}d overdue)`, card);
}

// ── Teams card: Access request approved → new user ───────────────────────────
export async function teamsAccessApproved(
  userId: string,
  userName: string,
  role: string
) {
  const card = buildCard(
    `🎉 Welcome to GoalSync, ${userName}!`,
    `Your access request has been approved by HR Administration.`,
    [
      { label: 'Name', value: userName },
      { label: 'Role', value: role.toUpperCase() },
      { label: 'Platform', value: 'GoalSync Enterprise' },
      { label: 'Next Step', value: 'Login and change your password' },
    ],
    [
      { label: '🚀 Login Now', url: `${APP}/login`, style: 'positive' },
    ]
  );
  await storeTeamsCard(userId, `🎉 Access Approved — Welcome, ${userName}!`, card);
}
