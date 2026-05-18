import { Router } from 'express';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();


// GET /api/notifications
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    res.json(notifications);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/notifications/read-all  ← must be BEFORE /:id/read
router.put('/read-all', authenticate, async (req: AuthRequest, res) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user!.id },
      data: { status: 'read' },
    });
    res.json({ message: 'All marked as read' });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/notifications/:id/read  ← dynamic route comes after
router.put('/:id/read', authenticate, async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string;
    await prisma.notification.update({
      where: { id },
      data: { status: 'read' },
    });
    res.json({ message: 'Marked as read' });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
