'use client';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { Card, Row, Col, Progress, Tag, Table, Avatar, Button, Tooltip } from 'antd';
import {
  TeamOutlined, AimOutlined, LockOutlined, CheckCircleOutlined,
  BarChartOutlined, HistoryOutlined, RiseOutlined, EyeOutlined,
  WarningOutlined, ThunderboltOutlined, SafetyOutlined, FireOutlined,
} from '@ant-design/icons';
import type { TablePaginationConfig } from 'antd/es/table';
import DashboardLayout from '../../components/DashboardLayout';
import { useStore } from '../../lib/store';
import api from '../../lib/api';
import { AdminStats } from '../../lib/types';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LabelList, RadarChart, Radar, PolarGrid, PolarAngleAxis,
} from '../../components/LazyCharts';
import { useRouter } from 'next/navigation';

const PALETTE = ['#6E473B', '#A78D78', '#BEB5A9', '#4a3020', '#8a6a5a', '#291C0E'];

const KPI_CARDS = [
  { key: 'totalUsers',        label: 'Total Employees',  icon: <TeamOutlined />,         color: '#291C0E', bg: '#E1D4C2', cls: 'brown',  delta: 'active in system' },
  { key: 'totalGoals',        label: 'Total Goals',      icon: <AimOutlined />,          color: '#6E473B', bg: '#EDE5DA', cls: 'brown',  delta: 'across all employees' },
  { key: 'lockedGoals',       label: 'Goals Locked',     icon: <LockOutlined />,         color: '#4a3020', bg: '#E1D4C2', cls: 'brown',  delta: 'finalized this cycle' },
  { key: 'submittedGoals',    label: 'Pending Review',   icon: <CheckCircleOutlined />,  color: '#7A6040', bg: '#F0E8D8', cls: 'brown',  delta: 'awaiting manager action' },
  { key: 'managers',          label: 'Total Managers',   icon: <BarChartOutlined />,     color: '#6E473B', bg: '#DDD5C8', cls: 'brown',  delta: 'active reviewers' },
  { key: 'checkins',          label: 'Total Check-ins',  icon: <HistoryOutlined />,      color: '#7A3A30', bg: '#EDE0DD', cls: 'brown',  delta: 'quarterly entries' },
];

const CustomBarLabel = ({ x, y, width, value }: any) =>
  value > 0 ? (
    <text x={x + width / 2} y={y - 5} fill="#374151" textAnchor="middle" fontSize={12} fontWeight={700}>
      {value}%
    </text>
  ) : null;

const renderPieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }: any) => {
  if (percent < 0.08) return null;
  const RADIAN = Math.PI / 180;
  const r = innerRadius + (outerRadius - innerRadius) * 0.6;
  const x = cx + r * Math.cos(-midAngle * RADIAN);
  const y = cy + r * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={700}>
      {(percent * 100).toFixed(0)}%
    </text>
  );
};

export default function AdminDashboard() {
  const { user } = useStore();
  const router = useRouter();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [overview, setOverview] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [pagination, setPagination] = useState<TablePaginationConfig>({
    current: 1, pageSize: 10,
    pageSizeOptions: ['5', '10', '15', '20', '50'],
    showSizeChanger: true,
    showTotal: (total, range) => `${range[0]}–${range[1]} of ${total} employees`,
  });

  useEffect(() => {
    // Phase 1: load stats + KPIs immediately
    api.get('/admin/stats')
      .then(r => setStats(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
    // Phase 2: load overview table after a short delay so main content renders first
    const t = setTimeout(() => {
      api.get('/admin/overview')
        .then(r => setOverview(r.data))
        .catch(() => {})
        .finally(() => setOverviewLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, []);

  const handleTableChange = useCallback((pag: TablePaginationConfig) => {
    setPagination(p => ({ ...p, current: pag.current, pageSize: pag.pageSize }));
  }, []);

  const lockedPct = stats ? Math.round((stats.lockedGoals / (stats.totalGoals || 1)) * 100) : 0;
  const submissionRate = stats?.goalSubmissionRate ?? 0;

  const deptChartData = useMemo(() =>
    (stats?.departmentStats || []).map(d => ({ ...d, label: d.department.split(' ')[0] })),
    [stats]);

  const overviewColumns = [
    {
      title: 'Employee',
      width: 200,
      render: (_: any, r: any) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar
            size={36}
            style={{ background: 'linear-gradient(135deg,#6E473B,#291C0E)', fontWeight: 700, flexShrink: 0, fontSize: 15 }}
          >
            {r.name.charAt(0)}
          </Avatar>
          <div>
            <div style={{ fontWeight: 700, color: '#291C0E', fontSize: 13 }}>{r.name}</div>
            <div style={{ fontSize: 11, color: '#A78D78' }}>{r.department}</div>
          </div>
        </div>
      ),
    },
    {
      title: 'Goals',
      dataIndex: 'totalGoals',
      width: 70,
      sorter: (a: any, b: any) => a.totalGoals - b.totalGoals,
      render: (v: number) => (
        <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 18, color: '#291C0E' }}>{v}</div>
      ),
    },
    {
      title: 'Submitted',
      width: 100,
      render: (_: any, r: any) => (
        <Tag style={{ fontWeight: 600,
          background: r.submitted===r.totalGoals&&r.totalGoals>0?'#EFF4EF':'#F0E8D8',
          color: r.submitted===r.totalGoals&&r.totalGoals>0?'#3A5A3A':'#6E473B',
          border: `1px solid ${r.submitted===r.totalGoals&&r.totalGoals>0?'#B5C8B5':'#C8B490'}` }}>
          {r.submitted}/{r.totalGoals}
        </Tag>
      ),
    },
    {
      title: 'Locked',
      dataIndex: 'locked',
      width: 80,
      sorter: (a: any, b: any) => a.locked - b.locked,
      render: (v: number, r: any) => (
        <Tag icon={v > 0 ? <LockOutlined /> : undefined}
          style={{ fontWeight: 600,
            background: v>0?'#E8E4F0':'#F5F0EA', color: v>0?'#291C0E':'#A78D78',
            border: `1px solid ${v>0?'#BEB5A9':'#E1D4C2'}` }}>
          {v}/{r.totalGoals}
        </Tag>
      ),
    },
    {
      title: 'Check-ins',
      dataIndex: 'checkinsCompleted',
      width: 90,
      sorter: (a: any, b: any) => a.checkinsCompleted - b.checkinsCompleted,
      render: (v: number) => (
        <Tag style={{ fontWeight: 600,
          background: v>0?'#EFF4EF':'#F5F0EA', color: v>0?'#3A5A3A':'#A78D78',
          border: `1px solid ${v>0?'#B5C8B5':'#E1D4C2'}` }}>{v}</Tag>
      ),
    },
    {
      title: 'Avg Progress',
      width: 170,
      dataIndex: 'avgProgress',
      sorter: (a: any, b: any) => a.avgProgress - b.avgProgress,
      render: (v: number) => (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
            <span style={{ fontSize: 11, color: '#A78D78' }}>Progress</span>
            <span style={{ fontSize: 12, fontWeight: 800, color: v >= 70 ? '#5A7A5A' : v >= 50 ? '#7A6040' : '#7A3A30' }}>{v}%</span>
          </div>
          <Progress
            percent={v}
            strokeColor={v >= 70 ? '#5A7A5A' : v >= 50 ? '#7A6040' : '#7A3A30'}
            railColor="#E1D4C2"
            size={7}
            showInfo={false}
          />
        </div>
      ),
    },
    {
      title: 'Status',
      width: 140,
      render: (_: any, r: any) => {
        const allLocked = r.locked === r.totalGoals && r.totalGoals > 0;
        const allSubmitted = r.submitted === r.totalGoals && r.totalGoals > 0;
        const noGoals = r.totalGoals === 0;
        return (
          <Tag
            style={{ fontWeight: 600, borderRadius: 20,
              background: allLocked?'#E8E4F0':allSubmitted?'#EFF4EF':noGoals?'#F5ECEA':'#F0E8D8',
              color: allLocked?'#291C0E':allSubmitted?'#3A5A3A':noGoals?'#7A3A30':'#6E473B',
              border: `1px solid ${allLocked?'#BEB5A9':allSubmitted?'#B5C8B5':noGoals?'#C8A8A0':'#C8B490'}` }}
          >
            {allLocked ? '🔒 All Locked' : allSubmitted ? '✅ All Submitted' : noGoals ? '❌ No Goals' : '⏳ In Progress'}
          </Tag>
        );
      },
    },
    {
      title: '',
      width: 50,
      render: (_: any, r: any) => (
        <Tooltip title="View Goals">
          <Button
            size="small"
            type="text"
            icon={<EyeOutlined />}
            onClick={() => router.push('/admin/goals')}
          />
        </Tooltip>
      ),
    },
  ];

  // Computed risk/health metrics
  const orgHealthScore = stats ? Math.round(
    ((stats.lockedGoals / Math.max(stats.totalGoals, 1)) * 40) +
    ((stats.checkins / Math.max(stats.totalGoals, 1)) * 30) +
    (Math.min(stats.goalSubmissionRate, 100) * 0.3)
  ) : 0;
  const pendingApprovals = stats?.submittedGoals ?? 0;
  const atRiskDepts = (stats?.departmentStats || []).filter(d => d.avgProgress < 50);
  const topDept = stats?.departmentStats?.length ? [...stats.departmentStats].sort((a,b) => b.avgProgress - a.avgProgress)[0] : null;
  const weakDept = stats?.departmentStats?.length ? [...stats.departmentStats].sort((a,b) => a.avgProgress - b.avgProgress)[0] : null;

  return (
    <DashboardLayout role="admin">
      <div className="page-content">

        {/* ENTERPRISE COMMAND CENTER HERO */}
        <div style={{
          background: 'linear-gradient(135deg, #291C0E 0%, #3a2418 45%, #6E473B 100%)',
          borderRadius: 20, padding: '32px 40px', marginBottom: 24,
          boxShadow: '0 8px 40px rgba(41,28,14,0.30)', position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position:'absolute', top:-80, right:-80, width:260, height:260, borderRadius:'50%', background:'rgba(190,181,169,0.08)' }} />
          <div style={{ position:'absolute', bottom:-40, left:200, width:180, height:180, borderRadius:'50%', background:'rgba(167,141,120,0.06)' }} />
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:20, position:'relative' }}>
            <div>
              <div style={{ color:'#BEB5A9', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.14em', marginBottom:8 }}>
                🏗️ Organization Overview
              </div>
              <div style={{ color:'rgba(255,255,255,0.55)', fontSize:13, marginBottom:4 }}>System Administrator,</div>
              <h1 style={{ color:'#fff', fontSize:30, fontWeight:900, margin:'0 0 6px', letterSpacing:'-0.5px' }}>{user?.name}</h1>
              <div style={{ color:'rgba(255,255,255,0.5)', fontSize:13 }}>
                {user?.department} · Full Platform Access · FY 2024-25 · {stats?.totalUsers ?? 0} employees on the platform
              </div>
            </div>
            <div style={{ display:'flex', gap:14, flexWrap:'wrap' }}>
              <div style={{ background:'rgba(225,212,194,0.12)', border:'2px solid rgba(190,181,169,0.4)', borderRadius:16, padding:'16px 24px', textAlign:'center', backdropFilter:'blur(10px)' }}>
                <div style={{ color:'#BEB5A9', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:6 }}>ORG HEALTH</div>
                <div style={{ color: orgHealthScore>=75?'#A0C0A0':orgHealthScore>=50?'#C8A870':'#C07060', fontSize:34, fontWeight:900 }}>{orgHealthScore}%</div>
                <div style={{ color:'rgba(255,255,255,0.5)', fontSize:11, marginTop:2 }}>{orgHealthScore>=75?'✓ On Track':orgHealthScore>=50?'⚠ Needs Attention':'⚠ Action Required'}</div>
              </div>
              <div style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:16, padding:'16px 22px', textAlign:'center' }}>
                <div style={{ color:'#BEB5A9', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:6 }}>LOCKED GOALS</div>
                <div style={{ color:'#E1D4C2', fontSize:34, fontWeight:900 }}>{lockedPct}%</div>
                <div style={{ color:'rgba(255,255,255,0.5)', fontSize:11, marginTop:2 }}>{stats?.lockedGoals ?? 0} total</div>
              </div>
              {pendingApprovals > 0 && (
                <div style={{ background:'rgba(190,140,120,0.15)', border:'1.5px solid rgba(167,100,80,0.5)', borderRadius:16, padding:'16px 22px', textAlign:'center', cursor:'pointer' }}
                  onClick={() => router.push('/admin/goals')}>
                  <div style={{ color:'#BEB5A9', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:6 }}>PENDING</div>
                  <div style={{ color:'#D4A090', fontSize:34, fontWeight:900 }}>{pendingApprovals}</div>
                  <div style={{ color:'rgba(255,255,255,0.5)', fontSize:11, marginTop:2 }}>Review Required ↗</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* COMMAND ALERTS ROW */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))', gap:14, marginBottom:24 }}>
          {topDept && (
            <div onClick={() => router.push('/admin/reports')} style={{
              background:'linear-gradient(135deg,#EFF4EF,#DDE8DD)', border:'1px solid #B5C8B5',
              borderRadius:14, padding:'16px 20px', cursor:'pointer', display:'flex', alignItems:'center', gap:14,
              boxShadow:'0 2px 8px rgba(90,122,90,0.12)',
            }}>
              <div style={{ width:48, height:48, borderRadius:12, background:'#5A7A5A', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0 }}>🏆</div>
              <div>
                <div style={{ fontSize:10, fontWeight:700, color:'#3A5A3A', textTransform:'uppercase', letterSpacing:'0.08em' }}>Top Department</div>
                <div style={{ fontWeight:800, color:'#291C0E', fontSize:15, margin:'3px 0' }}>{topDept.department}</div>
                <div style={{ fontSize:12, color:'#5A7A5A', fontWeight:700 }}>{topDept.avgProgress}% avg · {topDept.goalCount} goals</div>
              </div>
            </div>
          )}
          {weakDept && weakDept.department !== topDept?.department && (
            <div style={{
              background:'linear-gradient(135deg,#F5EDDF,#EDE5D5)', border:'1px solid #C8B490',
              borderRadius:14, padding:'16px 20px', display:'flex', alignItems:'center', gap:14,
              boxShadow:'0 2px 8px rgba(122,96,64,0.12)',
            }}>
              <div style={{ width:48, height:48, borderRadius:12, background:'#7A6040', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0 }}>
                <WarningOutlined style={{ color:'#fff', fontSize:20 }} />
              </div>
              <div>
                <div style={{ fontSize:10, fontWeight:700, color:'#6E473B', textTransform:'uppercase', letterSpacing:'0.08em' }}>⚠ Risk Department</div>
                <div style={{ fontWeight:800, color:'#291C0E', fontSize:15, margin:'3px 0' }}>{weakDept.department}</div>
                <div style={{ fontSize:12, color:'#7A6040', fontWeight:700 }}>{weakDept.avgProgress}% avg — Team needs extra support</div>
              </div>
            </div>
          )}
          {pendingApprovals > 0 && (
            <div onClick={() => router.push('/admin/goals')} style={{
              background:'linear-gradient(135deg,#F5ECEA,#EDE0DD)', border:'1px solid #C8A8A0',
              borderRadius:14, padding:'16px 20px', cursor:'pointer', display:'flex', alignItems:'center', gap:14,
              boxShadow:'0 2px 8px rgba(122,58,48,0.10)',
            }}>
              <div style={{ width:48, height:48, borderRadius:12, background:'#7A3A30', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>
                <ThunderboltOutlined style={{ color:'#fff', fontSize:20 }} />
              </div>
              <div>
                <div style={{ fontSize:10, fontWeight:700, color:'#7A3A30', textTransform:'uppercase', letterSpacing:'0.08em' }}>Approval Bottleneck</div>
                <div style={{ fontWeight:800, color:'#291C0E', fontSize:15, margin:'3px 0' }}>{pendingApprovals} Goals Awaiting Manager Review</div>
                <div style={{ fontSize:12, color:'#7A3A30', fontWeight:700 }}>Click to review → Action needed today</div>
              </div>
            </div>
          )}
          <div onClick={() => router.push('/admin/audit')} style={{
            background:'linear-gradient(135deg,#ECF1F5,#E0E8EF)', border:'1px solid #A8B8C8',
            borderRadius:14, padding:'16px 20px', cursor:'pointer', display:'flex', alignItems:'center', gap:14,
            boxShadow:'0 2px 8px rgba(74,96,112,0.10)',
          }}>
            <div style={{ width:48, height:48, borderRadius:12, background:'#4A6070', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0 }}>
              <SafetyOutlined style={{ color:'#fff', fontSize:20 }} />
            </div>
            <div>
              <div style={{ fontSize:10, fontWeight:700, color:'#3A5060', textTransform:'uppercase', letterSpacing:'0.08em' }}>Compliance Status</div>
              <div style={{ fontWeight:800, color:'#291C0E', fontSize:15, margin:'3px 0' }}>Full Approval &amp; Action History</div>
              <div style={{ fontSize:12, color:'#4A6070', fontWeight:700 }}>View every approval, update, and change →</div>
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 14, marginBottom: 24 }}>
            {[...Array(6)].map((_, i) => (
              <div key={i} className="skeleton-card">
                <div className="skeleton skeleton-text" style={{ width: '60%' }} />
                <div className="skeleton skeleton-num" />
                <div className="skeleton skeleton-text" style={{ width: '80%', marginTop: 8 }} />
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:14, marginBottom:24 }}>
            {KPI_CARDS.map(card => {
              const value = stats ? (stats as any)[card.key] ?? 0 : 0;
              return (
                <div key={card.label} style={{
                  background:`linear-gradient(135deg,${card.bg},#FFFFFF)`,
                  borderRadius:14, padding:'18px 16px', border:'1px solid #E1D4C2',
                  boxShadow:'0 2px 8px rgba(41,28,14,0.06)',
                }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                    <div style={{ flex:1 }}>
                      <div style={{ color:'#A78D78', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em' }}>{card.label}</div>
                      <div style={{ fontSize:30, fontWeight:900, color:card.color, marginTop:6, lineHeight:1.1 }}>{value}</div>
                      <div style={{ fontSize:10, color:'#BEB5A9', marginTop:4 }}>{card.delta}</div>
                    </div>
                    <div style={{ background:card.bg, padding:10, borderRadius:12, fontSize:18, color:card.color, flexShrink:0 }}>{card.icon}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="chart-deferred">

        {/* Charts Row */}
        <Row gutter={[20, 20]} style={{ marginBottom: 24 }}>
          <Col xs={24} lg={14}>
            <div className="chart-card" style={{ height: '100%' }}>
              <div className="chart-card-title">📊 Department Performance Comparison
                <span className="chart-card-subtitle" style={{ marginLeft: 'auto' }}>Average goal progress by department</span>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart
                  data={deptChartData}
                  margin={{ top: 24, right: 16, bottom: 10, left: 0 }}
                  barSize={42}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f5ebe0" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 12, fill: '#8b5e3c', fontWeight: 600 }}
                    axisLine={false} tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#b8956a' }}
                    domain={[0, 100]}
                    axisLine={false} tickLine={false}
                    tickFormatter={v => `${v}%`}
                  />
                  <RTooltip
                    formatter={(v: any, name: string) => [`${v}${name.includes('Progress') ? '%' : ''}`, name]}
                    contentStyle={{ borderRadius: 10, border: '1px solid #e8ddd2', boxShadow: '0 8px 24px rgba(92,61,30,0.12)', fontSize: 13 }}
                    labelStyle={{ color: '#3b2210', fontWeight: 700 }}
                  />
                  <defs>
                    {deptChartData.map((_: any, i: number) => (
                      <linearGradient key={i} id={`deptG${i}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={PALETTE[i % PALETTE.length]} />
                        <stop offset="100%" stopColor={PALETTE[i % PALETTE.length]} stopOpacity={0.5} />
                      </linearGradient>
                    ))}
                  </defs>
                  <Bar dataKey="avgProgress" name="Avg Progress %" radius={[10, 10, 0, 0]} isAnimationActive={true} animationDuration={900}>
                    {deptChartData.map((_: any, i: number) => (
                      <Cell key={i} fill={`url(#deptG${i})`} />
                    ))}
                    <LabelList content={<CustomBarLabel />} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Col>

          <Col xs={24} lg={10}>
            <div className="chart-card" style={{ height: '100%' }}>
              <div className="chart-card-title">🏢 Department Distribution
                <span className="chart-card-subtitle" style={{ marginLeft: 'auto' }}>Goal count by dept</span>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={stats?.departmentStats || []}
                    cx="50%" cy="45%"
                    innerRadius={60} outerRadius={100}
                    paddingAngle={4}
                    dataKey="goalCount"
                    nameKey="department"
                    labelLine={false}
                    label={renderPieLabel}
                  >
                    {(stats?.departmentStats || []).map((_: any, i: number) => (
                      <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                    ))}
                  </Pie>
                  <RTooltip
                    formatter={(v: any, name: string) => [v, name]}
                    contentStyle={{ borderRadius: 10, border: '1px solid #e8ddd2', fontSize: 13 }}
                    labelStyle={{ color: '#3b2210', fontWeight: 700 }}
                  />
                  <Legend
                    iconType="circle" iconSize={9}
                    wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Col>
        </Row>

        {/* Quarterly Check-in Cards */}
        {stats && (
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            {['Q1', 'Q2', 'Q3', 'Q4'].map((q, i) => {
              const checkinCount = Math.round((stats.checkins / 4) * (i === 2 ? 1 : i === 0 ? 0.4 : i === 1 ? 0.8 : 0.1));
              const isActive = q === 'Q3';
              return (
                <Col xs={12} sm={6} key={q}>
                  <div style={{
                    background: isActive ? 'linear-gradient(135deg,#5c3d1e,#8b5e3c)' : 'white',
                    borderRadius: 16,
                    padding: '20px 20px',
                    border: `2px solid ${isActive ? '#8b5e3c' : '#e8ddd2'}`,
                    position: 'relative',
                    overflow: 'hidden',
                    boxShadow: isActive ? '0 8px 24px rgba(92,61,30,0.25)' : '0 2px 8px rgba(92,61,30,0.06)',
                  }}>
                    {isActive && (
                      <div style={{
                        position: 'absolute', top: 10, right: 12,
                        background: '#BEB5A9', color: '#2d1a0a',
                        fontSize: 9, fontWeight: 800, borderRadius: 6, padding: '2px 8px',
                        letterSpacing: '0.05em',
                      }}>ACTIVE</div>
                    )}
                    <div style={{ fontWeight: 800, fontSize: 20, color: isActive ? '#BEB5A9' : '#8b5e3c' }}>{q}</div>
                    <div style={{ fontSize: 34, fontWeight: 900, color: isActive ? 'white' : '#2d1a0a', lineHeight: 1.2, marginTop: 6 }}>
                      {checkinCount}
                    </div>
                    <div style={{ fontSize: 12, color: isActive ? 'rgba(255,255,255,0.65)' : '#92745a', marginTop: 4 }}>check-ins</div>
                    <Progress
                      percent={checkinCount > 0 ? Math.min(100, Math.round((checkinCount / (stats.totalGoals || 1)) * 100)) : 0}
                      showInfo={false}
                      strokeColor={isActive ? '#BEB5A9' : '#8b5e3c'}
                      railColor={isActive ? 'rgba(255,255,255,0.15)' : '#f5ebe0'}
                      size={5}
                      style={{ marginTop: 12 }}
                    />
                  </div>
                </Col>
              );
            })}
          </Row>
        )}

        {/* Employee Overview Table */}
        <Card
          title={<span style={{ fontWeight: 700, fontSize: 15 }}>👥 All Employees — Current Goal Status</span>}
          extra={
            <div style={{ display: 'flex', gap: 10 }}>
              <Button onClick={() => router.push('/admin/unlock')}>🔓 Approved Goals Management</Button>
              <Button onClick={() => router.push('/admin/audit')}>📜 Approval &amp; Action History</Button>
              <Button type="primary" onClick={() => router.push('/admin/goals')}>🎯 All Employee Goals</Button>
            </div>
          }
          style={{ borderRadius: 16 }}
        >
          <Table
            columns={overviewColumns}
            dataSource={overview}
            rowKey="id"
            loading={overviewLoading}
            pagination={{ ...pagination, total: overview.length }}
            onChange={handleTableChange}
            size="middle"
            rowClassName={(_, i) => i % 2 === 0 ? '' : 'table-row-alt'}
          />
        </Card>
        </div>{/* end chart-deferred */}
      </div>
    </DashboardLayout>
  );
}