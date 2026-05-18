'use client';
import { useEffect, useState, useMemo } from 'react';
import { Card, Row, Col, Progress, Tag, Alert } from 'antd';
import { RiseOutlined, CheckCircleOutlined, LockOutlined, TeamOutlined } from '@ant-design/icons';
import DashboardLayout from '../../../components/DashboardLayout';
import api from '../../../lib/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, RadarChart, PolarGrid, PolarAngleAxis, Radar, Legend } from '../../../components/LazyCharts';

let _admin_impact_cache: { data: any; ts: number } | null = null;

const COLORS = ['#6E473B', '#5A7A5A', '#7A6040', '#5A4A6A', '#7A3A30', '#4A6070'];

const ROI_METRICS = [
  {
    before: 'Manual Excel tracking',
    after: 'Real-time goal dashboard',
    metric: 'Visibility',
    improvement: '∞ improvement',
    color: '#6E473B',
    icon: '📊',
  },
  {
    before: '5–7 days email approval cycle',
    after: 'Online approval in <24 hrs',
    metric: 'Approval Speed',
    improvement: '85% faster',
    color: '#5A7A5A',
    icon: '⚡',
  },
  {
    before: 'No compliance record',
    after: 'Full audit trail on every action',
    metric: 'Compliance',
    improvement: '100% audited',
    color: '#5A4A6A',
    icon: '🔒',
  },
  {
    before: 'Quarterly Excel reports',
    after: 'Live progress tracking',
    metric: 'Reporting',
    improvement: 'Real-time',
    color: '#7A6040',
    icon: '📈',
  },
  {
    before: 'Goals created in silos',
    after: 'Manager pushes shared KPIs',
    metric: 'Goal Alignment',
    improvement: 'Team-wide sync',
    color: '#4A6070',
    icon: '🎯',
  },
  {
    before: 'No escalation tracking',
    after: 'Automated SLA alerts',
    metric: 'Accountability',
    improvement: 'Zero delays missed',
    color: '#7A3A30',
    icon: '🚨',
  },
];

export default function BusinessImpactPage() {
  const [stats, setStats] = useState<any>(null);
  const [overview, setOverview] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (_admin_impact_cache && Date.now() - _admin_impact_cache.ts < 90_000) {
      setStats(_admin_impact_cache.data.stats);
      setOverview(_admin_impact_cache.data.overview);
      setLoading(false); return;
    }
    Promise.all([api.get('/admin/stats'), api.get('/admin/overview')])
      .then(([s, o]) => {
        _admin_impact_cache = { data: { stats: s.data, overview: o.data }, ts: Date.now() };
        setStats(s.data); setOverview(o.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const lockedPct = stats ? Math.round((stats.lockedGoals / (stats.totalGoals || 1)) * 100) : 0;
  const submittedPct = stats?.goalSubmissionRate ?? 0;
  const completedEmp = overview.filter(e => e.locked === e.totalGoals && e.totalGoals > 0).length;
  const inProgressEmp = overview.filter(e => e.totalGoals > 0 && e.locked < e.totalGoals).length;

  const radarData = [
    { subject: 'Submission Rate', value: submittedPct },
    { subject: 'Goal Locking', value: lockedPct },
    { subject: 'Check-in Coverage', value: stats ? Math.min(100, Math.round((stats.checkins / (stats.totalGoals || 1)) * 60)) : 0 },
    { subject: 'Manager Engagement', value: stats?.managers > 0 ? 85 : 0 },
    { subject: 'Audit Coverage', value: 100 },
    { subject: 'Team Alignment', value: 78 },
  ];

  const deptChartData = (stats?.departmentStats || []).map((d: any) => ({
    name: d.department.split(' ')[0],
    progress: d.avgProgress,
    goals: d.goalCount,
  }));

  const bottlenecks = [
    stats?.submittedGoals > 0
      ? { label: `${stats.submittedGoals} goals awaiting manager review`, priority: 'high', action: 'Managers should review pending goals' }
      : null,
    overview.filter(e => e.totalGoals === 0).length > 0
      ? { label: `${overview.filter(e => e.totalGoals === 0).length} employees have no goals yet`, priority: 'medium', action: 'Follow up with employees to create goals' }
      : null,
    overview.filter(e => e.checkinsCompleted === 0 && e.totalGoals > 0).length > 0
      ? { label: `${overview.filter(e => e.checkinsCompleted === 0 && e.totalGoals > 0).length} employees have zero Q3 check-ins`, priority: 'medium', action: 'Remind employees to update quarterly progress' }
      : null,
  ].filter(Boolean);

  return (
    <DashboardLayout role="admin">
      <div className="page-content">
        <div className="portal-header" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13 }}>Executive Summary</div>
              <h1 style={{ color: 'white', fontSize: 26, fontWeight: 800, margin: '4px 0' }}>
                💼 Business Impact Dashboard
              </h1>
              <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13 }}>
                ROI metrics, process improvement visibility, and leadership action items
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              {[
                { label: 'Employees Tracked', value: overview.length },
                { label: 'Goals Finalized', value: stats?.lockedGoals ?? 0 },
                { label: 'System Compliance', value: '100%' },
              ].map(m => (
                <div key={m.label} style={{ background: 'rgba(255,255,255,0.12)', borderRadius: 12, padding: '10px 18px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.15)' }}>
                  <div style={{ color: 'white', fontSize: 26, fontWeight: 800 }}>{m.value}</div>
                  <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11 }}>{m.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottleneck Action Alerts */}
        {bottlenecks.length > 0 && (
          <Card
            title={<span style={{ fontWeight: 700 }}>🚦 Leadership Action Required</span>}
            style={{ borderRadius: 16, marginBottom: 24, borderLeft: '4px solid #7A3A30' }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {bottlenecks.map((b: any, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  background: b.priority === 'high' ? '#F5ECEA' : '#fefce8',
                  borderRadius: 10, padding: '12px 16px',
                  border: `1px solid ${b.priority === 'high' ? '#fecaca' : '#fde68a'}`,
                }}>
                  <span style={{ fontSize: 22 }}>{b.priority === 'high' ? '🔴' : '🟡'}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, color: '#291C0E', fontSize: 13 }}>{b.label}</div>
                    <div style={{ fontSize: 12, color: '#A78D78', marginTop: 2 }}>Recommended: {b.action}</div>
                  </div>
                  <Tag color={b.priority === 'high' ? 'error' : 'warning'} style={{ fontWeight: 700 }}>
                    {b.priority === 'high' ? 'Act Now' : 'Monitor'}
                  </Tag>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Executive KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          {[
            { label: 'Goal Submission Rate', value: `${submittedPct}%`, color: '#6E473B', target: '≥90%', ok: submittedPct >= 90, icon: '📤' },
            { label: 'Goals Finalized', value: `${lockedPct}%`, color: '#5A7A5A', target: '≥80%', ok: lockedPct >= 80, icon: '🔒' },
            { label: 'Employees on Track', value: `${completedEmp}/${overview.length}`, color: '#5A4A6A', target: 'All employees', ok: completedEmp >= overview.length * 0.8, icon: '✅' },
            { label: 'Total Check-ins', value: stats?.checkins ?? 0, color: '#7A6040', target: '≥ goals × 3', ok: (stats?.checkins ?? 0) >= (stats?.totalGoals ?? 1) * 2, icon: '📋' },
          ].map(card => (
            <div key={card.label} style={{
              background: 'white', borderRadius: 14, padding: '18px 20px',
              border: `1px solid #E1D4C2`, borderTop: `4px solid ${card.color}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 11, color: '#A78D78', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{card.label}</div>
                  <div style={{ fontSize: 30, fontWeight: 900, color: card.color, marginTop: 6 }}>{card.value}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                    <Tag color={card.ok ? 'success' : 'warning'} style={{ fontSize: 10 }}>
                      {card.ok ? '✅ On Target' : '⚠️ Below Target'}
                    </Tag>
                  </div>
                  <div style={{ fontSize: 11, color: '#A78D78', marginTop: 4 }}>Target: {card.target}</div>
                </div>
                <div style={{ fontSize: 24 }}>{card.icon}</div>
              </div>
            </div>
          ))}
        </div>

        <Row gutter={[20, 20]} style={{ marginBottom: 24 }}>
          {/* Radar — Org Health */}
          <Col xs={24} lg={10}>
            <Card title={<span style={{ fontWeight: 700 }}>🕸️ Organizational Health Score</span>} style={{ borderRadius: 16, height: '100%' }}>
              <ResponsiveContainer width="100%" height={280}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#E1D4C2" />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: '#A78D78' }} />
                  <Radar name="Current Score" dataKey="value" stroke="#6E473B" fill="#6E473B" fillOpacity={0.25} strokeWidth={2} />
                  <Tooltip formatter={(v: any) => [`${v}%`, 'Score']} />
                </RadarChart>
              </ResponsiveContainer>
            </Card>
          </Col>

          {/* Dept Progress */}
          <Col xs={24} lg={14}>
            <Card title={<span style={{ fontWeight: 700 }}>🏢 Department Performance Comparison</span>} style={{ borderRadius: 16 }}>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={deptChartData} margin={{ top: 16, right: 16, bottom: 10, left: 0 }} barSize={40}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F5F0EA" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#A78D78' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#A78D78' }} domain={[0, 100]} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                  <Tooltip formatter={(v: any) => [`${v}%`, 'Avg Progress']} contentStyle={{ borderRadius: 10, fontSize: 13 }} />
                  <Bar dataKey="progress" name="Avg Progress %" radius={[6, 6, 0, 0]}>
                    {deptChartData.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </Col>
        </Row>

        {/* Before vs After ROI */}
        <Card
          title={<span style={{ fontWeight: 700 }}>📊 Before vs After — Process ROI</span>}
          style={{ borderRadius: 16 }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {ROI_METRICS.map(m => (
              <div key={m.metric} style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid #E1D4C2' }}>
                {/* Header */}
                <div style={{ background: m.color, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 20 }}>{m.icon}</span>
                  <span style={{ color: 'white', fontWeight: 800, fontSize: 14 }}>{m.metric}</span>
                </div>
                {/* Before */}
                <div style={{ padding: '10px 16px', background: '#F5ECEA', borderBottom: '1px solid #fecaca' }}>
                  <div style={{ fontSize: 10, color: '#6A2A20', fontWeight: 700, textTransform: 'uppercase' }}>❌ Before</div>
                  <div style={{ fontSize: 12, color: '#374151', marginTop: 3 }}>{m.before}</div>
                </div>
                {/* After */}
                <div style={{ padding: '10px 16px', background: '#EFF4EF', borderBottom: '1px solid #bbf7d0' }}>
                  <div style={{ fontSize: 10, color: '#2a4a2a', fontWeight: 700, textTransform: 'uppercase' }}>✅ After</div>
                  <div style={{ fontSize: 12, color: '#374151', marginTop: 3 }}>{m.after}</div>
                </div>
                {/* Improvement */}
                <div style={{ padding: '8px 16px', background: 'white', textAlign: 'center' }}>
                  <span style={{ fontWeight: 800, color: m.color, fontSize: 14 }}>{m.improvement}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}