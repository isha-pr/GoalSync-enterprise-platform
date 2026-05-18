'use client';
import { useEffect, useState } from 'react';
import { Table, Tag, Button, Modal, Form, Select, Input, InputNumber, message, Progress, Tooltip, Space, Steps, Timeline, Divider } from 'antd';
import { LockOutlined, EditOutlined, SendOutlined, DeleteOutlined, EyeOutlined, CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined, WarningOutlined } from '@ant-design/icons';
import DashboardLayout from '../../../components/DashboardLayout';
import api from '../../../lib/api';
import { Goal } from '../../../lib/types';
import { useRouter } from 'next/navigation';

const { Option } = Select;

function GoalHealthScore({ goal }: { goal: Goal }) {
  const progress = goal.progressScore;
  const hasCheckins = (goal.quarterlyCheckins?.length || 0) > 0;
  const isApproved = goal.status === 'approved' || goal.isLocked;
  const deadlineRisk = goal.deadline ? (new Date(goal.deadline) < new Date() ? 0 : 20) : 10;
  const score = Math.round(
    (progress * 0.5) + (hasCheckins ? 20 : 0) + (isApproved ? 20 : 0) + deadlineRisk
  );
  const clipped = Math.min(100, Math.max(0, score));
  const color = clipped >= 75 ? '#5A7A5A' : clipped >= 50 ? '#7A6040' : '#7A3A30';
  const label = clipped >= 75 ? 'Healthy' : clipped >= 50 ? 'Moderate' : 'At Risk';
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <Progress type="circle" percent={clipped} size={52} strokeColor={color} size={8}
          format={() => <span style={{ fontSize: 12, fontWeight: 800, color }}>{clipped}</span>} />
      </div>
      <div style={{ fontSize: 10, fontWeight: 700, color, marginTop: 2 }}>{label}</div>
    </div>
  );
}

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [editGoal, setEditGoal] = useState<Goal | null>(null);
  const [detailGoal, setDetailGoal] = useState<Goal | null>(null);
  const [editForm] = Form.useForm();
  const [submitLoading, setSubmitLoading] = useState(false);
  const router = useRouter();

  useEffect(() => { fetchGoals(); }, []);

  const fetchGoals = async () => {
    setLoading(true);
    try {
      const res = await api.get('/goals');
      setGoals(res.data);
    } catch {}
    finally { setLoading(false); }
  };

  const handleDelete = async (id: string) => {
    Modal.confirm({
      title: 'Delete Goal', content: 'This cannot be undone.',
      okText: 'Delete', okType: 'danger',
      onOk: async () => {
        try { await api.delete(`/goals/${id}`); message.success('Goal deleted'); fetchGoals(); }
        catch (err: any) { message.error(err.response?.data?.error || 'Delete failed'); }
      },
    });
  };

  const handleSubmit = async (id: string) => {
    setSubmitLoading(true);
    try {
      await api.post(`/goals/${id}/submit`);
      message.success('Goal submitted for manager review!');
      fetchGoals();
    } catch (err: any) {
      message.error(err.response?.data?.error || 'Submit failed');
    } finally { setSubmitLoading(false); }
  };

  const handleEditSave = async (values: any) => {
    if (!editGoal) return;
    try {
      await api.put(`/goals/${editGoal.id}`, values);
      message.success('Goal updated successfully');
      setEditGoal(null);
      fetchGoals();
    } catch (err: any) {
      message.error(err.response?.data?.error || 'Update failed');
    }
  };

  const getProgressColor = (score: number) =>
    score >= 80 ? '#5A7A5A' : score >= 60 ? '#7A6040' : '#7A3A30';

  const statusBadge = (goal: Goal) => {
    const STATUS_STYLE: Record<string, { bg: string; color: string; border: string; label: string }> = {
    draft:     { bg: '#F5F0EA', color: '#A78D78', border: '#E1D4C2', label: '📝 Draft' },
    submitted: { bg: '#F0E8D8', color: '#6E473B', border: '#C8B490', label: '⏳ Submitted' },
    approved:  { bg: '#EFF4EF', color: '#3A5A3A', border: '#B5C8B5', label: '✅ Approved' },
    rejected:  { bg: '#F5ECEA', color: '#7A3A30', border: '#C8A8A0', label: '❌ Rejected' },
    rework:    { bg: '#EDE8F5', color: '#5A4A6A', border: '#C4B5D4', label: '🔄 Rework' },
    locked:    { bg: '#E8E4F0', color: '#291C0E', border: '#BEB5A9', label: '🔒 Locked' },
  };
  const s = goal.isLocked ? STATUS_STYLE['locked'] : STATUS_STYLE[goal.status] || STATUS_STYLE['draft'];
  return <Tag style={{ borderRadius: 20, fontWeight: 600, padding: '3px 12px',
    background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>{s.label}</Tag>;
  };

  const totalWeightage = goals.reduce((s, g) => s + g.weightage, 0);

  const columns = [
    { title: '#', width: 36, render: (_: any, __: any, i: number) => <span style={{ color: '#A78D78', fontWeight: 700, fontSize: 13 }}>{i + 1}</span> },
    {
      title: 'Goal Details', render: (_: any, r: Goal) => (
        <div>
          <div style={{ fontWeight: 700, color: '#291C0E', fontSize: 14, marginBottom: 2 }}>{r.goalTitle}</div>
          <div style={{ fontSize: 12, color: '#A78D78', marginBottom: 4 }}>{r.goalDescription?.substring(0, 80)}{r.goalDescription?.length > 80 ? '…' : ''}</div>
          <Space size={4}>
            <Tag style={{ fontSize: 11, borderRadius: 4 }}>{r.thrustArea}</Tag>
            <Tag color="geekblue" style={{ fontSize: 11, borderRadius: 4 }}>{r.uomType.toUpperCase()}</Tag>
            {r.isSharedGoal && <Tag color="default" style={{ fontSize: 11 }}>Shared</Tag>}
          </Space>
        </div>
      ),
    },
    {
      title: 'Progress', width: 200, render: (_: any, r: Goal) => (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#A78D78', marginBottom: 4 }}>
            <span>Target: <strong>{r.target}</strong></span>
            <span>Done: <strong>{r.achievement}</strong></span>
          </div>
          <Progress percent={Math.min(100, Math.round(r.progressScore))} strokeColor={getProgressColor(r.progressScore)} size={8} showInfo={false} />
          <div style={{ textAlign: 'right', fontSize: 12, fontWeight: 700, color: getProgressColor(r.progressScore) }}>
            {Math.round(r.progressScore)}%
          </div>
        </div>
      ),
    },
    {
      title: 'Health', width: 80, render: (_: any, r: Goal) => <GoalHealthScore goal={r} />,
    },
    { title: 'Wt.', dataIndex: 'weightage', width: 60, render: (v: number) => <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 16, color: '#291C0E' }}>{v}%</div> },
    { title: 'Status', width: 140, render: (_: any, r: Goal) => statusBadge(r) },
    {
      title: 'Deadline', dataIndex: 'deadline', width: 100, render: (v: string) =>
        v ? <span style={{ fontSize: 12, color: '#A78D78' }}>{new Date(v).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
          : <span style={{ color: '#BEB5A9' }}>—</span>,
    },
    {
      title: 'Actions', width: 150, render: (_: any, r: Goal) => (
        <Space>
          <Tooltip title="View Details">
            <Button size="small" icon={<EyeOutlined />} onClick={() => setDetailGoal(r)}
              style={{ borderColor: '#6E473B', color: '#6E473B' }} />
          </Tooltip>
          {!r.isLocked && r.status === 'draft' && (
            <>
              <Tooltip title="Edit">
                <Button size="small" icon={<EditOutlined />} onClick={() => { setEditGoal(r); editForm.setFieldsValue(r); }} />
              </Tooltip>
              <Tooltip title="Submit for Review">
                <Button size="small" type="primary" icon={<SendOutlined />} onClick={() => handleSubmit(r.id)} loading={submitLoading} />
              </Tooltip>
              <Tooltip title="Delete">
                <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(r.id)} />
              </Tooltip>
            </>
          )}
          {r.isLocked && <Tag icon={<LockOutlined />} color="default">Locked</Tag>}
          {r.status === 'submitted' && <Tag color="default">Awaiting</Tag>}
        </Space>
      ),
    },
  ];

  return (
    <DashboardLayout role="employee">
      <div className="page-content">

        {/* WORKFLOW HERO */}
        <div style={{
          background: 'linear-gradient(135deg, #291C0E 0%, #291C0E 50%, #6E473B 100%)',
          borderRadius: 20, padding: '28px 36px', marginBottom: 24,
          boxShadow: '0 8px 32px rgba(30,64,175,0.3)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{ color: '#A78D78', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>
                📋 Goal Management Workflow
              </div>
              <h1 style={{ color: '#fff', fontSize: 26, fontWeight: 900, margin: '0 0 6px' }}>My Goal Sheet — FY 2024-25</h1>
              <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13 }}>
                {goals.length} goals · Weightage {totalWeightage}% {totalWeightage === 100 ? '✓ Balanced' : `(need ${100 - totalWeightage}% more)`}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              {[
                { label: 'Draft', value: goals.filter(g => g.status === 'draft').length, color: '#C8A870' },
                { label: 'Submitted', value: goals.filter(g => g.status === 'submitted').length, color: '#BEB5A9' },
                { label: 'Approved', value: goals.filter(g => g.status === 'approved' || g.isLocked).length, color: '#8AB08A' },
              ].map(s => (
                <div key={s.label} style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: '12px 20px', textAlign: 'center' }}>
                  <div style={{ color: s.color, fontWeight: 900, fontSize: 22 }}>{s.value}</div>
                  <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11 }}>{s.label}</div>
                </div>
              ))}
              <Button onClick={() => router.push('/employee/create-goal')}
                style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', borderRadius: 10, fontWeight: 700, height: 40 }}>
                + Add Goal
              </Button>
            </div>
          </div>
        </div>

        {/* Weightage Summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 }}>
          {[
            { label: 'Total Goals', value: goals.length, max: 8, color: '#6E473B', bg: 'linear-gradient(135deg,#eff6ff,#E1D4C2)' },
            { label: 'Weightage Used', value: `${totalWeightage}%`, color: totalWeightage === 100 ? '#5A7A5A' : '#7A6040', bg: 'linear-gradient(135deg,#EFF4EF,#EFF4EF)' },
            { label: 'Locked Goals', value: goals.filter(g => g.isLocked).length, color: '#5A4A6A', bg: 'linear-gradient(135deg,#faf5ff,#EDE8F5)' },
            { label: 'Avg Progress', value: `${goals.length ? Math.round(goals.reduce((s, g) => s + g.progressScore, 0) / goals.length) : 0}%`, color: '#5A7A5A', bg: 'linear-gradient(135deg,#EFF4EF,#ccfbf1)' },
          ].map(item => (
            <div key={item.label} style={{ background: item.bg, borderRadius: 14, padding: '18px 22px', border: '1px solid #E1D4C2', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: 11, color: '#A78D78', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.label}</div>
              <div style={{ fontSize: 30, fontWeight: 900, color: item.color, marginTop: 6 }}>{item.value}</div>
            </div>
          ))}
        </div>

        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E1D4C2', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <Table columns={columns} dataSource={goals} rowKey="id" loading={loading} pagination={false} size="middle" scroll={{ x: 1100 }}
            summary={() => (
              <Table.Summary fixed>
                <Table.Summary.Row style={{ background: '#FAF7F4' }}>
                  <Table.Summary.Cell index={0} />
                  <Table.Summary.Cell index={1}><strong>Total ({goals.length}/8 goals)</strong></Table.Summary.Cell>
                  <Table.Summary.Cell index={2} /><Table.Summary.Cell index={3} />
                  <Table.Summary.Cell index={4}>
                    <div style={{ textAlign: 'center', fontWeight: 900, fontSize: 18, color: totalWeightage === 100 ? '#5A7A5A' : '#7A6040' }}>{totalWeightage}%</div>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={5} /><Table.Summary.Cell index={6} /><Table.Summary.Cell index={7} />
                </Table.Summary.Row>
              </Table.Summary>
            )}
          />
        </div>

        {/* GOAL DETAIL MODAL */}
        <Modal open={!!detailGoal} onCancel={() => setDetailGoal(null)} footer={null} width={760}
          title={<div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#291C0E,#6E473B)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 16 }}>🎯</div>
            <div>
              <div style={{ fontWeight: 800, color: '#291C0E', fontSize: 16 }}>Goal Detail View</div>
              <div style={{ fontSize: 12, color: '#A78D78', fontWeight: 400 }}>Complete goal information & history</div>
            </div>
          </div>}>
          {detailGoal && (
            <div>
              {/* Goal Header */}
              <div style={{ background: '#FAF7F4', borderRadius: 12, padding: '16px 20px', marginBottom: 20, border: '1px solid #E1D4C2' }}>
                <div style={{ fontWeight: 800, color: '#291C0E', fontSize: 17, marginBottom: 6 }}>{detailGoal.goalTitle}</div>
                <div style={{ color: '#A78D78', fontSize: 13, marginBottom: 12, lineHeight: 1.5 }}>{detailGoal.goalDescription}</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Tag color="default">{detailGoal.thrustArea}</Tag>
                  <Tag color="geekblue">{detailGoal.uomType.toUpperCase()}</Tag>
                  {detailGoal.isSharedGoal && <Tag color="default">Shared Goal</Tag>}
                  {statusBadge(detailGoal)}
                </div>
              </div>

              {/* Metrics Row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
                {[
                  { label: 'Target', value: detailGoal.target, color: '#291C0E' },
                  { label: 'Achievement', value: detailGoal.achievement, color: '#5A7A5A' },
                  { label: 'Weightage', value: `${detailGoal.weightage}%`, color: '#5A4A6A' },
                  { label: 'Progress', value: `${Math.round(detailGoal.progressScore)}%`, color: getProgressColor(detailGoal.progressScore) },
                ].map(m => (
                  <div key={m.label} style={{ background: '#FAF7F4', borderRadius: 10, padding: '14px 16px', textAlign: 'center', border: '1px solid #E1D4C2' }}>
                    <div style={{ fontSize: 11, color: '#A78D78', fontWeight: 700, textTransform: 'uppercase' }}>{m.label}</div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: m.color, marginTop: 4 }}>{m.value}</div>
                  </div>
                ))}
              </div>

              {/* Progress Bar */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                  <span style={{ fontWeight: 600, color: '#374151' }}>Overall Progress</span>
                  <span style={{ fontWeight: 700, color: getProgressColor(detailGoal.progressScore) }}>{Math.round(detailGoal.progressScore)}%</span>
                </div>
                <Progress percent={Math.min(100, Math.round(detailGoal.progressScore))} strokeColor={getProgressColor(detailGoal.progressScore)} size={12} showInfo={false} style={{ borderRadius: 100 }} />
              </div>

              {/* Goal Health */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, background: '#FAF7F4', borderRadius: 12, padding: '16px 20px', marginBottom: 20, border: '1px solid #E1D4C2' }}>
                <GoalHealthScore goal={detailGoal} />
                <div>
                  <div style={{ fontWeight: 700, color: '#291C0E', fontSize: 14 }}>Goal Health Score</div>
                  <div style={{ fontSize: 12, color: '#A78D78', lineHeight: 1.6 }}>
                    Based on progress ({Math.round(detailGoal.progressScore)}%), check-in history ({detailGoal.quarterlyCheckins?.length || 0} entries), approval status, and deadline risk.
                  </div>
                </div>
              </div>

              <Divider style={{ margin: '16px 0' }} />

              {/* Approval History */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontWeight: 700, color: '#291C0E', fontSize: 14, marginBottom: 12 }}>📋 Approval History</div>
                {(detailGoal.goalApprovals?.length || 0) === 0 ? (
                  <div style={{ color: '#A78D78', fontSize: 13, fontStyle: 'italic' }}>No approval records yet.</div>
                ) : (
                  <Timeline items={detailGoal.goalApprovals?.map(a => ({
                    color: a.approvalStatus === 'approved' ? 'green' : a.approvalStatus === 'rejected' ? 'red' : 'orange',
                    dot: a.approvalStatus === 'approved' ? <CheckCircleOutlined /> : a.approvalStatus === 'rejected' ? <CloseCircleOutlined /> : <WarningOutlined />,
                    children: (
                      <div>
                        <div style={{ fontWeight: 700, color: '#291C0E', fontSize: 13 }}>
                          {a.approvalStatus === 'approved' ? '✅ Approved' : a.approvalStatus === 'rejected' ? '❌ Rejected' : '🔄 Rework Required'}
                          {a.manager?.name && <span style={{ color: '#A78D78', fontWeight: 400, marginLeft: 8 }}>by {a.manager.name}</span>}
                        </div>
                        {a.approvalComments && <div style={{ fontSize: 12, color: '#A78D78', marginTop: 4, background: '#FAF7F4', padding: '8px 12px', borderRadius: 8 }}>"{a.approvalComments}"</div>}
                        {a.updatedTarget && <div style={{ fontSize: 12, color: '#5A4A6A', marginTop: 4 }}>Updated target: <strong>{a.updatedTarget}</strong></div>}
                        <div style={{ fontSize: 11, color: '#A78D78', marginTop: 4 }}>{new Date(a.approvedAt).toLocaleString('en-IN')}</div>
                      </div>
                    ),
                  }))} />
                )}
              </div>

              {/* Check-in History */}
              <div>
                <div style={{ fontWeight: 700, color: '#291C0E', fontSize: 14, marginBottom: 12 }}>📅 Quarterly Check-in History</div>
                {(detailGoal.quarterlyCheckins?.length || 0) === 0 ? (
                  <div style={{ color: '#A78D78', fontSize: 13, fontStyle: 'italic' }}>No check-ins recorded yet.</div>
                ) : (
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {detailGoal.quarterlyCheckins?.map(c => {
                      const statusColors: Record<string, string> = { 'completed': '#5A7A5A', 'on-track': '#7A6040', 'at-risk': '#7A3A30', 'not-started': '#A78D78' };
                      const col = statusColors[c.progressStatus] || '#A78D78';
                      return (
                        <div key={c.id} style={{ background: col + '12', border: `1px solid ${col}40`, borderRadius: 12, padding: '14px 18px', minWidth: 140 }}>
                          <div style={{ fontWeight: 900, color: col, fontSize: 20 }}>{c.quarter}</div>
                          <div style={{ fontSize: 12, color: '#374151', marginTop: 4 }}>Achievement: <strong>{c.actualAchievement}</strong></div>
                          <Tag style={{ marginTop: 6, fontSize: 10, borderColor: col, color: col, background: col + '15' }}>{c.progressStatus.replace('-', ' ')}</Tag>
                          {c.managerComment && <div style={{ fontSize: 11, color: '#A78D78', marginTop: 6, fontStyle: 'italic' }}>"{c.managerComment}"</div>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </Modal>

        {/* Edit Modal */}
        <Modal title={<span style={{ fontWeight: 700 }}>✏️ Edit Goal</span>} open={!!editGoal} onCancel={() => setEditGoal(null)} footer={null} width={600}>
          <Form form={editForm} layout="vertical" onFinish={handleEditSave}>
            <Form.Item name="goalTitle" label="Goal Title" rules={[{ required: true }]}><Input /></Form.Item>
            <Form.Item name="goalDescription" label="Description" rules={[{ required: true }]}><Input.TextArea rows={3} /></Form.Item>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Form.Item name="target" label="Target" rules={[{ required: true }]}><InputNumber style={{ width: '100%' }} /></Form.Item>
              <Form.Item name="weightage" label="Weightage %" rules={[{ required: true }]}><InputNumber style={{ width: '100%' }} min={10} max={100} formatter={v => `${v}%`} /></Form.Item>
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <Button onClick={() => setEditGoal(null)}>Cancel</Button>
              <Button type="primary" htmlType="submit">Save Changes</Button>
            </div>
          </Form>
        </Modal>

      </div>
    </DashboardLayout>
  );
}
