'use client';
import { useEffect, useState } from 'react';
import { Card, Row, Col, Progress, Tag, Table, Button, Empty, Tooltip, Modal, Timeline } from 'antd';
import { AimOutlined, CheckCircleOutlined, ClockCircleOutlined, LockOutlined, WarningOutlined, TrophyOutlined, RiseOutlined, FileTextOutlined, EyeOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import DashboardLayout from '../../components/DashboardLayout';
import { useStore } from '../../lib/store';
import api from '../../lib/api';
import { Goal, DashboardStats } from '../../lib/types';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartTooltip, Cell, PieChart, Pie } from '../../components/LazyCharts';

const statusConfig: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
  draft: { color: 'default', label: 'Draft', icon: <FileTextOutlined /> },
  submitted: { color: 'warning', label: 'Submitted', icon: <ClockCircleOutlined /> },
  approved: { color: 'success', label: 'Approved', icon: <CheckCircleOutlined /> },
  rejected: { color: 'error', label: 'Rejected', icon: <WarningOutlined /> },
  rework: { color: 'purple', label: 'Rework Required', icon: <WarningOutlined /> },
  locked: { color: 'blue', label: 'Locked', icon: <LockOutlined /> },
};

export default function EmployeeDashboard() {
  const { user } = useStore();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailGoal, setDetailGoal] = useState<Goal | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [statsRes, goalsRes] = await Promise.all([
        api.get('/goals/stats'),
        api.get('/goals'),
      ]);
      setStats(statsRes.data);
      setGoals(goalsRes.data);
    } catch {}
    finally { setLoading(false); }
  };

  const getProgressColor = (score: number) => {
    if (score >= 80) return '#5A7A5A';
    if (score >= 60) return '#7A6040';
    if (score >= 40) return '#8a6a4a';
    return '#7A3A30';
  };

  const getHealthScore = (g: Goal) => {
    const p = g.progressScore;
    const hasCheckins = (g.quarterlyCheckins?.length || 0) > 0;
    const isApproved = g.status === 'approved' || g.isLocked;
    const deadlineRisk = g.deadline ? (new Date(g.deadline) < new Date() ? 0 : 20) : 10;
    return Math.min(100, Math.round((p * 0.5) + (hasCheckins ? 20 : 0) + (isApproved ? 20 : 0) + deadlineRisk));
  };

  const statCards = [
    { label: 'Total Goals', value: stats?.total ?? 0, color: 'brown', icon: <AimOutlined />, bg: '#E1D4C2', fg: '#291C0E' },
    { label: 'Draft', value: stats?.draft ?? 0, color: 'brown', icon: <FileTextOutlined />, bg: '#EDE5DA', fg: '#6E473B' },
    { label: 'Submitted', value: stats?.submitted ?? 0, color: 'brown', icon: <ClockCircleOutlined />, bg: '#E8E0D8', fg: '#4a3020' },
    { label: 'Approved', value: stats?.approved ?? 0, color: 'brown', icon: <CheckCircleOutlined />, bg: '#DDD5C8', fg: '#291C0E' },
    { label: 'Locked', value: stats?.locked ?? 0, color: 'brown', icon: <LockOutlined />, bg: '#E1D4C2', fg: '#6E473B' },
    { label: 'Avg Progress', value: `${stats?.avgProgress ?? 0}%`, color: 'brown', icon: <TrophyOutlined />, bg: '#F0E8D8', fg: '#7A6040' },
  ];

  const radarData = goals.map(g => ({
    thrustArea: g.thrustArea.length > 15 ? g.thrustArea.substring(0, 15) + '...' : g.thrustArea,
    progress: Math.round(g.progressScore),
    target: 100,
  }));

  const barData = goals.map(g => ({
    name: g.goalTitle.length > 20 ? g.goalTitle.substring(0, 20) + '...' : g.goalTitle,
    achievement: Math.round(g.progressScore),
    target: 100,
    weightage: g.weightage,
  }));

  const columns = [
    {
      title: 'Goal', dataIndex: 'goalTitle',
      render: (text: string, r: Goal) => (
        <div>
          <div style={{ fontWeight: 600, color: '#291C0E', fontSize: 13 }}>{text}</div>
          <div style={{ color: '#A78D78', fontSize: 12 }}>{r.thrustArea}</div>
        </div>
      ),
    },
    {
      title: 'UoM', dataIndex: 'uomType',
      render: (v: string) => <Tag style={{ borderRadius: 6 }}>{v.toUpperCase()}</Tag>,
      width: 100,
    },
    {
      title: 'Target vs Achievement', width: 220,
      render: (_: any, r: Goal) => (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
            <span style={{ color: '#A78D78' }}>Target: <strong>{r.target}</strong></span>
            <span style={{ color: '#291C0E' }}>Achieved: <strong>{r.achievement}</strong></span>
          </div>
          <Progress
            percent={Math.round(r.progressScore)}
            strokeColor={getProgressColor(r.progressScore)}
            size={6}
            showInfo={false}
            style={{ margin: 0 }}
          />
          <div style={{ fontSize: 11, color: '#A78D78', textAlign: 'right' }}>{Math.round(r.progressScore)}%</div>
        </div>
      ),
    },
    {
      title: 'Weightage', dataIndex: 'weightage', width: 100,
      render: (v: number) => (
        <div style={{ textAlign: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: 16, color: '#291C0E' }}>{v}%</span>
        </div>
      ),
    },
    {
      title: 'Status', dataIndex: 'status', width: 140,
      render: (status: string, r: Goal) => {
        const s = r.isLocked ? statusConfig['locked'] : statusConfig[status] || statusConfig['draft'];
        return (
          <Tag color={s.color} icon={s.icon} style={{ fontWeight: 600, borderRadius: 20, padding: '3px 10px' }}>
            {r.isLocked ? 'Locked' : s.label}
          </Tag>
        );
      },
    },
  ];

  const weightageTotal = goals.reduce((s, g) => s + g.weightage, 0);
  const weightageOk = Math.abs(weightageTotal - 100) < 0.01;

  return (
    <DashboardLayout role="employee">
      <div className="page-content">
        {/* EXECUTIVE HERO */}
        <div style={{
          background: 'linear-gradient(135deg, #291C0E 0%, #3a2418 40%, #6E473B 100%)',
          borderRadius: 20, padding: '32px 40px', marginBottom: 24,
          boxShadow: '0 8px 32px rgba(41,28,14,0.22)', position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', top: -60, right: -60, width: 220, height: 220, borderRadius: '50%', background: 'rgba(190,181,169,0.08)' }} />
          <div style={{ position: 'absolute', bottom: -40, right: 80, width: 140, height: 140, borderRadius: '50%', background: 'rgba(167,141,120,0.06)' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 20, position: 'relative' }}>
            <div>
              <div style={{ color: '#BEB5A9', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>📊 My Goals &amp; Progress</div>
              <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, marginBottom: 4 }}>Welcome back,</div>
              <h1 style={{ color: '#fff', fontSize: 32, fontWeight: 900, margin: '0 0 6px', letterSpacing: '-0.5px' }}>{user?.name}</h1>
              <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13 }}>{user?.department} · FY 2024-25 Goal Cycle · Q3 Active</div>
            </div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <div style={{
                background: weightageOk ? 'rgba(167,141,120,0.18)' : 'rgba(190,120,100,0.18)',
                border: `2px solid ${weightageOk ? '#A78D78' : '#C08070'}`,
                borderRadius: 16, padding: '16px 28px', textAlign: 'center', backdropFilter: 'blur(10px)',
              }}>
                <div style={{ color: '#BEB5A9', fontSize: 11, fontWeight: 700, marginBottom: 4 }}>WEIGHTAGE</div>
                <div style={{ color: '#fff', fontSize: 36, fontWeight: 900 }}>{weightageTotal}%</div>
                <div style={{ color: weightageOk ? '#C8D8C8' : '#D4A090', fontSize: 12, fontWeight: 700 }}>
                  {weightageOk ? '✓ Perfectly Balanced' : `Need ${100 - weightageTotal}% more`}
                </div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 16, padding: '16px 24px', textAlign: 'center' }}>
                <div style={{ color: '#BEB5A9', fontSize: 11, fontWeight: 700, marginBottom: 4 }}>AVG PROGRESS</div>
                <div style={{ color: '#E1D4C2', fontSize: 36, fontWeight: 900 }}>{stats?.avgProgress ?? 0}%</div>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>across all goals</div>
              </div>
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 14, marginBottom: 24 }}>
            {[...Array(6)].map((_, i) => (
              <div key={i} className="skeleton-card">
                <div className="skeleton skeleton-text" style={{ width: '60%' }} />
                <div className="skeleton skeleton-num" />
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 14, marginBottom: 24 }}>
            {statCards.map((card) => (
              <div key={card.label} style={{
                background: `linear-gradient(135deg, ${card.bg}, #FFFFFF)`,
                borderRadius: 14, padding: '18px 16px', border: '1px solid #E1D4C2',
                boxShadow: '0 2px 8px rgba(41,28,14,0.06)', transition: 'transform 0.2s, box-shadow 0.2s',
                cursor: 'default',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ color: '#A78D78', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{card.label}</div>
                    <div style={{ fontSize: 30, fontWeight: 900, color: card.fg, marginTop: 6 }}>{card.value}</div>
                  </div>
                  <div style={{ background: card.bg, padding: 10, borderRadius: 10, fontSize: 18, color: card.fg }}>{card.icon}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Charts Row — deferred for faster initial render */}
        <div className="chart-deferred">
        {goals.length > 0 && (
          <Row gutter={[20, 20]} style={{ marginBottom: 24 }}>
            <Col xs={24} lg={12}>
              <div className="chart-card" style={{ height: '100%' }}>
                <div className="chart-card-title">📊 My Goal Progress
                  <span className="chart-card-subtitle" style={{ marginLeft: 'auto' }}>How much of each goal you have achieved</span>
                </div>
                <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={barData} margin={{ top: 16, right: 10, bottom: 60, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f5ebe0" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#8b5e3c' }} angle={-35} textAnchor="end" interval={0} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#b8956a' }} domain={[0, 100]} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                    <RechartTooltip
                      formatter={(v: any) => [`${v}%`, 'Progress Score']}
                      contentStyle={{ borderRadius: 10, border: '1px solid #e8ddd2', boxShadow: '0 8px 24px rgba(92,61,30,0.12)', fontSize: 13 }}
                      labelStyle={{ color: '#3b2210', fontWeight: 700 }}
                    />
                    <defs>
                      {barData.map((_: any, i: number) => (
                        <linearGradient key={i} id={`barG${i}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={['#8b5e3c','#6E473c','#3a5f7a','#7a3c5c','#b89a50','#c49a6c'][i % 6]} />
                          <stop offset="100%" stopColor={['#c49a6c','#8ab86c','#6a9fd4','#c96ba0','#e8c870','#e8c8a0'][i % 6]} stopOpacity={0.7} />
                        </linearGradient>
                      ))}
                    </defs>
                    <Bar dataKey="achievement" name="Progress %" radius={[8,8,0,0]} isAnimationActive={true} animationDuration={800}>
                      {barData.map((_: any, i: number) => (
                        <Cell key={i} fill={`url(#barG${i})`} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Col>
            <Col xs={24} lg={12}>
              <div className="chart-card" style={{ height: '100%' }}>
                <div className="chart-card-title">🎯 Performance by Area
                  <span className="chart-card-subtitle" style={{ marginLeft: 'auto' }}>Spread across your goal categories</span>
                </div>
                <ResponsiveContainer width="100%" height={240}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#e8ddd2" />
                    <PolarAngleAxis dataKey="thrustArea" tick={{ fontSize: 11, fill: '#8b5e3c' }} />
                    <Radar name="Progress" dataKey="progress" fill="#8b5e3c" fillOpacity={0.2} stroke="#8b5e3c" strokeWidth={2.5} />
                    <RechartTooltip
                      formatter={(v: any) => [`${v}%`, 'Progress']}
                      contentStyle={{ borderRadius: 10, border: '1px solid #e8ddd2', fontSize: 13 }}
                      labelStyle={{ color: '#3b2210', fontWeight: 700 }}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </Col>
          </Row>
        )}
        </div>{/* end chart-deferred */}

        {/* Goals Table */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E1D4C2', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <div style={{ padding: '18px 24px', borderBottom: '1px solid #F5F0EA', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontWeight: 800, fontSize: 16, color: '#291C0E' }}>📋 My Goal Sheet — FY 2024-25</span>
              <div style={{ fontSize: 12, color: '#A78D78', marginTop: 2 }}>Click 👁 to see full goal details, approval & review history, and quarterly progress</div>
            </div>
            <Button type="primary" icon={<AimOutlined />} onClick={() => router.push('/employee/create-goal')}
              style={{ background: 'linear-gradient(135deg,#291C0E,#6E473B)', border: 'none', borderRadius: 10, fontWeight: 700 }}>+ Add Goal</Button>
          </div>
          {goals.length === 0 ? (
            <div style={{ padding: 48 }}><Empty image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={<div><div style={{ fontWeight: 600, marginBottom: 8 }}>No goals created yet</div>
                <Button type="primary" onClick={() => router.push('/employee/create-goal')}>Create Your First Goal</Button></div>} /></div>
          ) : (
            <Table columns={columns} dataSource={goals} rowKey="id" loading={loading} pagination={false}
              rowClassName={(r) => r.isLocked ? 'ant-table-row-selected' : ''} size="middle"
              summary={() => (
                <Table.Summary fixed>
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0}><strong>Total ({goals.length} goals)</strong></Table.Summary.Cell>
                    <Table.Summary.Cell index={1} /><Table.Summary.Cell index={2} />
                    <Table.Summary.Cell index={3}>
                      <Tag color={weightageOk ? 'success' : 'error'} style={{ fontWeight: 700, fontSize: 13 }}>{weightageTotal}%</Tag>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={4} /><Table.Summary.Cell index={5} />
                  </Table.Summary.Row>
                </Table.Summary>
              )} />
          )}
        </div>

        {/* Goal Detail Modal */}
        <Modal open={!!detailGoal} onCancel={() => setDetailGoal(null)} footer={null} width={680}
          title={<div style={{ fontWeight: 800, color: '#291C0E' }}>🎯 Goal Detail — {detailGoal?.goalTitle}</div>}>
          {detailGoal && (
            <div>
              <div style={{ background: 'linear-gradient(135deg,#eff6ff,#ECF1F5)', borderRadius: 12, padding: 18, marginBottom: 16, border: '1px solid #bfdbfe' }}>
                <div style={{ color: '#A78D78', fontSize: 13, lineHeight: 1.6 }}>{detailGoal.goalDescription}</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
                {[{l:'Target',v:detailGoal.target,c:'#291C0E'},{l:'Achievement',v:detailGoal.achievement,c:'#5A7A5A'},{l:'Weightage',v:`${detailGoal.weightage}%`,c:'#5A4A6A'},{l:'Progress',v:`${Math.round(detailGoal.progressScore)}%`,c:getProgressColor(detailGoal.progressScore)}].map(m=>(
                  <div key={m.l} style={{background:'#FAF7F4',borderRadius:10,padding:'12px',textAlign:'center',border:'1px solid #E1D4C2'}}>
                    <div style={{fontSize:10,color:'#A78D78',fontWeight:700,textTransform:'uppercase'}}>{m.l}</div>
                    <div style={{fontSize:22,fontWeight:900,color:m.c,marginTop:4}}>{m.v}</div>
                  </div>
                ))}
              </div>
              <Progress percent={Math.min(100,Math.round(detailGoal.progressScore))} strokeColor={getProgressColor(detailGoal.progressScore)} size={10} style={{marginBottom:20}} />
              <div style={{fontWeight:700,color:'#291C0E',marginBottom:12}}>📋 Approval &amp; Review History</div>
              {(detailGoal.goalApprovals?.length||0)===0
                ? <div style={{color:'#A78D78',fontSize:13,marginBottom:16}}>No approvals yet.</div>
                : <Timeline items={detailGoal.goalApprovals?.map(a=>({color:a.approvalStatus==='approved'?'green':a.approvalStatus==='rejected'?'red':'orange',children:(<div><strong>{a.approvalStatus}</strong>{a.approvalComments&&<span style={{color:'#A78D78',marginLeft:8}}>— {a.approvalComments}</span>}<div style={{fontSize:11,color:'#A78D78'}}>{new Date(a.approvedAt).toLocaleString()}</div></div>)}))}/>
              }
              <div style={{fontWeight:700,color:'#291C0E',marginBottom:12}}>📅 Quarterly Progress Records</div>
              {(detailGoal.quarterlyCheckins?.length||0)===0
                ? <div style={{color:'#A78D78',fontSize:13}}>No check-ins yet.</div>
                : <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>{detailGoal.quarterlyCheckins?.map(c=>{
                    const col={'completed':'#5A7A5A','on-track':'#7A6040','at-risk':'#7A3A30','not-started':'#A78D78'}[c.progressStatus]||'#A78D78';
                    return <div key={c.id} style={{background:col+'15',border:`1px solid ${col}40`,borderRadius:10,padding:'12px 16px',textAlign:'center'}}>
                      <div style={{fontWeight:900,color:col,fontSize:18}}>{c.quarter}</div>
                      <div style={{fontSize:12,color:'#374151',marginTop:4}}>{c.actualAchievement}</div>
                      <Tag style={{marginTop:4,fontSize:10,color:col,borderColor:col,background:col+'15'}}>{c.progressStatus}</Tag>
                    </div>;
                  })}
                </div>
              }
            </div>
          )}
        </Modal>

      </div>
    </DashboardLayout>
  );
}