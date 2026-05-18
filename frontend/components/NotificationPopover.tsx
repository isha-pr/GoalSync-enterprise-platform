'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Badge, Button, Popover } from 'antd';
import { BellOutlined, RightOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { useStore } from '../lib/store';
import api from '../lib/api';
import { Notification } from '../lib/types';

let _notifCache: { data: any[]; ts: number } | null = null;
const NOTIF_TTL = 30_000;

function resolveNotifRoute(n: Notification, userRole: string): string | null {
  const t = n.title.toLowerCase();
  const m = n.message.toLowerCase();
  if ((n as any).type === 'access_request' || t.includes('access request') || t.startsWith('access request:')) return '/admin/access-requests';
  if (t.includes('approved') || t.includes('goal approved') || t.includes('access approved')) return userRole === 'admin' ? '/admin/goals' : '/employee/goals';
  if (t.includes('rejected') || t.includes('goal rejected')) return '/employee/goals';
  if (t.includes('rework') || t.includes('needs rework')) return '/employee/goals';
  if (t.includes('check-in') || t.includes('quarterly') || t.includes('checkin')) return userRole === 'manager' ? '/manager/checkins' : '/employee/quarterly';
  if (t.includes('unlocked') || t.includes('unlock')) return userRole === 'admin' ? '/admin/unlock' : '/employee/goals';
  if (t.includes('shared goal') || t.includes('shared kpi') || m.includes('shared')) return '/employee/goals';
  if (t.includes('submitted') || t.includes('goal sheet')) return userRole === 'manager' ? '/manager/approvals' : '/employee/goals';
  if (t.includes('pending') || t.includes('review') || t.includes('pending goal')) {
    if (userRole === 'manager') return '/manager/approvals';
    if (userRole === 'admin') return '/admin/goals';
  }
  if (t.includes('escalation')) return '/admin/escalations';
  if (t.includes('unlock request')) return '/admin/unlock';
  if (t.includes('completion report') || t.includes('report')) return '/admin/reports';
  return `/${userRole}`;
}

function getNotifIcon(type: string, title: string): string {
  const t = title.toLowerCase();
  if (t.includes('approved')) return '✅';
  if (t.includes('rejected')) return '❌';
  if (t.includes('rework')) return '🔄';
  if (t.includes('lock')) return '🔒';
  if (t.includes('unlock')) return '🔓';
  if (t.includes('check-in') || t.includes('quarterly')) return '📅';
  if (t.includes('shared')) return '🤝';
  if (t.includes('escalation')) return '🚨';
  if (t.includes('pending')) return '⏳';
  if (type === 'success') return '✅';
  if (type === 'warning') return '⚠️';
  if (type === 'error') return '❌';
  return 'ℹ️';
}

function TeamsCardNotif({ n, onClose }: { n: Notification; onClose: () => void }) {
  let card: any = null;
  try { const p = JSON.parse(n.message); if (p._teamsCard) card = p.card; } catch {}
  if (!card) return null;
  const title = card.body?.find((b: any) => b.type === 'Container')?.items?.find((i: any) => i.size === 'Large')?.text ?? n.title;
  const subtitle = card.body?.find((b: any) => b.type === 'Container')?.items?.find((i: any) => i.isSubtle)?.text ?? '';
  const facts: { title: string; value: string }[] = card.body?.find((b: any) => b.type === 'FactSet')?.facts ?? [];
  const actions: { title: string; url: string; style?: string }[] = card.actions ?? [];
  return (
    <div style={{ margin: '8px 10px', borderRadius: 12, overflow: 'hidden', border: '1.5px solid #4B5563', background: '#1F2937' }}>
      <div style={{ background: '#6264A7', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 22, height: 22, borderRadius: 6, background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>💬</div>
        <div>
          <span style={{ color: 'white', fontSize: 11, fontWeight: 700 }}>Microsoft Teams</span>
          <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: 10, marginLeft: 6 }}>via GoalSync Bot</span>
        </div>
        <div style={{ marginLeft: 'auto', background: '#5059A5', borderRadius: 10, padding: '1px 7px', fontSize: 9, color: 'white', fontWeight: 700 }}>Adaptive Card</div>
      </div>
      <div style={{ padding: '12px 14px', background: '#111827' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#F9FAFB', marginBottom: 4, lineHeight: 1.3 }}>{title}</div>
        {subtitle && <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 10 }}>{subtitle}</div>}
        {facts.length > 0 && (
          <div style={{ borderRadius: 8, background: '#1F2937', padding: '8px 10px', marginBottom: 10 }}>
            {facts.map((f, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: i < facts.length - 1 ? 5 : 0 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', minWidth: 90, flexShrink: 0 }}>{f.title}:</span>
                <span style={{ fontSize: 11, color: '#D1D5DB' }}>{f.value}</span>
              </div>
            ))}
          </div>
        )}
        {actions.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {actions.map((a, i) => (
              <a key={i} href={a.url} target="_blank" rel="noreferrer" onClick={onClose}
                style={{ display: 'inline-block', padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 700, textDecoration: 'none', background: a.style === 'positive' ? '#6264A7' : a.style === 'destructive' ? '#7A3A30' : '#374151', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }}>
                {a.title}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function NotificationPopover({ role }: { role: 'employee' | 'manager' | 'admin' }) {
  const router = useRouter();
  const { notifications, unreadCount, setNotifications, markAllRead, markRead } = useStore();
  const [visible, setVisible] = useState(false);

  const fetchNotifications = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && _notifCache && now - _notifCache.ts < NOTIF_TTL) { setNotifications(_notifCache.data); return; }
    try {
      const res = await api.get('/notifications');
      _notifCache = { data: res.data, ts: Date.now() };
      setNotifications(res.data);
    } catch {}
  }, [setNotifications]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  const handleMarkAllRead = useCallback(async () => {
    try { await api.put('/notifications/read-all'); markAllRead(); _notifCache = null; } catch {}
  }, [markAllRead]);

  const handleNotifClick = useCallback(async (n: Notification) => {
    if (n.status === 'unread') { markRead(n.id); _notifCache = null; try { await api.put(`/notifications/${n.id}/read`); } catch {} }
    setVisible(false);
    const route = resolveNotifRoute(n, role);
    if (route) router.push(route);
  }, [markRead, role, router]);

  const content = useMemo(() => (
    <div style={{ width: 400 }}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid #E1D4C2', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FAF7F4' }}>
        <div>
          <span style={{ fontWeight: 800, color: '#291C0E', fontSize: 14 }}>Notifications</span>
          {unreadCount > 0 && <span style={{ marginLeft: 8, background: '#6E473B', color: 'white', fontSize: 10, fontWeight: 800, borderRadius: 10, padding: '2px 7px' }}>{unreadCount} new</span>}
        </div>
        {unreadCount > 0 && <Button type="link" size="small" onClick={handleMarkAllRead} style={{ padding: 0, fontSize: 12, color: '#6E473B' }}>Mark all read</Button>}
      </div>
      <div style={{ maxHeight: 460, overflowY: 'auto' }}>
        {notifications.length === 0 ? (
          <div style={{ padding: '32px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🔔</div>
            <div style={{ color: '#92745a', fontSize: 13 }}>You're all caught up!</div>
          </div>
        ) : notifications.slice(0, 15).map(n => {
          const isTeams = (n as any).type === 'teams_card';
          const route = resolveNotifRoute(n, role);
          const isUnread = n.status === 'unread';
          if (isTeams) return (
            <div key={n.id} onClick={() => { if (isUnread) { markRead(n.id); api.put(`/notifications/${n.id}/read`).catch(() => {}); } }} style={{ cursor: 'pointer' }}>
              {isUnread && <div style={{ height: 2, background: '#6264A7' }} />}
              <TeamsCardNotif n={n} onClose={() => setVisible(false)} />
            </div>
          );
          return (
            <div key={n.id} onClick={() => handleNotifClick(n)} className={`notif-card ${isUnread ? 'notif-unread' : 'notif-read'}`}>
              {isUnread && <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: '#8b5e3c', borderRadius: '0 2px 2px 0' }} />}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flex: 1 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: isUnread ? '#E1D4C2' : '#fdf9f5', fontSize: 18 }}>
                  {getNotifIcon(n.type, n.title)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: isUnread ? 700 : 600, color: isUnread ? '#291C0E' : '#6E473B', marginBottom: 3, lineHeight: 1.3 }}>
                    {n.title}
                    {isUnread && <span style={{ display: 'inline-block', width: 7, height: 7, background: '#6E473B', borderRadius: '50%', marginLeft: 6, verticalAlign: 'middle' }} />}
                  </div>
                  <div style={{ fontSize: 12, color: '#A78D78', lineHeight: 1.5, marginBottom: 4 }}>{n.message.length > 80 ? n.message.slice(0, 80) + '…' : n.message}</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 10, color: '#A78D78' }}>{new Date(n.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                    {route && <span style={{ fontSize: 11, color: '#6E473B', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 3 }}>View <RightOutlined style={{ fontSize: 9 }} /></span>}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {notifications.length > 0 && (
        <div style={{ padding: '10px 16px', borderTop: '1px solid #E1D4C2', display: 'flex', justifyContent: 'center', background: '#FAF7F4' }}>
          <Button type="link" size="small" onClick={() => { setVisible(false); router.push(`/${role}`); }} style={{ fontSize: 12, color: '#6E473B' }}>Go to Dashboard</Button>
        </div>
      )}
    </div>
  ), [notifications, unreadCount, handleMarkAllRead, handleNotifClick, markRead, role, router]);

  return (
    <Popover content={content} trigger="click" open={visible} onOpenChange={setVisible} placement="bottomRight" overlayStyle={{ width: 380 }} styles={{ body: { padding: 0, borderRadius: 12, overflow: 'hidden' } }}>
      <Badge count={unreadCount} className="pulse-badge" overflowCount={9} styles={{ indicator: { background: '#6E473B' } }}>
        <Button type="text" icon={<BellOutlined style={{ fontSize: 20, color: '#291C0E' }} />} style={{ width: 40, height: 40 }} />
      </Badge>
    </Popover>
  );
}
