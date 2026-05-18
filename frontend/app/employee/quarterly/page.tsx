'use client';
import { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Select, InputNumber, message, Tag, Progress, Alert, Empty } from 'antd';
import { PlusOutlined, CheckCircleOutlined, ClockCircleOutlined, WarningOutlined, FireOutlined } from '@ant-design/icons';
import DashboardLayout from '../../../components/DashboardLayout';
import api from '../../../lib/api';
import { Goal, QuarterlyCheckin } from '../../../lib/types';

const { Option } = Select;
const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];
const QUARTER_DATES: Record<string, string> = {
  Q1: 'Apr – Jun 2024', Q2: 'Jul – Sep 2024', Q3: 'Oct – Dec 2024', Q4: 'Jan – Mar 2025',
};
const CURRENT_QUARTER = 'Q3';

const statusColors: Record<string, string> = {
  'not-started': '#A78D78', 'on-track': '#7A6040', 'completed': '#5A7A5A', 'at-risk': '#7A3A30',
};

export default function QuarterlyPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkinGoal, setCheckinGoal] = useState<Goal | null>(null);
  const [form] = Form.useForm();

  useEffect(() => { fetchGoals(); }, []);

  const fetchGoals = async () => {
    setLoading(true);
    try {
      const res = await api.get('/goals');
      setGoals(res.data.filter((g: Goal) => g.isLocked || g.status === 'approved'));
    } catch {}
    finally { setLoading(false); }
  };

  const handleCheckin = async (values: any) => {
    if (!checkinGoal) return;
    try {
      await api.post(`/goals/${checkinGoal.id}/checkin`, values);
      message.success(`${values.quarter} check-in submitted!`);
      setCheckinGoal(null); form.resetFields(); fetchGoals();
    } catch (err: any) { message.error(err.response?.data?.error || 'Check-in failed'); }
  };

  const allCheckins = goals.flatMap(g => g.quarterlyCheckins || []);
  const atRiskGoals = goals.filter(g => {
    const q3 = (g.quarterlyCheckins || []).find(c => c.quarter === CURRENT_QUARTER);
    return q3?.progressStatus === 'at-risk' || (!q3 && g.progressScore < 40);
  });
  const overdueGoals = goals.filter(g =>
    g.deadline && new Date(g.deadline) < new Date() && g.progressScore < 100
  );

  const columns = [
    {
      title: 'Goal', render: (_: any, r: Goal) => (
        <div>
          <div style={{ fontWeight: 700, color: '#291C0E', fontSize: 14 }}>{r.goalTitle}</div>
          <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
            <Tag style={{ fontSize: 10 }}>{r.thrustArea}</Tag>
            <Tag color="default" style={{ fontSize: 10 }}>{r.uomType}</Tag>
            {r.isLocked && <Tag color="default" style={{ fontSize: 10 }}>🔒 Locked</Tag>}
          </div>
        </div>
      ),
    },
    {
      title: 'Target / Progress', width: 220, render: (_: any, r: Goal) => (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#A78D78', marginBottom: 4 }}>
            <span>Target: <strong>{r.target}</strong></span>
            <span>Done: <strong>{r.achievement}</strong></span>
          </div>
          <Progress percent={Math.min(100, Math.round(r.progressScore))}
            strokeColor={r.progressScore >= 80 ? '#5A7A5A' : r.progressScore >= 60 ? '#7A6040' : '#7A3A30'}
            strokeWidth={8} showInfo={false} />
          <div style={{ textAlign: 'right', fontSize: 12, fontWeight: 700, color: r.progressScore >= 80 ? '#5A7A5A' : r.progressScore >= 60 ? '#7A6040' : '#7A3A30' }}>
            {Math.round(r.progressScore)}%
          </div>
        </div>
      ),
    },
    {
      title: 'Check-in Timeline', width: 280, render: (_: any, r: Goal) => {
        const checkins = r.quarterlyCheckins || [];
        return (
          <div style={{ display: 'flex', gap: 8 }}>
            {QUARTERS.map(q => {
              const c = checkins.find(ci => ci.quarter === q);
              const isCurrent = q === CURRENT_QUARTER;
              const bg = c ? statusColors[c.progressStatus] : isCurrent ? '#6E473B' : '#E1D4C2';
              return (
                <div key={q} style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%', background: bg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 4px',
                    border: isCurrent ? '2px solid #291C0E' : 'none',
                    boxShadow: c ? `0 0 0 3px ${bg}30` : 'none',
                  }}>
                    {c ? <CheckCircleOutlined style={{ color: '#fff', fontSize: 14 }} /> :
                      isCurrent ? <ClockCircleOutlined style={{ color: '#fff', fontSize: 12 }} /> :
                        <span style={{ fontSize: 9, fontWeight: 700, color: '#A78D78' }}>{q}</span>}
                  </div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: c ? bg : '#A78D78' }}>{q}</div>
                  {c && <div style={{ fontSize: 9, color: '#A78D78' }}>{c.actualAchievement}</div>}
                </div>
              );
            })}
          </div>
        );
      },
    },
    {
      title: 'Action', width: 140, render: (_: any, r: Goal) => (
        <Button type="primary" size="small" icon={<PlusOutlined />}
          onClick={() => { setCheckinGoal(r); form.setFieldValue('quarter', CURRENT_QUARTER); }}
          style={{ borderRadius: 8, fontWeight: 600 }}>
          Add Check-in
        </Button>
      ),
    },
  ];

  return (
    <DashboardLayout role="employee">
      <div className="page-content">

        {/* PROGRESS TIMELINE HERO */}
        <div style={{
          background: 'linear-gradient(135deg, #291C0E 0%, #3a3028 50%, #047857 100%)',
          borderRadius: 20, padding: '28px 36px', marginBottom: 24,
          boxShadow: '0 8px 32px rgba(6,78,59,0.3)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{ color: '#B5C8B5', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>
                📅 Progress Timeline Tracker
              </div>
              <h1 style={{ color: '#fff', fontSize: 26, fontWeight: 900, margin: '0 0 6px' }}>Quarterly Progress Updates</h1>
              <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13 }}>FY 2024-25 · Current Quarter: Q3 (Oct – Dec 2024)</div>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              {[
                { label: 'Goals Active', value: goals.length, color: '#B5C8B5' },
                { label: 'Check-ins Done', value: allCheckins.length, color: '#8AB08A' },
                { label: 'At Risk', value: atRiskGoals.length, color: '#C8A8A0' },
              ].map(s => (
                <div key={s.label} style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: '12px 20px', textAlign: 'center' }}>
                  <div style={{ color: s.color, fontWeight: 900, fontSize: 22 }}>{s.value}</div>
                  <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* FY Timeline */}
          <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 0 }}>
            {QUARTERS.map((q, i) => {
              const qCheckins = allCheckins.filter(c => c.quarter === q);
              const done = qCheckins.filter(c => c.progressStatus === 'completed').length;
              const isCurrent = q === CURRENT_QUARTER;
              const isPast = i < QUARTERS.indexOf(CURRENT_QUARTER);
              return (
                <div key={q} style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: '50%',
                      background: isCurrent ? '#5A7A5A' : isPast ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.15)',
                      border: isCurrent ? '3px solid #8AB08A' : '2px solid rgba(255,255,255,0.3)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: isCurrent ? '0 0 0 6px rgba(16,185,129,0.3)' : 'none',
                    }}>
                      {isPast ? <CheckCircleOutlined style={{ color: '#fff', fontSize: 18 }} /> :
                        isCurrent ? <FireOutlined style={{ color: '#fff', fontSize: 18 }} /> :
                          <ClockCircleOutlined style={{ color: 'rgba(255,255,255,0.5)', fontSize: 16 }} />}
                    </div>
                    <div style={{ color: isCurrent ? '#B5C8B5' : 'rgba(255,255,255,0.7)', fontWeight: isCurrent ? 800 : 600, fontSize: 13, marginTop: 8 }}>{q}</div>
                    <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10 }}>{QUARTER_DATES[q]}</div>
                    {isCurrent && <Tag color="default" style={{ marginTop: 4, fontSize: 10 }}>● Active</Tag>}
                    {isPast && <div style={{ color: '#B5C8B5', fontSize: 10, marginTop: 4 }}>{done} done</div>}
                  </div>
                  {i < 3 && <div style={{ flex: 1, height: 2, background: isPast ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.15)', margin: '0 4px', marginBottom: 28 }} />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Alerts */}
        {overdueGoals.length > 0 && (
          <Alert icon={<WarningOutlined />} type="error" showIcon
            message={`⚠️ ${overdueGoals.length} goal(s) are overdue`}
            description={overdueGoals.map(g => g.goalTitle).join(', ')}
            style={{ marginBottom: 16, borderRadius: 12 }} />
        )}
        {atRiskGoals.length > 0 && (
          <Alert icon={<FireOutlined />} type="warning" showIcon
            message={`🔴 ${atRiskGoals.length} goal(s) marked At Risk in Q3`}
            description="Immediate attention needed to improve progress before quarter end."
            style={{ marginBottom: 16, borderRadius: 12 }} />
        )}
        <Alert
          message="📢 Q3 Check-in Deadline"
          description="Submit all Q3 quarterly progress updates by December 31, 2024. Goals must be approved or locked to appear here."
          type="info" showIcon style={{ marginBottom: 24, borderRadius: 12 }} />

        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E1D4C2', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <div style={{ padding: '18px 24px', borderBottom: '1px solid #F5F0EA', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <span style={{ fontWeight: 800, color: '#291C0E', fontSize: 16 }}>📊 Approved Goals — Quarterly Tracker</span>
              <div style={{ fontSize: 12, color: '#A78D78', marginTop: 2 }}>Update your quarterly progress for all approved/locked goals</div>
            </div>
          </div>
          {goals.length === 0
            ? <div style={{ padding: 40 }}><Empty description="No approved goals. Goals must be approved by manager first." /></div>
            : <Table columns={columns} dataSource={goals} rowKey="id" loading={loading} pagination={false} size="middle" scroll={{ x: 900 }} />
          }
        </div>

        {/* Check-in Modal */}
        <Modal title={<span style={{ fontWeight: 700 }}>📅 Add Quarterly Check-in</span>}
          open={!!checkinGoal} onCancel={() => { setCheckinGoal(null); form.resetFields(); }} footer={null} width={520}>
          {checkinGoal && (
            <div>
              <div style={{ background: 'linear-gradient(135deg,#EFF4EF,#EFF4EF)', borderRadius: 12, padding: '14px 18px', marginBottom: 24, border: '1px solid #B5C8B5' }}>
                <div style={{ fontWeight: 700, color: '#291C0E', marginBottom: 4 }}>{checkinGoal.goalTitle}</div>
                <div style={{ fontSize: 12, color: '#3a3028' }}>
                  Target: <strong>{checkinGoal.target}</strong> · UoM: <strong>{checkinGoal.uomType}</strong> · Weightage: <strong>{checkinGoal.weightage}%</strong>
                </div>
                <Progress percent={Math.min(100, Math.round(checkinGoal.progressScore))}
                  strokeColor="#5A7A5A" strokeWidth={6} style={{ marginTop: 10 }}
                  format={p => <span style={{ color: '#291C0E', fontWeight: 700 }}>{p}%</span>} />
              </div>
              <Form form={form} layout="vertical" onFinish={handleCheckin}>
                <Form.Item name="quarter" label="Quarter" rules={[{ required: true }]}>
                  <Select size="large">
                    {QUARTERS.map(q => <Option key={q} value={q}>{q} — {QUARTER_DATES[q]}</Option>)}
                  </Select>
                </Form.Item>
                <Form.Item name="actualAchievement" label="Actual Achievement" rules={[{ required: true }]}>
                  <InputNumber style={{ width: '100%' }} min={0} size="large"
                    placeholder={`Target: ${checkinGoal.target} · Enter actual value`} />
                </Form.Item>
                <Form.Item name="progressStatus" label="Progress Status" rules={[{ required: true }]}>
                  <Select size="large" placeholder="Select current status">
                    <Option value="not-started">⭕ Not Started</Option>
                    <Option value="on-track">🟡 On Track</Option>
                    <Option value="completed">✅ Completed</Option>
                    <Option value="at-risk">🔴 At Risk</Option>
                  </Select>
                </Form.Item>
                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                  <Button onClick={() => { setCheckinGoal(null); form.resetFields(); }}>Cancel</Button>
                  <Button type="primary" htmlType="submit" icon={<CheckCircleOutlined />}
                    style={{ background: '#5A7A5A', borderColor: '#5A7A5A', fontWeight: 700 }}>
                    Submit Check-in
                  </Button>
                </div>
              </Form>
            </div>
          )}
        </Modal>
      </div>
    </DashboardLayout>
  );
}