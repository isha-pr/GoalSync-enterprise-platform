export interface User {
  id: string;
  name: string;
  email: string;
  role: 'employee' | 'manager' | 'admin';
  department: string;
  reportingManagerId?: string;
  createdAt?: string;
}

export interface Goal {
  id: string;
  userId: string;
  thrustArea: string;
  goalTitle: string;
  goalDescription: string;
  uomType: 'numeric' | 'percentage' | 'timeline' | 'zero-based';
  higherIsBetter: boolean;
  target: number;
  achievement: number;
  weightage: number;
  deadline?: string;
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'rework' | 'locked';
  progressScore: number;
  isLocked: boolean;
  isSharedGoal: boolean;
  sharedGoalId?: string;
  createdAt: string;
  updatedAt: string;
  user?: User;
  goalApprovals?: GoalApproval[];
  quarterlyCheckins?: QuarterlyCheckin[];
}

export interface GoalApproval {
  id: string;
  goalId: string;
  managerId: string;
  approvalStatus: 'approved' | 'rejected' | 'rework';
  approvalComments?: string;
  updatedWeightage?: number;
  updatedTarget?: number;
  approvedAt: string;
  manager?: { name: string };
}

export interface QuarterlyCheckin {
  id: string;
  goalId: string;
  userId: string;
  quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  actualAchievement: number;
  progressStatus: 'not-started' | 'on-track' | 'completed' | 'at-risk';
  managerComment?: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  goalId?: string;
  actionType: string;
  oldValue?: string;
  newValue?: string;
  changedAt: string;
  user?: { name: string; email: string; role: string };
  goal?: { goalTitle: string };
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  status: 'read' | 'unread';
  type: 'info' | 'success' | 'warning' | 'error';
  createdAt: string;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  department: string;
  goals: Goal[];
}

export interface DashboardStats {
  total: number;
  draft: number;
  submitted: number;
  approved: number;
  locked: number;
  rework: number;
  totalWeightage: number;
  avgProgress: number;
}

export interface AdminStats {
  totalUsers: number;
  totalGoals: number;
  lockedGoals: number;
  submittedGoals: number;
  checkins: number;
  managers: number;
  goalSubmissionRate: number;
  departmentStats: { department: string; goalCount: number; avgProgress: number }[];
}

export interface ManagerStats {
  teamSize: number;
  totalGoals: number;
  pendingReview: number;
  approved: number;
  avgProgress: number;
}
