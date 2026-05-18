'use client';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

const WORKFLOW = [
  { icon: '✏️', step: 'Goal Creation', who: 'Employee', desc: 'Employee sets goals with KPIs, targets & deadlines' },
  { icon: '✅', step: 'Manager Approval', who: 'Manager', desc: 'Manager reviews, approves or requests changes' },
  { icon: '📆', step: 'Check-ins', who: 'Employee', desc: 'Quarterly progress updates against each goal' },
  { icon: '🔒', step: 'Cycle Lock', who: 'HR Admin', desc: 'HR locks the cycle — no edits after deadline' },
  { icon: '📊', step: 'Reports', who: 'HR Admin', desc: 'Department-wide performance reports generated' },
  { icon: '⚡', step: 'Escalation', who: 'Auto', desc: 'Missed SLAs auto-escalate to senior managers' },
];

const ROLES = [
  {
    icon: '👤',
    role: 'Employee',
    color: '#5c3d1e',
    bg: 'linear-gradient(135deg,#291C0E,#6E473B)',
    tagline: 'Set goals. Track progress. Stay aligned.',
    points: ['Create & submit goals', 'Log quarterly check-ins', 'View approval status', 'See your performance score'],
  },
  {
    icon: '👔',
    role: 'Manager',
    color: '#4a3020',
    bg: 'linear-gradient(135deg,#3a2418,#7a5030)',
    tagline: 'Approve fast. Coach better. Lead clearly.',
    points: ['Review & approve team goals', 'Handle escalations', 'Track team KPIs', 'Rate performance at cycle end'],
  },
  {
    icon: '🛡️',
    role: 'HR / Admin',
    color: '#291C0E',
    bg: 'linear-gradient(135deg,#1a0f06,#4a3020)',
    tagline: 'Control the cycle. Audit everything.',
    points: ['Manage users & roles', 'Lock/unlock goal cycles', 'Generate compliance reports', 'Monitor escalation trail'],
  },
];

const PROBLEMS = [
  ['Excel chaos & version conflicts', 'Centralized, structured goal repository'],
  ['Missed approval deadlines', 'Automated SLA tracking & escalation'],
  ['Zero real-time visibility', 'Live dashboards for every role'],
  ['Manual appraisal reviews', 'Automated check-ins & scoring'],
  ['No audit trail', '100% immutable compliance log'],
];

export default function LandingPage() {
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [vis, setVis] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', fn);
    setTimeout(() => setVis(true), 80);
    return () => window.removeEventListener('scroll', fn);
  }, []);

  const btn = (label: string, path: string, primary = false) => (
    <button
      onClick={() => router.push(path)}
      style={{
        padding: primary ? '14px 36px' : '13px 28px',
        borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: 'pointer',
        border: primary ? 'none' : '2px solid rgba(255,255,255,0.35)',
        background: primary ? '#BEB5A9' : 'rgba(255,255,255,0.1)',
        color: primary ? '#1a0e05' : '#fff',
        backdropFilter: primary ? 'none' : 'blur(8px)',
        boxShadow: primary ? '0 6px 24px rgba(190,181,169,0.4)' : 'none',
        transition: 'all 0.2s',
      }}
    >{label}</button>
  );

  return (
    <div style={{ fontFamily: "'Inter',-apple-system,sans-serif", background: '#fdf9f5', color: '#2d1f0f', overflowX: 'hidden' }}>

      {/* NAV */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, height: 68,
        background: scrolled ? 'rgba(253,249,245,0.97)' : 'transparent',
        backdropFilter: scrolled ? 'blur(20px)' : 'none',
        borderBottom: scrolled ? '1px solid #e8ddd2' : 'none',
        transition: 'all 0.3s', padding: '0 6%',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18, color: scrolled ? '#3b2210' : '#fff', letterSpacing: '-0.3px' }}>GoalSync</div>
            <div style={{ fontSize: 9, color: scrolled ? '#92745a' : 'rgba(255,255,255,0.6)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Enterprise HR Suite</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={() => router.push('/login?tab=request')} style={{ padding: '9px 20px', borderRadius: 8, fontWeight: 700, fontSize: 13, background: 'transparent', color: scrolled ? '#5c3d1e' : '#fff', border: `2px solid ${scrolled ? '#c49a6c' : 'rgba(255,255,255,0.4)'}`, cursor: 'pointer' }}>Request Access</button>
          <button onClick={() => router.push('/login')} style={{ padding: '9px 22px', borderRadius: 8, fontWeight: 700, fontSize: 14, background: 'linear-gradient(135deg,#5c3d1e,#8b5e3c)', color: '#fff', border: 'none', cursor: 'pointer', boxShadow: '0 4px 14px rgba(92,61,30,0.4)' }}>Sign In →</button>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{ minHeight: '100vh', position: 'relative', display: 'flex', alignItems: 'center', paddingTop: 68, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'url(https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1920&q=80)', backgroundSize: 'cover', backgroundPosition: 'center 30%' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(155deg,rgba(30,16,5,0.96) 0%,rgba(80,48,22,0.90) 55%,rgba(139,94,60,0.78) 100%)' }} />
        <div style={{ position: 'relative', zIndex: 2, padding: '80px 7%', width: '100%', maxWidth: 1280, margin: '0 auto' }}>

          <h1 style={{ fontSize: 'clamp(34px,5vw,68px)', fontWeight: 900, color: '#fff', lineHeight: 1.1, margin: '0 0 20px', letterSpacing: '-1.5px', maxWidth: 720, opacity: vis ? 1 : 0, transform: vis ? 'none' : 'translateY(28px)', transition: 'all 0.7s ease' }}>
            One platform for company-wide<br />
            <span style={{ color: '#BEB5A9' }}>Goal Setting & Performance</span>
          </h1>

          <p style={{ fontSize: 19, color: 'rgba(255,255,255,0.80)', maxWidth: 560, lineHeight: 1.7, margin: '0 0 40px', opacity: vis ? 1 : 0, transition: 'all 0.7s ease 0.15s' }}>
            Employees set goals. Managers approve them. HR tracks everything — with full audit trail, automated escalations, and real-time dashboards.
          </p>

          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', opacity: vis ? 1 : 0, transition: 'all 0.7s ease 0.3s' }}>
            {btn('Sign In to Portal →', '/login', true)}
            {btn('Request Access', '/login?tab=request')}
          </div>

          {/* Quick stats */}
          <div style={{ display: 'flex', gap: 20, marginTop: 60, flexWrap: 'wrap' }}>
            {[['3', 'Role-Based Portals'], ['6-Step', 'Structured Workflow'], ['100%', 'Audit Coverage']].map(([v, l]) => (
              <div key={l} style={{ background: 'rgba(255,255,255,0.09)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 12, padding: '14px 24px', textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 900, color: '#BEB5A9' }}>{v}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 2, fontWeight: 500 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── WHAT IT DOES IN ONE SENTENCE ── */}
      <section style={{ background: '#291C0E', padding: '36px 7%' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, flexWrap: 'wrap', textAlign: 'center' }}>
          <span style={{ fontSize: 22, fontWeight: 800, color: '#E1D4C2', lineHeight: 1.5 }}>
            GoalSync replaces scattered spreadsheets with a structured, role-aware portal where every goal is created, approved, tracked, and reported — automatically.
          </span>
        </div>
      </section>

      {/* ── WHO USES IT ── */}
      <section style={{ padding: '88px 7%', background: '#fdf9f5' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 52 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#8b5e3c', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10 }}>Who Uses GoalSync</div>
            <h2 style={{ fontSize: 'clamp(26px,3vw,40px)', fontWeight: 800, color: '#2d1a0a', margin: 0 }}>Built for Three Roles, One System</h2>
            <p style={{ color: '#7a5c3a', fontSize: 15, marginTop: 10 }}>Every person in your company has a tailored portal — no confusion, no overlap.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 24 }}>
            {ROLES.map(r => (
              <div key={r.role} style={{ borderRadius: 20, overflow: 'hidden', boxShadow: '0 6px 28px rgba(41,28,14,0.12)', border: '1px solid #e8ddd2' }}>
                <div style={{ background: r.bg, padding: '32px 28px', color: '#fff' }}>
                  <div style={{ fontSize: 40, marginBottom: 10 }}>{r.icon}</div>
                  <div style={{ fontWeight: 800, fontSize: 22 }}>{r.role}</div>
                  <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.70)', marginTop: 6, fontStyle: 'italic' }}>{r.tagline}</div>
                </div>
                <div style={{ padding: '24px 28px', background: '#fff' }}>
                  {r.points.map(p => (
                    <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid #f5ede4' }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#c49a6c', flexShrink: 0 }} />
                      <span style={{ fontSize: 14, color: '#4a3520', fontWeight: 500 }}>{p}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── WORKFLOW PIPELINE ── */}
      <section style={{ padding: '88px 7%', background: '#fff' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 52 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#8b5e3c', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10 }}>How It Works</div>
            <h2 style={{ fontSize: 'clamp(26px,3vw,40px)', fontWeight: 800, color: '#2d1a0a', margin: 0 }}>The Goal Lifecycle — Step by Step</h2>
            <p style={{ color: '#7a5c3a', fontSize: 15, marginTop: 10 }}>Every goal follows the same structured path from creation to final report.</p>
          </div>

          {/* Pipeline */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 0, position: 'relative' }}>
            {WORKFLOW.map((w, i) => (
              <div key={w.step} style={{ position: 'relative', textAlign: 'center', padding: '0 8px' }}>
                {/* connector line */}
                {i < WORKFLOW.length - 1 && (
                  <div style={{ position: 'absolute', top: 36, left: '58%', right: '-42%', height: 2, background: 'linear-gradient(90deg,#c49a6c,#E1D4C2)', zIndex: 0 }} />
                )}
                <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                  <div style={{
                    width: 72, height: 72, borderRadius: '50%',
                    background: i === 0 ? 'linear-gradient(135deg,#291C0E,#6E473B)' : i === 1 ? 'linear-gradient(135deg,#3a2418,#8b5e3c)' : i === 2 ? 'linear-gradient(135deg,#4a3020,#a0724a)' : i === 3 ? 'linear-gradient(135deg,#5a3a28,#c49a6c)' : i === 4 ? 'linear-gradient(135deg,#6E473B,#BEB5A9)' : 'linear-gradient(135deg,#7a5030,#E1D4C2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 26, boxShadow: '0 4px 16px rgba(41,28,14,0.18)',
                    border: '3px solid #fff',
                  }}>{w.icon}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#8b5e3c', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Step {i + 1} · {w.who}</div>
                  <div style={{ fontWeight: 800, fontSize: 15, color: '#2d1a0a' }}>{w.step}</div>
                  <div style={{ fontSize: 13, color: '#7a5c3a', lineHeight: 1.5, maxWidth: 150 }}>{w.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── BEFORE / AFTER ── */}
      <section style={{ padding: '88px 7%', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'url(https://images.unsplash.com/photo-1497366412874-3415097a27e7?auto=format&fit=crop&w=1920&q=80)', backgroundSize: 'cover', backgroundPosition: 'center' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(30,16,5,0.93)' }} />
        <div style={{ maxWidth: 1280, margin: '0 auto', position: 'relative', zIndex: 2 }}>
          <div style={{ textAlign: 'center', marginBottom: 52 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#BEB5A9', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10 }}>Why Companies Need This</div>
            <h2 style={{ fontSize: 'clamp(26px,3vw,40px)', fontWeight: 800, color: '#fff', margin: 0 }}>The Problem GoalSync Solves</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 1fr', gap: 20, alignItems: 'center' }}>
            {/* Before */}
            <div style={{ background: 'rgba(120,40,30,0.25)', border: '1px solid rgba(200,100,80,0.3)', borderRadius: 18, padding: '32px 28px' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#f08070', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 20 }}>❌ Without GoalSync</div>
              {PROBLEMS.map(([b]) => (
                <div key={b} style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 14, marginTop: 2 }}>⚠️</span>
                  <span style={{ fontSize: 14, color: 'rgba(255,220,210,0.85)', lineHeight: 1.5 }}>{b}</span>
                </div>
              ))}
            </div>
            {/* Arrow */}
            <div style={{ textAlign: 'center', fontSize: 28, color: '#BEB5A9', fontWeight: 900 }}>→</div>
            {/* After */}
            <div style={{ background: 'rgba(50,80,50,0.25)', border: '1px solid rgba(100,160,100,0.3)', borderRadius: 18, padding: '32px 28px' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#90d090', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 20 }}>✅ With GoalSync</div>
              {PROBLEMS.map(([, a]) => (
                <div key={a} style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 14, marginTop: 2 }}>✅</span>
                  <span style={{ fontSize: 14, color: 'rgba(200,240,200,0.90)', lineHeight: 1.5 }}>{a}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ padding: '80px 7%', background: '#291C0E', textAlign: 'center' }}>
        <div style={{ maxWidth: 620, margin: '0 auto' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🎯</div>
          <h2 style={{ fontSize: 'clamp(28px,3.5vw,44px)', fontWeight: 900, color: '#fff', margin: '0 0 16px', letterSpacing: '-0.5px' }}>Ready to see GoalSync?</h2>
          <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 16, marginBottom: 36, lineHeight: 1.7 }}>Sign in with demo credentials and explore all three portals — Employee, Manager, and HR Admin.</p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => router.push('/login')} style={{ padding: '15px 44px', borderRadius: 10, fontWeight: 800, fontSize: 16, background: '#BEB5A9', color: '#1a0e05', border: 'none', cursor: 'pointer', boxShadow: '0 6px 24px rgba(190,181,169,0.35)' }}>Enter the Portal →</button>
            <button onClick={() => router.push('/login?tab=request')} style={{ padding: '15px 32px', borderRadius: 10, fontWeight: 700, fontSize: 15, background: 'transparent', color: '#BEB5A9', border: '2px solid rgba(190,181,169,0.4)', cursor: 'pointer' }}>Request Access</button>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ background: '#1a0e05', padding: '36px 7%' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ fontSize: 22 }}>🎯</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15, color: '#BEB5A9' }}>GoalSync</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>Enterprise Goal Management Platform</div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', fontWeight: 600 }}>Enterprise-Grade Goal Management</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 3 }}>Structured · Auditable · Real-Time</div>
          </div>
        </div>
      </footer>

    </div>
  );
}
