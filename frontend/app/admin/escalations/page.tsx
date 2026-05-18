'use client';
import { useEffect, useState, useMemo } from 'react';
import { Card, Table, Tag, Row, Col, Progress, Tooltip, message, Tabs, Badge } from 'antd';
import { WarningOutlined, CheckCircleOutlined, SyncOutlined } from '@ant-design/icons';
import DashboardLayout from '../../../components/DashboardLayout';
import api from '../../../lib/api';

let _admin_escalations_cache: { data: any; ts: number } | null = null;

const SEVERITY_CFG = {
  high:   { color: '#7A3A30', bg: '#F5ECEA', label: '🔴 High',   border: '#C8A8A0' },
  medium: { color: '#7A6040', bg: '#F0E8D8', label: '🟡 Medium', border: '#C8B490' },
  low:    { color: '#6E473B', bg: '#E1D4C2', label: '⚪ Low',    border: '#BEB5A9' },
};

const STATUS_CFG: Record<string, { color: string; bg: string; label: string }> = {
  open:         { color: '#7A3A30', bg: '#F5ECEA', label: '🔴 Open' },
  acknowledged: { color: '#7A6040', bg: '#F5EDDF', label: '🟡 Acknowledged' },
  resolved:     { color: '#5A7A5A', bg: '#EFF4EF', label: '✅ Resolved' },
};

const LEVEL_CFG: Record<number, { label: string; color: string }> = {
  1: { label: 'L1 · Employee', color: '#A78D78' },
  2: { label: 'L2 · Manager',  color: '#7A6040' },
  3: { label: 'L3 · HR/Admin', color: '#7A3A30' },
};

const TYPE_CFG: Record<string, { icon: string }> = {
  OVERDUE_SUBMISSION: { icon: '📋' },
  OVERDUE_APPROVAL:   { icon: '⏳' },
  MISSING_CHECKIN:    { icon: '📅' },
};

export default function EscalationsPage() {
  const [data, setData]       = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [tab, setTab]         = useState('open');

  const load = () => {
    if (_admin_escalations_cache && Date.now() - _admin_escalations_cache.ts < 60_000) {
      setData(_admin_escalations_cache.data); setLoading(false); return;
    }
    setLoading(true);
    api.get('/escalations')
      .then(r => { _admin_escalations_cache = { data: r.data, ts: Date.now() }; setData(r.data); })
      .catch(() => message.error('Failed to load escalations'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const escalations: any[] = data?.escalations ?? [];
  const summary             = data?.summary ?? {};
  const slaRules: any[]     = data?.slaRules ?? [];

  const filtered = useMemo(() => {
    if (tab === 'all') return escalations;
    return escalations.filter(e => e.status === tab);
  }, [escalations, tab]);

  const triggerRun = async () => {
    setRunning(true);
    try {
      await api.post('/escalations/run');
      message.success('Escalation engine executed. Refreshing…');
      await new Promise(r => setTimeout(r, 800));
      load();
    } catch {
      message.error('Engine run failed');
    } finally {
      setRunning(false);
    }
  };

  const acknowledge = async (id: string) => {
    try {
      await api.put(`/escalations/${id}/acknowledge`);
      message.success('Acknowledged');
      load();
    } catch { message.error('Failed'); }
  };

  const resolve = async (id: string) => {
    try {
      await api.put(`/escalations/${id}/resolve`);
      message.success('Marked as resolved');
      load();
    } catch { message.error('Failed'); }
  };

  const columns = [
    {
      title: 'Severity',
      dataIndex: 'severity',
      width: 110,
      render: (v: string) => {
        const cfg = SEVERITY_CFG[v as keyof typeof SEVERITY_CFG] ?? SEVERITY_CFG.low;
        return <Tag style={{ fontWeight: 700, borderRadius: 20, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>{cfg.label}</Tag>;
      },
    },
    {
      title: 'Alert',
      dataIndex: 'label',
      width: 190,
      render: (v: string, r: any) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>{TYPE_CFG[r.type]?.icon}</span>
          <div>
            <div style={{ fontWeight: 700, color: '#291C0E', fontSize: 13 }}>{v}</div>
            <div style={{ fontSize: 11, color: '#A78D78' }}>{r.reason?.slice(0, 52)}…</div>
          </div>
        </div>
      ),
    },
    {
      title: 'Employee',
      dataIndex: 'employee',
      width: 150,
      render: (v: string, r: any) => (
        <div>
          <div style={{ fontWeight: 700, color: '#291C0E', fontSize: 13 }}>{v}</div>
          <div style={{ fontSize: 11, color: '#A78D78' }}>{r.department}</div>
        </div>
      ),
    },
    { title: 'Goal', dataIndex: 'goalTitle', render: (v: string) => <span style={{ fontWeight: 600, color: '#374151', fontSize: 13 }}>{v}</span> },
    {
      title: 'Level',
      dataIndex: 'escalationLevel',
      width: 130,
      render: (v: number) => {
        const cfg = LEVEL_CFG[v] ?? LEVEL_CFG[1];
        return <Tag style={{ fontWeight: 700, borderRadius: 20, background: '#F5F0EA', color: cfg.color, border: `1px solid #E1D4C2` }}>{cfg.label}</Tag>;
      },
    },
    {
      title: 'Overdue',
      dataIndex: 'daysOverdue',
      width: 90,
      sorter: (a: any, b: any) => b.daysOverdue - a.daysOverdue,
      render: (v: number) => (
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: v > 10 ? '#7A3A30' : v > 5 ? '#7A6040' : '#6E473B' }}>{v}</div>
          <div style={{ fontSize: 10, color: '#A78D78' }}>days</div>
        </div>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 140,
      render: (v: string) => {
        const cfg = STATUS_CFG[v] ?? STATUS_CFG.open;
        return <Tag style={{ fontWeight: 700, borderRadius: 20, background: cfg.bg, color: cfg.color, border: 'none' }}>{cfg.label}</Tag>;
      },
    },
    {
      title: 'Actions',
      width: 180,
      render: (_: any, r: any) => (
        <div style={{ display: 'flex', gap: 6 }}>
          {r.status === 'open' && (
            <button onClick={() => acknowledge(r.id)}
              style={{ padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: '#F5EDDF', color: '#7A6040', border: '1px solid #C8B490', cursor: 'pointer' }}>
              Acknowledge
            </button>
          )}
          {r.status !== 'resolved' && (
            <button onClick={() => resolve(r.id)}
              style={{ padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: '#EFF4EF', color: '#5A7A5A', border: '1px solid #B5C8B5', cursor: 'pointer' }}>
              Resolve
            </button>
          )}
          {r.status === 'resolved' && (
            <span style={{ fontSize: 12, color: '#5A7A5A', fontWeight: 600 }}>
              ✅ {r.resolverName ?? 'Admin'}
            </span>
          )}
        </div>
      ),
    },
  ];

  return (
    <DashboardLayout role="admin">
      <div className="page-content">

        {/* Header */}
        <div className="portal-header" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13 }}>SLA &amp; Compliance Monitoring</div>
              <h1 style={{ color: 'white', fontSize: 26, fontWeight: 800, margin: '4px 0' }}>⚠️ Escalation Center</h1>
              <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13 }}>
                Automated SLA engine · 7-day submission · 5-day approval · Q1 check-in deadlines
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              {[
                { label: 'Total', value: summary.total ?? 0 },
                { label: 'Open', value: summary.open ?? 0, color: '#C8A8A0' },
                { label: 'Level 3 🚨', value: summary.level3 ?? 0, color: '#ff9999' },
                { label: 'Resolved', value: summary.resolved ?? 0, color: '#99cc99' },
              ].map(m => (
                <div key={m.label} style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: '10px 18px', textAlign: 'center', minWidth: 70 }}>
                  <div style={{ color: m.color ?? 'white', fontSize: 26, fontWeight: 800 }}>{m.value}</div>
                  <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11 }}>{m.label}</div>
                </div>
              ))}
              <Tooltip title="Manually run the escalation engine now">
                <button onClick={triggerRun} disabled={running}
                  style={{ padding: '10px 20px', borderRadius: 10, fontWeight: 700, fontSize: 13, border: '2px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.12)', color: '#fff', cursor: 'pointer' }}>
                  {running ? '⏳ Running…' : '⚡ Run Engine Now'}
                </button>
              </Tooltip>
            </div>
          </div>
        </div>

        {/* Critical alert banner */}
        {(summary.level3 ?? 0) > 0 && (
          <div style={{ background: '#F5ECEA', border: '1px solid #C8A8A0', borderRadius: 12, padding: '14px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ fontSize: 28 }}>🚨</div>
            <div>
              <div style={{ fontWeight: 700, color: '#7A3A30', fontSize: 14 }}>
                {summary.level3} Level 3 escalation{(summary.level3 ?? 0) > 1 ? 's' : ''} — HR immediate action required
              </div>
              <div style={{ fontSize: 12, color: '#6E473B', marginTop: 2 }}>
                These have breached the 14-day threshold. Managers and HR have been notified via in-app alerts.
              </div>
            </div>
          </div>
        )}

        {/* Summary chips */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14, marginBottom: 24 }}>
          {[
            { key: 'OVERDUE_SUBMISSION', label: 'Overdue Submissions', count: summary.overdueSubmissions ?? 0, color: '#7A3A30', bg: '#EDE0DD', icon: '📋', desc: '>7 days in draft' },
            { key: 'OVERDUE_APPROVAL',   label: 'Pending Approval',    count: summary.overdueApprovals   ?? 0, color: '#7A6040', bg: '#F0E8D8', icon: '⏳', desc: '>5 days awaiting manager' },
            { key: 'MISSING_CHECKIN',    label: 'Missing Check-ins',   count: summary.missingCheckins    ?? 0, color: '#6E473B', bg: '#E1D4C2', icon: '📅', desc: 'Q1 deadline: Mar 31' },
            { key: 'resolved',           label: 'Resolved',             count: summary.resolved           ?? 0, color: '#5A7A5A', bg: '#EFF4EF', icon: '✅', desc: 'Closed by admin/manager' },
          ].map(s => (
            <div key={s.key} style={{ background: '#fff', borderRadius: 14, padding: '16px 18px', border: `1px solid ${s.bg}`, boxShadow: '0 1px 6px rgba(41,28,14,0.05)' }}>
              <div style={{ fontSize: 22, marginBottom: 6 }}>{s.icon}</div>
              <div style={{ fontSize: 26, fontWeight: 900, color: s.color }}>{s.count}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#291C0E', marginTop: 4 }}>{s.label}</div>
              <div style={{ fontSize: 11, color: '#A78D78', marginTop: 2 }}>{s.desc}</div>
            </div>
          ))}
        </div>

        <Row gutter={[20, 20]}>
          <Col xs={24} lg={17}>
            <Card
              title={
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <WarningOutlined style={{ color: '#7A3A30' }} />
                  <span style={{ fontWeight: 700 }}>Escalation Log</span>
                  <Badge count={summary.open ?? 0} color="#7A3A30" style={{ fontSize: 11 }} />
                </div>
              }
              style={{ borderRadius: 16 }}
            >
              <Tabs
                activeKey={tab}
                onChange={setTab}
                items={[
                  { key: 'open',         label: `Open (${summary.open ?? 0})` },
                  { key: 'acknowledged', label: `Acknowledged (${summary.acknowledged ?? 0})` },
                  { key: 'resolved',     label: `Resolved (${summary.resolved ?? 0})` },
                  { key: 'all',          label: `All (${summary.total ?? 0})` },
                ]}
              />
              <Table
                columns={columns}
                dataSource={filtered}
                rowKey="id"
                loading={loading}
                pagination={{ pageSize: 8, showSizeChanger: false }}
                size="middle"
                locale={{ emptyText: '✅ No escalations in this category' }}
              />
            </Card>
          </Col>

          <Col xs={24} lg={7}>
            <Card title={<span style={{ fontWeight: 700 }}>📏 SLA Rules & Escalation Chain</span>} style={{ borderRadius: 16, marginBottom: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {slaRules.map((rule: any) => {
                  const cfg = SEVERITY_CFG[rule.severity as keyof typeof SEVERITY_CFG] ?? SEVERITY_CFG.low;
                  return (
                    <div key={rule.rule} style={{ background: cfg.bg, borderRadius: 10, padding: '12px 14px', border: `1px solid ${cfg.border}` }}>
                      <div style={{ fontWeight: 700, color: '#291C0E', fontSize: 13, marginBottom: 6 }}>{rule.rule}</div>
                      <div style={{ fontSize: 11, color: '#6E473B', display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <span>⏱ SLA: <strong>{rule.threshold}</strong></span>
                        <span>🔔 L2 at: <strong>{rule.level2}</strong></span>
                        <span>🚨 L3 at: <strong>{rule.level3}</strong></span>
                        <span>📣 Chain: <strong>{rule.scope}</strong></span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card title={<span style={{ fontWeight: 700 }}>📊 Breakdown</span>} style={{ borderRadius: 16, marginBottom: 16 }}>
              {[
                { label: 'High Priority',   value: summary.high   ?? 0, total: summary.total || 1, color: '#7A3A30' },
                { label: 'Medium Priority', value: summary.medium ?? 0, total: summary.total || 1, color: '#7A6040' },
                { label: 'Low Priority',    value: summary.low    ?? 0, total: summary.total || 1, color: '#6E473B' },
                { label: 'Resolved',        value: summary.resolved ?? 0, total: (summary.total || 1) + (summary.resolved || 0), color: '#5A7A5A' },
              ].map(item => (
                <div key={item.label} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: '#A78D78', fontWeight: 600 }}>{item.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: item.color }}>{item.value}</span>
                  </div>
                  <Progress percent={Math.round((item.value / item.total) * 100)} strokeColor={item.color} railColor="#F5F0EA" size={6} showInfo={false} />
                </div>
              ))}
            </Card>

            <Card title={<span style={{ fontWeight: 700 }}>🔗 Escalation Chain</span>} style={{ borderRadius: 16 }}>
              {[
                { level: 'Level 1', who: 'Employee notified', day: 'Day 7 / 5 / 0', color: '#A78D78' },
                { level: 'Level 2', who: 'Manager notified',  day: 'Day 10 / 8 / +7', color: '#7A6040' },
                { level: 'Level 3', who: 'HR & Admin alerted', day: 'Day 14 / 12 / —', color: '#7A3A30' },
              ].map((l, i) => (
                <div key={l.level} style={{ display: 'flex', gap: 12, marginBottom: i < 2 ? 14 : 0 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: l.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 12, flexShrink: 0 }}>{i + 1}</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#291C0E' }}>{l.level}: {l.who}</div>
                    <div style={{ fontSize: 11, color: '#A78D78' }}>{l.day} (Submit / Approval / Checkin)</div>
                  </div>
                </div>
              ))}
            </Card>
          </Col>
        </Row>
      </div>
    </DashboardLayout>
  );
}