import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create users
  const hashedPassword = await bcrypt.hash('1234', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@test.com' },
    update: {},
    create: {
      name: 'Rajesh Kumar',
      email: 'admin@test.com',
      password: hashedPassword,
      role: 'admin',
      department: 'Human Resources',
    },
  });

  const manager = await prisma.user.upsert({
    where: { email: 'manager@test.com' },
    update: {},
    create: {
      name: 'Priya Sharma',
      email: 'manager@test.com',
      password: hashedPassword,
      role: 'manager',
      department: 'Technology',
    },
  });

  const employee = await prisma.user.upsert({
    where: { email: 'employee@test.com' },
    update: {},
    create: {
      name: 'Arjun Patel',
      email: 'employee@test.com',
      password: hashedPassword,
      role: 'employee',
      department: 'Technology',
      reportingManagerId: manager.id,
    },
  });

  // Extra employees for rich demo
  const emp2 = await prisma.user.upsert({
    where: { email: 'neha@test.com' },
    update: {},
    create: {
      name: 'Neha Singh',
      email: 'neha@test.com',
      password: hashedPassword,
      role: 'employee',
      department: 'Technology',
      reportingManagerId: manager.id,
    },
  });

  const emp3 = await prisma.user.upsert({
    where: { email: 'vikram@test.com' },
    update: {},
    create: {
      name: 'Vikram Mehta',
      email: 'vikram@test.com',
      password: hashedPassword,
      role: 'employee',
      department: 'Finance',
      reportingManagerId: manager.id,
    },
  });

  const emp4 = await prisma.user.upsert({
    where: { email: 'ananya@test.com' },
    update: {},
    create: {
      name: 'Ananya Reddy',
      email: 'ananya@test.com',
      password: hashedPassword,
      role: 'employee',
      department: 'Operations',
      reportingManagerId: manager.id,
    },
  });

  // Create goals for main employee
  const goal1 = await prisma.goal.create({
    data: {
      userId: employee.id,
      thrustArea: 'Technical Excellence',
      goalTitle: 'Reduce System Response Time',
      goalDescription: 'Optimize API endpoints to achieve sub-200ms response time across all critical services',
      uomType: 'numeric',
      higherIsBetter: false,
      target: 200,
      achievement: 165,
      weightage: 25,
      deadline: '2024-12-31',
      status: 'locked',
      isLocked: true,
      progressScore: 82.5,
    },
  });

  const goal2 = await prisma.goal.create({
    data: {
      userId: employee.id,
      thrustArea: 'Customer Satisfaction',
      goalTitle: 'Improve CSAT Score',
      goalDescription: 'Achieve customer satisfaction score of 90% through improved service delivery',
      uomType: 'percentage',
      higherIsBetter: true,
      target: 90,
      achievement: 87,
      weightage: 20,
      status: 'approved',
      isLocked: true,
      progressScore: 96.67,
    },
  });

  const goal3 = await prisma.goal.create({
    data: {
      userId: employee.id,
      thrustArea: 'Process Improvement',
      goalTitle: 'Complete Digital Transformation Roadmap',
      goalDescription: 'Deliver all milestones of the Q4 digital transformation project within timeline',
      uomType: 'timeline',
      higherIsBetter: true,
      target: 100,
      achievement: 75,
      weightage: 20,
      deadline: '2024-12-31',
      status: 'locked',
      isLocked: true,
      progressScore: 75,
    },
  });

  const goal4 = await prisma.goal.create({
    data: {
      userId: employee.id,
      thrustArea: 'Learning & Development',
      goalTitle: 'Complete Cloud Certification',
      goalDescription: 'Achieve AWS Solutions Architect certification by Q3 2024',
      uomType: 'zero-based',
      higherIsBetter: true,
      target: 1,
      achievement: 1,
      weightage: 15,
      status: 'locked',
      isLocked: true,
      progressScore: 100,
    },
  });

  const goal5 = await prisma.goal.create({
    data: {
      userId: employee.id,
      thrustArea: 'Team Collaboration',
      goalTitle: 'Knowledge Sharing Sessions',
      goalDescription: 'Conduct minimum 6 technical knowledge sharing sessions with the team',
      uomType: 'numeric',
      higherIsBetter: true,
      target: 6,
      achievement: 4,
      weightage: 20,
      status: 'submitted',
      isLocked: false,
      progressScore: 66.67,
    },
  });

  // Create approvals for locked goals
  await prisma.goalApproval.createMany({
    data: [
      {
        goalId: goal1.id,
        managerId: manager.id,
        approvalStatus: 'approved',
        approvalComments: 'Good target. Ensure monitoring is set up for real-time tracking.',
        approvedAt: new Date('2024-01-15'),
      },
      {
        goalId: goal2.id,
        managerId: manager.id,
        approvalStatus: 'approved',
        approvalComments: 'Aligned with Q4 customer excellence initiative.',
        approvedAt: new Date('2024-01-15'),
      },
      {
        goalId: goal3.id,
        managerId: manager.id,
        approvalStatus: 'approved',
        approvalComments: 'Critical project. Monthly check-ins required.',
        approvedAt: new Date('2024-01-15'),
      },
      {
        goalId: goal4.id,
        managerId: manager.id,
        approvalStatus: 'approved',
        approvalComments: 'Essential for team upskilling.',
        approvedAt: new Date('2024-01-15'),
      },
    ],
  });

  // Quarterly check-ins
  await prisma.quarterlyCheckin.createMany({
    data: [
      {
        goalId: goal1.id,
        userId: employee.id,
        quarter: 'Q1',
        actualAchievement: 220,
        progressStatus: 'on-track',
        managerComment: 'Good progress. Focus on database query optimization.',
      },
      {
        goalId: goal1.id,
        userId: employee.id,
        quarter: 'Q2',
        actualAchievement: 190,
        progressStatus: 'completed',
        managerComment: 'Excellent work. Target achieved ahead of schedule.',
      },
      {
        goalId: goal2.id,
        userId: employee.id,
        quarter: 'Q1',
        actualAchievement: 82,
        progressStatus: 'on-track',
        managerComment: 'Improving steadily. Focus on support ticket resolution time.',
      },
    ],
  });

  // Goals for Neha
  await prisma.goal.createMany({
    data: [
      {
        userId: emp2.id,
        thrustArea: 'Revenue Growth',
        goalTitle: 'Upsell Enterprise Accounts',
        goalDescription: 'Achieve 15% upsell revenue from existing enterprise accounts',
        uomType: 'percentage',
        higherIsBetter: true,
        target: 15,
        achievement: 12,
        weightage: 30,
        status: 'locked',
        isLocked: true,
        progressScore: 80,
      },
      {
        userId: emp2.id,
        thrustArea: 'Customer Success',
        goalTitle: 'Reduce Churn Rate',
        goalDescription: 'Reduce monthly churn rate to below 2%',
        uomType: 'percentage',
        higherIsBetter: false,
        target: 2,
        achievement: 1.8,
        weightage: 35,
        status: 'approved',
        isLocked: true,
        progressScore: 90,
      },
      {
        userId: emp2.id,
        thrustArea: 'Process Excellence',
        goalTitle: 'Automate Reporting Dashboard',
        goalDescription: 'Implement automated weekly reports for management review',
        uomType: 'zero-based',
        higherIsBetter: true,
        target: 1,
        achievement: 1,
        weightage: 35,
        status: 'submitted',
        isLocked: false,
        progressScore: 100,
      },
    ],
  });

  // Goals for Vikram
  await prisma.goal.createMany({
    data: [
      {
        userId: emp3.id,
        thrustArea: 'Cost Optimization',
        goalTitle: 'Reduce Operational Costs',
        goalDescription: 'Identify and implement cost reduction measures targeting 10% savings',
        uomType: 'percentage',
        higherIsBetter: true,
        target: 10,
        achievement: 7.5,
        weightage: 40,
        status: 'locked',
        isLocked: true,
        progressScore: 75,
      },
      {
        userId: emp3.id,
        thrustArea: 'Compliance',
        goalTitle: 'ISO 27001 Audit Completion',
        goalDescription: 'Successfully complete annual ISO 27001 compliance audit',
        uomType: 'zero-based',
        higherIsBetter: true,
        target: 1,
        achievement: 1,
        weightage: 30,
        status: 'locked',
        isLocked: true,
        progressScore: 100,
      },
      {
        userId: emp3.id,
        thrustArea: 'Team Development',
        goalTitle: 'Finance Team Training Hours',
        goalDescription: 'Complete 40 hours of finance team upskilling',
        uomType: 'numeric',
        higherIsBetter: true,
        target: 40,
        achievement: 28,
        weightage: 30,
        status: 'draft',
        isLocked: false,
        progressScore: 70,
      },
    ],
  });

  // Goals for Ananya  
  await prisma.goal.createMany({
    data: [
      {
        userId: emp4.id,
        thrustArea: 'Operational Excellence',
        goalTitle: 'SLA Compliance Rate',
        goalDescription: 'Maintain 99.5% SLA compliance across all service categories',
        uomType: 'percentage',
        higherIsBetter: true,
        target: 99.5,
        achievement: 98.8,
        weightage: 35,
        status: 'approved',
        isLocked: true,
        progressScore: 99.3,
      },
      {
        userId: emp4.id,
        thrustArea: 'Innovation',
        goalTitle: 'Process Automation Initiatives',
        goalDescription: 'Automate 5 manual operational processes using RPA tools',
        uomType: 'numeric',
        higherIsBetter: true,
        target: 5,
        achievement: 3,
        weightage: 40,
        status: 'submitted',
        isLocked: false,
        progressScore: 60,
      },
      {
        userId: emp4.id,
        thrustArea: 'Sustainability',
        goalTitle: 'Carbon Footprint Reduction',
        goalDescription: 'Reduce department carbon footprint by 20% through green initiatives',
        uomType: 'percentage',
        higherIsBetter: true,
        target: 20,
        achievement: 14,
        weightage: 25,
        status: 'draft',
        isLocked: false,
        progressScore: 70,
      },
    ],
  });

  // Notifications for employee
  await prisma.notification.createMany({
    data: [
      {
        userId: employee.id,
        title: 'Goal Approved',
        message: 'Your goal "Reduce System Response Time" has been approved by Priya Sharma.',
        status: 'unread',
        type: 'success',
      },
      {
        userId: employee.id,
        title: 'Q3 Check-in Reminder',
        message: 'Q3 quarterly check-in is due by September 30. Please update your progress.',
        status: 'unread',
        type: 'warning',
      },
      {
        userId: employee.id,
        title: 'Goal Sheet Submitted',
        message: 'Your goal sheet has been successfully submitted for manager review.',
        status: 'read',
        type: 'info',
      },
    ],
  });

  // Notifications for manager
  await prisma.notification.createMany({
    data: [
      {
        userId: manager.id,
        title: 'Pending Goal Review',
        message: 'Arjun Patel has submitted 5 goals for your approval. Please review within 3 business days.',
        status: 'unread',
        type: 'warning',
      },
      {
        userId: manager.id,
        title: 'Q3 Check-in Due',
        message: '3 team members have not completed Q3 check-ins. Deadline: September 30.',
        status: 'unread',
        type: 'error',
      },
      {
        userId: manager.id,
        title: 'Shared Goal Assignment',
        message: 'Admin has assigned a new shared KPI "Customer Excellence Score" to your team.',
        status: 'read',
        type: 'info',
      },
    ],
  });

  // Notifications for admin
  await prisma.notification.createMany({
    data: [
      {
        userId: admin.id,
        title: 'Goal Unlock Request',
        message: 'Priya Sharma has requested to unlock goals for Arjun Patel for correction.',
        status: 'unread',
        type: 'warning',
      },
      {
        userId: admin.id,
        title: 'Q3 Completion Report',
        message: '78% of employees have completed Q3 check-ins. View detailed report.',
        status: 'read',
        type: 'info',
      },
    ],
  });

  // Audit logs
  await prisma.auditLog.createMany({
    data: [
      {
        userId: employee.id,
        goalId: goal1.id,
        actionType: 'GOAL_CREATED',
        newValue: JSON.stringify({ title: 'Reduce System Response Time', weightage: 25 }),
        changedAt: new Date('2024-01-10'),
      },
      {
        userId: employee.id,
        goalId: goal1.id,
        actionType: 'GOAL_SUBMITTED',
        changedAt: new Date('2024-01-12'),
      },
      {
        userId: manager.id,
        goalId: goal1.id,
        actionType: 'GOAL_APPROVED',
        newValue: JSON.stringify({ status: 'approved', comment: 'Good target.' }),
        changedAt: new Date('2024-01-15'),
      },
      {
        userId: manager.id,
        goalId: goal1.id,
        actionType: 'GOAL_LOCKED',
        changedAt: new Date('2024-01-15'),
      },
      {
        userId: employee.id,
        goalId: goal5.id,
        actionType: 'GOAL_SUBMITTED',
        changedAt: new Date('2024-09-01'),
      },
    ],
  });

  console.log('✅ Database seeded successfully!');
  console.log('📧 Demo credentials:');
  console.log('  Employee: employee@test.com / 1234');
  console.log('  Manager:  manager@test.com / 1234');
  console.log('  Admin:    admin@test.com / 1234');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
