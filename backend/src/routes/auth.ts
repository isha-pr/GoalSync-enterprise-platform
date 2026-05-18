import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { sendPasswordResetEmail } from '../utils/mailer';

const router = Router();


// In-memory OTP store: email -> { otp, expiry, name }
const otpStore = new Map<string, { otp: string; expiry: number; name: string }>();

// Helper: find admin user(s) to notify
async function getAdminIds(): Promise<string[]> {
  const admins = await prisma.user.findMany({ where: { role: 'admin' }, select: { id: true } });
  return admins.map(a => a.id);
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Check if there's a pending access request for this email
      const pendingRequest = await prisma.notification.findFirst({
        where: { type: 'access_request', message: { contains: `"email":"${email}"` } },
      });
      if (pendingRequest) {
        return res.status(401).json({ error: 'account_pending', message: 'Your access request is pending HR approval. You will be notified once approved.' });
      }
      return res.status(401).json({ error: 'account_not_found', message: 'No account found with this email. Please request access below.' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'invalid_password', message: 'Incorrect password. Please try again or use Forgot Password.' });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'server_error', message: 'Server error. Please try again.' });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req: AuthRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { id: true, name: true, email: true, role: true, department: true, reportingManagerId: true, createdAt: true },
    });
    res.json(user);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/request-access — Submit employee registration request
router.post('/request-access', async (req, res) => {
  const { fullName, email, employeeId, department, requestedRole, managerName, reason } = req.body;
  if (!fullName || !email || !employeeId || !department) {
    return res.status(400).json({ error: 'Required fields missing' });
  }

  try {
    // Check if user already exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'account_exists', message: 'An account with this email already exists. Please sign in.' });
    }

    // Check for duplicate pending request
    const duplicate = await prisma.notification.findFirst({
      where: { type: 'access_request', message: { contains: `"email":"${email}"` } },
    });
    if (duplicate) {
      return res.status(409).json({ error: 'request_pending', message: 'A request for this email is already pending HR review.' });
    }

    const payload = JSON.stringify({ fullName, email, employeeId, department, requestedRole: requestedRole || 'employee', managerName, reason });

    // Notify all admins
    const adminIds = await getAdminIds();
    await Promise.all(adminIds.map(adminId =>
      prisma.notification.create({
        data: {
          userId: adminId,
          title: `Access Request: ${fullName}`,
          message: payload,
          type: 'access_request',
          status: 'unread',
        },
      })
    ));

    res.status(201).json({ message: 'Access request submitted successfully. HR will review within 1-2 business days.' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/auth/request-status?email= — Check status of access request
router.get('/request-status', async (req, res) => {
  const { email } = req.query as { email: string };
  if (!email) return res.status(400).json({ error: 'Email required' });

  try {
    // Check if account was created (approved)
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) return res.json({ status: 'approved', message: 'Your account has been activated. You can now sign in.' });

    // Check for pending request
    const pending = await prisma.notification.findFirst({
      where: { type: 'access_request', message: { contains: `"email":"${email}"` }, status: 'unread' },
    });
    if (pending) return res.json({ status: 'pending', message: 'Your request is under HR review. Expected: 1-2 business days.' });

    const rejected = await prisma.notification.findFirst({
      where: { type: 'access_request', message: { contains: `"email":"${email}"` }, status: 'read' },
    });
    if (rejected) return res.json({ status: 'rejected', message: 'Your access request was not approved. Contact HR for details.' });

    return res.json({ status: 'not_found', message: 'No request found for this email.' });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/create-admin — Create admin/HR account using secret key
router.post('/create-admin', async (req, res) => {
  const { adminSecretKey, name, email, password, department } = req.body;

  // Validate admin secret key
  const validKey = process.env.ADMIN_SECRET_KEY || 'GOALSYNC-ADMIN-2024-ENTERPRISE';
  if (!adminSecretKey || adminSecretKey !== validKey) {
    return res.status(403).json({
      error: 'invalid_admin_key',
      message: 'Invalid Admin Secret Key. Unauthorized admin registration blocked.',
    });
  }

  if (!name || !email || !password || !department) {
    return res.status(400).json({ error: 'All fields required' });
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'account_exists', message: 'An account with this email already exists.' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const admin = await prisma.user.create({
      data: { name, email, password: hashed, role: 'admin', department },
    });

    const token = jwt.sign(
      { id: admin.id, email: admin.email, role: admin.role, name: admin.name },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'Admin account created successfully.',
      token,
      user: { id: admin.id, name: admin.name, email: admin.email, role: admin.role, department: admin.department },
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── PASSWORD RESET FLOW ─────────────────────────────────────────────────────

// POST /api/auth/forgot-password — verify email exists, generate OTP, send email
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(404).json({
        error: 'email_not_registered',
        message: 'No account found with this email address. Please check and try again.',
      });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = Date.now() + 15 * 60 * 1000; // 15 minutes

    // Store OTP in memory — always succeeds regardless of email status
    otpStore.set(email, { otp, expiry, name: user.name });

    // Always log OTP to console — usable for demo/dev even without email config
    console.log(`\n🔐 [OTP] Email: ${email} | OTP: ${otp} | Valid for 15 min\n`);

    // Attempt email delivery (non-blocking — never fails the response)
    let previewUrl: string | null = null;
    try {
      previewUrl = await sendPasswordResetEmail(email, user.name, otp);
    } catch (mailErr) {
      console.warn('📧 Mail delivery skipped (non-critical):', (mailErr as Error).message);
    }

    const response: any = {
      message: `A 6-digit OTP has been sent to ${email}. Check your inbox (valid 15 minutes).`,
    };
    if (previewUrl) response.previewUrl = previewUrl;

    res.json(response);
  } catch (e: any) {
    res.status(500).json({ error: 'server_error', message: 'Server error. Please try again.' });
  }
});

// POST /api/auth/verify-otp — validate the OTP entered by user
router.post('/verify-otp', async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ error: 'Email and OTP required' });

  const record = otpStore.get(email);
  if (!record) {
    return res.status(400).json({
      error: 'otp_expired',
      message: 'OTP has expired or was not generated. Please request a new one.',
    });
  }
  if (Date.now() > record.expiry) {
    otpStore.delete(email);
    return res.status(400).json({
      error: 'otp_expired',
      message: 'OTP has expired (15 minutes). Please request a new password reset.',
    });
  }
  if (record.otp !== otp.toString().trim()) {
    return res.status(400).json({
      error: 'otp_invalid',
      message: 'Invalid OTP. Please check your email and try again.',
    });
  }

  // OTP valid — generate a short-lived reset token
  const resetToken = jwt.sign(
    { email, purpose: 'password_reset' },
    process.env.JWT_SECRET || 'secret',
    { expiresIn: '10m' }
  );

  // Keep OTP in store until password is actually reset
  res.json({ message: 'OTP verified successfully.', resetToken });
});

// POST /api/auth/reset-password — update password using valid reset token
router.post('/reset-password', async (req, res) => {
  const { resetToken, newPassword } = req.body;
  if (!resetToken || !newPassword) {
    return res.status(400).json({ error: 'Reset token and new password required' });
  }

  // Strong password validation
  const strongPassword = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_\-+=])[A-Za-z\d@$!%*?&#^()_\-+=]{8,}$/;
  if (!strongPassword.test(newPassword)) {
    return res.status(400).json({
      error: 'weak_password',
      message: 'Password must be at least 8 characters with uppercase, lowercase, number, and special character.',
    });
  }

  try {
    // Verify reset token
    let payload: any;
    try {
      payload = jwt.verify(resetToken, process.env.JWT_SECRET || 'secret') as any;
    } catch {
      return res.status(400).json({
        error: 'invalid_reset_token',
        message: 'Invalid or expired reset link. Please request a new password reset.',
      });
    }

    if (payload.purpose !== 'password_reset') {
      return res.status(400).json({ error: 'invalid_reset_token', message: 'Invalid reset token.' });
    }

    const { email } = payload;

    // Hash new password
    const hashed = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { email }, data: { password: hashed } });

    // Clear OTP store for this email
    otpStore.delete(email);

    // Send confirmation notification (in-app)
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      await prisma.notification.create({
        data: {
          userId: user.id,
          title: '🔐 Password Reset Successful',
          message: 'Your password has been successfully updated. If you did not make this change, contact HR immediately.',
          type: 'success',
          status: 'unread',
        },
      });
    }

    res.json({ message: 'Password reset successful. You can now sign in with your new password.' });
  } catch (e: any) {
    res.status(500).json({ error: 'server_error', message: 'Server error. Please try again.' });
  }
});

export default router;
