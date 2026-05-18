import nodemailer from 'nodemailer';

const APP = process.env.FRONTEND_URL || 'http://localhost:3000';
const FROM = process.env.SMTP_FROM || 'GoalSync Enterprise <noreply@goalsync.com>';
const isConfigured = !!(
  process.env.SMTP_USER &&
  process.env.SMTP_PASS &&
  process.env.SMTP_PASS !== 'your_gmail_app_password_here'
);

let transporter: nodemailer.Transporter | null = null;

async function getTransporter(): Promise<nodemailer.Transporter> {
  if (transporter) return transporter;
  if (isConfigured) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      family: 4, // Force IPv4 — Render cannot reach SMTP via IPv6 (ENETUNREACH)
    } as any);
    console.log('📧 Mail: Using Gmail SMTP');
  } else {
    try {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email', port: 587, secure: false,
        auth: { user: testAccount.user, pass: testAccount.pass },
        family: 4, // Force IPv4 — Render cannot reach SMTP via IPv6 (ENETUNREACH)
      } as any);
      console.log('📧 Mail: Using Ethereal (preview at ethereal.email)');
      console.log(`📧 Test creds: ${testAccount.user} / ${testAccount.pass}`);
    } catch {
      // Ethereal unreachable — fall back to console-only transport
      console.warn('📧 Mail: Ethereal unavailable — using console fallback (OTP will be logged)');
      transporter = nodemailer.createTransport({ jsonTransport: true });
    }
  }
  return transporter!;
}

// ── Shared layout helpers ────────────────────────────────────────────────────
function emailShell(title: string, body: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background:#f5f0eb;}</style>
</head><body>
<div style="max-width:580px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
  <div style="background:linear-gradient(135deg,#291C0E,#6E473B);padding:32px 40px;text-align:center;">
    <div style="font-size:28px;margin-bottom:8px;">🎯</div>
    <h1 style="margin:0;color:#fff;font-size:20px;font-weight:800;">GoalSync Enterprise</h1>
    <p style="margin:4px 0 0;color:rgba(255,255,255,0.65);font-size:12px;">Performance Management Platform</p>
  </div>
  <div style="padding:32px 40px;">${body}</div>
  <div style="background:#FAF7F4;padding:18px 40px;text-align:center;border-top:1px solid #E8DDD2;">
    <p style="margin:0;font-size:11px;color:#C4B0A0;">© 2025 GoalSync Enterprise · Automated Notification · Do not reply</p>
    <p style="margin:4px 0 0;font-size:11px;color:#C4B0A0;">Secure Role-Based Access · Enterprise HR Suite</p>
  </div>
</div>
</body></html>`;
}

function ctaButton(label: string, url: string, color = '#291C0E'): string {
  return `<div style="text-align:center;margin:24px 0;">
    <a href="${url}" style="display:inline-block;background:${color};color:#fff;font-weight:700;font-size:14px;padding:13px 32px;border-radius:10px;text-decoration:none;letter-spacing:0.02em;">${label}</a>
  </div>`;
}

function infoBox(content: string, bg = '#FDF9F5', border = '#DBC9A8'): string {
  return `<div style="background:${bg};border:1px solid ${border};border-radius:10px;padding:16px 20px;margin:16px 0;">${content}</div>`;
}

async function send(to: string, subject: string, html: string): Promise<string | null> {
  try {
    const t = await getTransporter();
    const info = await t.sendMail({ from: FROM, to, subject, html });
    const preview = nodemailer.getTestMessageUrl(info);
    if (preview) {
      console.log(`📧 Preview: ${preview}`);
      return preview as string;
    }
    return null;
  } catch (err) {
    console.error('📧 Mail send error:', err);
    return null;
  }
}

// ── 1. Password Reset ────────────────────────────────────────────────────────
export async function sendPasswordResetEmail(to: string, name: string, otp: string): Promise<string | null> {
  const body = `
    <p style="margin:0 0 8px;font-size:16px;color:#2d1a0a;font-weight:700;">Hello, ${name} 👋</p>
    <p style="margin:0 0 20px;color:#7a5c3a;font-size:14px;line-height:1.6;">We received a password reset request for your GoalSync account.</p>
    ${infoBox(`
      <p style="margin:0 0 10px;font-size:11px;font-weight:700;color:#8b5e3c;text-transform:uppercase;letter-spacing:0.1em;">Your OTP</p>
      <div style="font-size:40px;font-weight:900;color:#291C0E;letter-spacing:10px;font-family:'Courier New',monospace;text-align:center;">${otp}</div>
      <p style="margin:12px 0 0;font-size:12px;color:#B8956A;text-align:center;">⏰ Valid for <strong>15 minutes</strong> only</p>
    `)}
    <div style="background:#FEF3C7;border-left:4px solid #F59E0B;border-radius:6px;padding:12px 16px;margin:16px 0;">
      <p style="margin:0;font-size:12px;color:#92400E;"><strong>🔒 Security Notice:</strong> Never share this OTP. GoalSync will never ask for it.</p>
    </div>`;
  return send(to, `🔐 GoalSync Password Reset OTP — ${otp}`, emailShell('Password Reset', body));
}

// ── 2. Goal Submitted → notify manager ──────────────────────────────────────
export async function sendGoalSubmittedEmail(
  managerEmail: string, managerName: string,
  employeeName: string, goalTitle: string, goalId: string
): Promise<string | null> {
  const reviewUrl = `${APP}/manager/approvals`;
  const body = `
    <p style="margin:0 0 6px;font-size:16px;color:#2d1a0a;font-weight:700;">Hello, ${managerName} 👋</p>
    <p style="margin:0 0 20px;color:#7a5c3a;font-size:14px;line-height:1.6;">
      <strong>${employeeName}</strong> has submitted a goal for your review and approval.
    </p>
    ${infoBox(`
      <p style="margin:0 0 4px;font-size:11px;color:#8b5e3c;font-weight:700;text-transform:uppercase;">Goal Submitted</p>
      <p style="margin:0;font-size:15px;color:#291C0E;font-weight:700;">${goalTitle}</p>
      <p style="margin:6px 0 0;font-size:12px;color:#A78D78;">Submitted by: ${employeeName}</p>
    `)}
    <p style="color:#7a5c3a;font-size:13px;line-height:1.6;">
      Please review and approve or send back for rework within <strong>5 business days</strong> per SLA policy.
    </p>
    ${ctaButton('🔍 Review Goal Now →', reviewUrl, '#291C0E')}
    <p style="font-size:11px;color:#A78D78;text-align:center;">Or navigate to: GoalSync → Manager → Approvals</p>`;
  return send(managerEmail, `📋 Goal Submitted for Review — ${employeeName}: "${goalTitle}"`, emailShell('Goal Submitted', body));
}

// ── 3. Goal Approved → notify employee ──────────────────────────────────────
export async function sendGoalApprovedEmail(
  employeeEmail: string, employeeName: string,
  managerName: string, goalTitle: string
): Promise<string | null> {
  const goalUrl = `${APP}/employee/goals`;
  const body = `
    <p style="margin:0 0 6px;font-size:16px;color:#2d1a0a;font-weight:700;">Great news, ${employeeName}! 🎉</p>
    <p style="margin:0 0 20px;color:#7a5c3a;font-size:14px;line-height:1.6;">Your goal has been reviewed and <strong style="color:#5A7A5A;">approved</strong> by your manager.</p>
    ${infoBox(`
      <p style="margin:0 0 4px;font-size:11px;color:#5A7A5A;font-weight:700;text-transform:uppercase;">✅ Approved Goal</p>
      <p style="margin:0;font-size:15px;color:#291C0E;font-weight:700;">${goalTitle}</p>
      <p style="margin:6px 0 0;font-size:12px;color:#A78D78;">Reviewed by: ${managerName}</p>
    `, '#EFF4EF', '#B5C8B5')}
    <p style="color:#7a5c3a;font-size:13px;line-height:1.6;">
      Your goal is now <strong>locked and active</strong>. You can start tracking your quarterly check-ins.
    </p>
    ${ctaButton('🎯 View My Goals →', goalUrl, '#5A7A5A')}`;
  return send(employeeEmail, `✅ Goal Approved — "${goalTitle}"`, emailShell('Goal Approved', body));
}

// ── 4. Goal Rejected → notify employee ──────────────────────────────────────
export async function sendGoalRejectedEmail(
  employeeEmail: string, employeeName: string,
  managerName: string, goalTitle: string, reason: string, isRework = false
): Promise<string | null> {
  const goalUrl = `${APP}/employee/goals`;
  const actionLabel = isRework ? 'Sent for Rework 🔄' : 'Rejected ❌';
  const actionColor = isRework ? '#5A4A6A' : '#7A3A30';
  const body = `
    <p style="margin:0 0 6px;font-size:16px;color:#2d1a0a;font-weight:700;">Hello, ${employeeName}</p>
    <p style="margin:0 0 20px;color:#7a5c3a;font-size:14px;line-height:1.6;">
      Your goal has been <strong>${isRework ? 'sent back for rework' : 'rejected'}</strong> by your manager.
    </p>
    ${infoBox(`
      <p style="margin:0 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;color:${actionColor};">${actionLabel}</p>
      <p style="margin:0;font-size:15px;color:#291C0E;font-weight:700;">${goalTitle}</p>
      <p style="margin:6px 0 0;font-size:12px;color:#A78D78;">Reviewed by: ${managerName}</p>
    `, isRework ? '#EDE8F5' : '#F5ECEA', isRework ? '#C8B8D8' : '#C8A8A0')}
    ${reason ? infoBox(`<p style="margin:0;font-size:13px;color:#291C0E;"><strong>Manager's Comment:</strong><br/>${reason}</p>`, '#FEF3C7', '#F59E0B') : ''}
    <p style="color:#7a5c3a;font-size:13px;">Please update your goal based on the feedback and resubmit.</p>
    ${ctaButton(`${isRework ? '🔄 Update Goal →' : '📝 Edit & Resubmit →'}`, goalUrl, actionColor)}`;
  return send(employeeEmail, `${isRework ? '🔄' : '❌'} Goal ${isRework ? 'Rework Required' : 'Rejected'} — "${goalTitle}"`, emailShell(actionLabel, body));
}

// ── 5. Access Request Approved → notify new user ─────────────────────────────
export async function sendAccessApprovedEmail(
  userEmail: string, userName: string, tempPassword: string, role: string
): Promise<string | null> {
  const loginUrl = `${APP}/login`;
  const body = `
    <p style="margin:0 0 6px;font-size:16px;color:#2d1a0a;font-weight:700;">Welcome to GoalSync, ${userName}! 🎉</p>
    <p style="margin:0 0 20px;color:#7a5c3a;font-size:14px;line-height:1.6;">
      Your access request has been <strong style="color:#5A7A5A;">approved</strong> by HR Administration.
      Your account has been created with the role: <strong>${role.toUpperCase()}</strong>.
    </p>
    ${infoBox(`
      <p style="margin:0 0 8px;font-size:11px;font-weight:700;color:#8b5e3c;text-transform:uppercase;">Your Login Credentials</p>
      <p style="margin:0 0 4px;font-size:13px;color:#291C0E;"><strong>Email:</strong> ${userEmail}</p>
      <p style="margin:0;font-size:13px;color:#291C0E;"><strong>Temporary Password:</strong> <code style="background:#F5F0EA;padding:2px 6px;border-radius:4px;">${tempPassword}</code></p>
    `)}
    <div style="background:#FEF3C7;border-left:4px solid #F59E0B;border-radius:6px;padding:12px 16px;margin:16px 0;">
      <p style="margin:0;font-size:12px;color:#92400E;"><strong>⚠️ Important:</strong> Please change your password immediately after first login.</p>
    </div>
    ${ctaButton('🚀 Login to GoalSync →', loginUrl, '#291C0E')}`;
  return send(userEmail, '🎉 GoalSync Access Approved — Account Created', emailShell('Access Approved', body));
}

// ── 6. Check-in Reminder → notify employee ──────────────────────────────────
export async function sendCheckinReminderEmail(
  employeeEmail: string, employeeName: string,
  goalTitle: string, quarter: string, dueDate: string
): Promise<string | null> {
  const checkinUrl = `${APP}/employee/goals`;
  const body = `
    <p style="margin:0 0 6px;font-size:16px;color:#2d1a0a;font-weight:700;">Hello, ${employeeName} 👋</p>
    <p style="margin:0 0 20px;color:#7a5c3a;font-size:14px;line-height:1.6;">
      Your <strong>${quarter}</strong> quarterly check-in is due. Please complete it to keep your progress on track.
    </p>
    ${infoBox(`
      <p style="margin:0 0 4px;font-size:11px;color:#7A6040;font-weight:700;text-transform:uppercase;">📅 Check-in Due</p>
      <p style="margin:0;font-size:15px;color:#291C0E;font-weight:700;">${goalTitle}</p>
      <p style="margin:6px 0 0;font-size:12px;color:#7A3A30;font-weight:700;">⏰ Due: ${dueDate}</p>
    `, '#F5EDDF', '#C8B490')}
    <p style="color:#7a5c3a;font-size:13px;">Submit your actual achievement figures to avoid an escalation alert to your manager.</p>
    ${ctaButton('📅 Complete Check-in Now →', checkinUrl, '#7A6040')}`;
  return send(employeeEmail, `📅 ${quarter} Check-in Reminder — "${goalTitle}"`, emailShell('Check-in Reminder', body));
}

// ── 7. Escalation Alert → notify manager / HR ───────────────────────────────
export async function sendEscalationAlertEmail(
  recipientEmail: string, recipientName: string,
  employeeName: string, department: string,
  reason: string, escalationLevel: number, daysOverdue: number
): Promise<string | null> {
  const dashUrl = `${APP}/admin/escalations`;
  const levelLabel = escalationLevel === 3 ? '🚨 Level 3 — HR Action Required' : escalationLevel === 2 ? '🔔 Level 2 — Manager Notified' : '⚠️ Level 1 — Employee Reminder';
  const severity = escalationLevel === 3 ? '#7A3A30' : escalationLevel === 2 ? '#7A6040' : '#A78D78';
  const body = `
    <p style="margin:0 0 6px;font-size:16px;color:#2d1a0a;font-weight:700;">Hello, ${recipientName}</p>
    <p style="margin:0 0 20px;color:#7a5c3a;font-size:14px;line-height:1.6;">
      A GoalSync SLA escalation requires your attention.
    </p>
    ${infoBox(`
      <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:${severity};text-transform:uppercase;">${levelLabel}</p>
      <p style="margin:0 0 4px;font-size:14px;color:#291C0E;font-weight:700;">Employee: ${employeeName}</p>
      <p style="margin:0 0 4px;font-size:13px;color:#A78D78;">Department: ${department}</p>
      <p style="margin:0 0 4px;font-size:13px;color:#7A3A30;font-weight:700;">⏰ ${daysOverdue} days overdue</p>
      <p style="margin:8px 0 0;font-size:12px;color:#6E473B;">${reason}</p>
    `, escalationLevel === 3 ? '#F5ECEA' : '#F5EDDF', escalationLevel === 3 ? '#C8A8A0' : '#C8B490')}
    <p style="color:#7a5c3a;font-size:13px;">Please take immediate action to resolve this escalation.</p>
    ${ctaButton('🚨 Open Escalation Dashboard →', dashUrl, severity)}`;
  return send(recipientEmail, `${escalationLevel === 3 ? '🚨' : '⚠️'} GoalSync Escalation Alert — ${employeeName} (${daysOverdue}d overdue)`, emailShell('Escalation Alert', body));
}
