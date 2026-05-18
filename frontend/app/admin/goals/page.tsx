'use client';
import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { Table, Tag, Avatar, Progress, Input, Select, Button, Space, Tooltip, Skeleton } from 'antd';
import { SearchOutlined, FilterOutlined, ReloadOutlined, LockOutlined, CheckCircleOutlined } from '@ant-design/icons';
import type { TablePaginationConfig } from 'antd/es/table';
import DashboardLayout from '../../../components/DashboardLayout';
import api from '../../../lib/api';

const { Search } = Input;

const STATUS_STYLE: Record<string, { background: string; color: string; border: string; label: string; icon: string }> = {
  draft:     { background: '#F5F0EA', color: '#A78D78', border: '#E1D4C2', label: 'Draft',       icon: '📝' },
  submitted: { background: '#F0E8D8', color: '#6E473B', border: '#C8B490', label: 'Submitted',   icon: '📤' },
  approved:  { background: '#EFF4EF', color: '#3A5A3A', border: '#B5C8B5', label: 'Approved',    icon: '✅' },
  rejected:  { background: '#F5ECEA', color: '#7A3A30', border: '#C8A8A0', label: 'Rejected',    icon: '❌' },
  rework:    { background: '#EDE8F5', color: '#5A4A6A', border: '#C4B5D4', label: 'Rework Req.', icon: '🔄' },
  locked:    { background: '#E8E4F0', color: '#291C0E', border: '#BEB5A9', label: 'Locked',      icon: '🔒' },
};

// Module-level cache: avoids re-fetching when switching back to this page
let _goalsCache: { data: any[]; ts: number } | null = null;
const CACHE_TTL = 60_000; // 1 minute

export default function AdminGoalsPage() {
  const [goals, setGoals] = useState<any[]>(_goalsCache?.data ?? []);
  const [loading, setLoading] = useState(!_goalsCache);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [deptFilter, setDeptFilter] = useState('all');
  const [pagination, setPagination] = useState<TablePaginationConfig>({
    current: 1,
    pageSize: 15,
    pageSizeOptions: ['10', '15', '20', '50'],
    showSizeChanger: true,
    showTotal: (total, range) => `${range[0]}–${range[1]} of ${total} goals`,
  });

  // Stable fetch — no callback deps, cache-aware
  const fetchGoals = useCallback((force = false) => {
    const now = Date.now();
    if (!force && _goalsCache && now - _goalsCache.ts < CACHE_TTL) {
      setGoals(_goalsCache.data);
      setLoading(false);
      return;
    }
    setLoading(true);
    api.get('/admin/all-goals')
      .then(r => {
        _goalsCache = { data: r.data, ts: Date.now() };
        setGoals(r.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Run once on mount — stable ref guarantees no re-fire on re-renders
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; fetchGoals(); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const departments = useMemo(
    () => [...new Set<string>(goals.map(g => g.user?.department).filter(Boolean))],
    [goals]
  );

  const filteredGoals = useMemo(() => {
    return goals.filter(g => {
      const q = search.toLowerCase();
      const matchSearch = !q ||
        (g.goalTitle ?? '').toLowerCase().includes(q) ||
        (g.user?.name ?? '').toLowerCase().includes(q) ||
        (g.user?.department ?? '').toLowerCase().includes(q) ||
        (g.thrustArea ?? '').toLowerCase().includes(q);
      const effectiveStatus = g.isLocked ? 'locked' : g.status;
      const matchStatus = statusFilter === 'all' || effectiveStatus === statusFilter;
      const matchDept = deptFilter === 'all' || g.user?.department === deptFilter;
      return matchSearch && matchStatus && matchDept;
    });
  }, [goals, search, statusFilter, deptFilter]);

  const handleTableChange = useCallback((pag: TablePaginationConfig) => {
    setPagination(p => ({ ...p, current: pag.current, pageSize: pag.pageSize }));
  }, []);

  const resetFilters = useCallback(() => {
    setSearch(''); setStatusFilter('all'); setDeptFilter('all');
    setPagination(p => ({ ...p, current: 1 }));
  }, []);

  const getProgressColor = useCallback((v: number) =>
    v >= 80 ? '#5A7A5A' : v >= 50 ? '#7A6040' : '#7A3A30', []);

  const stats = useMemo(() => ({
    total:     goals.length,
    locked:    goals.filter(g => g.isLocked).length,
    approved:  goals.filter(g => g.status === 'approved' && !g.isLocked).length,
    submitted: goals.filter(g => g.status === 'submitted').length,
    draft:     goals.filter(g => g.status === 'draft').length,
  }), [goals]);

  // Columns are stable — memoized so table doesn't re-create on every state change
  const columns = useMemo(() => [
    {
      title: '#',
      width: 44,
      render: (_: any, __: any, i: number) => (
        <span style={{ color: '#A78D78', fontWeight: 700, fontSize: 13 }}>
          {(((pagination.current ?? 1) - 1) * (pagination.pageSize ?? 15)) + i + 1}
        </span>
      ),
    },
    {
      title: 'Employee',
      width: 190,
      render: (_: any, r: any) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar
            size={36}
            style={{ background: 'linear-gradient(135deg,#5A4A6A,#4a3a5a)', fontWeight: 700, flexShrink: 0, fontSize: 15 }}
          >
            {r.user?.name?.charAt(0)}
          </Avatar>
          <div>
            <div style={{ fontWeight: 700, color: '#291C0E', fontSize: 13, lineHeight: 1.3 }}>{r.user?.name}</div>
            <div style={{ fontSize: 11, color: '#A78D78', marginTop: 1 }}>{r.user?.department}</div>
          </div>
        </div>
      ),
    },
    {
      title: 'Goal Title',
      dataIndex: 'goalTitle',
      render: (v: string, r: any) => (
        <div>
          <div style={{ fontWeight: 600, color: '#291C0E', fontSize: 13, lineHeight: 1.4 }}>{v}</div>
          <Tag style={{ fontSize: 10, borderRadius: 4, marginTop: 4, padding: '0 6px' }}>{r.thrustArea}</Tag>
        </div>
      ),
    },
    {
      title: 'UoM / Wt.',
      width: 90,
      render: (_: any, r: any) => (
        <div style={{ textAlign: 'center' }}>
          <Tag color="geekblue" style={{ fontSize: 11, borderRadius: 4, marginBottom: 4 }}>{r.uomType?.toUpperCase()}</Tag>
          <div style={{ fontWeight: 800, color: '#291C0E', fontSize: 15 }}>{r.weightage}%</div>
        </div>
      ),
    },
    {
      title: 'Target / Achieved',
      width: 130,
      render: (_: any, r: any) => (
        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 6, alignItems: 'baseline' }}>
            <span style={{ fontSize: 13, color: '#A78D78' }}>{r.target}</span>
            <span style={{ color: '#BEB5A9' }}>→</span>
            <span style={{ fontSize: 15, fontWeight: 800, color: '#5A7A5A' }}>{r.achievement}</span>
          </div>
        </div>
      ),
    },
    {
      title: 'Progress',
      dataIndex: 'progressScore',
      width: 155,
      sorter: (a: any, b: any) => a.progressScore - b.progressScore,
      render: (v: number) => {
        const pct = Math.min(100, Math.round(v));
        return (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: '#A78D78' }}>Achievement</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: getProgressColor(pct) }}>{pct}%</span>
            </div>
            <Progress
              percent={pct}
              strokeColor={getProgressColor(pct)}
              railColor="#F5F0EA"
              size={7}
              showInfo={false}
            />
          </div>
        );
      },
    },
    {
      title: 'Status',
      width: 140,
      filters: [
        { text: '📝 Draft', value: 'draft' },
        { text: '📤 Submitted', value: 'submitted' },
        { text: '✅ Approved', value: 'approved' },
        { text: '🔒 Locked', value: 'locked' },
        { text: '❌ Rejected', value: 'rejected' },
        { text: '🔄 Rework', value: 'rework' },
      ],
      onFilter: (value: any, r: any) => (r.isLocked ? 'locked' : r.status) === value,
      render: (_: any, r: any) => {
        const key = r.isLocked ? 'locked' : r.status;
        const cfg = STATUS_STYLE[key] || STATUS_STYLE['draft'];
        return (
          <Tag
            icon={r.isLocked ? <LockOutlined /> : cfg.icon === '✅' ? <CheckCircleOutlined /> : undefined}
            style={{ fontWeight: 700, borderRadius: 20, padding: '3px 12px', fontSize: 12,
              background: cfg.background, color: cfg.color, border: `1px solid ${cfg.border}` }}
          >
            {cfg.icon} {cfg.label}
          </Tag>
        );
      },
    },
    {
      title: 'Reviewed By',
      width: 145,
      render: (_: any, r: any) => {
        const approval = r.goalApprovals?.find((a: any) => a.approvalStatus === 'approved') || r.goalApprovals?.[0];
        if (!approval?.manager?.name) {
          return (
            <span style={{ color: '#BEB5A9', fontSize: 12, fontStyle: 'italic' }}>
              {r.status === 'submitted' ? 'Awaiting Review' : '—'}
            </span>
          );
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Avatar size={22} style={{ background: '#6E473B', fontSize: 11, fontWeight: 700 }}>
              {approval.manager.name.charAt(0)}
            </Avatar>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{approval.manager.name}</div>
              <div style={{ fontSize: 10, color: approval.approvalStatus === 'approved' ? '#5A7A5A' : approval.approvalStatus === 'rejected' ? '#7A3A30' : '#5A4A6A' }}>
                {approval.approvalStatus}
              </div>
            </div>
          </div>
        );
      },
    },
  ], [pagination.current, pagination.pageSize, getProgressColor]);

  return (
    <DashboardLayout role="admin">
      <div className="page-content">
        {/* Header */}
        <div className="portal-header" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13 }}>Organization-wide View</div>
              <h1 style={{ color: 'white', fontSize: 26, fontWeight: 800, margin: '4px 0' }}>All Goals</h1>
              <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13 }}>
                {loading ? 'Loading...' : `${filteredGoals.length} of ${goals.length} goals shown`}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              {[
                { label: 'Total',   value: stats.total,     color: '#E1D4C2' },
                { label: 'Locked',  value: stats.locked,    color: '#BEB5A9' },
                { label: 'Pending', value: stats.submitted,  color: '#C8A870' },
              ].map(m => (
                <div key={m.label} style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: '10px 18px', textAlign: 'center', minWidth: 70 }}>
                  {loading
                    ? <Skeleton.Button active size="small" style={{ width: 40, height: 26, display: 'block', margin: '0 auto 4px' }} />
                    : <div style={{ color: m.color, fontSize: 26, fontWeight: 800 }}>{m.value}</div>}
                  <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>{m.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Quick stats filter bar */}
        {loading ? (
          <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
            {[...Array(5)].map((_, i) => (
              <div key={i} className="skeleton-card" style={{ flex: 1, height: 58 }}>
                <div className="skeleton" style={{ height: '100%', borderRadius: 10 }} />
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'All Goals',    value: stats.total,     color: '#6E473B', filter: 'all' },
              { label: '🔒 Locked',   value: stats.locked,    color: '#291C0E', filter: 'locked' },
              { label: '✅ Approved',  value: stats.approved,  color: '#5A7A5A', filter: 'approved' },
              { label: '📤 Submitted', value: stats.submitted, color: '#7A6040', filter: 'submitted' },
              { label: '📝 Draft',    value: stats.draft,     color: '#A78D78', filter: 'draft' },
            ].map(s => (
              <div
                key={s.label}
                onClick={() => { setStatusFilter(s.filter); setPagination(p => ({ ...p, current: 1 })); }}
                style={{
                  background: statusFilter === s.filter ? s.color : 'white',
                  borderRadius: 10, padding: '10px 18px', cursor: 'pointer',
                  border: `2px solid ${statusFilter === s.filter ? s.color : '#E1D4C2'}`,
                  transition: 'all 0.15s', flex: 1, textAlign: 'center',
                  boxShadow: statusFilter === s.filter ? `0 4px 12px ${s.color}35` : 'none',
                }}
              >
                <div style={{ fontWeight: 800, fontSize: 22, color: statusFilter === s.filter ? 'white' : s.color }}>{s.value}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: statusFilter === s.filter ? 'rgba(255,255,255,0.85)' : '#A78D78', marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Goals Table */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E1D4C2', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <div style={{ padding: '16px 24px', borderBottom: '1px solid #F5F0EA', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <span style={{ fontWeight: 700, fontSize: 15, color: '#291C0E' }}>🎯 Organization-wide Goals</span>
            <Space wrap>
              <Search
                placeholder="Search employee, goal, dept..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPagination(p => ({ ...p, current: 1 })); }}
                allowClear
                style={{ width: 240 }}
              />
              <Select
                value={deptFilter}
                onChange={v => { setDeptFilter(v); setPagination(p => ({ ...p, current: 1 })); }}
                style={{ width: 160 }}
                suffixIcon={<FilterOutlined />}
              >
                <Select.Option value="all">All Departments</Select.Option>
                {departments.map(d => <Select.Option key={d} value={d}>{d}</Select.Option>)}
              </Select>
              <Tooltip title="Refresh">
                <Button icon={<ReloadOutlined />} onClick={() => fetchGoals(true)} />
              </Tooltip>
              {(search || statusFilter !== 'all' || deptFilter !== 'all') && (
                <Button size="small" onClick={resetFilters}>Clear Filters</Button>
              )}
            </Space>
          </div>
          <Table
            columns={columns}
            dataSource={filteredGoals}
            rowKey="id"
            loading={loading}
            pagination={{ ...pagination, total: filteredGoals.length }}
            onChange={handleTableChange}
            size="middle"
            scroll={{ x: 1200 }}
            rowClassName={(_, i) => i % 2 === 0 ? '' : 'table-row-alt'}
            locale={{ emptyText: '🔍 No goals match your current filters' }}
          />
        </div>
      </div>
    </DashboardLayout>
  );
}