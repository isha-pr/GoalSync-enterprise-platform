'use client';
import { useEffect, useState } from 'react';
import { Card, Row, Col, Progress, Tag, Table, Avatar, Button, Badge, Tooltip, Modal, Timeline, Divider } from 'antd';
import { TeamOutlined, CheckCircleOutlined, ClockCircleOutlined, TrophyOutlined, AimOutlined, WarningOutlined, ThunderboltOutlined, FireOutlined, EyeOutlined, ArrowRightOutlined } from '@ant-design/icons';
import DashboardLayout from '../../components/DashboardLayout';
import { useStore } from '../../lib/store';
import api from '../../lib/api';
import { TeamMember, ManagerStats } from '../../lib/types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, RadarChart, Radar, PolarGrid, PolarAngleAxis } from '../../components/LazyCharts';
import { useRouter } from 'next/navigation';

const COLORS = ['#6E473B', '#A78D78', '#BEB5A9', '#4a3020', '#8a6a5a', '#291C0E'];

export default function ManagerDashboard() {
  const { user } = useStore();
  const router = useRouter();
  const [stats, setStats] = useState<ManagerStats | null>(null);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [memberModal, setMemberModal] = useState<TeamMember | null>(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [statsRes, teamRes] = await Promise.all([api.get('/manager/stats'), api.get('/manager/team')]);
      setStats(statsRes.data); setTeam(teamRes.data);
    } catch {}
    finally { setLoading(false); }
  };

  const allGoals = team.flatMap(m => m.goals);
  const pendingGoals = allGoals.filter(g => g.status === 'submitted');
  const atRiskMembers = team.filter(m => {
    const avg = m.goals.length ? m.goals.reduce((s, g) => s + g.progressScore, 0) / m.goals.length : 0;
    return avg < 50 && m.goals.length > 0;
  });
  const missingGoals = team.filter(m => m.goals.length === 0);
  const topPerformer = team.length ? team.reduce((best, m) => {
    const avg = m.goals.length ? m.goals.reduce((s, g) => s + g.progressScore, 0) / m.goals.length : 0;
    const bestAvg = best.goals.length ? best.goals.reduce((s, g) => s + g.progressScore, 0) / best.goals.length : 0;
    return avg > bestAvg ? m : best;
  }, team[0]) : null;

  const statCards = [
    { label: 'Team Size', value: stats?.teamSize ?? 0, icon: <TeamOutlined />, color: '#291C0E', bg: '#E1D4C2' },
    { label: 'Total Goals', value: stats?.totalGoals ?? 0, icon: <AimOutlined />, color: '#6E473B', bg: '#EDE5DA' },
    { label: 'Pending Review', value: stats?.pendingReview ?? 0, icon: <ClockCircleOutlined />, color: '#7A6040', bg: '#F0E8D8' },
    { label: 'Approved', value: stats?.approved ?? 0, icon: <CheckCircleOutlined />, color: '#4a3020', bg: '#DDD5C8' },
    { label: 'Avg Progress', value: `${stats?.avgProgress ?? 0}%`, icon: <TrophyOutlined />, color: '#6E473B', bg: '#E1D4C2' },
  ];

  const teamChartData = team.map(m => ({
    name: m.name.split(' ')[0],
    progress: m.goals.length ? Math.round(m.goals.reduce((s, g) => s + g.progressScore, 0) / m.goals.length) : 0,
    approved: m.goals.filter(g => g.isLocked || g.status === 'approved').length,
    pending: m.goals.filter(g => g.status === 'submitted').length,
  }));

  const statusPieData = [
    { name: 'Approved/Locked', value: allGoals.filter(g => g.isLocked || g.status === 'approved').length },
    { name: 'Submitted', value: allGoals.filter(g => g.status === 'submitted').length },
    { name: 'Draft', value: allGoals.filter(g => g.status === 'draft').length },
    { name: 'Rework', value: allGoals.filter(g => g.status === 'rework').length },
  ].filter(d => d.value > 0);

  const radarData = team.map(m => ({
    member: m.name.split(' ')[0],
    progress: m.goals.length ? Math.round(m.goals.reduce((s, g) => s + g.progressScore, 0) / m.goals.length) : 0,
  }));

  const teamColumns = [
    {
      title: 'Team Member', render: (_: any, r: TeamMember) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar size={40} style={{ background: `hsl(${r.name.charCodeAt(0) * 13 % 360},60%,50%)`, fontWeight: 700, fontSize: 16 }}>
            {r.name.charAt(0)}
          </Avatar>
          <div>
            <div style={{ fontWeight: 700, color: '#291C0E', fontSize: 14 }}>{r.name}</div>
            <div style={{ fontSize: 11, color: '#A78D78' }}>{r.department}</div>
          </div>
        </div>
      ),
    },
    { title: 'Goals', width: 70, render: (_: any, r: TeamMember) => <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 18, color: '#291C0E' }}>{r.goals.length}</div> },
    {
      title: 'Avg Progress', width: 200, render: (_: any, r: TeamMember) => {
        const avg = r.goals.length ? Math.round(r.goals.reduce((s, g) => s + g.progressScore, 0) / r.goals.length) : 0;
        const col = avg >= 70 ? '#5A7A5A' : avg >= 50 ? '#7A6040' : '#7A3A30';
        return (
          <div>
            <Progress percent={avg} strokeColor={col} size={8} showInfo={false} />
            <span style={{ fontSize: 12, color: col, fontWeight: 700 }}>{avg}%</span>
          </div>
        );
      },
    },
    {
      title: 'Pending', width: 100, render: (_: any, r: TeamMember) => {
        const p = r.goals.filter(g => g.status === 'submitted').length;
        return p > 0 ? <Badge count={p} style={{ backgroundColor: '#7A6040' }}><Tag color="default" style={{ fontWeight: 700 }}>{p} pending</Tag></Badge>
          : <Tag color="default">✓ Clear</Tag>;
      },
    },
    {
      title: 'Action', width: 130, render: (_: any, r: TeamMember) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <Tooltip title="View member profile"><Button size="small" icon={<EyeOutlined />} onClick={() => setMemberModal(r)} /></Tooltip>
          <Button size="small" type="primary" icon={<ArrowRightOutlined />} onClick={() => router.push('/manager/approvals')} style={{ fontSize: 12 }}>Review</Button>
        </div>
      ),
    },
  ];

  return (
    <DashboardLayout role="manager">
      <div className="page-content">

        {/* EXECUTIVE COMMAND HERO */}
        <div style={{
          background: 'linear-gradient(135deg, #291C0E 0%, #3a2418 45%, #6E473B 100%)',
          borderRadius: 20, padding: '32px 40px', marginBottom: 24,
          boxShadow: '0 8px 32px rgba(41,28,14,0.28)', position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', top: -80, right: -80, width: 280, height: 280, borderRadius: '50%', background: 'rgba(190,181,169,0.08)' }} />
          <div style={{ position: 'absolute', bottom: -40, right: 120, width: 160, height: 160, borderRadius: '50%', background: 'rgba(167,141,120,0.06)' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 20, position: 'relative' }}>
            <div>
              <div style={{ color: '#BEB5A9', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>
                📊 Team Performance Overview
              </div>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginBottom: 4 }}>Team Lead,</div>
              <h1 style={{ color: '#fff', fontSize: 30, fontWeight: 900, margin: '0 0 6px', letterSpacing: '-0.5px' }}>{user?.name}</h1>
              <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13 }}>
                {user?.department} · Team Manager · {stats?.teamSize ?? 0} Direct Reports · FY 2024-25
              </div>
            </div>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              {[
                { label: 'Goals Pending Your Review', value: stats?.pendingReview ?? 0, color: '#E1D4C2', urgent: (stats?.pendingReview ?? 0) > 0 },
                { label: 'Members Falling Behind', value: atRiskMembers.length, color: '#D4A090', urgent: atRiskMembers.length > 0 },
                { label: 'Team Progress', value: `${stats?.avgProgress ?? 0}%`, color: '#A0C0A0', urgent: false },
              ].map(kpi => (
                <div key={kpi.label} style={{
                  background: kpi.urgent ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.07)',
                  border: kpi.urgent ? '1.5px solid rgba(239,68,68,0.5)' : '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 14, padding: '14px 22px', textAlign: 'center', backdropFilter: 'blur(10px)',
                  animation: kpi.urgent && kpi.value !== 0 ? 'pulse 2s infinite' : 'none',
                }}>
                  <div style={{ color: kpi.color, fontWeight: 900, fontSize: 28 }}>{kpi.value}</div>
                  <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 600, marginTop: 2 }}>{kpi.label}</div>
                </div>
              ))}
              {(stats?.pendingReview ?? 0) > 0 && (
                <Button onClick={() => router.push('/manager/approvals')} icon={<ThunderboltOutlined />}
                  style={{ alignSelf: 'center', background: '#6E473B', border: 'none', borderRadius: 10, color: '#fff', fontWeight: 700, height: 44, padding: '0 20px' }}>
                  Review Now
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* COMMAND CENTER ALERTS */}
        {(pendingGoals.length > 0 || atRiskMembers.length > 0 || missingGoals.length > 0) && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14, marginBottom: 24 }}>
            {pendingGoals.length > 0 && (
              <div onClick={() => router.push('/manager/approvals')} style={{
                background: 'linear-gradient(135deg,#F5EDDF,#EDE5D5)', border: '1px solid #C8B490',
                borderRadius: 14, padding: '16px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14,
                transition: 'transform 0.2s', boxShadow: '0 2px 8px rgba(122,96,64,0.12)',
              }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: '#7A6040', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>⏳</div>
                <div>
                  <div style={{ fontWeight: 800, color: '#291C0E', fontSize: 15 }}>{pendingGoals.length} Goals Waiting for Your Approval</div>
                  <div style={{ fontSize: 12, color: '#6E473B', marginTop: 2 }}>Tap to review and approve or send back for rework →</div>
                </div>
              </div>
            )}
            {atRiskMembers.length > 0 && (
              <div style={{
                background: 'linear-gradient(135deg,#F5ECEA,#EDE0DD)', border: '1px solid #C8A8A0',
                borderRadius: 14, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14,
                boxShadow: '0 2px 8px rgba(122,58,48,0.10)',
              }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: '#7A3A30', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                  <WarningOutlined style={{ color: '#fff', fontSize: 20 }} />
                </div>
                <div>
                  <div style={{ fontWeight: 800, color: '#291C0E', fontSize: 15 }}>{atRiskMembers.length} Team Members Falling Behind</div>
                  <div style={{ fontSize: 12, color: '#6E473B', marginTop: 2 }}>Below 50% progress — {atRiskMembers.map(m => m.name.split(' ')[0]).join(', ')}</div>
                </div>
              </div>
            )}
            {topPerformer && (
              <div style={{
                background: 'linear-gradient(135deg,#EFF4EF,#DDE8DD)', border: '1px solid #B5C8B5',
                borderRadius: 14, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14,
                boxShadow: '0 2px 8px rgba(90,122,90,0.10)',
              }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: '#5A7A5A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>🏆</div>
                <div>
                  <div style={{ fontWeight: 800, color: '#291C0E', fontSize: 15 }}>Top Performer</div>
                  <div style={{ fontSize: 12, color: '#6E473B', marginTop: 2, fontWeight: 600 }}>
                    {topPerformer.name} · {Math.round(topPerformer.goals.reduce((s, g) => s + g.progressScore, 0) / Math.max(topPerformer.goals.length, 1))}% avg
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* KPI Cards */}
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 14, marginBottom: 24 }}>
            {[...Array(5)].map((_, i) => (
              <div key={i} className="skeleton-card">
                <div className="skeleton skeleton-text" style={{ width: '60%' }} />
                <div className="skeleton skeleton-num" />
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 14, marginBottom: 24 }}>
            {statCards.map(card => (
              <div key={card.label} style={{
                background: `linear-gradient(135deg,${card.bg},#FFFFFF)`, borderRadius: 14, padding: '18px 16px',
                border: '1px solid #E1D4C2', boxShadow: '0 2px 8px rgba(41,28,14,0.06)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ color: '#A78D78', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{card.label}</div>
                    <div style={{ fontSize: 30, fontWeight: 900, color: card.color, marginTop: 6 }}>{card.value}</div>
                  </div>
                  <div style={{ background: card.bg, padding: 10, borderRadius: 10, fontSize: 18, color: card.color }}>{card.icon}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Charts Row — deferred */}
        <div className="chart-deferred">
        <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr 2fr', gap: 20, marginBottom: 24 }}>
          {/* Bar */}
          <div style={{ background: '#fff', borderRadius: 16, padding: '20px', border: '1px solid #E1D4C2', boxShadow: '0 2px 8px rgba(41,28,14,0.05)' }}>
            <div style={{ fontWeight: 700, color: '#291C0E', fontSize: 14, marginBottom: 4 }}>📊 Individual Progress Comparison</div>
            <div style={{ color: '#A78D78', fontSize: 11, marginBottom: 16 }}>How each team member is tracking against their goals</div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={teamChartData} margin={{ top: 4, right: 8, bottom: 4, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F5F0EA" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#A78D78' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} tickFormatter={v => `${v}%`} axisLine={false} tickLine={false} />
                <RechartTooltip contentStyle={{ borderRadius: 10, fontSize: 12, border: '1px solid #E1D4C2' }} />
                <Bar dataKey="progress" name="Progress %" fill="#6E473B" radius={[6, 6, 0, 0]} />
                <Bar dataKey="pending" name="Pending" fill="#A78D78" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {/* Pie */}
          <div style={{ background: '#fff', borderRadius: 16, padding: '20px', border: '1px solid #E1D4C2', boxShadow: '0 2px 8px rgba(41,28,14,0.05)' }}>
            <div style={{ fontWeight: 700, color: '#291C0E', fontSize: 14, marginBottom: 4 }}>🍩 Goal Status Breakdown</div>
            <div style={{ color: '#A78D78', fontSize: 11, marginBottom: 8 }}>Where your team's goals currently stand</div>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={statusPieData} cx="50%" cy="45%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value">
                  {statusPieData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                </Pie>
                <RechartTooltip contentStyle={{ borderRadius: 10, fontSize: 12, border: '1px solid #E1D4C2' }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          {/* Radar */}
          <div style={{ background: '#fff', borderRadius: 16, padding: '20px', border: '1px solid #E1D4C2', boxShadow: '0 2px 8px rgba(41,28,14,0.05)' }}>
            <div style={{ fontWeight: 700, color: '#291C0E', fontSize: 14, marginBottom: 4 }}>🎯 Team Coverage Radar</div>
            <div style={{ color: '#A78D78', fontSize: 11, marginBottom: 8 }}>Overall progress spread across team</div>
            <ResponsiveContainer width="100%" height={200}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#E1D4C2" />
                <PolarAngleAxis dataKey="member" tick={{ fontSize: 10, fill: '#A78D78' }} />
                <Radar name="Progress" dataKey="progress" fill="#6E473B" fillOpacity={0.20} stroke="#6E473B" strokeWidth={2} />
                <RechartTooltip contentStyle={{ borderRadius: 10, fontSize: 12, border: '1px solid #E1D4C2' }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
        </div>{/* end chart-deferred */}

        {/* Team Table */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E1D4C2', overflow: 'hidden', boxShadow: '0 2px 8px rgba(41,28,14,0.05)' }}>
          <div style={{ padding: '18px 24px', borderBottom: '1px solid #F5F0EA', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontWeight: 800, fontSize: 16, color: '#291C0E' }}>👥 Your Team Members</span>
              <div style={{ fontSize: 12, color: '#A78D78', marginTop: 2 }}>Click 👁 to see a full breakdown of each member's goals and check-ins · FY 2024-25</div>
            </div>
            <Button type="primary" onClick={() => router.push('/manager/approvals')}
              style={{ background: 'linear-gradient(135deg,#291C0E,#6E473B)', border: 'none', borderRadius: 10, fontWeight: 700 }}>
              Pending Approvals ({stats?.pendingReview ?? 0})
            </Button>
          </div>
          <Table columns={teamColumns} dataSource={team} rowKey="id" loading={loading} pagination={false} size="middle" />
        </div>

        {/* Team Member Deep View Modal */}
        <Modal open={!!memberModal} onCancel={() => setMemberModal(null)} footer={null} width={700}
          title={<div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Avatar size={40} style={{ background: '#6E473B', fontWeight: 700, fontSize: 18 }}>{memberModal?.name.charAt(0)}</Avatar>
            <div>
              <div style={{ fontWeight: 800, color: '#291C0E' }}>{memberModal?.name}</div>
              <div style={{ fontSize: 12, color: '#A78D78' }}>{memberModal?.department} · Goal &amp; Progress Summary</div>
            </div>
          </div>}>
          {memberModal && (() => {
            const goals = memberModal.goals;
            const avg = goals.length ? Math.round(goals.reduce((s, g) => s + g.progressScore, 0) / goals.length) : 0;
            const approved = goals.filter(g => g.isLocked || g.status === 'approved').length;
            const pending = goals.filter(g => g.status === 'submitted').length;
            const allCheckins = goals.flatMap(g => g.quarterlyCheckins || []);
            return (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
                  {[{ l: 'Total Goals', v: goals.length, c: '#6E473B' }, { l: 'Approved', v: approved, c: '#5A7A5A' }, { l: 'Pending', v: pending, c: '#7A6040' }, { l: 'Avg Progress', v: `${avg}%`, c: avg >= 70 ? '#5A7A5A' : avg >= 50 ? '#7A6040' : '#7A3A30' }].map(m => (
                    <div key={m.l} style={{ background: '#FAF7F4', borderRadius: 10, padding: 14, textAlign: 'center', border: '1px solid #E1D4C2' }}>
                      <div style={{ fontSize: 10, color: '#A78D78', fontWeight: 700, textTransform: 'uppercase' }}>{m.l}</div>
                      <div style={{ fontSize: 24, fontWeight: 900, color: m.c, marginTop: 4 }}>{m.v}</div>
                    </div>
                  ))}
                </div>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                    <span style={{ fontWeight: 600 }}>Overall Performance</span>
                    <span style={{ fontWeight: 700, color: avg >= 70 ? '#5A7A5A' : avg >= 50 ? '#7A6040' : '#7A3A30' }}>{avg}%</span>
                  </div>
                  <Progress percent={avg} strokeColor={avg >= 70 ? '#5A7A5A' : avg >= 50 ? '#7A6040' : '#7A3A30'} size={10} showInfo={false} />
                </div>
                <Divider style={{ margin: '16px 0' }} />
                <div style={{ fontWeight: 700, color: '#291C0E', marginBottom: 12 }}>📋 All Goals This Cycle</div>
                {goals.length === 0 ? <div style={{ color: '#A78D78', fontSize: 13 }}>No goals assigned yet.</div> : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {goals.map(g => (
                      <div key={g.id} style={{ background: '#FAF7F4', borderRadius: 10, padding: '12px 16px', border: '1px solid #E1D4C2' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <div style={{ fontWeight: 700, color: '#291C0E', fontSize: 13 }}>{g.goalTitle}</div>
                          <Tag color={g.isLocked ? 'blue' : g.status === 'approved' ? 'success' : g.status === 'submitted' ? 'warning' : 'default'} style={{ fontSize: 11, fontWeight: 600 }}>
                            {g.isLocked ? '🔒 Locked' : g.status}
                          </Tag>
                        </div>
                        <Progress percent={Math.min(100, Math.round(g.progressScore))} strokeColor={g.progressScore >= 70 ? '#5A7A5A' : '#7A6040'} size={6} showInfo={false} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#A78D78', marginTop: 4 }}>
                          <span>Target: {g.target} · Done: {g.achievement}</span>
                          <span style={{ fontWeight: 700 }}>{Math.round(g.progressScore)}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {allCheckins.length > 0 && (
                  <>
                    <Divider style={{ margin: '16px 0' }} />
                    <div style={{ fontWeight: 700, color: '#291C0E', marginBottom: 12 }}>📅 Quarterly Review History</div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      {allCheckins.map(c => {
                        const col = { completed: '#5A7A5A', 'on-track': '#7A6040', 'at-risk': '#7A3A30', 'not-started': '#A78D78' }[c.progressStatus] || '#A78D78';
                        return (
                          <div key={c.id} style={{ background: col + '15', border: `1px solid ${col}40`, borderRadius: 10, padding: '10px 14px', textAlign: 'center' }}>
                            <div style={{ fontWeight: 900, color: col, fontSize: 16 }}>{c.quarter}</div>
                            <div style={{ fontSize: 12, color: '#374151' }}>{c.actualAchievement}</div>
                            <div style={{ fontSize: 10, color: col, marginTop: 2 }}>{c.progressStatus}</div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            );
          })()}
        </Modal>

      </div>
    </DashboardLayout>
  );
}
