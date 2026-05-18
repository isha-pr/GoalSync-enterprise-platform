'use client';
import { useEffect, useState } from 'react';
import { Layout, Menu, Avatar, Dropdown, Space, Button } from 'antd';
import {
  DashboardOutlined, AimOutlined, CheckCircleOutlined,
  TeamOutlined, BarChartOutlined,
  LogoutOutlined, UserOutlined,
  SafetyOutlined, FileTextOutlined, MenuFoldOutlined,
  MenuUnfoldOutlined, LockOutlined, HistoryOutlined,
  CalendarOutlined, TrophyOutlined, WarningOutlined, RiseOutlined,
  UserAddOutlined,
} from '@ant-design/icons';
import { useRouter, usePathname } from 'next/navigation';
import { useStore } from '../lib/store';
import dynamic from 'next/dynamic';

// Dynamically imported — code-split, loaded async, not in main bundle
const NotificationPopover = dynamic(() => import('./NotificationPopover'), { ssr: false });

const { Sider, Header, Content } = Layout;

interface DashboardLayoutProps {
  children: React.ReactNode;
  role: 'employee' | 'manager' | 'admin';
}

const menuItems = {
  employee: [
    { key: '/employee', icon: <DashboardOutlined />, label: 'Dashboard' },
    { key: '/employee/goals', icon: <AimOutlined />, label: 'My Goals' },
    { key: '/employee/create-goal', icon: <FileTextOutlined />, label: 'Create Goal' },
    { key: '/employee/quarterly', icon: <CalendarOutlined />, label: 'Quarterly Updates' },
    { key: '/employee/reports', icon: <BarChartOutlined />, label: 'My Reports' },
  ],
  manager: [
    { key: '/manager', icon: <DashboardOutlined />, label: 'Dashboard' },
    { key: '/manager/team-goals', icon: <TeamOutlined />, label: 'Team Goals' },
    { key: '/manager/approvals', icon: <CheckCircleOutlined />, label: 'Goals to Review' },
    { key: '/manager/checkins', icon: <CalendarOutlined />, label: 'Quarterly Check-ins' },
    { key: '/manager/shared-goals', icon: <TrophyOutlined />, label: 'Shared Team Goals' },
    { key: '/manager/effectiveness', icon: <RiseOutlined />, label: 'My Performance Report' },
    { key: '/manager/reports', icon: <BarChartOutlined />, label: 'Team Reports' },
  ],
  admin: [
    { key: '/admin', icon: <DashboardOutlined />, label: 'Dashboard' },
    { key: '/admin/overview', icon: <TeamOutlined />, label: 'Employee Overview' },
    { key: '/admin/access-requests', icon: <UserAddOutlined />, label: 'Access Requests' },
    { key: '/admin/goals', icon: <AimOutlined />, label: 'All Goals' },
    { key: '/admin/unlock', icon: <LockOutlined />, label: 'Approved Goals' },
    { key: '/admin/escalations', icon: <WarningOutlined />, label: 'Missed Deadline Alerts' },
    { key: '/admin/audit', icon: <HistoryOutlined />, label: 'Approval History' },
    { key: '/admin/reports', icon: <BarChartOutlined />, label: 'Analytics & Reports' },
    { key: '/admin/impact', icon: <RiseOutlined />, label: 'Business Impact' },
  ],
};

const roleConfig = {
  employee: { color: '#6E473B', bg: '#E1D4C2', label: 'Employee',   avatarBg: '#6E473B' },
  manager:  { color: '#291C0E', bg: '#BEB5A9', label: 'L1 Manager', avatarBg: '#291C0E' },
  admin:    { color: '#4a3020', bg: '#E1D4C2', label: 'Admin / HR', avatarBg: '#4a3020' },
};

const roleHeaderLabel = {
  employee: 'Employee Portal',
  manager: 'Manager Dashboard',
  admin: 'Admin Console',
};

export default function DashboardLayout({ children, role }: DashboardLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useStore();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!user) router.push('/login');
  }, [user]);

  const handleLogout = () => { logout(); router.push('/login'); };
  const rc = roleConfig[role];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* ── Sidebar ── */}
      <Sider
        width={258}
        collapsedWidth={70}
        collapsed={collapsed}
        style={{
          background: 'linear-gradient(180deg, #291C0E 0%, #3a2418 55%, #4a3020 100%)',
          position: 'fixed', left: 0, top: 0, bottom: 0, zIndex: 100,
          boxShadow: '3px 0 20px rgba(41,28,14,0.5)',
        }}
      >
        {/* Logo */}
        <div style={{ padding: collapsed ? '22px 0' : '22px 24px', justifyContent: collapsed ? 'center' : 'flex-start', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ width: 38, height: 38, borderRadius: 11, flexShrink: 0, background: 'linear-gradient(135deg, #A78D78, #BEB5A9)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, boxShadow: '0 4px 14px rgba(110,71,59,0.30)' }}>🎯</div>
          {!collapsed && (
            <div>
              <div style={{ color: '#fff', fontWeight: 800, fontSize: 17, lineHeight: 1.2, letterSpacing: '-0.3px' }}>GoalSync</div>
              <div style={{ color: '#BEB5A9', fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', marginTop: 1 }}>ENTERPRISE PRO</div>
            </div>
          )}
        </div>

        {/* User Badge */}
        {!collapsed && (
          <div style={{ padding: '14px 14px 6px' }}>
            <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: '11px 14px', border: '1px solid rgba(255,255,255,0.09)' }}>
              <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10.5, fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Logged in as</div>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 14, lineHeight: 1.3 }}>{user?.name}</div>
              <span style={{ display: 'inline-block', marginTop: 7, background: rc.bg, color: rc.color, fontSize: 11, fontWeight: 700, borderRadius: 20, padding: '2px 11px' }}>{rc.label}</span>
            </div>
          </div>
        )}

        {/* Nav Menu */}
        <Menu
          mode="inline"
          theme="dark"
          selectedKeys={[pathname]}
          items={menuItems[role]}
          onClick={({ key }) => router.push(key)}
          style={{ background: 'transparent', border: 'none', padding: '10px 10px 0' }}
        />

        {/* Collapse toggle */}
        <div style={{ position: 'absolute', bottom: 18, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
          <Button type="text" icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />} onClick={() => setCollapsed(!collapsed)} style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }} />
        </div>
      </Sider>

      {/* ── Main area ── */}
      <Layout style={{ marginLeft: collapsed ? 70 : 258, transition: 'margin-left 0.22s ease' }}>
        {/* Top Header */}
        <Header style={{ background: '#ffffff', padding: '0 28px', position: 'sticky', top: 0, zIndex: 99, borderBottom: '1px solid #E1D4C2', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 1px 6px rgba(41,28,14,0.06)', height: 62 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#291C0E', letterSpacing: '-0.2px' }}>{roleHeaderLabel[role]}</div>
            <div style={{ fontSize: 11.5, color: '#6E473B', background: '#E1D4C2', borderRadius: 20, padding: '3px 12px', fontWeight: 700, border: '1px solid #BEB5A9', letterSpacing: '0.02em' }}>
              FY 2024-25 · Q3 Active
            </div>
          </div>

          <Space size="middle">
            {/* Notifications — dynamically loaded */}
            <NotificationPopover role={role} />

            {/* User dropdown */}
            <Dropdown
              menu={{
                items: [
                  { key: 'profile', icon: <UserOutlined />, label: (<div><div style={{ fontWeight: 600 }}>{user?.name}</div><div style={{ fontSize: 12, color: '#A78D78' }}>{user?.email}</div></div>) },
                  { type: 'divider' },
                  { key: 'logout', icon: <LogoutOutlined />, label: 'Sign Out', danger: true, onClick: handleLogout },
                ],
              }}
              placement="bottomRight"
            >
              <Space style={{ cursor: 'pointer' }}>
                <Avatar style={{ background: rc.avatarBg, fontWeight: 700 }} size={36}>{user?.name?.charAt(0)}</Avatar>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#291C0E' }}>{user?.name?.split(' ')[0]}</span>
              </Space>
            </Dropdown>
          </Space>
        </Header>

        {/* Page Content */}
        <Content style={{ minHeight: 'calc(100vh - 62px)', background: 'linear-gradient(160deg, #FAF7F4 0%, #F5F0EA 60%, #F7F3EE 100%)' }}>
          <div className="page-enter" key={pathname}>
            {children}
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}
