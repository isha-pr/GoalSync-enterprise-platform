'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { Table, Tag, Button, Modal, message, Space, Input, Select, Tabs, Switch, Form, Avatar, Badge, Empty } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, ReloadOutlined, SearchOutlined, SafetyOutlined, KeyOutlined, SwapOutlined, TeamOutlined } from '@ant-design/icons';
import DashboardLayout from '../../../components/DashboardLayout';
import api from '../../../lib/api';

let _admin_access_requests_cache: { data: any; ts: number } | null = null;

const { Search } = Input;

const ROLES = [{ label: '👤 Employee', value: 'employee' }, { label: '👔 Manager', value: 'manager' }, { label: '🧑‍💼 HR', value: 'hr' }, { label: '🛡️ Admin', value: 'admin' }];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fmtDate = (d: string) => { try { const dt = new Date(d); return `${dt.getDate()} ${MONTHS[dt.getMonth()]} ${dt.getFullYear()}`; } catch { return '—'; } };
const RTAG: any = { employee: <Tag color="green">👤 Employee</Tag>, manager: <Tag color="blue">👔 Manager</Tag>, hr: <Tag color="cyan">🧑‍💼 HR</Tag>, admin: <Tag color="red">🛡️ Admin</Tag> };
const STAG: any = { pending: <Tag color="orange">⏳ Pending</Tag>, approved: <Tag color="green">✅ Approved</Tag>, rejected: <Tag color="red">❌ Rejected</Tag> };
const S = { card: { background: '#fff', borderRadius: 16, border: '1px solid #e8ddd2', boxShadow: '0 2px 8px rgba(92,61,30,0.06)' } };

export default function Page() {
  const [reqs, setReqs] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('pending');
  const [search, setSearch] = useState('');
  const [appModal, setAppModal] = useState<any>({ open: false, req: null, result: null, role: 'employee' });
  const [rejModal, setRejModal] = useState<any>({ open: false, id: '', name: '' });
  const [rejReason, setRejReason] = useState('');
  const [roleModal, setRoleModal] = useState<any>({ open: false, user: null, role: '' });
  const [createModal, setCreateModal] = useState(false);
  const [createForm] = Form.useForm();
  const [busy, setBusy] = useState(false);

  const loadReqs = useCallback(async (force = false) => {
    if (!force && _admin_access_requests_cache && Date.now() - _admin_access_requests_cache.ts < 30_000) {
      setReqs(_admin_access_requests_cache.data); setLoading(false); return;
    }
    setLoading(true);
    try {
      const r = await api.get('/admin/access-requests');
      _admin_access_requests_cache = { data: r.data, ts: Date.now() };
      setReqs(r.data);
    }
    catch { message.error('Failed to load requests'); }
    finally { setLoading(false); }
  }, []);

  const _ar_mounted = useRef(false);
  useEffect(() => { if (!_ar_mounted.current) { _ar_mounted.current = true; loadReqs(); } }, []); // eslint-disable-line

  const loadUsers = useCallback(async () => {
    try { const r = await api.get('/admin/users'); setUsers(r.data); }
    catch { message.error('Failed to load users'); }
  }, []);

  useEffect(() => { if (tab === 'accounts') loadUsers(); }, [tab, loadUsers]);

  const approve = async () => {
    setBusy(true);
    try {
      const r = await api.post(`/admin/access-requests/${appModal.req.id}/approve`, { overrideRole: appModal.role });
      setAppModal((p: any) => ({ ...p, result: r.data.tempPassword || 'Welcome@123' }));
      message.success('Account created'); loadReqs();
    } catch (e: any) { message.error(e.response?.data?.error || 'Failed'); setAppModal({ open: false, req: null, result: null, role: 'employee' }); }
    finally { setBusy(false); }
  };

  const reject = async () => {
    if (!rejReason.trim()) { message.warning('Enter rejection reason'); return; }
    setBusy(true);
    try {
      await api.post(`/admin/access-requests/${rejModal.id}/reject`, { reason: rejReason });
      message.success('Rejected'); setRejModal({ open: false, id: '', name: '' }); setRejReason(''); loadReqs();
    } catch { message.error('Failed'); }
    finally { setBusy(false); }
  };

  const changeRole = async () => {
    setBusy(true);
    try {
      await api.patch(`/admin/users/${roleModal.user.id}/role`, { role: roleModal.role });
      message.success('Role updated'); setRoleModal({ open: false, user: null, role: '' }); loadUsers();
    } catch (e: any) { message.error(e.response?.data?.error || 'Failed'); }
    finally { setBusy(false); }
  };

  const toggleActive = async (u: any) => {
    try {
      await api.patch(`/admin/users/${u.id}/toggle-active`);
      message.success(u.isActive !== false ? 'Deactivated' : 'Activated'); loadUsers();
    } catch (e: any) { message.error(e.response?.data?.error || 'Failed'); }
  };

  const createAccount = async (vals: any) => {
    setBusy(true);
    try {
      const r = await api.post('/admin/create-privileged-account', vals);
      message.success(r.data.message); setCreateModal(false); createForm.resetFields(); loadUsers();
    } catch (e: any) { message.error(e.response?.data?.message || 'Failed'); }
    finally { setBusy(false); }
  };

  const filt = (arr: any[]) => arr.filter(x => !search || x.fullName?.toLowerCase().includes(search.toLowerCase()) || x.name?.toLowerCase().includes(search.toLowerCase()) || x.email?.toLowerCase().includes(search.toLowerCase()) || x.department?.toLowerCase().includes(search.toLowerCase()));
  const pending = filt(reqs).filter(r => r.status === 'pending');
  const history = filt(reqs).filter(r => r.status !== 'pending');
  const fUsers = filt(users);

  const pCols = [
    { title: 'Applicant', render: (_: any, r: any) => <div><b style={{ color: '#2d1a0a' }}>{r.fullName}</b><br /><small style={{ color: '#7a5c3a' }}>{r.email}</small><br /><small style={{ color: '#b8956a' }}>EMP: {r.employeeId}</small></div> },
    { title: 'Department', dataIndex: 'department', render: (d: string) => <Tag style={{ background: '#f5ebe0', color: '#5c3d1e', border: '1px solid #dbc9a8' }}>{d}</Tag> },
    { title: 'Requested Role', dataIndex: 'requestedRole', render: (r: string) => RTAG[r] || RTAG.employee },
    { title: 'Manager', dataIndex: 'managerName', render: (m: string) => <small style={{ color: '#7a5c3a' }}>{m || '—'}</small> },
    { title: 'Assign Role', render: (_: any, r: any) => <Select value={r._role || r.requestedRole || 'employee'} size="small" style={{ width: 130 }} options={ROLES} onChange={v => setReqs(prev => prev.map(x => x.id === r.id ? { ...x, _role: v } : x))} /> },
    { title: 'Submitted', dataIndex: 'submittedAt', render: (d: string) => <small style={{ color: '#7a5c3a' }}>{fmtDate(d)}</small> },
    {
      title: 'Actions', render: (_: any, r: any) => (
        <Space>
          <Button type="primary" size="small" icon={<CheckCircleOutlined />} style={{ background: '#5A7A5A', border: 'none' }} onClick={() => setAppModal({ open: true, req: r, result: null, role: r._role || r.requestedRole || 'employee' })}>Approve</Button>
          <Button danger size="small" icon={<CloseCircleOutlined />} onClick={() => setRejModal({ open: true, id: r.id, name: r.fullName })}>Reject</Button>
        </Space>
      )
    },
  ];

  const hCols = [
    { title: 'Applicant', render: (_: any, r: any) => <div><b style={{ color: '#2d1a0a' }}>{r.fullName}</b><br /><small style={{ color: '#7a5c3a' }}>{r.email}</small></div> },
    { title: 'Department', dataIndex: 'department', render: (d: string) => <Tag style={{ background: '#f5ebe0', color: '#5c3d1e', border: '1px solid #dbc9a8' }}>{d}</Tag> },
    { title: 'Role', render: (_: any, r: any) => RTAG[r.approvedRole || r.requestedRole] || RTAG.employee },
    { title: 'Status', dataIndex: 'status', render: (s: string) => STAG[s] },
    { title: 'Reviewed By', render: (_: any, r: any) => r.reviewedBy ? <div><b style={{ color: '#2d1a0a', fontSize: 13 }}>{r.reviewedBy}</b><br /><small style={{ color: '#7a5c3a' }}>{r.reviewedAt ? new Date(r.reviewedAt).toLocaleDateString('en-IN') : ''}</small></div> : <span style={{ color: '#b8956a' }}>—</span> },
    { title: 'Rejection Reason', render: (_: any, r: any) => r.rejectionReason ? <small style={{ color: '#7a3c3c' }}>{r.rejectionReason}</small> : <span style={{ color: '#b8956a' }}>—</span> },
  ];

  const uCols = [
    { title: 'User', render: (_: any, u: any) => <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Avatar style={{ background: 'linear-gradient(135deg,#6E473B,#291C0E)', fontWeight: 700 }}>{u.name?.[0]}</Avatar><div><b style={{ color: '#2d1a0a' }}>{u.name}</b><br /><small style={{ color: '#7a5c3a' }}>{u.email}</small></div></div> },
    { title: 'Department', dataIndex: 'department', render: (d: string) => <Tag style={{ background: '#f5ebe0', color: '#5c3d1e', border: '1px solid #dbc9a8' }}>{d}</Tag> },
    { title: 'Role', dataIndex: 'role', render: (r: string) => RTAG[r] || <Tag>{r}</Tag> },
    { title: 'Registered', dataIndex: 'createdAt', render: (d: string) => <small style={{ color: '#7a5c3a' }}>{fmtDate(d)}</small> },
    { title: 'Account Status', render: (_: any, u: any) => <Switch checked={u.isActive !== false} size="small" onChange={() => toggleActive(u)} checkedChildren="Active" unCheckedChildren="Off" style={{ background: u.isActive !== false ? '#5A7A5A' : undefined }} /> },
    { title: 'Role Mgmt', render: (_: any, u: any) => <Button size="small" icon={<SwapOutlined />} onClick={() => setRoleModal({ open: true, user: u, role: u.role })} style={{ borderColor: '#dbc9a8', color: '#5c3d1e', fontWeight: 600 }}>Reassign</Button> },
  ];

  return (
    <DashboardLayout role="admin">
      <div style={{ padding: '28px 32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(135deg,#5c3d1e,#8b5e3c)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 22 }}><SafetyOutlined /></div>
            <div>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: '#2d1a0a' }}>Admin Control Center</h1>
              <p style={{ margin: 0, color: '#7a5c3a', fontSize: 13 }}>Access management · Role assignment · Account control</p>
            </div>
          </div>
          <Space>
            <Button icon={<SafetyOutlined />} type="primary" onClick={() => setCreateModal(true)} style={{ background: 'linear-gradient(135deg,#5c3d1e,#8b5e3c)', border: 'none', fontWeight: 700, borderRadius: 8 }}>Create Admin/HR Account</Button>
            <Button icon={<ReloadOutlined />} onClick={() => { loadReqs(); if (tab === 'accounts') loadUsers(); }} style={{ borderRadius: 8 }}>Refresh</Button>
          </Space>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 14, marginBottom: 20 }}>
          {[
            { l: 'Total Requests', v: reqs.length, i: '📋', c: '#5c3d1e', b: '#f5ebe0' },
            { l: 'Pending', v: reqs.filter(r => r.status === 'pending').length, i: '⏳', c: '#6E473B', b: '#F0E8D8' },
            { l: 'Approved', v: reqs.filter(r => r.status === 'approved').length, i: '✅', c: '#5A7A5A', b: '#EFF4EF' },
            { l: 'Rejected', v: reqs.filter(r => r.status === 'rejected').length, i: '❌', c: '#7A3A30', b: '#F5ECEA' },
            { l: 'Active Users', v: users.filter(u => u.isActive !== false).length, i: '👥', c: '#4A6070', b: '#ECF1F5' },
          ].map(x => (
            <div key={x.l} style={{ ...S.card, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: x.b, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{x.i}</div>
              <div><div style={{ fontSize: 26, fontWeight: 900, color: x.c, lineHeight: 1 }}>{x.v}</div><div style={{ fontSize: 12, color: '#7a5c3a', fontWeight: 600, marginTop: 3 }}>{x.l}</div></div>
            </div>
          ))}
        </div>

        <div style={{ marginBottom: 14 }}>
          <Input prefix={<SearchOutlined style={{ color: '#b8956a' }} />} placeholder="Search name, email, department..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: 320, borderRadius: 8, borderColor: '#dbc9a8' }} />
        </div>

        <div style={{ ...S.card, overflow: 'hidden' }}>
          <Tabs activeKey={tab} onChange={t => setTab(t)} style={{ padding: '0 20px' }} items={[
            {
              key: 'pending',
              label: <span style={{ fontWeight: 700 }}>⏳ Pending Requests <Badge count={pending.length} style={{ marginLeft: 6, background: '#6E473B' }} /></span>,
              children: <div style={{ padding: '4px 0 16px' }}><Table columns={pCols} dataSource={pending} rowKey="id" loading={loading} pagination={{ pageSize: 8, showSizeChanger: false }} locale={{ emptyText: <Empty description="No pending requests" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }} /></div>,
            },
            {
              key: 'history',
              label: <span style={{ fontWeight: 700 }}>📜 Registration History ({history.length})</span>,
              children: <div style={{ padding: '4px 0 16px' }}><Table columns={hCols} dataSource={history} rowKey="id" loading={loading} pagination={{ pageSize: 10, showSizeChanger: false }} locale={{ emptyText: <Empty description="No processed requests" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }} /></div>,
            },
            {
              key: 'accounts',
              label: <span style={{ fontWeight: 700 }}>👥 User Accounts ({users.length})</span>,
              children: <div style={{ padding: '4px 0 16px' }}><Table columns={uCols} dataSource={fUsers} rowKey="id" pagination={{ pageSize: 10, showSizeChanger: false }} locale={{ emptyText: <Empty description="No users found" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }} /></div>,
            },
          ]} />
        </div>
      </div>

      {/* Approve Modal */}
      <Modal open={appModal.open} onCancel={() => setAppModal({ open: false, req: null, result: null, role: 'employee' })} width={500}
        title={<span><CheckCircleOutlined style={{ color: '#5A7A5A', marginRight: 8 }} /><b>Approve Access Request</b></span>}
        footer={appModal.result ? [
          <Button key="d" type="primary" style={{ background: '#5A7A5A', border: 'none', fontWeight: 700 }} onClick={() => setAppModal({ open: false, req: null, result: null, role: 'employee' })}>Done</Button>
        ] : [
          <Button key="c" onClick={() => setAppModal({ open: false, req: null, result: null, role: 'employee' })}>Cancel</Button>,
          <Button key="a" type="primary" loading={busy} onClick={approve} style={{ background: '#5A7A5A', border: 'none', fontWeight: 700 }}>✅ Approve & Create Account</Button>,
        ]}>
        {!appModal.result ? (
          <div>
            <div style={{ background: '#F0E8D8', borderRadius: 10, padding: '14px 18px', marginBottom: 16 }}>
              <b style={{ color: '#2d1a0a', fontSize: 15 }}>👤 {appModal.req?.fullName}</b><br />
              <small style={{ color: '#7a5c3a' }}>{appModal.req?.email} · {appModal.req?.department}</small><br />
              <small style={{ color: '#b8956a' }}>EMP: {appModal.req?.employeeId} | Manager: {appModal.req?.managerName || 'N/A'} | Reason: {appModal.req?.reason || 'N/A'}</small>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontWeight: 700, color: '#2d1a0a', display: 'block', marginBottom: 6 }}>Assign Role</label>
              <Select value={appModal.role} onChange={val => setAppModal((p: any) => ({ ...p, role: val }))} options={ROLES} style={{ width: '100%' }} />
            </div>
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#92400e' }}>
              ⚠️ Temporary password <b>Welcome@123</b> will be set. Employee must change on first login.
            </div>
          </div>
        ) : (
          <div>
            <div style={{ background: '#EFF4EF', border: '1px solid #B5C8B5', borderRadius: 12, padding: '16px 20px', marginBottom: 14 }}>
              <b style={{ color: '#2a4a2a' }}>✅ Account created for {appModal.req?.fullName}</b><br />
              <small>Email: {appModal.req?.email} | Role: {appModal.role} | Dept: {appModal.req?.department}</small>
            </div>
            <div style={{ background: '#F0E8D8', border: '1px solid #C8B490', borderRadius: 12, padding: '14px 18px' }}>
              <div style={{ fontWeight: 700, color: '#6E473B', marginBottom: 6 }}>🔑 Temporary Password</div>
              <div style={{ fontFamily: 'monospace', fontSize: 22, fontWeight: 900, color: '#6E473B', letterSpacing: 3 }}>{appModal.result}</div>
              <small style={{ color: '#78350f' }}>Share securely. Must be changed on first login.</small>
            </div>
          </div>
        )}
      </Modal>

      {/* Reject Modal */}
      <Modal open={rejModal.open} onCancel={() => { setRejModal({ open: false, id: '', name: '' }); setRejReason(''); }}
        onOk={reject} confirmLoading={busy} okText="Reject Request" okButtonProps={{ danger: true, style: { fontWeight: 700 } }}
        title={<span><CloseCircleOutlined style={{ color: '#7A3A30', marginRight: 8 }} /><b>Reject Access Request</b></span>}>
        <p style={{ color: '#4a3520' }}>Rejecting request from <b>{rejModal.name}</b>. The applicant will not gain access to GoalSync.</p>
        <label style={{ fontWeight: 700, color: '#2d1a0a', display: 'block', marginBottom: 6 }}>Rejection Reason <span style={{ color: '#7A3A30' }}>*</span></label>
        <Input.TextArea placeholder="Provide a clear reason for rejection..." value={rejReason} onChange={e => setRejReason(e.target.value)} rows={4} style={{ borderRadius: 8, borderColor: '#dbc9a8' }} />
        <small style={{ color: '#7a5c3a' }}>This reason will be stored and shown in Registration History.</small>
      </Modal>

      {/* Role Change Modal */}
      <Modal open={roleModal.open} onCancel={() => setRoleModal({ open: false, user: null, role: '' })}
        onOk={changeRole} confirmLoading={busy} okText="Update Role" okButtonProps={{ style: { background: '#5c3d1e', border: 'none', fontWeight: 700 } }}
        title={<span><SwapOutlined style={{ color: '#5c3d1e', marginRight: 8 }} /><b>Role Assignment — {roleModal.user?.name}</b></span>}>
        <p style={{ color: '#4a3520' }}>Current role: <b>{roleModal.user?.role}</b></p>
        <label style={{ fontWeight: 700, color: '#2d1a0a', display: 'block', marginBottom: 6 }}>Assign New Role</label>
        <Select value={roleModal.role} onChange={val => setRoleModal((p: any) => ({ ...p, role: val }))} options={ROLES} style={{ width: '100%' }} />
        <br /><small style={{ color: '#7a5c3a', display: 'block', marginTop: 8 }}>The user will be notified of this role change via in-app notification.</small>
      </Modal>

      {/* Create Admin/HR Modal */}
      <Modal open={createModal} onCancel={() => { setCreateModal(false); createForm.resetFields(); }}
        onOk={() => createForm.submit()} confirmLoading={busy} okText="Create Account"
        okButtonProps={{ style: { background: 'linear-gradient(135deg,#5c3d1e,#8b5e3c)', border: 'none', fontWeight: 700 } }}
        title={<span><SafetyOutlined style={{ color: '#5c3d1e', marginRight: 8 }} /><b>Create Admin / HR Account</b></span>} width={520}>
        <div style={{ background: '#F0E8D8', border: '1px solid #C8B490', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#6E473B' }}>
          🔐 Privileged account creation. Admin Secret Key is required.
        </div>
        <Form form={createForm} onFinish={createAccount} layout="vertical">
          <Form.Item name="adminSecretKey" label={<b>Admin Secret Key</b>} rules={[{ required: true, message: 'Secret key required' }]}>
            <Input.Password placeholder="Enter admin secret key..." style={{ borderRadius: 8, borderColor: '#dbc9a8' }} />
          </Form.Item>
          <Form.Item name="role" label={<b>Account Role</b>} rules={[{ required: true, message: 'Select role' }]}>
            <Select placeholder="Select role..." options={[{ label: '🛡️ Admin', value: 'admin' }, { label: '🧑‍💼 HR', value: 'hr' }, { label: '👔 Manager', value: 'manager' }]} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="name" label={<b>Full Name</b>} rules={[{ required: true, message: 'Name required' }]}>
            <Input placeholder="Full name..." style={{ borderRadius: 8, borderColor: '#dbc9a8' }} />
          </Form.Item>
          <Form.Item name="email" label={<b>Email Address</b>} rules={[{ required: true, type: 'email', message: 'Valid email required' }]}>
            <Input placeholder="email@company.com" style={{ borderRadius: 8, borderColor: '#dbc9a8' }} />
          </Form.Item>
          <Form.Item name="department" label={<b>Department</b>} rules={[{ required: true, message: 'Department required' }]}>
            <Input placeholder="e.g. Human Resources" style={{ borderRadius: 8, borderColor: '#dbc9a8' }} />
          </Form.Item>
          <Form.Item name="password" label={<b>Password</b>} rules={[{ required: true, min: 8, message: 'Min 8 characters' }]}>
            <Input.Password placeholder="Min 8 characters..." style={{ borderRadius: 8, borderColor: '#dbc9a8' }} />
          </Form.Item>
        </Form>
      </Modal>

      <style>{`
        .ant-tabs-tab { font-size: 13px !important; }
        .ant-table-thead > tr > th { background: #f5ebe0 !important; color: #5c3d1e !important; font-weight: 700 !important; }
      `}</style>
    </DashboardLayout>
  );
}