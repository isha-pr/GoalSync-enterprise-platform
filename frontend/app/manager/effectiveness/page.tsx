'use client';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { Badge, Card, Table, Tag, Progress, Select, Row, Col, Tooltip, Spin } from 'antd';
import { CheckCircleOutlined, ClockCircleOutlined, RiseOutlined, TrophyOutlined, WarningOutlined, ThunderboltOutlined } from '@ant-design/icons';
import DashboardLayout from '../../../components/DashboardLayout';
import api from '../../../lib/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartTooltip, ResponsiveContainer, Cell, Legend, AreaChart, Area, RadarChart, PolarGrid, PolarAngleAxis, Radar, LabelList } from '../../../components/LazyCharts';

let _manager_effectiveness_cache: { data: any; ts: number } | null = null;

const COLORS = ['#6E473B', '#5A7A5A', '#7A6040', '#5A4A6A', '#7A3A30', '#4A6070'];
const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];

export default function ManagerEffectivenessPage() {
  const [stats, setStats]         = useState<any[]>([]);
  const [checkinStats, setCheckinStats] = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/escalations/manager-stats'),
      api.get('/reports/analytics'),
    ])
      .then(([r1, r2]) => {
        setStats(r1.data);
        setCheckinStats(r2.data?.managerCheckinStats ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Merge approval stats + checkin stats by managerId
  const merged = stats.map(m => {
    const cs = checkinStats.find(c => c.managerId === m.id) ?? {};
    return { ...m, ...cs };
  });

  const avgApprovalRate  = merged.length ? Math.round(merged.reduce((s, m) => s + m.approvalRate, 0) / merged.length) : 0;
  const avgTurnaround    = merged.length ? Math.round(merged.reduce((s, m) => s + m.avgTurnaroundDays, 0) / merged.length) : 0;
  const totalReviewed    = merged.reduce((s, m) => s + m.totalReviewed, 0);
  const totalDelayed     = merged.filter(m => m.avgTurnaroundDays > 5).length;
  const totalPending     = merged.reduce((s, m) => s + (m.pendingApprovals ?? 0), 0);
  const totalEscalated   = merged.reduce((s, m) => s + (m.delayedApprovals ?? 0), 0);
  const reviewEfficiency = totalReviewed > 0 ? Math.round((merged.reduce((s, m) => s + m.approved, 0) / totalReviewed) * 100) : 0;
  const avgCheckinRate   = merged.length ? Math.round(merged.reduce((s, m) => s + (m.overallCheckinRate ?? 0), 0) / merged.length) : 0;

  const monthlyTrend = [
    { month: 'Jan', reviews: 4, approved: 3 },
    { month: 'Feb', reviews: 7, approved: 6 },
    { month: 'Mar', reviews: 5, approved: 4 },
    { month: 'Apr', reviews: 9, approved: 8 },
    { month: 'May', reviews: totalReviewed, approved: merged.reduce((s, m) => s + m.approved, 0) },
  ];

  // Radar data: one entry per manager for multi-dimension comparison
  const radarData = QUARTERS.map(q => {
    const row: Record<string, any> = { quarter: q };
    merged.forEach(m => { row[m.name?.split(' ')[0] ?? m.managerId] = m[q] ?? 0; });
    return row;
  });
  const managerNames = merged.map(m => m.name?.split(' ')[0] ?? m.managerId);

  const columns = [
    {
      title: 'Manager',
      render: (_: any, r: any) => (
        <div>
          <div style={{ fontWeight: 700, color: '#291C0E', fontSize: 13 }}>{r.name}</div>
          <div style={{ fontSize: 11, color: '#A78D78' }}>{r.department} · {r.teamSize ?? 0} reports</div>
        </div>
      ),
    },
    {
      title: 'Reviews',
      dataIndex: 'totalReviewed',
      width: 90,
      render: (v: number) => <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 20, color: '#291C0E' }}>{v}</div>,
    },
    {
      title: 'Approved',
      dataIndex: 'approved',
      width: 90,
      render: (v: number) => <Tag style={{ background: '#EFF4EF', color: '#5A7A5A', border: 'none', fontWeight: 700 }}>✅ {v}</Tag>,
    },
    {
      title: 'Rejected',
      dataIndex: 'rejected',
      width: 90,
      render: (v: number) => <Tag style={{ background: v > 0 ? '#F5ECEA' : '#F5F0EA', color: v > 0 ? '#7A3A30' : '#A78D78', border: 'none', fontWeight: 700 }}>❌ {v}</Tag>,
    },
    {
      title: 'Rework',
      dataIndex: 'rework',
      width: 90,
      render: (v: number) => <Tag style={{ background: v > 0 ? '#EDE8F5' : '#F5F0EA', color: v > 0 ? '#5A4A6A' : '#A78D78', border: 'none', fontWeight: 700 }}>🔄 {v}</Tag>,
    },
    {
      title: 'Pending',
      dataIndex: 'pendingApprovals',
      width: 90,
      render: (v: number) => (
        <Badge count={v ?? 0} color={v > 0 ? '#7A6040' : '#A78D78'} showZero>
          <div style={{ width: 32, height: 32 }} />
        </Badge>
      ),
    },
    {
      title: 'Delayed',
      dataIndex: 'delayedApprovals',
      width: 90,
      sorter: (a: any, b: any) => (b.delayedApprovals ?? 0) - (a.delayedApprovals ?? 0),
      render: (v: number) => (
        <Tag style={{ background: v > 0 ? '#F5ECEA' : '#EFF4EF', color: v > 0 ? '#7A3A30' : '#5A7A5A', border: 'none', fontWeight: 700 }}>
          {v > 0 ? `⚠️ ${v}` : '✅ 0'}
        </Tag>
      ),
    },
    {
      title: 'Approval Rate',
      dataIndex: 'approvalRate',
      width: 160,
      sorter: (a: any, b: any) => a.approvalRate - b.approvalRate,
      render: (v: number) => (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
            <span style={{ fontSize: 10, color: '#A78D78' }}>Rate</span>
            <span style={{ fontWeight: 800, fontSize: 12, color: v >= 80 ? '#5A7A5A' : v >= 60 ? '#7A6040' : '#7A3A30' }}>{v}%</span>
          </div>
          <Progress percent={v} strokeColor={v >= 80 ? '#5A7A5A' : v >= 60 ? '#7A6040' : '#7A3A30'} railColor="#F5F0EA" size={7} showInfo={false} />
        </div>
      ),
    },
    {
      title: 'Turnaround',
      dataIndex: 'avgTurnaroundDays',
      width: 120,
      sorter: (a: any, b: any) => a.avgTurnaroundDays - b.avgTurnaroundDays,
      render: (v: number) => (
        <div style={{ textAlign: 'center' }}>
          <Tag style={{ fontWeight: 700, fontSize: 12, background: v <= 2 ? '#EFF4EF' : v <= 5 ? '#F0E8D8' : '#F5ECEA', color: v <= 2 ? '#3A5A3A' : v <= 5 ? '#6E473B' : '#7A3A30', border: 'none' }}>
            {v}d
          </Tag>
          <div style={{ fontSize: 10, color: '#A78D78', marginTop: 2 }}>{v <= 2 ? '✅ Fast' : v <= 5 ? '⚠️ OK' : '❌ SLA Breach'}</div>
        </div>
      ),
    },
    {
      title: 'Check-in Rate',
      dataIndex: 'overallCheckinRate',
      width: 130,
      sorter: (a: any, b: any) => (b.overallCheckinRate ?? 0) - (a.overallCheckinRate ?? 0),
      render: (v: number) => {
        const pct = Math.round(v ?? 0);
        return (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ fontSize: 10, color: '#A78D78' }}>Avg Q1-Q4</span>
              <span style={{ fontWeight: 800, fontSize: 12, color: pct >= 70 ? '#5A7A5A' : pct >= 40 ? '#7A6040' : '#7A3A30' }}>{pct}%</span>
            </div>
            <Progress percent={pct} strokeColor={pct >= 70 ? '#5A7A5A' : pct >= 40 ? '#7A6040' : '#7A3A30'} railColor="#F5F0EA" size={7} showInfo={false} />
          </div>
        );
      },
    },
  ];

  const barChartData = merged.map(m => ({
    name: m.name?.split(' ')[0] ?? 'Mgr',
    approved: m.approved,
    rejected: m.rejected,
    rework: m.rework,
    pending: m.pendingApprovals ?? 0,
    delayed: m.delayedApprovals ?? 0,
  }));

  const checkinBarData = merged.map(m => ({
    name: m.name?.split(' ')[0] ?? 'Mgr',
    Q1: m.Q1 ?? 0, Q2: m.Q2 ?? 0, Q3: m.Q3 ?? 0, Q4: m.Q4 ?? 0,
  }));

  return (
    <DashboardLayout role="manager">
      <div className="page-content">
        <div className="portal-header" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13 }}>Performance Governance</div>
              <h1 style={{ color: 'white', fontSize: 26, fontWeight: 800, margin: '4px 0' }}>📊 Manager Effectiveness</h1>
              <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13 }}>Review turnaround · Approval rates · Check-in compliance · SLA adherence</div>
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {[
                { label: 'Avg Check-in Rate', value: `${avgCheckinRate}%`, color: '#C8D8C8' },
                { label: 'Pending Reviews', value: totalPending, color: '#C8B490' },
                { label: 'Delayed (>5d)', value: totalEscalated, color: '#C8A8A0' },
              ].map(m => (
                <div key={m.label} style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: '10px 18px', textAlign: 'center' }}>
                  <div style={{ color: m.color, fontSize: 24, fontWeight: 800 }}>{m.value}</div>
                  <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11 }}>{m.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* KPI Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 14, marginBottom: 24 }}>
          {[
            { label: 'Total Reviews', value: totalReviewed, icon: <CheckCircleOutlined />, color: '#5A7A5A', bg: '#EFF4EF', sub: 'all time' },
            { label: 'Avg Approval Rate', value: `${avgApprovalRate}%`, icon: <TrophyOutlined />, color: '#6E473B', bg: '#E1D4C2', sub: 'across managers' },
            { label: 'Avg Turnaround', value: `${avgTurnaround}d`, icon: <ClockCircleOutlined />, color: '#7A6040', bg: '#F0E8D8', sub: avgTurnaround <= 2 ? '✅ Fast' : avgTurnaround <= 5 ? '⚠️ Acceptable' : '❌ Over SLA' },
            { label: 'Review Efficiency', value: `${reviewEfficiency}%`, icon: <RiseOutlined />, color: '#5A4A6A', bg: '#EDE8F5', sub: 'first-pass approvals' },
            { label: 'Pending Reviews', value: totalPending, icon: <WarningOutlined />, color: '#7A6040', bg: '#F5EDDF', sub: 'awaiting action' },
            { label: 'Delayed Managers', value: totalDelayed, icon: <ThunderboltOutlined />, color: '#7A3A30', bg: '#F5ECEA', sub: 'turnaround > 5d' },
            { label: 'Avg Check-in Rate', value: `${avgCheckinRate}%`, icon: <CheckCircleOutlined />, color: '#4A6070', bg: '#ECF1F5', sub: 'team Q1–Q4 avg' },
            { label: 'Active Managers', value: merged.length, icon: <ThunderboltOutlined />, color: '#6E473B', bg: '#E1D4C2', sub: 'in system' },
          ].map(card => (
            <div key={card.label} style={{ background: 'white', borderRadius: 14, padding: '16px 18px', border: '1px solid #E1D4C2', borderTop: `4px solid ${card.color}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 10, color: '#A78D78', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{card.label}</div>
                  <div style={{ fontSize: 26, fontWeight: 900, color: card.color, marginTop: 4 }}>{card.value}</div>
                  <div style={{ fontSize: 10, color: '#A78D78', marginTop: 3 }}>{card.sub}</div>
                </div>
                <div style={{ background: card.bg, padding: 8, borderRadius: 10, fontSize: 18, color: card.color }}>{card.icon}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Charts Row 1 — Activity + Monthly Trend */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
          <Card title={<span style={{ fontWeight: 700 }}>📈 Manager Activity Comparison (Approvals vs Pending vs Delayed)</span>} style={{ borderRadius: 16 }}>
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={barChartData} margin={{ top: 8, right: 8, bottom: 4, left: 0 }} barGap={3} barSize={14}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F5F0EA" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#A78D78' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#A78D78' }} axisLine={false} tickLine={false} />
                <RechartTooltip contentStyle={{ borderRadius: 10, border: '1px solid #E1D4C2', fontSize: 12 }} />
                <Legend iconType="circle" iconSize={9} wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="approved" name="Approved" fill="#5A7A5A" radius={[4,4,0,0]} />
                <Bar dataKey="rejected" name="Rejected" fill="#7A3A30" radius={[4,4,0,0]} />
                <Bar dataKey="rework"   name="Rework"   fill="#5A4A6A" radius={[4,4,0,0]} />
                <Bar dataKey="pending"  name="Pending"  fill="#7A6040" radius={[4,4,0,0]} />
                <Bar dataKey="delayed"  name="Delayed"  fill="#C8A8A0" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
          <Card title={<span style={{ fontWeight: 700 }}>📅 Monthly Review Trend</span>} style={{ borderRadius: 16 }}>
            <ResponsiveContainer width="100%" height={230}>
              <AreaChart data={monthlyTrend} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F5F0EA" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#A78D78' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#A78D78' }} axisLine={false} tickLine={false} />
                <RechartTooltip contentStyle={{ borderRadius: 10, border: '1px solid #E1D4C2', fontSize: 12 }} />
                <Legend iconType="circle" iconSize={9} wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="reviews" name="Total Reviews" stroke="#6E473B" fill="#E1D4C2" strokeWidth={2} />
                <Area type="monotone" dataKey="approved" name="Approved" stroke="#5A7A5A" fill="#EFF4EF" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* Check-in Completion by Quarter per Manager */}
        {checkinBarData.length > 0 && (
          <Card title={<span style={{ fontWeight: 700 }}>📆 Team Check-in Completion Rate by Quarter (per Manager's Team)</span>}
            style={{ borderRadius: 16, marginBottom: 20 }}
            extra={<span style={{ fontSize: 11, color: '#A78D78' }}>% of team goals with check-in recorded that quarter</span>}>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={checkinBarData} margin={{ top: 8, right: 16, bottom: 4, left: 0 }} barGap={4} barSize={18}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F5F0EA" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#A78D78' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#A78D78' }} domain={[0, 100]} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                <RechartTooltip formatter={(v: any) => [`${v}%`, '']} contentStyle={{ borderRadius: 10, border: '1px solid #E1D4C2', fontSize: 12 }} />
                <Legend iconType="circle" iconSize={9} wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Q1" name="Q1" fill="#6E473B" radius={[4,4,0,0]}><LabelList dataKey="Q1" position="top" style={{ fontSize: 9 }} formatter={(v: any) => v > 0 ? `${v}%` : ''} /></Bar>
                <Bar dataKey="Q2" name="Q2" fill="#5A7A5A" radius={[4,4,0,0]}><LabelList dataKey="Q2" position="top" style={{ fontSize: 9 }} formatter={(v: any) => v > 0 ? `${v}%` : ''} /></Bar>
                <Bar dataKey="Q3" name="Q3" fill="#7A6040" radius={[4,4,0,0]}><LabelList dataKey="Q3" position="top" style={{ fontSize: 9 }} formatter={(v: any) => v > 0 ? `${v}%` : ''} /></Bar>
                <Bar dataKey="Q4" name="Q4" fill="#5A4A6A" radius={[4,4,0,0]}><LabelList dataKey="Q4" position="top" style={{ fontSize: 9 }} formatter={(v: any) => v > 0 ? `${v}%` : ''} /></Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}

        {/* Detailed Table */}
        <Card title={<span style={{ fontWeight: 700 }}>🧾 Manager-wise Full Review Breakdown</span>} style={{ borderRadius: 16 }}>
          <Table columns={columns} dataSource={merged} rowKey="id" loading={loading} pagination={false} size="middle" scroll={{ x: 1200 }} locale={{ emptyText: 'No manager review data available yet' }} />
        </Card>

        {/* SLA Reference */}
        <Card style={{ borderRadius: 16, marginTop: 20, background: '#FAF7F4' }}>
          <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
            {[
              { label: 'Approval SLA', value: '5 Business Days', sub: 'from submission to decision', color: '#291C0E' },
              { label: 'Ideal Turnaround', value: '≤ 2 Days', sub: 'best-in-class review speed', color: '#5A7A5A' },
              { label: 'Target Approval Rate', value: '≥ 80%', sub: 'approved on first review', color: '#5A4A6A' },
              { label: 'Target Check-in Rate', value: '≥ 70%', sub: 'team check-ins per quarter', color: '#4A6070' },
            ].map(s => (
              <div key={s.label}>
                <div style={{ fontSize: 10, color: '#A78D78', fontWeight: 700, textTransform: 'uppercase' }}>{s.label}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 11, color: '#A78D78' }}>{s.sub}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}