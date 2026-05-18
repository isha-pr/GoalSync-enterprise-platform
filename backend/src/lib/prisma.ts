/**
 * Prisma singleton — import this everywhere instead of `new PrismaClient()`.
 * A single shared instance means ONE connection pool for the entire process,
 * which dramatically reduces DB connection overhead.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});

export default prisma;
