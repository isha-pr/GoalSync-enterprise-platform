'use client';
import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, Tag, Progress, message, Space, Tabs, Divider, Avatar } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, ReloadOutlined, EyeOutlined, FileTextOutlined } from '@ant-design/icons';
import DashboardLayout from '../../../components/DashboardLayout';
import api from '../../../lib/api';

const { TextArea } = Input;
const { TabPane } = Tabs;

// Module-level cache — 60s TTL
let _teamCache: { data: any[]; ts: number } | null = null;
const CACHE_TTL = 60_000;

const actionConfig = {
  approve: { title: '✅ Approve Goal', color: '#5A7A5A', description: 'Approving will LOCK this goal. The employee cannot edit it after.' },
  reject:  { title: '❌ Reject Goal',  color: '#7A3A30', description: 'The goal will be rejected and the employee notified.' },
  rework:  { title: '🔄 Return for Rework', color: '#5A4A6A', description: 'The goal will be returned to the employee for revision.' },
};

export default function ApprovalsPage() {
  const [team, setTeam] = useState<any[]>(_teamCache?.data ?? []);
  const [loading, setLoading] = useState(!_teamCache);
  const [selectedGoal, setSelectedGoal] = useState<any | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'rework' | null>(null);
  const [reviewGoal, setReviewGoal] = useState<any | null>(null);
  const [form] = Form.useForm();
  const [actionLoading, setActionLoading] = useState(false);

  const fetchTeam = useCallback((force = false) => {
    const now = Date.now();
    if (!force && _teamCache && now - _teamCache.ts < CACHE_TTL) {
      setTeam(_teamCache.data); setLoading(false); return;
    }
    setLoading(true);
    api.get('/manager/team')
      .then(r => { _teamCache = { data: r.data, ts: Date.now() }; setTeam(r.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const mounted = useRef(false);
  useEffect(() => { if (!mounted.current) { mounted.current = true; fetchTeam(); } }, []); // eslint-disable-line

  // Memoized derived data — not recomputed on every render
  const allGoals = useMemo(() =>
    team.flatMap(m => m.goals.map((g: any) => ({ ...g, employeeName: m.name, employeeDept: m.department }))),
    [team]);
  const submittedGoals = useMemo(() => allGoals.filter((g: any) => g.status === 'submitted'), [allGoals]);
  const allOtherGoals  = useMemo(() => allGoals.filter((g: any) => g.status !== 'submitted'),  [allGoals]);

  const handleAction = useCallback(async (values: any) => {
    if (!selectedGoal || !actionType) return;
    setActionLoading(true);
    try {
      await api.post(`/manager/goals/${selectedGoal.id}/${actionType}`, {
        approvalComments: values.approvalComments,
        updatedWeightage: values.updatedWeightage,
        updatedTarget: values.updatedTarget,
      });
      const msgs = { approve: '✅ Goal approved and locked!', reject: '❌ Goal rejected.', rework: '🔄 Goal returned for rework.' };
      message.success(msgs[actionType]);
      setSelectedGoal(null); setActionType(null); form.resetFields();
      _teamCache = null; fetchTeam(true);
    } catch (err: any) {
      message.error(err.response?.data?.error || 'Action failed');
    } finally { setActionLoading(false); }
  }, [selectedGoal, actionType, form, fetchTeam]);

  const openAction = useCallback((goal: any, type: 'approve' | 'reject' | 'rework') => {
    setSelectedGoal(goal); setActionType(type);
  }, []);

  const getProgressColor = (s: number) => s >= 80 ? '#5A7A5A' : s >= 60 ? '#7A6040' : '#7A3A30';

  // Memoized columns — not recreated on every render
  const submittedColumns = useMemo(() => [
    {
      title: 'Employee', width: 180,
      render: (_: any, r: any) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar style={{ background: '#6E473B', fontWeight: 700, flexShrink: 0 }}>{r.employeeName?.charAt(0)}</Avatar>
          <div>
            <div style={{ fontWeight: 700, color: '#291C0E' }}>{r.employeeName}</div>
            <div style={{ fontSize: 12, color: '#A78D78' }}>{r.employeeDept}</div>
          </div>
        </div>
      ),
    },
    {
      title: 'Goal Details',
      render: (_: any, r: any) => (
        <div>
          <div style={{ fontWeight: 700, color: '#291C0E', marginBottom: 4 }}>{r.goalTitle}</div>
          <div style={{ fontSize: 12, color: '#A78D78', marginBottom: 6 }}>{r.goalDescription?.substring(0, 100)}...</div>
          <Space>
            <Tag style={{ fontSize: 11 }}>{r.thrustArea}</Tag>
            <Tag color="geekblue" style={{ fontSize: 11 }}>{r.uomType?.toUpperCase()}</Tag>
          </Space>
        </div>
      ),
    },
    { title: 'Target', dataIndex: 'target', width: 80, render: (v: number) => <strong>{v}</strong> },
    { title: 'Weightage', dataIndex: 'weightage', width: 90, render: (v: number) => <div style={{ fontWeight: 800, fontSize: 18, color: '#291C0E', textAlign: 'center' }}>{v}%</div> },
    {
      title: 'Actions', width: 300,
      render: (_: any, r: any) => (
        <Space size={6}>
          <Button size="small" icon={<EyeOutlined />} onClick={() => setReviewGoal(r)} style={{ fontWeight: 700, borderColor: '#6E473B', color: '#6E473B' }}>Review</Button>
          <Button size="small" type="primary" icon={<CheckCircleOutlined />} onClick={() => openAction(r, 'approve')} style={{ background: '#5A7A5A', borderColor: '#5A7A5A', fontWeight: 700 }}>Approve</Button>
          <Button size="small" icon={<ReloadOutlined />} onClick={() => openAction(r, 'rework')} style={{ color: '#5A4A6A', borderColor: '#5A4A6A', fontWeight: 700 }}>Rework</Button>
          <Button size="small" danger icon={<CloseCircleOutlined />} onClick={() => openAction(r, 'reject')} style={{ fontWeight: 700 }}>Reject</Button>
        </Space>
      ),
    },
  ], [openAction]);

  const reviewedColumns = useMemo(() => [
    {
      title: 'Employee', width: 150,
      render: (_: any, r: any) => (
        <div>
          <div style={{ fontWeight: 700 }}>{r.employeeName}</div>
          <div style={{ fontSize: 12, color: '#A78D78' }}>{r.employeeDept}</div>
        </div>
      ),
    },
    { title: 'Goal', dataIndex: 'goalTitle', render: (v: string) => <span style={{ fontWeight: 600 }}>{v}</span> },
    { title: 'Weightage', dataIndex: 'weightage', width: 90, render: (v: number) => <strong>{v}%</strong> },
    {
      title: 'Progress', width: 160,
      render: (_: any, r: any) => <Progress percent={Math.round(r.progressScore)} strokeColor={getProgressColor(r.progressScore)} size={6} />,
    },
    {
      title: 'Status', width: 140,
      render: (_: any, r: any) => {
        const s = r.isLocked ? { color: 'blue', label: '🔒 Locked' } :
          r.status === 'approved' ? { color: 'success', label: '✅ Approved' } :
          r.status === 'rejected' ? { color: 'error',   label: '❌ Rejected' } :
          r.status === 'rework'   ? { color: 'purple',  label: '🔄 Rework' } :
          { color: 'default', label: r.status };
        return <Tag color={s.color} style={{ fontWeight: 600 }}>{s.label}</Tag>;
      },
    },
  ], []);

  return (
    <DashboardLayout role="manager">
      <div className="page-content">

        {/* Hero */}
        <div style={{ background: 'linear-gradient(135deg,#3a2418,#6E473B)', borderRadius: 20, padding: '28px 36px', marginBottom: 24, boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{ color: '#A78D78', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>⚡ Approval Action Center</div>
              <h1 style={{ color: '#fff', fontSize: 26, fontWeight: 900, margin: '0 0 6px' }}>Goal Approvals Panel</h1>
              <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13 }}>
                {loading ? 'Loading team data...' : submittedGoals.length > 0 ? `${submittedGoals.length} goals awaiting your decision` : '✓ All caught up — no pending approvals'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              {[
                { label: 'Pending',  value: submittedGoals.length, color: '#C8A870', bg: 'rgba(245,158,11,0.15)' },
                { label: 'Approved', value: allOtherGoals.filter((g: any) => g.isLocked || g.status === 'approved').length, color: '#8AB08A', bg: 'rgba(52,211,153,0.15)' },
                { label: 'Rework',   value: allOtherGoals.filter((g: any) => g.status === 'rework').length, color: '#c4b5fd', bg: 'rgba(196,181,253,0.15)' },
              ].map(s => (
                <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.color}40`, borderRadius: 12, padding: '12px 20px', textAlign: 'center' }}>
                  <div style={{ color: s.color, fontWeight: 900, fontSize: 24 }}>{s.value}</div>
                  <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Alert banner */}
        {!loading && submittedGoals.length > 0 && (
          <div style={{ background: 'linear-gradient(135deg,#F0E8D8,#F5EDDF)', border: '1px solid #C8B490', borderRadius: 14, padding: '16px 24px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ fontSize: 28 }}>🔔</div>
            <div>
              <div style={{ fontWeight: 700, color: '#6E473B', fontSize: 15 }}>{submittedGoals.length} goals pending your approval</div>
              <div style={{ fontSize: 13, color: '#6E473B' }}>Review and take action below. Approved goals are automatically locked.</div>
            </div>
          </div>
        )}

        {/* Tables */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E1D4C2', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <Tabs defaultActiveKey="pending" size="large" style={{ padding: '0 16px' }}>
            <TabPane tab={<span>⏳ Pending Review <Tag color="default" style={{ fontWeight: 700 }}>{submittedGoals.length}</Tag></span>} key="pending">
              {!loading && submittedGoals.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40 }}>
                  <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
                  <div style={{ fontWeight: 700, fontSize: 18, color: '#291C0E' }}>All caught up!</div>
                  <div style={{ color: '#A78D78', marginTop: 8 }}>No pending goal approvals.</div>
                </div>
              ) : (
                <Table
                  columns={submittedColumns}
                  dataSource={submittedGoals}
                  rowKey="id"
                  loading={loading}
                  pagination={{ pageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '20', '50'], showTotal: (t, r) => `${r[0]}–${r[1]} of ${t}` }}
                  size="middle"
                  scroll={{ x: 900 }}
                />
              )}
            </TabPane>
            <TabPane tab={<span>📋 All Team Goals <Tag>{allOtherGoals.length}</Tag></span>} key="all">
              <Table
                columns={reviewedColumns}
                dataSource={allOtherGoals}
                rowKey="id"
                loading={loading}
                pagination={{ pageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '20', '50'] }}
                size="middle"
              />
            </TabPane>
          </Tabs>
        </div>

        {/* Review Modal — only mounted when open */}
        {reviewGoal && (
          <Modal open onCancel={() => setReviewGoal(null)} footer={null} width={720}
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#291C0E,#6E473B)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 16 }}><FileTextOutlined /></div>
                <div><div style={{ fontWeight: 800, color: '#291C0E', fontSize: 15 }}>Goal Review</div><div style={{ fontSize: 11, color: '#A78D78' }}>Full goal details, history & check-ins</div></div>
              </div>
            }
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: '#FAF7F4', borderRadius: 12, padding: '14px 18px', marginBottom: 16, border: '1px solid #E1D4C2' }}>
                <Avatar size={48} style={{ background: '#6E473B', fontWeight: 800, fontSize: 18 }}>{reviewGoal.employeeName?.charAt(0)}</Avatar>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, color: '#291C0E', fontSize: 15 }}>{reviewGoal.employeeName}</div>
                  <div style={{ fontSize: 12, color: '#A78D78' }}>{reviewGoal.employeeDept} · {reviewGoal.thrustArea}</div>
                </div>
                <Tag style={{ fontWeight: 700, fontSize: 12, padding: '4px 12px', borderRadius: 20, background: reviewGoal.isLocked ? '#BEB5A9' : '#C8B490', color: '#291C0E', border: 'none' }}>
                  {reviewGoal.isLocked ? '🔒 Locked' : reviewGoal.status === 'submitted' ? '⏳ Pending' : '📝 ' + reviewGoal.status}
                </Tag>
              </div>

              <div style={{ fontWeight: 800, color: '#291C0E', fontSize: 16, marginBottom: 6 }}>{reviewGoal.goalTitle}</div>
              <div style={{ fontSize: 13, color: '#6E473B', lineHeight: 1.65, marginBottom: 16 }}>{reviewGoal.goalDescription || 'No description provided.'}</div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 16 }}>
                {[{ l: 'Target', v: reviewGoal.target, c: '#291C0E' }, { l: 'Achievement', v: reviewGoal.achievement, c: '#5A7A5A' }, { l: 'Weightage', v: `${reviewGoal.weightage}%`, c: '#5A4A6A' }, { l: 'UoM', v: reviewGoal.uomType?.toUpperCase(), c: '#7A6040' }].map(m => (
                  <div key={m.l} style={{ textAlign: 'center', background: 'white', borderRadius: 10, padding: '12px 8px', border: '1px solid #E1D4C2' }}>
                    <div style={{ fontSize: 10, color: '#A78D78', fontWeight: 700, textTransform: 'uppercase' }}>{m.l}</div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: m.c, marginTop: 4 }}>{m.v}</div>
                  </div>
                ))}
              </div>

              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#A78D78' }}>Progress</span>
                  <span style={{ fontSize: 14, fontWeight: 900, color: getProgressColor(reviewGoal.progressScore) }}>{Math.round(reviewGoal.progressScore)}%</span>
                </div>
                <Progress percent={Math.min(100, Math.round(reviewGoal.progressScore))} strokeColor={getProgressColor(reviewGoal.progressScore)} railColor="#F5F0EA" size={10} showInfo={false} />
              </div>

              <Tabs defaultActiveKey="history" size="small">
                <TabPane tab="📋 Approval History" key="history">
                  {(reviewGoal.goalApprovals?.length || 0) === 0
                    ? <div style={{ color: '#A78D78', padding: '16px 0', textAlign: 'center' }}>No previous approvals recorded.</div>
                    : <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                        {reviewGoal.goalApprovals?.map((a: any) => (
                          <div key={a.id} style={{ background: '#FAF7F4', borderRadius: 10, padding: '12px 16px', border: '1px solid #E1D4C2' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontWeight: 700, color: a.approvalStatus === 'approved' ? '#5A7A5A' : a.approvalStatus === 'rejected' ? '#7A3A30' : '#5A4A6A', fontSize: 13 }}>
                                {a.approvalStatus === 'approved' ? '✅' : a.approvalStatus === 'rejected' ? '❌' : '🔄'} {a.approvalStatus.toUpperCase()}
                              </span>
                              <span style={{ fontSize: 11, color: '#A78D78' }}>{new Date(a.approvedAt).toLocaleString('en-IN')}</span>
                            </div>
                            {a.approvalComments && <div style={{ marginTop: 6, fontSize: 12, color: '#6E473B', background: 'white', borderRadius: 6, padding: '8px 10px', border: '1px solid #E1D4C2' }}>💬 {a.approvalComments}</div>}
                          </div>
                        ))}
                      </div>
                  }
                </TabPane>
                <TabPane tab="📆 Check-ins" key="checkins">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                    {['Q1', 'Q2', 'Q3', 'Q4'].map(q => {
                      const ci = reviewGoal.quarterlyCheckins?.find((c: any) => c.quarter === q);
                      return (
                        <div key={q} style={{ display: 'flex', alignItems: 'center', gap: 12, background: ci ? '#EFF4EF' : '#FAF7F4', borderRadius: 10, padding: '10px 16px', border: `1px solid ${ci ? '#B5C8B5' : '#E1D4C2'}` }}>
                          <div style={{ width: 32, height: 32, borderRadius: 8, background: ci ? '#5A7A5A' : '#BEB5A9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 12 }}>{q}</div>
                          {ci ? (
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 700, color: '#291C0E', fontSize: 13 }}>Achievement: {ci.achievement} / {reviewGoal.target}</div>
                              {ci.comments && <div style={{ fontSize: 11, color: '#6E473B', marginTop: 2 }}>💬 {ci.comments}</div>}
                              <div style={{ fontSize: 10, color: '#A78D78', marginTop: 2 }}>{new Date(ci.updatedAt).toLocaleDateString('en-IN')}</div>
                            </div>
                          ) : <div style={{ color: '#A78D78', fontSize: 12 }}>Not submitted</div>}
                        </div>
                      );
                    })}
                  </div>
                </TabPane>
              </Tabs>

              <Divider />
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <Button onClick={() => setReviewGoal(null)}>Close</Button>
                {reviewGoal.status === 'submitted' && !reviewGoal.isLocked && (<>
                  <Button icon={<CheckCircleOutlined />} onClick={() => { setReviewGoal(null); openAction(reviewGoal, 'approve'); }} style={{ background: '#5A7A5A', borderColor: '#5A7A5A', color: '#fff', fontWeight: 700 }}>Approve</Button>
                  <Button icon={<ReloadOutlined />} onClick={() => { setReviewGoal(null); openAction(reviewGoal, 'rework'); }} style={{ color: '#5A4A6A', borderColor: '#5A4A6A', fontWeight: 700 }}>Rework</Button>
                  <Button danger icon={<CloseCircleOutlined />} onClick={() => { setReviewGoal(null); openAction(reviewGoal, 'reject'); }} style={{ fontWeight: 700 }}>Reject</Button>
                </>)}
              </div>
            </div>
          </Modal>
        )}

        {/* Action Modal — only mounted when open */}
        {selectedGoal && actionType && (
          <Modal
            title={actionConfig[actionType].title}
            open
            onCancel={() => { setSelectedGoal(null); setActionType(null); form.resetFields(); }}
            footer={null}
            width={540}
          >
            <div>
              <div style={{ background: actionType === 'approve' ? '#EFF4EF' : actionType === 'reject' ? '#F5ECEA' : '#faf5ff', border: `1px solid ${actionType === 'approve' ? '#B5C8B5' : actionType === 'reject' ? '#C8A8A0' : '#c4b5fd'}`, borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 13, fontWeight: 600, color: '#291C0E' }}>
                {actionConfig[actionType].description}
              </div>

              <div style={{ background: '#FAF7F4', borderRadius: 12, padding: '16px 18px', marginBottom: 18, border: '1px solid #E1D4C2' }}>
                <div style={{ fontWeight: 800, fontSize: 15, color: '#291C0E', marginBottom: 10 }}>{selectedGoal.goalTitle}</div>
                <div style={{ fontSize: 12, color: '#A78D78', marginBottom: 12, lineHeight: 1.5 }}>{selectedGoal.goalDescription?.substring(0, 140)}…</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                  {[{ l: 'Target', v: selectedGoal.target, c: '#291C0E' }, { l: 'Achievement', v: selectedGoal.achievement, c: '#5A7A5A' }, { l: 'Weightage', v: `${selectedGoal.weightage}%`, c: '#5A4A6A' }].map(m => (
                    <div key={m.l} style={{ textAlign: 'center', background: 'white', borderRadius: 8, padding: '10px', border: '1px solid #E1D4C2' }}>
                      <div style={{ fontSize: 10, color: '#A78D78', fontWeight: 700, textTransform: 'uppercase' }}>{m.l}</div>
                      <div style={{ fontSize: 20, fontWeight: 900, color: m.c, marginTop: 2 }}>{m.v}</div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 14 }}>
                  <Progress percent={Math.min(100, Math.round(selectedGoal.progressScore))} strokeColor={selectedGoal.progressScore >= 70 ? '#5A7A5A' : '#7A6040'} size={8} showInfo />
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                  <Tag>{selectedGoal.thrustArea}</Tag>
                  <Tag color="geekblue">{selectedGoal.uomType?.toUpperCase()}</Tag>
                  {selectedGoal.employeeName && <Tag color="default">👤 {selectedGoal.employeeName}</Tag>}
                </div>
              </div>

              <Form form={form} layout="vertical" onFinish={handleAction}>
                {actionType === 'approve' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <Form.Item name="updatedTarget" label="Updated Target" initialValue={selectedGoal.target}>
                      <InputNumber style={{ width: '100%' }} min={0} />
                    </Form.Item>
                    <Form.Item name="updatedWeightage" label="Updated Weightage %" initialValue={selectedGoal.weightage}>
                      <InputNumber style={{ width: '100%' }} min={10} max={100} formatter={v => `${v}%`} />
                    </Form.Item>
                  </div>
                )}
                <Form.Item name="approvalComments" label="Comments / Feedback" rules={[{ required: actionType !== 'approve', message: 'Please provide feedback' }]}>
                  <TextArea rows={3} placeholder={actionType === 'approve' ? 'Optional: any feedback...' : actionType === 'reject' ? 'Reason for rejection (required)...' : 'What needs to be reworked? (required)...'} />
                </Form.Item>
                <Divider />
                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                  <Button onClick={() => { setSelectedGoal(null); setActionType(null); form.resetFields(); }}>Cancel</Button>
                  <Button type="primary" htmlType="submit" loading={actionLoading} style={{ background: actionConfig[actionType].color, borderColor: actionConfig[actionType].color, fontWeight: 700 }}>
                    Confirm {actionType.charAt(0).toUpperCase() + actionType.slice(1)}
                  </Button>
                </div>
              </Form>
            </div>
          </Modal>
        )}
      </div>
    </DashboardLayout>
  );
}