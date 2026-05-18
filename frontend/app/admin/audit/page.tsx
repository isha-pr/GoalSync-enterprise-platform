'use client';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { Card, Table, Tag, Input, Select, Avatar, Badge } from 'antd';
import { SearchOutlined, HistoryOutlined, FilterOutlined } from '@ant-design/icons';
import type { TablePaginationConfig } from 'antd/es/table';
import DashboardLayout from '../../../components/DashboardLayout';
import api from '../../../lib/api';
import { AuditLog } from '../../../lib/types';

let _admin_audit_cache: { data: any; ts: number } | null = null;

const { Search } = Input;

const ACTION_CONFIG: Record<string, { color: string; bg: string; border: string; label: string; icon: string }> = {
  GOAL_CREATED:         { color: '#3A5A3A', bg: '#EFF4EF', border: '#B5C8B5', label: 'Goal Created',        icon: '➕' },
  GOAL_UPDATED:         { color: '#6E473B', bg: '#F0E8D8', border: '#C8B490', label: 'Goal Updated',        icon: '✏️' },
  GOAL_SUBMITTED:       { color: '#7A6040', bg: '#F0E8D8', border: '#C8B490', label: 'Goal Submitted',      icon: '📤' },
  GOAL_APPROVED:        { color: '#3A5A3A', bg: '#EFF4EF', border: '#B5C8B5', label: 'Goal Approved',       icon: '✅' },
  GOAL_REJECTED:        { color: '#7A3A30', bg: '#F5ECEA', border: '#C8A8A0', label: 'Goal Rejected',       icon: '❌' },
  GOAL_REWORK_REQUIRED: { color: '#5A4A6A', bg: '#EDE8F5', border: '#C4B5D4', label: 'Returned for Rework', icon: '🔄' },
  GOAL_LOCKED:          { color: '#291C0E', bg: '#E8E4F0', border: '#BEB5A9', label: 'Goal Locked',         icon: '🔒' },
  GOAL_UNLOCKED:        { color: '#6E473B', bg: '#F0E8D8', border: '#C8B490', label: 'Goal Unlocked',       icon: '🔓' },
  CHECKIN_ADDED:        { color: '#4A6070', bg: '#ECF1F5', border: '#A8B8C8', label: 'Check-in Updated',    icon: '📋' },
  ACCESS_REQUEST_APPROVED: { color: '#3A5A3A', bg: '#EFF4EF', border: '#B5C8B5', label: 'Access Approved',  icon: '🟢' },
  ACCESS_REQUEST_REJECTED: { color: '#7A3A30', bg: '#F5ECEA', border: '#C8A8A0', label: 'Access Rejected',  icon: '🔴' },
};

const ROLE_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  employee: { bg: '#EFF4EF', color: '#3A5A3A', border: '#B5C8B5' },
  manager:  { bg: '#F0E8D8', color: '#6E473B', border: '#C8B490' },
  admin:    { bg: '#EDE8F5', color: '#5A4A6A', border: '#C4B5D4' },
};

const SUMMARY_ITEMS = [
  { key: 'GOAL_CREATED',            label: 'Created',        icon: '➕', color: '#3A5A3A' },
  { key: 'GOAL_SUBMITTED',          label: 'Submitted',      icon: '📤', color: '#7A6040' },
  { key: 'GOAL_APPROVED',           label: 'Approved',       icon: '✅', color: '#3A5A3A' },
  { key: 'GOAL_REJECTED',           label: 'Rejected',       icon: '❌', color: '#7A3A30' },
  { key: 'GOAL_REWORK_REQUIRED',    label: 'Rework',         icon: '🔄', color: '#5A4A6A' },
  { key: 'GOAL_LOCKED',             label: 'Locked',         icon: '🔒', color: '#291C0E' },
];

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [pagination, setPagination] = useState<TablePaginationConfig>({
    current: 1, pageSize: 15,
    pageSizeOptions: ['5', '10', '15', '20', '50'],
    showSizeChanger: true,
    showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} events`,
  });

  useEffect(() => {
    if (_admin_audit_cache && Date.now() - _admin_audit_cache.ts < 60_000) {
      setLogs(_admin_audit_cache.data); setLoading(false); return;
    }
    api.get('/admin/audit')
      .then(r => { _admin_audit_cache = { data: r.data, ts: Date.now() }; setLogs(r.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Memoized filtering — search + dropdown work together correctly
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const q = search.toLowerCase();
      const matchSearch = !q ||
        (log.user?.name ?? '').toLowerCase().includes(q) ||
        (log.goal?.goalTitle ?? '').toLowerCase().includes(q) ||
        ACTION_CONFIG[log.actionType]?.label.toLowerCase().includes(q) ||
        log.actionType.toLowerCase().includes(q);
      const matchAction = actionFilter === 'all' || log.actionType === actionFilter;
      return matchSearch && matchAction;
    });
  }, [logs, search, actionFilter]);

  // Reset to page 1 when filter/search changes
  const handleSearch = useCallback((val: string) => {
    setSearch(val);
    setPagination(p => ({ ...p, current: 1 }));
  }, []);

  const handleFilterChange = useCallback((val: string) => {
    setActionFilter(val);
    setPagination(p => ({ ...p, current: 1 }));
  }, []);

  const handleTableChange = useCallback((pag: TablePaginationConfig) => {
    setPagination(p => ({ ...p, current: pag.current, pageSize: pag.pageSize }));
  }, []);

  const columns = [
    {
      title: 'Timestamp',
      dataIndex: 'changedAt',
      width: 150,
      render: (v: string) => (
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#291C0E' }}>
            {new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
          </div>
          <div style={{ fontSize: 11, color: '#A78D78', marginTop: 2 }}>
            {new Date(v).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
        </div>
      ),
      sorter: (a: AuditLog, b: AuditLog) =>
        new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime(),
      defaultSortOrder: 'ascend' as const,
    },
    {
      title: 'User',
      width: 190,
      render: (_: any, r: AuditLog) => {
        const rs = ROLE_STYLE[r.user?.role || 'employee'] || ROLE_STYLE.employee;
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Avatar size={34} style={{ background: rs.color, fontWeight: 700, flexShrink: 0, fontSize: 14 }}>
              {r.user?.name?.charAt(0)}
            </Avatar>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#291C0E', lineHeight: 1.3 }}>{r.user?.name}</div>
              <Tag style={{ fontSize: 10, borderRadius: 4, marginTop: 2, padding: '0 6px',
                background: rs.bg, color: rs.color, border: `1px solid ${rs.border}` }}>
                {r.user?.role?.toUpperCase()}
              </Tag>
            </div>
          </div>
        );
      },
    },
    {
      title: 'Action',
      dataIndex: 'actionType',
      width: 200,
      render: (v: string) => {
        const cfg = ACTION_CONFIG[v] || { bg: '#F5F0EA', color: '#A78D78', border: '#E1D4C2', label: v, icon: '📝' };
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18, lineHeight: 1 }}>{cfg.icon}</span>
            <Tag style={{ fontWeight: 600, borderRadius: 20, padding: '2px 10px', margin: 0, fontSize: 12,
              background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
              {cfg.label}
            </Tag>
          </div>
        );
      },
    },
    {
      title: 'Goal Title',
      width: 220,
      render: (_: any, r: AuditLog) =>
        r.goal?.goalTitle ? (
          <div style={{ fontSize: 13, color: '#374151', fontWeight: 500, lineHeight: 1.4 }}>
            {r.goal.goalTitle}
          </div>
        ) : (
          <span style={{ color: '#BEB5A9', fontSize: 12 }}>System action</span>
        ),
    },
    {
      title: 'Change Detail',
      render: (_: any, r: AuditLog) => {
        if (!r.oldValue && !r.newValue)
          return <span style={{ color: '#BEB5A9', fontSize: 12 }}>—</span>;
        let newDisplay = r.newValue || '';
        let oldDisplay = r.oldValue || '';
        try { newDisplay = JSON.stringify(JSON.parse(newDisplay), null, 0); } catch {}
        try { oldDisplay = JSON.stringify(JSON.parse(oldDisplay), null, 0); } catch {}
        return (
          <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {newDisplay && (
              <div style={{ background: '#EFF4EF', borderRadius: 6, padding: '3px 8px', border: '1px solid #bbf7d0' }}>
                <span style={{ color: '#2a4a2a', fontWeight: 600 }}>New: </span>
                <span style={{ color: '#374151', fontFamily: 'monospace', fontSize: 11 }}>
                  {newDisplay.length > 70 ? newDisplay.substring(0, 70) + '…' : newDisplay}
                </span>
              </div>
            )}
            {oldDisplay && (
              <div style={{ background: '#F5ECEA', borderRadius: 6, padding: '3px 8px', border: '1px solid #fecaca' }}>
                <span style={{ color: '#6A2A20', fontWeight: 600 }}>Prev: </span>
                <span style={{ color: '#374151', fontFamily: 'monospace', fontSize: 11 }}>
                  {oldDisplay.length > 70 ? oldDisplay.substring(0, 70) + '…' : oldDisplay}
                </span>
              </div>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <DashboardLayout role="admin">
      <div className="page-content">

        {/* COMPLIANCE HERO */}
        <div style={{
          background: 'linear-gradient(135deg, #042f2e 0%, #3a3028 50%, #4a3020 100%)',
          borderRadius: 20, padding: '28px 36px', marginBottom: 24,
          boxShadow: '0 8px 32px rgba(6,95,70,0.3)',
        }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:16 }}>
            <div>
              <div style={{ color:'#B5C8B5', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.12em', marginBottom:8 }}>
                📜 Approval &amp; Activity History
              </div>
              <h1 style={{ color:'#fff', fontSize:26, fontWeight:900, margin:'0 0 6px' }}>Full History of Approvals &amp; Actions</h1>
              <div style={{ color:'rgba(255,255,255,0.65)', fontSize:13 }}>
                {logs.length} total records · {filteredLogs.length} matching · Every goal update, approval, and change is recorded here
              </div>
            </div>
            <div style={{ display:'flex', gap:12 }}>
              {[
                { label:'Total Events', value:logs.length, color:'#B5C8B5' },
                { label:'Approvals', value:logs.filter(l=>l.actionType==='GOAL_APPROVED').length, color:'#8AB08A' },
                { label:'Unlocks', value:logs.filter(l=>l.actionType==='GOAL_UNLOCKED').length, color:'#C8A870' },
                { label:'Rejections', value:logs.filter(l=>l.actionType==='GOAL_REJECTED').length, color:'#C07060' },
              ].map(m => (
                <div key={m.label} style={{ background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:12, padding:'12px 18px', textAlign:'center' }}>
                  <div style={{ color:m.color, fontSize:26, fontWeight:900 }}>{m.value}</div>
                  <div style={{ color:'rgba(255,255,255,0.6)', fontSize:11, fontWeight:600, marginTop:2 }}>{m.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:14, marginBottom:24 }}>
          {SUMMARY_ITEMS.map(item => {
            const count = logs.filter(l => l.actionType === item.key).length;
            const isActive = actionFilter === item.key;
            return (
              <div
                key={item.key}
                onClick={() => handleFilterChange(isActive ? 'all' : item.key)}
                style={{
                  background: isActive ? item.color : 'white',
                  borderRadius: 12,
                  padding: '14px 16px',
                  border: `2px solid ${isActive ? item.color : '#E1D4C2'}`,
                  cursor: 'pointer',
                  transition: 'all 0.18s ease',
                  boxShadow: isActive ? `0 4px 14px ${item.color}40` : '0 1px 3px rgba(0,0,0,0.06)',
                }}
              >
                <div style={{ fontSize: 20, marginBottom: 6 }}>{item.icon}</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: isActive ? 'white' : item.color }}>{count}</div>
                <div style={{ fontSize: 11, color: isActive ? 'rgba(255,255,255,0.8)' : '#A78D78', fontWeight: 600, marginTop: 2 }}>
                  {item.label}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ background:'#fff', borderRadius:16, border:'1px solid #E1D4C2', overflow:'hidden', boxShadow:'0 2px 8px rgba(0,0,0,0.05)' }}>
          <div style={{ padding:'18px 24px', borderBottom:'1px solid #F5F0EA', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <HistoryOutlined style={{ color:'#4a3020', fontSize:18 }} />
              <span style={{ fontWeight:800, fontSize:16, color:'#291C0E' }}>All Approvals, Updates &amp; System Actions</span>
              {actionFilter !== 'all' && (
                <Tag color="default" style={{ fontWeight:600 }}>Filtered: {ACTION_CONFIG[actionFilter]?.label}</Tag>
              )}
            </div>
            <div style={{ display:'flex', gap:10, alignItems:'center' }}>
              <Search placeholder="Search by employee name, goal, or action type..." value={search}
                onChange={e => handleSearch(e.target.value)} onSearch={handleSearch}
                allowClear style={{ width:260 }} />
              <Select value={actionFilter} onChange={handleFilterChange} style={{ width:200 }}
                placeholder="Filter by action" suffixIcon={<FilterOutlined />}>
                <Select.Option value="all"><span style={{ color:'#A78D78' }}>All Actions</span></Select.Option>
                {Object.entries(ACTION_CONFIG).map(([k,v]) => (
                  <Select.Option key={k} value={k}><span style={{ marginRight:6 }}>{v.icon}</span>{v.label}</Select.Option>
                ))}
              </Select>
            </div>
          </div>
          <Table columns={columns} dataSource={filteredLogs} rowKey="id" loading={loading}
            pagination={{ ...pagination, total:filteredLogs.length }}
            onChange={handleTableChange} size="middle" scroll={{ x:1000 }}
            rowClassName={(_,i) => i%2===0?'':'audit-row-alt'}
            locale={{ emptyText: search||actionFilter!=='all'?'🔍 No records match your filters':'No activity recorded yet' }}
          />
        </div>
      </div>
    </DashboardLayout>
  );
}