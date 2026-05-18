'use client';
import { useEffect, useState } from 'react';
import { Table, Tag, Button, Progress, message } from 'antd';
import { DownloadOutlined, TrophyOutlined, WarningOutlined, RiseOutlined, FallOutlined } from '@ant-design/icons';
import DashboardLayout from '../../../components/DashboardLayout';
import api from '../../../lib/api';
import {
  PieChart, Pie, Cell, Tooltip as RechartTooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
} from '../../../components/LazyCharts';

export default function EmployeeReports() {
  const [report, setReport] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/reports/achievements').then(r => setReport(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  // ── Computed values (must be declared before exportToExcel references them) ──
  const getProgressColor = (s: number) => s >= 80 ? '#5A7A5A' : s >= 60 ? '#7A6040' : '#7A3A30';
  const avgProgress = report.length ? Math.round(report.reduce((s, r) => s + r.progressScore, 0) / report.length) : 0;
  const completed = report.filter(r => r.progressScore >= 80).length;
  const atRisk = report.filter(r => r.progressScore < 40).length;
  const best = report.length ? report.reduce((a, b) => a.progressScore > b.progressScore ? a : b, report[0]) : null;
  const worst = report.length ? report.reduce((a, b) => a.progressScore < b.progressScore ? a : b, report[0]) : null;

  const statusDist = [
    { name: 'On Track (≥80%)', value: report.filter(r => r.progressScore >= 80).length, color: '#5A7A5A' },
    { name: 'Moderate (60-79%)', value: report.filter(r => r.progressScore >= 60 && r.progressScore < 80).length, color: '#7A6040' },
    { name: 'Behind (40-59%)', value: report.filter(r => r.progressScore >= 40 && r.progressScore < 60).length, color: '#7A6040' },
    { name: 'At Risk (<40%)', value: report.filter(r => r.progressScore < 40).length, color: '#7A3A30' },
  ].filter(d => d.value > 0);

  const quarterlyTrend = [
    { quarter: 'Q1', progress: 42 }, { quarter: 'Q2', progress: 58 },
    { quarter: 'Q3', progress: avgProgress }, { quarter: 'Q4', progress: 0 },
  ];

  const radarData = report.map(g => ({
    goal: g.goalTitle.length > 14 ? g.goalTitle.substring(0, 14) + '…' : g.goalTitle,
    progress: Math.round(g.progressScore), weightage: g.weightage,
  }));

  const exportToExcel = async () => {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();
    const today = new Date().toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
    const empName = report[0]?.employeeName ?? 'Employee';
    const dept = report[0]?.department ?? '';
    const locked = report.filter(r=>r.isLocked).length;
    const pending = report.filter(r=>r.status==='submitted'&&!r.isLocked).length;
    const bestGoal = report.length ? [...report].sort((a,b)=>b.progressScore-a.progressScore)[0] : null;
    const weakGoal = report.length ? [...report].sort((a,b)=>a.progressScore-b.progressScore)[0] : null;

    // ── SHEET 1: Personal Performance Summary ──
    const summaryRows: any[][] = [
      ['GoalSync — Personal Performance Report'],
      ['Individual Goal Achievement Summary'],
      ['Employee Name:', empName],
      ['Department:', dept],
      ['Generated On:', today],
      ['Quarter:', 'Q3 FY 2024-25'],
      ['Report Type:', 'Employee Self-Assessment Report'],
      [],
      ['MY PERFORMANCE KPIs'],
      ['Metric', 'Value'],
      ['Total Goals', report.length],
      ['Average Progress', `${avgProgress}%`],
      ['Goals Completed (>=80%)', completed],
      ['Goals Locked (Finalized)', locked],
      ['Goals Pending Review', pending],
      ['Goals At Risk (<40%)', atRisk],
      ['Best Performing Goal', bestGoal ? `${bestGoal.goalTitle} (${Math.round(bestGoal.progressScore)}%)` : 'N/A'],
      ['Needs Attention', weakGoal&&weakGoal.id!==bestGoal?.id ? `${weakGoal.goalTitle} (${Math.round(weakGoal.progressScore)}%)` : 'N/A'],
      [],
      ['PROGRESS BANDS'],
      ['Band', 'Count'],
      ['On Track (>=80%)', report.filter(r=>r.progressScore>=80).length],
      ['Moderate (60-79%)', report.filter(r=>r.progressScore>=60&&r.progressScore<80).length],
      ['Behind (40-59%)', report.filter(r=>r.progressScore>=40&&r.progressScore<60).length],
      ['At Risk (<40%)', report.filter(r=>r.progressScore<40).length],
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(summaryRows);
    ws1['!cols'] = [32,28].map(w=>({wch:w}));
    ws1['!merges'] = [{s:{r:0,c:0},e:{r:0,c:1}},{s:{r:1,c:0},e:{r:1,c:1}}];
    XLSX.utils.book_append_sheet(wb, ws1, '📊 My Summary');

    // ── SHEET 2: Detailed Goals ──
    const detailRows: any[][] = [
      ['GoalSync — Personal Goal Detail Report'],
      [`${empName} | ${dept} | Generated: ${today} | Q3 FY 2024-25`],
      [],
      ['#','Goal Title','Thrust Area','UoM Type','Target','Achievement','Progress %','Weightage %','Status'],
      ...report.map((r,i)=>[
        i+1, r.goalTitle, r.thrustArea, r.uomType.toUpperCase(),
        r.target, r.achievement, Math.round(r.progressScore), r.weightage,
        r.isLocked?'LOCKED':r.status==='approved'?'APPROVED':r.status==='submitted'?'PENDING REVIEW':r.status.toUpperCase(),
      ]),
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(detailRows);
    ws2['!cols'] = [5,32,18,10,10,12,12,12,16].map(w=>({wch:w}));
    ws2['!merges'] = [{s:{r:0,c:0},e:{r:0,c:8}},{s:{r:1,c:0},e:{r:1,c:8}}];
    XLSX.utils.book_append_sheet(wb, ws2, '📋 My Goals Detail');

    XLSX.writeFile(wb, `GoalSync_My_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
    message.success('✅ Personal Performance Report exported — 2 sheets!');
  };



  const columns = [
    { title: 'Goal', dataIndex: 'goalTitle', render: (v: string, r: any) => (
      <div>
        <div style={{ fontWeight: 700, color: '#291C0E', fontSize: 13 }}>{v}</div>
        <Tag style={{ fontSize: 10, marginTop: 2 }}>{r.thrustArea}</Tag>
      </div>
    )},
    { title: 'UoM', dataIndex: 'uomType', width: 80, render: (v: string) => <Tag color="geekblue" style={{ fontSize: 11 }}>{v.toUpperCase()}</Tag> },
    { title: 'Target', dataIndex: 'target', width: 70 },
    { title: 'Achievement', dataIndex: 'achievement', width: 100, render: (v: number) => <strong style={{ color: '#5A7A5A' }}>{v}</strong> },
    { title: 'Progress', dataIndex: 'progressScore', width: 180, render: (v: number) => (
      <div>
        <Progress percent={Math.round(v)} strokeColor={getProgressColor(v)} size={6} showInfo={false} />
        <span style={{ fontSize: 12, fontWeight: 700, color: getProgressColor(v) }}>{Math.round(v)}%</span>
      </div>
    )},
    { title: 'Weight', dataIndex: 'weightage', width: 70, render: (v: number) => <strong>{v}%</strong> },
    { title: 'Status', width: 110, render: (_: any, r: any) => (
      <Tag color={r.isLocked ? 'blue' : r.status === 'approved' ? 'success' : 'default'} style={{ fontWeight: 600 }}>
        {r.isLocked ? '🔒 Locked' : r.status}
      </Tag>
    )},
  ];

  return (
    <DashboardLayout role="employee">
      <div className="page-content">

        {/* ANALYTICS HERO */}
        <div style={{
          background: 'linear-gradient(135deg, #291C0E 0%, #291C0E 50%, #291C0E 100%)',
          borderRadius: 20, padding: '32px 40px', marginBottom: 24,
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 20 }}>
            <div>
              <div style={{ color: '#A78D78', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>
                📊 Executive Analytics Report
              </div>
              <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 900, margin: '0 0 8px', letterSpacing: '-0.5px' }}>
                Performance Intelligence
              </h1>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>FY 2024-25 · Goal Achievement Summary · Real-time data</div>
            </div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {[
                { label: 'Avg Progress', value: `${avgProgress}%`, color: '#A78D78' },
                { label: 'Completed', value: `${completed}/${report.length}`, color: '#5A7A5A' },
                { label: 'At Risk', value: atRisk, color: '#C07060' },
              ].map(kpi => (
                <div key={kpi.label} style={{
                  background: 'rgba(255,255,255,0.08)', borderRadius: 14, padding: '16px 24px', textAlign: 'center',
                  border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(10px)',
                }}>
                  <div style={{ color: kpi.color, fontSize: 28, fontWeight: 900 }}>{kpi.value}</div>
                  <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 600, marginTop: 2 }}>{kpi.label}</div>
                </div>
              ))}
              <Button type="primary" icon={<DownloadOutlined />} onClick={exportToExcel}
                style={{ alignSelf: 'center', background: '#0284c7', border: 'none', borderRadius: 10, fontWeight: 700, height: 44, padding: '0 24px' }}>
                Export Excel
              </Button>
            </div>
          </div>
        </div>

        {/* Best / Worst Goal */}
        {report.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
            {best && (
              <div style={{
                background: 'linear-gradient(135deg, #EFF4EF, #EFF4EF)', border: '1px solid #B5C8B5',
                borderRadius: 16, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16,
              }}>
                <div style={{ width: 52, height: 52, borderRadius: 14, background: '#5A7A5A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
                  <TrophyOutlined style={{ color: '#fff' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#5A7A5A', textTransform: 'uppercase', letterSpacing: '0.08em' }}>🏆 Best Performing Goal</div>
                  <div style={{ fontWeight: 800, color: '#291C0E', fontSize: 15, margin: '4px 0' }}>{best.goalTitle}</div>
                  <div style={{ fontSize: 13, color: '#5A7A5A', fontWeight: 700 }}>{Math.round(best.progressScore)}% Progress</div>
                </div>
              </div>
            )}
            {worst && worst.id !== best?.id && (
              <div style={{
                background: 'linear-gradient(135deg, #F5EDDF, #F0E8D8)', border: '1px solid #C8B490',
                borderRadius: 16, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16,
              }}>
                <div style={{ width: 52, height: 52, borderRadius: 14, background: '#7A6040', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
                  <WarningOutlined style={{ color: '#fff' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#6E473B', textTransform: 'uppercase', letterSpacing: '0.08em' }}>⚠️ Needs Attention</div>
                  <div style={{ fontWeight: 800, color: '#291C0E', fontSize: 15, margin: '4px 0' }}>{worst.goalTitle}</div>
                  <div style={{ fontSize: 13, color: '#7A6040', fontWeight: 700 }}>{Math.round(worst.progressScore)}% Progress</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Charts Row */}
        {report.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, marginBottom: 24 }}>

            {/* Completion Donut */}
            <div style={{ background: '#fff', borderRadius: 16, padding: '20px', border: '1px solid #E1D4C2', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <div style={{ fontWeight: 700, color: '#291C0E', fontSize: 14, marginBottom: 4 }}>🍩 Completion Distribution</div>
              <div style={{ color: '#A78D78', fontSize: 11, marginBottom: 12 }}>Goals by progress band</div>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={statusDist} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3} dataKey="value">
                    {statusDist.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <RechartTooltip formatter={(v: any, n: any) => [v + ' goals', n]} contentStyle={{ borderRadius: 10, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
                {statusDist.map(d => (
                  <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#A78D78' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: d.color }} />
                    {d.name}
                  </div>
                ))}
              </div>
            </div>

            {/* Quarterly Trend */}
            <div style={{ background: '#fff', borderRadius: 16, padding: '20px', border: '1px solid #E1D4C2', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <div style={{ fontWeight: 700, color: '#291C0E', fontSize: 14, marginBottom: 4 }}>📈 Quarterly Trend</div>
              <div style={{ color: '#A78D78', fontSize: 11, marginBottom: 12 }}>Progress over FY quarters</div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={quarterlyTrend} margin={{ top: 4, right: 8, bottom: 4, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F5F0EA" vertical={false} />
                  <XAxis dataKey="quarter" tick={{ fontSize: 11, fill: '#A78D78' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} tickFormatter={v => `${v}%`} axisLine={false} tickLine={false} />
                  <RechartTooltip formatter={(v: any) => [`${v}%`, 'Progress']} contentStyle={{ borderRadius: 10, fontSize: 12 }} />
                  <Bar dataKey="progress" fill="#0284c7" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Radar */}
            <div style={{ background: '#fff', borderRadius: 16, padding: '20px', border: '1px solid #E1D4C2', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <div style={{ fontWeight: 700, color: '#291C0E', fontSize: 14, marginBottom: 4 }}>🎯 Goal Radar</div>
              <div style={{ color: '#A78D78', fontSize: 11, marginBottom: 12 }}>Performance per goal</div>
              <ResponsiveContainer width="100%" height={180}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#E1D4C2" />
                  <PolarAngleAxis dataKey="goal" tick={{ fontSize: 9, fill: '#A78D78' }} />
                  <Radar name="Progress" dataKey="progress" fill="#0284c7" fillOpacity={0.25} stroke="#0284c7" strokeWidth={2} />
                  <RechartTooltip formatter={(v: any) => [`${v}%`, 'Progress']} contentStyle={{ borderRadius: 10, fontSize: 12 }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Completion Ratio Bar */}
        {report.length > 0 && (
          <div style={{
            background: 'linear-gradient(135deg, #291C0E, #291C0E)', borderRadius: 16, padding: '20px 28px',
            marginBottom: 24, display: 'flex', alignItems: 'center', gap: 24,
          }}>
            <div style={{ color: '#A78D78', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>COMPLETION RATIO</div>
            <div style={{ flex: 1 }}>
              <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 100, overflow: 'hidden', height: 14 }}>
                <div style={{
                  height: '100%', borderRadius: 100,
                  background: `linear-gradient(90deg, #5A7A5A, #A78D78)`,
                  width: `${Math.round((completed / Math.max(report.length, 1)) * 100)}%`,
                  transition: 'width 1s ease',
                }} />
              </div>
            </div>
            <div style={{ color: '#fff', fontWeight: 900, fontSize: 22, whiteSpace: 'nowrap' }}>
              {completed}/{report.length} goals
            </div>
            <div style={{ color: '#A78D78', fontWeight: 700, fontSize: 16 }}>
              {Math.round((completed / Math.max(report.length, 1)) * 100)}%
            </div>
          </div>
        )}

        {/* Data Table */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E1D4C2', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #F5F0EA', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 800, color: '#291C0E', fontSize: 16 }}>📋 Goal Achievement Summary</div>
              <div style={{ color: '#A78D78', fontSize: 12, marginTop: 2 }}>Detailed breakdown of all goals for FY 2024-25</div>
            </div>
          </div>
          <Table columns={columns} dataSource={report} rowKey="id" loading={loading} pagination={false} size="middle" />
        </div>

      </div>
    </DashboardLayout>
  );
}
