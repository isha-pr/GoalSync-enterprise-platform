'use client';
import { useEffect, useState } from 'react';
import { ConfigProvider } from 'antd';
import enUS from 'antd/locale/en_US';

export default function AntdProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <>{children}</>;
  return (
    <ConfigProvider locale={enUS} theme={{ token: { colorPrimary: '#291C0E', borderRadius: 8, fontFamily: 'Inter, -apple-system, sans-serif' } }}>
      {children}
    </ConfigProvider>
  );
}
