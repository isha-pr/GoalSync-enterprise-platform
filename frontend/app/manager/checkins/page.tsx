'use client';
import { useEffect, useState } from 'react';
import { Card, Table, Tag, Button, Modal, Form, Select, InputNumber, Input, message, Progress, Avatar, Tabs } from 'antd';
import DashboardLayout from '../../../components/DashboardLayout';
import api from '../../../lib/api';
import { TeamMember, Goal, QuarterlyCheckin } from '../../../lib/types';

const { Option } = Select;
const { TextArea } = Input;

const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];

export default function CheckinsPage() {
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [form] = Form.useForm();

  useEffect(() => { fetchTeam(); }, []);

  const fetchTeam = async () => {
    setLoading(true);
    try {
      const res = await api.get('/manager/team');
      setTeam(res.data);
    } catch {}
    finally { setLoading(false); }
  };

  const handleCheckin = async (values: any) => {
    if (!selectedGoal) return;
    try {
      await api.post(`/manager/goals/${selectedGoal.id}/checkin`, values);
      message.success('Check-in recorded successfully!');
      setSelectedGoal(null);
      form.resetFields();
      fetchTeam();
    } catch (err: any) {
      message.error(err.response?.data?.error || 'Failed');
    }
  };

  const getStatusColor = (status: string) => {
    return { 'not-started': '#A78D78', 'on-track': '#7A6040', 'completed': '#5A7A5A', 'at-risk': '#7A3A30' }[status] || '#A78D78';
  };

  const renderCheckinHistory = (checkins: QuarterlyCheckin[]) => (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {QUARTERS.map(q => {
        const ci = checkins.find(c => c.quarter === q);
        return (
          <div key={q} style={{
            minWidth: 60, borderRadius: 8, padding: '6px 10px', textAlign: 'center',
            background: ci ? getStatusColor(ci.progressStatus) + '20' : '#FAF7F4',
            border: `1px solid ${ci ? getStatusColor(ci.progressStatus) : '#E1D4C2'}`,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: ci ? getStatusColor(ci.progressStatus) : '#A78D78' }}>{q}</div>
            {ci ? (
              <div style={{ fontSize: 11, color: '#374151', fontWeight: 600 }}>{ci.actualAchievement}</div>
            ) : (
              <div style={{ fontSize: 11, color: '#BEB5A9' }}>—</div>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <DashboardLayout role="manager">
      <div className="page-content">
        <div className="portal-header">
          <div>
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>Performance Reviews</div>
            <h1 style={{ color: 'white', fontSize: 26, fontWeight: 800, margin: '4px 0' }}>Quarterly Check-in Module</h1>
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>
              Review team achievements and record discussion notes
            </div>
          </div>
        </div>

        <Tabs defaultActiveKey="q3" size="large" style={{ marginBottom: 24 }}>
          {QUARTERS.map(q => (
            <Tabs.TabPane tab={q === 'Q3' ? <span>{q} <Tag color="default">Active</Tag></span> : q} key={q.toLowerCase()}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {team.map(member => {
                  const lockedGoals = member.goals.filter(g => g.isLocked || g.status === 'approved');
                  if (lockedGoals.length === 0) return null;
                  return (
                    <Card key={member.id} style={{ borderRadius: 16 }} 
                      title={
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <Avatar style={{ background: '#6E473B', fontWeight: 700 }}>{member.name.charAt(0)}</Avatar>
                          <div>
                            <div style={{ fontWeight: 700 }}>{member.name}</div>
                            <div style={{ fontSize: 12, color: '#A78D78', fontWeight: 400 }}>{member.department}</div>
                          </div>
                        </div>
                      }
                    >
                      <Table
                        dataSource={lockedGoals}
                        rowKey="id"
                        pagination={false}
                        size="small"
                        columns={[
                          {
                            title: 'Goal',
                            render: (_: any, r: Goal) => (
                              <div>
                                <div style={{ fontWeight: 700 }}>{r.goalTitle}</div>
                                <div style={{ fontSize: 12, color: '#A78D78' }}>{r.thrustArea}</div>
                              </div>
                            ),
                          },
                          {
                            title: 'Target vs Planned', width: 180,
                            render: (_: any, r: Goal) => (
                              <div>
                                <div style={{ fontSize: 12, color: '#A78D78', marginBottom: 4 }}>
                                  Target: <strong>{r.target}</strong> | Actual: <strong style={{ color: '#5A7A5A' }}>{r.achievement}</strong>
                                </div>
                                <Progress
                                  percent={Math.round(r.progressScore)}
                                  strokeColor={r.progressScore >= 80 ? '#5A7A5A' : '#7A6040'}
                                  size={6}
                                  showInfo={false}
                                />
                              </div>
                            ),
                          },
                          {
                            title: 'Quarterly History', width: 300,
                            render: (_: any, r: Goal) => renderCheckinHistory(r.quarterlyCheckins || []),
                          },
                          {
                            title: 'Action', width: 140,
                            render: (_: any, r: Goal) => (
                              <Button
                                size="small"
                                type="primary"
                                onClick={() => {
                                  setSelectedGoal(r);
                                  setSelectedEmployee(member.name);
                                  form.setFieldValue('quarter', q);
                                }}
                              >
                                + Add {q} Check-in
                              </Button>
                            ),
                          },
                        ]}
                      />
                    </Card>
                  );
                })}
              </div>
            </Tabs.TabPane>
          ))}
        </Tabs>

        {/* Check-in Modal */}
        <Modal
          title={<span style={{ fontWeight: 700 }}>📋 Record Quarterly Check-in</span>}
          open={!!selectedGoal}
          onCancel={() => { setSelectedGoal(null); form.resetFields(); }}
          footer={null}
          width={560}
        >
          {selectedGoal && (
            <div>
              <div style={{ background: '#FAF7F4', borderRadius: 10, padding: '12px 16px', marginBottom: 20 }}>
                <div style={{ fontSize: 13, color: '#A78D78', marginBottom: 4 }}>Reviewing for: <strong style={{ color: '#291C0E' }}>{selectedEmployee}</strong></div>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#291C0E' }}>{selectedGoal.goalTitle}</div>
                <div style={{ fontSize: 12, color: '#A78D78', marginTop: 4 }}>
                  Planned Target: <strong>{selectedGoal.target}</strong> | Current Achievement: <strong>{selectedGoal.achievement}</strong>
                </div>
              </div>
              <Form form={form} layout="vertical" onFinish={handleCheckin}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <Form.Item name="quarter" label="Quarter" rules={[{ required: true }]}>
                    <Select>
                      {QUARTERS.map(q => <Option key={q} value={q}>{q}</Option>)}
                    </Select>
                  </Form.Item>
                  <Form.Item name="progressStatus" label="Progress Status" rules={[{ required: true }]}>
                    <Select>
                      <Option value="not-started">⭕ Not Started</Option>
                      <Option value="on-track">🟡 On Track</Option>
                      <Option value="completed">✅ Completed</Option>
                      <Option value="at-risk">🔴 At Risk</Option>
                    </Select>
                  </Form.Item>
                </div>
                <Form.Item name="actualAchievement" label="Actual Achievement (as discussed)" rules={[{ required: true }]}>
                  <InputNumber style={{ width: '100%' }} size="large" min={0} />
                </Form.Item>
                <Form.Item name="managerComment" label="Manager Discussion Notes" rules={[{ required: true, message: 'Please add discussion notes' }]}>
                  <TextArea rows={4} placeholder="Record key discussion points, observations, and guidance provided..." />
                </Form.Item>
                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                  <Button onClick={() => { setSelectedGoal(null); form.resetFields(); }}>Cancel</Button>
                  <Button type="primary" htmlType="submit">Save Check-in Record</Button>
                </div>
              </Form>
            </div>
          )}
        </Modal>
      </div>
    </DashboardLayout>
  );
}