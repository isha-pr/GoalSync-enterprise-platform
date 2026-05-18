'use client';
import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { Table, Tag, Button, Modal, message, Input, Select, Progress, Avatar, Skeleton } from 'antd';
import { UnlockOutlined, SearchOutlined, WarningOutlined, LockOutlined } from '@ant-design/icons';
import DashboardLayout from '../../../components/DashboardLayout';
import api from '../../../lib/api';

const { Search } = Input;
const { Option } = Select;

// Module-level cache — locked goals change rarely, cache 90s
let _lockedCache: { data: any[]; ts: number } | null = null;
const CACHE_TTL = 90_000;

export default function UnlockPage() {
  const [goals, setGoals] = useState<any[]>(_lockedCache?.data ?? []);
  const [loading, setLoading] = useState(!_lockedCache);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [unlockLoading, setUnlockLoading] = useState<string | null>(null);

  const fetchGoals = useCallback((force = false) => {
    const now = Date.now();
    if (!force && _lockedCache && now - _lockedCache.ts < CACHE_TTL) {
      setGoals(_lockedCache.data);
      setLoading(false);
      return;
    }
    setLoading(true);
    // Only fetch locked goals by passing status filter — avoids downloading entire goal dataset
    api.get('/admin/all-goals', { params: { status: 'locked' } })
      .then(r => {
        // Filter locked client-side from the response (backend may not support param, so be safe)
        const locked = r.data.filter((g: any) => g.isLocked);
        _lockedCache = { data: locked, ts: Date.now() };
        setGoals(locked);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; fetchGoals(); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleUnlock = useCallback((goal: any) => {
    Modal.confirm({
      title: '🔓 Unlock Goal',
      content: (
        <div>
          <p>Are you sure you want to unlock the following goal?</p>
          <div style={{ background: '#F0E8D8', borderRadius: 8, padding: 12, marginTop: 8, border: '1px solid #fde68a' }}>
            <div style={{ fontWeight: 700 }}>{goal.goalTitle}</div>
            <div style={{ fontSize: 12, color: '#A78D78' }}>Employee: {goal.user.name}</div>
          </div>
          <p style={{ marginTop: 12, color: '#7A3A30', fontSize: 13 }}>
            ⚠️ Unlocking will allow the employee to edit this goal. An audit log will be created.
          </p>
        </div>
      ),
      icon: <WarningOutlined style={{ color: '#7A6040' }} />,
      okText: 'Confirm Unlock',
      okButtonProps: { style: { background: '#7A6040', borderColor: '#7A6040' } },
      onOk: async () => {
        setUnlockLoading(goal.id);
        try {
          await api.post(`/admin/goals/${goal.id}/unlock`);
          message.success(`Goal "${goal.goalTitle}" has been unlocked!`);
          // Invalidate cache and re-fetch
          _lockedCache = null;
          fetchGoals(true);
        } catch (err: any) {
          message.error(err.response?.data?.error || 'Unlock failed');
        } finally {
          setUnlockLoading(null);
        }
      },
    });
  }, [fetchGoals]);

  const departments = useMemo(
    () => [...new Set(goals.map(g => g.user?.department).filter(Boolean))],
    [goals]
  );

  const filteredGoals = useMemo(() => {
    const q = search.toLowerCase();
    return goals.filter(g => {
      const matchSearch = !q ||
        (g.goalTitle ?? '').toLowerCase().includes(q) ||
        (g.user?.name ?? '').toLowerCase().includes(q);
      const matchDept = deptFilter === 'all' || g.user?.department === deptFilter;
      return matchSearch && matchDept;
    });
  }, [goals, search, deptFilter]);

  const columns = useMemo(() => [
    {
      title: 'Employee',
      render: (_: any, r: any) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar style={{ background: '#5A4A6A', fontWeight: 700 }}>{r.user?.name?.charAt(0)}</Avatar>
          <div>
            <div style={{ fontWeight: 700 }}>{r.user?.name}</div>
            <div style={{ fontSize: 12, color: '#A78D78' }}>{r.user?.department}</div>
          </div>
        </div>
      ),
      width: 180,
    },
    {
      title: 'Locked Goal',
      render: (_: any, r: any) => (
        <div>
          <div style={{ fontWeight: 700, color: '#291C0E', marginBottom: 4 }}>{r.goalTitle}</div>
          <div style={{ fontSize: 12, color: '#A78D78', marginBottom: 4 }}>{r.thrustArea}</div>
          <Tag color="geekblue">{r.uomType?.toUpperCase()}</Tag>
        </div>
      ),
    },
    { title: 'Target',    dataIndex: 'target',    width: 80,  render: (v: number) => <strong>{v}</strong> },
    { title: 'Weightage', dataIndex: 'weightage', width: 90,  render: (v: number) => <strong style={{ color: '#291C0E' }}>{v}%</strong> },
    {
      title: 'Progress', width: 160,
      render: (_: any, r: any) => (
        <Progress
          percent={Math.round(r.progressScore)}
          strokeColor={r.progressScore >= 80 ? '#5A7A5A' : '#7A6040'}
          size={6}
        />
      ),
    },
    {
      title: 'Locked Since', width: 140,
      render: (_: any, r: any) => {
        const approval = r.goalApprovals?.[0];
        return approval ? (
          <div style={{ fontSize: 12, color: '#A78D78' }}>
            <div>{new Date(approval.approvedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
            <div>by {approval.manager?.name}</div>
          </div>
        ) : <span style={{ color: '#BEB5A9' }}>—</span>;
      },
    },
    {
      title: 'Action', width: 140, fixed: 'right' as const,
      render: (_: any, r: any) => (
        <Button
          type="primary"
          size="small"
          icon={<UnlockOutlined />}
          loading={unlockLoading === r.id}
          onClick={() => handleUnlock(r)}
          style={{ background: '#7A6040', borderColor: '#7A6040', fontWeight: 700 }}
        >
          Unlock
        </Button>
      ),
    },
  ], [unlockLoading, handleUnlock]);

  return (
    <DashboardLayout role="admin">
      <div className="page-content">

        {/* Header */}
        <div className="portal-header" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>Admin Override</div>
              <h1 style={{ color: 'white', fontSize: 26, fontWeight: 800, margin: '4px 0' }}>Goal Unlock Center</h1>
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>
                {loading ? 'Loading locked goals...' : `${goals.length} locked goals • Admin-only override control`}
              </div>
            </div>
            {/* Quick stat */}
            <div style={{ background: 'rgba(255,255,255,0.12)', borderRadius: 14, padding: '14px 28px', textAlign: 'center' }}>
              {loading
                ? <Skeleton.Button active size="large" style={{ width: 60, height: 36 }} />
                : <div style={{ color: '#BEB5A9', fontSize: 32, fontWeight: 900 }}>{goals.length}</div>}
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 2 }}>🔒 Locked</div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E1D4C2', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>

          {/* Toolbar */}
          <div style={{ padding: '16px 24px', borderBottom: '1px solid #F5F0EA', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: 15, color: '#291C0E' }}>🔒 Locked Goals</span>
            <div style={{ display: 'flex', gap: 12 }}>
              <Search
                placeholder="Search goal or employee..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ width: 240 }}
                prefix={<SearchOutlined />}
                allowClear
              />
              <Select value={deptFilter} onChange={setDeptFilter} style={{ width: 160 }}>
                <Option value="all">All Departments</Option>
                {departments.map(d => <Option key={d} value={d}>{d}</Option>)}
              </Select>
              <Button
                icon={<UnlockOutlined />}
                onClick={() => { _lockedCache = null; fetchGoals(true); }}
                loading={loading}
              >
                Refresh
              </Button>
            </div>
          </div>

          {/* Skeleton rows while loading */}
          {loading ? (
            <div style={{ padding: '20px 24px' }}>
              {[...Array(6)].map((_, i) => (
                <div key={i} className="skeleton-row skeleton" style={{ marginBottom: 10 }} />
              ))}
            </div>
          ) : filteredGoals.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60 }}>
              <LockOutlined style={{ fontSize: 48, color: '#5A7A5A', marginBottom: 16 }} />
              <div style={{ fontWeight: 700, fontSize: 16, color: '#291C0E', marginBottom: 6 }}>No locked goals found</div>
              <div style={{ color: '#A78D78', fontSize: 13 }}>
                {search || deptFilter !== 'all' ? 'Try clearing your filters' : 'All goals are currently unlocked'}
              </div>
            </div>
          ) : (
            <Table
              columns={columns}
              dataSource={filteredGoals}
              rowKey="id"
              loading={false}
              pagination={{
                pageSize: 10,
                pageSizeOptions: ['10', '20', '50'],
                showSizeChanger: true,
                showTotal: (total, range) => `${range[0]}–${range[1]} of ${total} locked goals`,
              }}
              size="middle"
              scroll={{ x: 1000 }}
              rowClassName={() => 'ant-table-row'}
            />
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}