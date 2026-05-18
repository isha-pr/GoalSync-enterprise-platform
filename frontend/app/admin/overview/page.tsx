'use client';
import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { Card, Table, Tag, Avatar, Progress, Input, Button, Tooltip } from 'antd';
import { SearchOutlined, LockOutlined, EyeOutlined, ReloadOutlined } from '@ant-design/icons';
import type { TablePaginationConfig } from 'antd/es/table';
import DashboardLayout from '../../../components/DashboardLayout';
import api from '../../../lib/api';
import { useRouter } from 'next/navigation';

let _admin_overview_cache: { data: any; ts: number } | null = null;

const { Search } = Input;

export default function AdminOverview() {
  const [overview, setOverview] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const router = useRouter();
  const [pagination, setPagination] = useState<TablePaginationConfig>({
    current: 1,
    pageSize: 10,
    pageSizeOptions: ['5', '10', '15', '20', '50'],
    showSizeChanger: true,
    showTotal: (total, range) => `${range[0]}–${range[1]} of ${total} employees`,
  });

  const fetchData = useCallback((force = false) => {
    const now = Date.now();
    if (!force && _admin_overview_cache && now - _admin_overview_cache.ts < 60_000) {
      setOverview(_admin_overview_cache.data); setLoading(false); return;
    }
    setLoading(true);
    api.get('/admin/overview')
      .then(r => { _admin_overview_cache = { data: r.data, ts: Date.now() }; setOverview(r.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const _mounted = useRef(false);
  useEffect(() => { if (!_mounted.current) { _mounted.current = true; fetchData(); } }, []); // eslint-disable-line

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return !q ? overview : overview.filter(r =>
      r.name.toLowerCase().includes(q) ||
      r.department.toLowerCase().includes(q) ||
      r.email?.toLowerCase().includes(q)
    );
  }, [overview, search]);

  const handleTableChange = useCallback((pag: TablePaginationConfig) => {
    setPagination(p => ({ ...p, current: pag.current, pageSize: pag.pageSize }));
  }, []);

  // Summary stats
  const summary = useMemo(() => ({
    total: overview.length,
    allLocked: overview.filter(r => r.locked === r.totalGoals && r.totalGoals > 0).length,
    allSubmitted: overview.filter(r => r.submitted === r.totalGoals && r.totalGoals > 0).length,
    noGoals: overview.filter(r => r.totalGoals === 0).length,
    inProgress: overview.filter(r => r.totalGoals > 0 && r.submitted < r.totalGoals).length,
  }), [overview]);

  const columns = [
    {
      title: '#', width: 44,
      render: (_: any, __: any, i: number) => (
        <span style={{ color: '#A78D78', fontWeight: 700 }}>
          {(((pagination.current ?? 1) - 1) * (pagination.pageSize ?? 10)) + i + 1}
        </span>
      ),
    },
    {
      title: 'Employee',
      render: (_: any, r: any) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar
            size={38}
            style={{ background: 'linear-gradient(135deg,#6E473B,#291C0E)', fontWeight: 700, fontSize: 16, flexShrink: 0 }}
          >
            {r.name.charAt(0)}
          </Avatar>
          <div>
            <div style={{ fontWeight: 700, color: '#291C0E', fontSize: 13 }}>{r.name}</div>
            <div style={{ fontSize: 11, color: '#A78D78', marginTop: 1 }}>{r.department} · {r.email}</div>
          </div>
        </div>
      ),
    },
    {
      title: 'Goals',
      dataIndex: 'totalGoals',
      width: 72,
      sorter: (a: any, b: any) => a.totalGoals - b.totalGoals,
      render: (v: number) => (
        <div style={{ textAlign: 'center', fontWeight: 900, fontSize: 20, color: '#291C0E' }}>{v}</div>
      ),
    },
    {
      title: 'Submitted',
      width: 105,
      sorter: (a: any, b: any) => a.submitted - b.submitted,
      render: (_: any, r: any) => (
        <Tag
          style={{ fontWeight: 700,
            background: r.submitted===r.totalGoals&&r.totalGoals>0?'#EFF4EF':'#F0E8D8',
            color: r.submitted===r.totalGoals&&r.totalGoals>0?'#3A5A3A':'#6E473B',
            border: `1px solid ${r.submitted===r.totalGoals&&r.totalGoals>0?'#B5C8B5':'#C8B490'}` }}
        >
          {r.submitted} / {r.totalGoals}
        </Tag>
      ),
    },
    {
      title: 'Locked',
      dataIndex: 'locked',
      width: 90,
      sorter: (a: any, b: any) => a.locked - b.locked,
      render: (v: number, r: any) => (
        <Tag
          icon={v > 0 ? <LockOutlined /> : undefined}
          style={{ fontWeight: 700,
            background: v>0?(v===r.totalGoals?'#E8E4F0':'#F0E8D8'):'#F5F0EA',
            color: v>0?(v===r.totalGoals?'#291C0E':'#6E473B'):'#A78D78',
            border: `1px solid ${v>0?(v===r.totalGoals?'#BEB5A9':'#C8B490'):'#E1D4C2'}` }}
        >
          {v} / {r.totalGoals}
        </Tag>
      ),
    },
    {
      title: 'Check-ins',
      dataIndex: 'checkinsCompleted',
      width: 95,
      sorter: (a: any, b: any) => a.checkinsCompleted - b.checkinsCompleted,
      render: (v: number) => (
        <Tag style={{ fontWeight: 700, fontSize: 13,
          background: v>0?'#EFF4EF':'#F5F0EA',
          color: v>0?'#3A5A3A':'#A78D78',
          border: `1px solid ${v>0?'#B5C8B5':'#E1D4C2'}` }}>{v}</Tag>
      ),
    },
    {
      title: 'Avg Progress',
      dataIndex: 'avgProgress',
      width: 185,
      sorter: (a: any, b: any) => a.avgProgress - b.avgProgress,
      render: (v: number) => (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 11, color: '#A78D78' }}>Progress</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: v >= 70 ? '#5A7A5A' : v >= 50 ? '#7A6040' : '#7A3A30' }}>
              {v}%
            </span>
          </div>
          <Progress
            percent={v}
            strokeColor={v >= 70 ? '#5A7A5A' : v >= 50 ? '#7A6040' : '#7A3A30'}
            railColor="#F5F0EA"
            size={8}
            showInfo={false}
          />
        </div>
      ),
    },
    {
      title: 'Status',
      width: 150,
      render: (_: any, r: any) => {
        const allLocked = r.locked === r.totalGoals && r.totalGoals > 0;
        const allSubmitted = r.submitted === r.totalGoals && r.totalGoals > 0;
        const noGoals = r.totalGoals === 0;
        const inProgress = !allLocked && !allSubmitted && !noGoals;
        return (
          <Tag
            style={{ fontWeight: 700, borderRadius: 20, padding: '3px 12px', fontSize: 12,
              background: allLocked?'#E8E4F0':allSubmitted?'#EFF4EF':noGoals?'#F5ECEA':'#F0E8D8',
              color: allLocked?'#291C0E':allSubmitted?'#3A5A3A':noGoals?'#7A3A30':'#6E473B',
              border: `1px solid ${allLocked?'#BEB5A9':allSubmitted?'#B5C8B5':noGoals?'#C8A8A0':'#C8B490'}` }}
          >
            {allLocked ? '🔒 All Locked' : allSubmitted ? '✅ All Submitted' : noGoals ? '❌ No Goals' : '⏳ In Progress'}
          </Tag>
        );
      },
      filters: [
        { text: '🔒 All Locked', value: 'locked' },
        { text: '✅ All Submitted', value: 'submitted' },
        { text: '⏳ In Progress', value: 'progress' },
        { text: '❌ No Goals', value: 'none' },
      ],
      onFilter: (value: any, r: any) => {
        if (value === 'locked') return r.locked === r.totalGoals && r.totalGoals > 0;
        if (value === 'submitted') return r.submitted === r.totalGoals && r.totalGoals > 0 && r.locked < r.totalGoals;
        if (value === 'none') return r.totalGoals === 0;
        return r.totalGoals > 0 && r.submitted < r.totalGoals;
      },
    },
    {
      title: '', width: 50,
      render: () => (
        <Tooltip title="View All Goals">
          <Button
            size="small" type="text" icon={<EyeOutlined />}
            onClick={() => router.push('/admin/goals')}
          />
        </Tooltip>
      ),
    },
  ];

  return (
    <DashboardLayout role="admin">
      <div className="page-content">
        {/* Header */}
        <div className="portal-header" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13 }}>HR Administration</div>
              <h1 style={{ color: 'white', fontSize: 26, fontWeight: 800, margin: '4px 0' }}>Employee Overview</h1>
              <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13 }}>
                {filtered.length} of {overview.length} employees
              </div>
            </div>
          </div>
        </div>

        {/* Summary row */}
        <div style={{ display: 'flex', gap: 14, marginBottom: 22 }}>
          {[
            { label: 'Total Employees', value: summary.total, color: '#6E473B', bg: '#E1D4C2' },
            { label: '🔒 Fully Locked', value: summary.allLocked, color: '#5A4A6A', bg: '#EDE8F5' },
            { label: '✅ All Submitted', value: summary.allSubmitted, color: '#5A7A5A', bg: '#EFF4EF' },
            { label: '⏳ In Progress', value: summary.inProgress, color: '#7A6040', bg: '#F0E8D8' },
            { label: '❌ No Goals Yet', value: summary.noGoals, color: '#7A3A30', bg: '#EDE0DD' },
          ].map(s => (
            <div key={s.label} style={{ flex: 1, background: s.bg, borderRadius: 12, padding: '14px 16px', border: `1px solid ${s.color}25` }}>
              <div style={{ fontSize: 26, fontWeight: 900, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 11, color: '#A78D78', fontWeight: 600, marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        <Card
          title={<span style={{ fontWeight: 700 }}>👥 Employee Goal Tracker</span>}
          extra={
            <div style={{ display: 'flex', gap: 10 }}>
              <Search
                placeholder="Search name, dept, email..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPagination(p => ({ ...p, current: 1 })); }}
                allowClear
                style={{ width: 240 }}
              />
              <Tooltip title="Refresh">
                <Button icon={<ReloadOutlined />} onClick={fetchData} />
              </Tooltip>
            </div>
          }
          style={{ borderRadius: 16 }}
        >
          <Table
            columns={columns}
            dataSource={filtered}
            rowKey="id"
            loading={loading}
            pagination={{ ...pagination, total: filtered.length }}
            onChange={handleTableChange}
            size="middle"
            rowClassName={(_, i) => i % 2 === 0 ? '' : 'table-row-alt'}
            locale={{ emptyText: search ? '🔍 No employees match your search' : 'No employees found' }}
          />
        </Card>
      </div>
    </DashboardLayout>
  );
}