'use client';
import { useState, useEffect } from 'react';
import { Card, Form, Input, Select, InputNumber, Button, message, Table, Tag, Divider, Alert, Transfer } from 'antd';
import { ShareAltOutlined, TeamOutlined } from '@ant-design/icons';
import DashboardLayout from '../../../components/DashboardLayout';
import api from '../../../lib/api';

const { Option } = Select;
const { TextArea } = Input;

export default function SharedGoalsPage() {
  const [form] = Form.useForm();
  const [team, setTeam] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [targetKeys, setTargetKeys] = useState<string[]>([]);
  const [sharedGoals, setSharedGoals] = useState<any[]>([]);

  useEffect(() => {
    api.get('/manager/team').then(r => {
      setTeam(r.data);
      // Extract shared goals from team goals
      const shared = r.data.flatMap((m: any) => m.goals.filter((g: any) => g.isSharedGoal));
      setSharedGoals(shared);
    }).catch(() => {});
  }, []);

  const handleAssign = async (values: any) => {
    if (targetKeys.length === 0) {
      message.error('Select at least one employee');
      return;
    }
    setLoading(true);
    try {
      await api.post('/manager/shared-goal', {
        ...values,
        linkedEmployeeIds: targetKeys,
      });
      message.success(`Shared KPI assigned to ${targetKeys.length} employees!`);
      form.resetFields();
      setTargetKeys([]);
    } catch (err: any) {
      message.error(err.response?.data?.error || 'Failed');
    } finally {
      setLoading(false);
    }
  };

  const transferData = team.map(m => ({
    key: m.id,
    title: m.name,
    description: m.department,
  }));

  return (
    <DashboardLayout role="manager">
      <div className="page-content">
        <div className="portal-header">
          <div>
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>Shared KPIs</div>
            <h1 style={{ color: 'white', fontSize: 26, fontWeight: 800, margin: '4px 0' }}>Shared Goal Assignment</h1>
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>
              Push a departmental KPI to multiple team members
            </div>
          </div>
        </div>

        <div style={{ background: '#F0E8D8', border: '1px solid #C8B490', borderRadius: 12,
          padding: '14px 20px', marginBottom: 24, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ fontSize: 20, marginTop: 2 }}>ℹ️</div>
          <div>
            <div style={{ fontWeight: 700, color: '#6E473B', fontSize: 14, marginBottom: 4 }}>About Shared Goals</div>
            <div style={{ fontSize: 13, color: '#7A6040', lineHeight: 1.6 }}>Shared goals have the same title and target across all assigned employees. Each employee can only modify their own weightage allocation. Achievement updates sync automatically.</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <Card title={<span style={{ fontWeight: 700 }}>📤 Assign New Shared KPI</span>} style={{ borderRadius: 16 }}>
            <Form form={form} layout="vertical" onFinish={handleAssign}>
              <Form.Item name="goalTitle" label="KPI / Goal Title" rules={[{ required: true }]}>
                <Input placeholder="e.g., Improve Customer Satisfaction Score" size="large" />
              </Form.Item>
              <Form.Item name="goalDescription" label="Description" rules={[{ required: true }]}>
                <TextArea rows={3} placeholder="Describe the shared goal objective..." />
              </Form.Item>
              <Form.Item name="thrustArea" label="Thrust Area" rules={[{ required: true }]}>
                <Select placeholder="Select thrust area">
                  {['Customer Satisfaction', 'Technical Excellence', 'Process Improvement', 'Revenue Growth', 'Innovation'].map(a => (
                    <Option key={a} value={a}>{a}</Option>
                  ))}
                </Select>
              </Form.Item>
              <Form.Item name="target" label="Shared Target" rules={[{ required: true }]}>
                <InputNumber style={{ width: '100%' }} placeholder="e.g., 90 (for 90% satisfaction)" />
              </Form.Item>

              <Divider>Select Team Members</Divider>

              <Transfer
                dataSource={transferData}
                targetKeys={targetKeys}
                onChange={(keys) => setTargetKeys(keys as string[])}
                render={item => `${item.title} (${item.description})`}
                titles={['Available', 'Selected']}
                style={{ marginBottom: 20 }}
                listStyle={{ width: '100%', height: 200 }}
              />

              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                block
                icon={<ShareAltOutlined />}
                style={{ height: 44, fontWeight: 700 }}
                disabled={targetKeys.length === 0}
              >
                Assign to {targetKeys.length} Employee{targetKeys.length !== 1 ? 's' : ''}
              </Button>
            </Form>
          </Card>

          <Card title={<span style={{ fontWeight: 700 }}>🔗 Existing Shared Goals</span>} style={{ borderRadius: 16 }}>
            {sharedGoals.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#A78D78' }}>
                <TeamOutlined style={{ fontSize: 48, marginBottom: 16 }} />
                <div>No shared goals assigned yet</div>
              </div>
            ) : (
              sharedGoals.map((g: any) => (
                <div key={g.id} style={{
                  padding: '12px 16px', borderRadius: 10, background: '#FAF7F4',
                  border: '1px solid #E1D4C2', marginBottom: 12,
                }}>
                  <div style={{ fontWeight: 700, color: '#291C0E', marginBottom: 4 }}>{g.goalTitle}</div>
                  <div style={{ fontSize: 12, color: '#A78D78', marginBottom: 8 }}>{g.thrustArea}</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Tag style={{ background:'#F5F0EA',color:'#A78D78',border:'1px solid #E1D4C2' }}>Target: {g.target}</Tag>
                    <Tag style={{ background:'#E1D4C2',color:'#6E473B',border:'1px solid #C8B490' }}>Shared</Tag>
                    <Tag style={{
                      background: g.isLocked?'#E8E4F0':'#F0E8D8',
                      color: g.isLocked?'#291C0E':'#6E473B',
                      border: `1px solid ${g.isLocked?'#BEB5A9':'#C8B490'}` }}>{g.status}</Tag>
                  </div>
                </div>
              ))
            )}
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}