'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '../lib/store';
import LandingPage from '../components/LandingPage';

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, user } = useStore();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (isAuthenticated && user) {
      router.push(`/${user.role}`);
    } else {
      setChecked(true);
    }
  }, [isAuthenticated, user, router]);

  if (!checked) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fdf8f3' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 16 }}>🎯</div>
          <div style={{ fontSize: 16, color: '#92745a' }}>Loading GoalSync...</div>
        </div>
      </div>
    );
  }

  return <LandingPage />;
}
