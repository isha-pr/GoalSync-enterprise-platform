'use client';
let _teamGoalsCache: { data: any; ts: number } | null = null;
import { useEffect, useState } from 'react';
import { Card, Table, Tag, Button, Avatar } from 'antd';
import DashboardLayout from '../../../components/DashboardLayout';
import api from '../../../lib/api';
import { TeamMember, Goal } from '../../../lib/types';
import { Progress } from 'antd';

export default function TeamGoalsPage() {
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string[]>([]);

  useEffect(() => {
    api.get('/manager/team').then(r => setTeam(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const allGoals = team.flatMap(m => m.goals.map(g => ({
    ...g,
    employeeName: m.name,
    employeeDept: m.department,
    key: g.id,
  })));

  const statusColor: Record<string, string> = {
    draft: 'default', submitted: 'warning', approved: 'success',
    rejected: 'error', rework: 'purple', locked: 'blue',
  };

  const columns = [
    {
      title: 'Employee',
      render: (_: any, r: any) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar style={{ background: '#6E473B', fontWeight: 700 }}>{r.employeeName.charAt(0)}</Avatar>
          <div>
            <div style={{ fontWeight: 700 }}>{r.employeeName}</div>
            <div style={{ fontSize: 12, color: '#A78D78' }}>{r.employeeDept}</div>
          </div>
        </div>
      ),
      width: 180,
    },
    { title: 'Thrust Area', dataIndex: 'thrustArea', width: 160, render: (v: string) => <Tag>{v}</Tag> },
    { title: 'Goal Title', dataIndex: 'goalTitle', render: (v: string) => <span style={{ fontWeight: 600 }}>{v}</span> },
    { title: 'UoM', dataIndex: 'uomType', width: 90, render: (v: string) => <Tag color="geekblue">{v.toUpperCase()}</Tag> },
    { title: 'Target', dataIndex: 'target', width: 80 },
    { title: 'Achievement', dataIndex: 'achievement', width: 110, render: (v: number) => <strong style={{ color: '#5A7A5A' }}>{v}</strong> },
    {
      title: 'Progress', width: 160,
      render: (_: any, r: Goal) => (
        <Progress percent={Math.round(r.progressScore)} size={6}
          strokeColor={r.progressScore >= 80 ? '#5A7A5A' : r.progressScore >= 60 ? '#7A6040' : '#7A3A30'}
        />
      ),
    },
    { title: 'Weightage', dataIndex: 'weightage', width: 90, render: (v: number) => <strong>{v}%</strong> },
    {
      title: 'Status', width: 140,
      render: (_: any, r: any) => (
        <Tag color={r.isLocked ? 'blue' : statusColor[r.status]} style={{ fontWeight: 600 }}>
          {r.isLocked ? '🔒 Locked' : r.status}
        </Tag>
      ),
    },
  ];

  return (
    <DashboardLayout role="manager">
      <div className="page-content">
        <div className="portal-header">
          <div>
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>Team Overview</div>
            <h1 style={{ color: 'white', fontSize: 26, fontWeight: 800, margin: '4px 0' }}>All Team Goals</h1>
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>
              {team.length} team members • {allGoals.length} total goals
            </div>
          </div>
        </div>
        <Card style={{ borderRadius: 16 }}>
          <Table
            columns={columns}
            dataSource={allGoals}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 15 }}
            size="middle"
            scroll={{ x: 1200 }}
          />
        </Card>
      </div>
    </DashboardLayout>
  );
}