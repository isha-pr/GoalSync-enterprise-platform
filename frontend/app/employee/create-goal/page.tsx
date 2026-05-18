'use client';
import { useState, useEffect } from 'react';
import { Card, Form, Input, Select, InputNumber, Button, DatePicker, Switch, Alert, Progress, message, Steps, Divider, Tag } from 'antd';
import { PlusOutlined, SaveOutlined, SendOutlined, AimOutlined, WarningOutlined, CheckCircleOutlined } from '@ant-design/icons';
import DashboardLayout from '../../../components/DashboardLayout';
import { useStore } from '../../../lib/store';
import api from '../../../lib/api';
import { Goal } from '../../../lib/types';
import { useRouter } from 'next/navigation';

const { TextArea } = Input;
const { Option } = Select;

const THRUST_AREAS = [
  'Technical Excellence', 'Customer Satisfaction', 'Process Improvement',
  'Revenue Growth', 'Learning & Development', 'Team Collaboration',
  'Innovation', 'Compliance & Risk', 'Operational Excellence',
  'Cost Optimization', 'Sustainability', 'Digital Transformation',
];

export default function CreateGoalPage() {
  const { user } = useStore();
  const router = useRouter();
  const [form] = Form.useForm();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitAllLoading, setSubmitAllLoading] = useState(false);
  const [uomType, setUomType] = useState('numeric');

  useEffect(() => { fetchGoals(); }, []);

  const fetchGoals = async () => {
    try {
      const res = await api.get('/goals');
      setGoals(res.data);
    } catch {}
  };

  const totalWeightage = goals.reduce((s, g) => s + g.weightage, 0);
  const remainingWeightage = 100 - totalWeightage;
  const canAddMore = goals.length < 8;
  const weightageBalanced = Math.abs(totalWeightage - 100) < 0.01;

  const handleAddGoal = async (values: any) => {
    if (!canAddMore) {
      message.error('Maximum 8 goals allowed per employee');
      return;
    }

    setLoading(true);
    try {
      await api.post('/goals', {
        ...values,
        weightage: values.weightage,
        target: values.target,
        deadline: values.deadline?.format('YYYY-MM-DD'),
      });
      message.success('Goal added successfully!');
      form.resetFields();
      form.setFieldValue('weightage', remainingWeightage > 0 ? Math.min(remainingWeightage, 25) : 10);
      fetchGoals();
    } catch (err: any) {
      message.error(err.response?.data?.error || 'Failed to add goal');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitAll = async () => {
    if (!weightageBalanced) {
      message.error(`Total weightage must be 100%. Currently: ${totalWeightage}%`);
      return;
    }
    setSubmitAllLoading(true);
    try {
      await api.post('/goals/submit-all');
      message.success('All goals submitted for manager review!');
      fetchGoals();
      router.push('/employee');
    } catch (err: any) {
      message.error(err.response?.data?.error || 'Submit failed');
    } finally {
      setSubmitAllLoading(false);
    }
  };

  const getWeightageColor = () => {
    if (totalWeightage === 100) return '#5A7A5A';
    if (totalWeightage > 100) return '#7A3A30';
    return '#7A6040';
  };

  const statusColors: Record<string, string> = {
    draft: 'default', submitted: 'warning', approved: 'success',
    rejected: 'error', rework: 'purple', locked: 'blue',
  };

  return (
    <DashboardLayout role="employee">
      <div className="page-content">
        <div className="portal-header">
          <div style={{ color: 'white' }}>
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>Goal Management</div>
            <h1 style={{ fontSize: 26, fontWeight: 800, margin: '4px 0' }}>Create & Manage Goals</h1>
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>
              {user?.name} • {user?.department} • FY 2024-25
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24 }}>
          {/* Goal Form */}
          <div>
            {/* Validation Alerts */}
            {!canAddMore && (
              <Alert
                message="Maximum Goal Limit Reached"
                description="You have reached the maximum limit of 8 goals. Please review and remove any unnecessary goals."
                type="error"
                showIcon
                style={{ marginBottom: 16, borderRadius: 10 }}
              />
            )}
            {totalWeightage > 100 && (
              <Alert
                message="Weightage Overflow"
                description={`Total weightage (${totalWeightage}%) exceeds 100%. Please reduce weightage on existing goals before adding more.`}
                type="error"
                showIcon
                style={{ marginBottom: 16, borderRadius: 10 }}
              />
            )}

            <Card
              title={<span style={{ fontWeight: 700, fontSize: 16 }}>➕ Add New Goal</span>}
              style={{ borderRadius: 16 }}
            >
              <Form
                form={form}
                layout="vertical"
                onFinish={handleAddGoal}
                initialValues={{
                  uomType: 'numeric',
                  higherIsBetter: true,
                  weightage: remainingWeightage > 0 ? Math.min(remainingWeightage, 25) : 10,
                }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <Form.Item label="Thrust Area" name="thrustArea" rules={[{ required: true }]}>
                    <Select placeholder="Select thrust area" showSearch>
                      {THRUST_AREAS.map(a => <Option key={a} value={a}>{a}</Option>)}
                    </Select>
                  </Form.Item>
                  <Form.Item label="UoM Type" name="uomType" rules={[{ required: true }]}>
                    <Select onChange={setUomType}>
                      <Option value="numeric">📊 Numeric</Option>
                      <Option value="percentage">📈 Percentage</Option>
                      <Option value="timeline">📅 Timeline</Option>
                      <Option value="zero-based">⭕ Zero-based</Option>
                    </Select>
                  </Form.Item>
                </div>

                <Form.Item label="Goal Title" name="goalTitle" rules={[{ required: true, min: 5, message: 'Enter a descriptive goal title (min 5 chars)' }]}>
                  <Input placeholder="e.g., Reduce API Response Time to below 200ms" size="large" />
                </Form.Item>

                <Form.Item label="Goal Description" name="goalDescription" rules={[{ required: true, min: 20, message: 'Provide a detailed description (min 20 chars)' }]}>
                  <TextArea
                    rows={3}
                    placeholder="Describe the goal in detail — what will be done, how it will be measured, and why it matters..."
                  />
                </Form.Item>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                  <Form.Item
                    label="Target"
                    name="target"
                    rules={[{ required: true, type: 'number', min: 0.01 }]}
                  >
                    <InputNumber
                      style={{ width: '100%' }}
                      placeholder={uomType === 'zero-based' ? '0' : '100'}
                      min={0}
                      step={uomType === 'percentage' ? 1 : 0.1}
                    />
                  </Form.Item>

                  <Form.Item
                    label={`Weightage % (Remaining: ${remainingWeightage}%)`}
                    name="weightage"
                    rules={[
                      { required: true, type: 'number' },
                      { type: 'number', min: 10, message: 'Minimum weightage is 10%' },
                      { type: 'number', max: 100, message: 'Maximum weightage is 100%' },
                    ]}
                  >
                    <InputNumber
                      style={{ width: '100%' }}
                      min={10}
                      max={Math.max(10, remainingWeightage)}
                      step={5}
                      formatter={v => `${v}%`}
                      parser={v => parseFloat(v?.replace('%', '') || '0') as any}
                    />
                  </Form.Item>

                  {uomType === 'numeric' || uomType === 'percentage' ? (
                    <Form.Item label="Higher is Better?" name="higherIsBetter" valuePropName="checked">
                      <Switch
                        checkedChildren="Yes ↑"
                        unCheckedChildren="No ↓"
                        defaultChecked
                      />
                    </Form.Item>
                  ) : null}
                </div>

                {(uomType === 'timeline') && (
                  <Form.Item label="Deadline" name="deadline" rules={[{ required: true }]}>
                    <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
                  </Form.Item>
                )}

                <Divider />

                <div style={{ display: 'flex', gap: 12 }}>
                  <Button
                    type="primary"
                    htmlType="submit"
                    loading={loading}
                    icon={<PlusOutlined />}
                    disabled={!canAddMore}
                    style={{ flex: 1, height: 44, fontWeight: 700 }}
                  >
                    Add Goal
                  </Button>
                  <Button
                    htmlType="button"
                    icon={<SaveOutlined />}
                    onClick={() => form.resetFields()}
                    style={{ height: 44 }}
                  >
                    Clear
                  </Button>
                </div>
              </Form>
            </Card>
          </div>

          {/* Right Panel — Goal Summary */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Weightage Tracker */}
            <Card style={{ borderRadius: 16 }} title={<span style={{ fontWeight: 700 }}>⚖️ Weightage Tracker</span>}>
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <div style={{ fontSize: 48, fontWeight: 800, color: getWeightageColor() }}>
                  {totalWeightage}%
                </div>
                <div style={{ color: '#A78D78', fontSize: 13 }}>of 100% allocated</div>
              </div>
              <Progress
                percent={Math.min(totalWeightage, 100)}
                strokeColor={getWeightageColor()}
                railColor="#F5F0EA"
                size={10}
                showInfo={false}
              />
              {totalWeightage < 100 && (
                <Alert
                  message={`${100 - totalWeightage}% remaining to allocate`}
                  type="warning"
                  showIcon
                  style={{ marginTop: 12, borderRadius: 8 }}
                />
              )}
              {totalWeightage > 100 && (
                <Alert
                  message={`${totalWeightage - 100}% over limit!`}
                  type="error"
                  showIcon
                  style={{ marginTop: 12, borderRadius: 8 }}
                />
              )}
              {weightageBalanced && (
                <Alert
                  message="Perfect! Weightage balanced"
                  type="success"
                  showIcon
                  icon={<CheckCircleOutlined />}
                  style={{ marginTop: 12, borderRadius: 8 }}
                />
              )}
            </Card>

            {/* Validation Rules */}
            <Card style={{ borderRadius: 16 }} title={<span style={{ fontWeight: 700 }}>📋 Validation Rules</span>}>
              {[
                { rule: 'Total weightage = 100%', ok: weightageBalanced },
                { rule: 'Min 10% per goal', ok: true },
                { rule: `Max 8 goals (${goals.length}/8)`, ok: goals.length <= 8 },
                { rule: 'Locked goals are read-only', ok: true },
              ].map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ color: r.ok ? '#5A7A5A' : '#7A3A30', fontSize: 16 }}>
                    {r.ok ? '✓' : '✗'}
                  </span>
                  <span style={{ fontSize: 13, color: r.ok ? '#291C0E' : '#7A3A30' }}>{r.rule}</span>
                </div>
              ))}
            </Card>

            {/* Current Goals Summary */}
            <Card
              style={{ borderRadius: 16 }}
              title={<span style={{ fontWeight: 700 }}>📌 Current Goals ({goals.length})</span>}
            >
              {goals.length === 0 ? (
                <div style={{ color: '#A78D78', textAlign: 'center', padding: 16, fontSize: 13 }}>
                  No goals added yet
                </div>
              ) : (
                goals.map(g => (
                  <div key={g.id} style={{
                    padding: '10px 0', borderBottom: '1px solid #F5F0EA',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <div style={{ flex: 1, marginRight: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#291C0E' }}>{g.goalTitle}</div>
                      <div style={{ fontSize: 11, color: '#A78D78' }}>{g.thrustArea}</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                      <Tag color={statusColors[g.isLocked ? 'locked' : g.status]} style={{ fontSize: 10, margin: 0 }}>
                        {g.isLocked ? 'Locked' : g.status}
                      </Tag>
                      <span style={{ fontWeight: 700, color: '#291C0E', fontSize: 13 }}>{g.weightage}%</span>
                    </div>
                  </div>
                ))
              )}

              {goals.length > 0 && (
                <Button
                  type="primary"
                  block
                  icon={<SendOutlined />}
                  loading={submitAllLoading}
                  onClick={handleSubmitAll}
                  disabled={!weightageBalanced || goals.every(g => g.status !== 'draft')}
                  style={{ marginTop: 16, height: 44, fontWeight: 700 }}
                >
                  Submit Goal Sheet
                </Button>
              )}
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}