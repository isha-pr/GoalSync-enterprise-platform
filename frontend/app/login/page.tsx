'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Form, Input, Button, message, Modal, Steps, Tag, Select, Spin } from 'antd';
import {
  UserOutlined, LockOutlined, SafetyOutlined, ArrowLeftOutlined,
  CheckCircleOutlined, ClockCircleOutlined, CloseCircleOutlined,
  MailOutlined, IdcardOutlined, TeamOutlined, SendOutlined,
} from '@ant-design/icons';
import { useStore } from '../../lib/store';
import api from '../../lib/api';

type TabKey = 'signin' | 'request' | 'status' | 'admin';

const ERROR_MESSAGES: Record<string, string> = {
  account_not_found: '❌ No account found with this email. Please request access below.',
  account_pending: '⏳ Account pending HR approval. You will be notified once activated.',
  account_rejected: '🚫 Your access request was not approved. Contact HR for details.',
  account_deactivated: '🔒 This account has been deactivated. Contact your HR administrator.',
  invalid_password: '🔑 Incorrect password. Please try again or use Forgot Password.',
  invalid_admin_key: '🚫 Invalid Admin Secret Key. Unauthorized access blocked.',
  account_exists: '⚠️ An account with this email already exists. Please sign in.',
  request_pending: '⏳ A registration request for this email is already pending HR review.',
  server_error: 'Server error. Please try again later.',
};

export default function LoginPage() {
  const router = useRouter();
  const { login } = useStore();
  const [tab, setTab] = useState<TabKey>('signin');
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotStep, setForgotStep] = useState<0|1|2|3>(0); // 0=email, 1=otp, 2=newpw, 3=done
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotResetToken, setForgotResetToken] = useState('');
  const [forgotPreviewUrl, setForgotPreviewUrl] = useState<string|null>(null);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [ssoVisible, setSsoVisible] = useState(false);
  const [ssoStep, setSsoStep] = useState(0);
  const [ssoLoading, setSsoLoading] = useState(false);
  const [statusResult, setStatusResult] = useState<any>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [adminCreated, setAdminCreated] = useState<string | null>(null);

  const [loginForm] = Form.useForm();
  const [requestForm] = Form.useForm();
  const [statusForm] = Form.useForm();
  const [forgotForm] = Form.useForm();
  const [otpForm] = Form.useForm();
  const [newPwForm] = Form.useForm();
  const [adminForm] = Form.useForm();

  const demos = [
    { role: 'HR Admin', email: 'admin@test.com', icon: '🛡️', color: '#4a3020', bg: '#E1D4C2' },
    { role: 'Manager', email: 'manager@test.com', icon: '👔', color: '#6E473c', bg: '#edf5e0' },
    { role: 'Employee', email: 'employee@test.com', icon: '👤', color: '#8b5e3c', bg: '#f5ebe0' },
  ];

  const handleLogin = async (values: { email: string; password: string }) => {
    setLoading(true);
    try {
      const res = await api.post('/auth/login', values);
      const { token, user } = res.data;
      login(user, token);
      message.success(`Welcome back, ${user.name}!`);
      router.push(`/${user.role}`);
    } catch (err: any) {
      const errCode = err.response?.data?.error;
      const errMsg = err.response?.data?.message;
      message.error(ERROR_MESSAGES[errCode] || errMsg || 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (email: string) => {
    loginForm.setFieldsValue({ email, password: '1234' });
    setSelectedRole(email);
    setTab('signin');
  };

  const handleRequestAccess = async (values: any) => {
    setLoading(true);
    try {
      await api.post('/auth/request-access', values);
      message.success('Request submitted! HR will review within 1–2 business days.');
      requestForm.resetFields();
      setTab('status');
      statusForm.setFieldsValue({ email: values.email });
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Submission failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckStatus = async (values: { email: string }) => {
    setStatusLoading(true);
    try {
      const res = await api.get(`/auth/request-status?email=${values.email}`);
      setStatusResult(res.data);
    } catch {
      message.error('Could not fetch status.');
    } finally {
      setStatusLoading(false);
    }
  };

  const handleSSOClick = () => {
    setSsoVisible(true); setSsoStep(0); setSsoLoading(true);
    setTimeout(() => setSsoStep(1), 1200);
    setTimeout(() => setSsoStep(2), 2400);
    setTimeout(() => { setSsoStep(3); setSsoLoading(false); }, 3400);
  };

  const handleCreateAdmin = async (values: any) => {
    setLoading(true);
    try {
      const res = await api.post('/auth/create-admin', values);
      setAdminCreated(res.data.user?.email || values.email);
      message.success('Admin account created successfully!');
      adminForm.resetFields();
    } catch (err: any) {
      const code = err.response?.data?.error;
      message.error(ERROR_MESSAGES[code] || err.response?.data?.message || 'Creation failed.');
    } finally {
      setLoading(false);
    }
  };

  const tabStyle = (t: TabKey) => ({
    flex: 1, padding: '11px 0', border: 'none', cursor: 'pointer',
    borderRadius: 8, fontWeight: 700, fontSize: 13, transition: 'all 0.2s',
    background: tab === t ? '#5c3d1e' : 'transparent',
    color: tab === t ? '#fff' : '#7a5c3a',
  });

  const statusConfig: Record<string, { icon: JSX.Element; color: string; bg: string }> = {
    approved: { icon: <CheckCircleOutlined />, color: '#291C0E', bg: '#EFF4EF' },
    pending: { icon: <ClockCircleOutlined />, color: '#6E473B', bg: '#F0E8D8' },
    rejected: { icon: <CloseCircleOutlined />, color: '#7A3A30', bg: '#F5ECEA' },
    not_found: { icon: <UserOutlined />, color: '#4a3020', bg: '#E1D4C2' },
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', fontFamily: "'Inter', sans-serif" }}>
      {/* LEFT PANEL */}
      <div style={{ flex: '0 0 48%', position: 'relative', overflow: 'hidden', padding: '60px 64px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'url(https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1400&q=80)', backgroundSize: 'cover', backgroundPosition: 'center' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(160deg,rgba(30,17,5,0.95) 0%,rgba(70,40,14,0.88) 50%,rgba(110,70,30,0.82) 100%)' }} />
        {[{w:500,h:500,top:'-15%',right:'-20%'},{w:300,h:300,bottom:'5%',left:'-10%'},{w:200,h:200,top:'40%',right:'10%'}].map((s,i)=>(
          <div key={i} style={{ position:'absolute', zIndex:2, width:s.w, height:s.h, borderRadius:'50%', border:'1px solid rgba(255,255,255,0.06)', top:s.top, right:s.right, bottom:s.bottom, left:s.left }} />
        ))}
        <button onClick={()=>router.push('/')} style={{ position:'relative', zIndex:3, alignSelf:'flex-start', display:'inline-flex', alignItems:'center', gap:8, background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:8, padding:'8px 16px', cursor:'pointer', color:'rgba(255,255,255,0.85)', fontSize:13, fontWeight:600, marginBottom:'auto' }}>
          <ArrowLeftOutlined /> Back to Home
        </button>
        <div style={{ flex:1, display:'flex', flexDirection:'column', justifyContent:'center', position:'relative', zIndex:3 }}>
          <div style={{ fontSize:12, fontWeight:700, color:'#BEB5A9', textTransform:'uppercase', letterSpacing:'0.12em', marginBottom:14 }}>GoalSync · Enterprise HR Suite</div>
          <h1 style={{ fontSize:'clamp(28px,3vw,44px)', fontWeight:900, color:'#fff', lineHeight:1.12, margin:'0 0 20px', letterSpacing:'-0.5px' }}>
            GoalSync Enterprise<br/><span style={{color:'#BEB5A9'}}>Access Portal</span>
          </h1>
          <p style={{ color:'rgba(255,255,255,0.68)', fontSize:15, lineHeight:1.75, maxWidth:360, margin:'0 0 32px' }}>
            A complete performance management system for setting goals, tracking progress, and keeping your team accountable — all in one place.
          </p>
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {[['🎯','Streamlined goal setting and alignment across every team'],['📈','Real-time tracking of performance and key milestones'],['⚖️','Fair, transparent, and structured quarterly reviews'],['🚀','Boost productivity with clear expectations and feedback']].map(([icon,text])=>(
              <div key={text} style={{ display:'flex', alignItems:'center', gap:12 }}>
                <div style={{ width:34, height:34, borderRadius:9, background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.15)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:15 }}>{icon}</div>
                <span style={{ color:'rgba(255,255,255,0.72)', fontSize:13, fontWeight:500 }}>{text}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ position:'relative', zIndex:3, fontSize:11, color:'rgba(255,255,255,0.28)', marginTop:40 }}>
          © 2025 GoalSync · Empowering Performance Accountability Across Your Organization
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:'40px 56px', background:'#fdf9f5', overflowY:'auto' }}>
        <div style={{ width:'100%', maxWidth:440 }}>
          <h2 style={{ fontSize:26, fontWeight:800, color:'#2d1a0a', margin:'0 0 4px', letterSpacing:'-0.3px' }}>GoalSync Enterprise Access Portal</h2>
          <p style={{ color:'#92745a', fontSize:13, margin:'0 0 28px' }}>Sign in to manage goals, track team progress, and stay on top of quarterly reviews.</p>

          {/* Quick Demo */}
          <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e8ddd2', padding:16, marginBottom:24, boxShadow:'0 2px 8px rgba(92,61,30,0.06)' }}>
            <p style={{ fontSize:10, fontWeight:700, color:'#b8956a', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:12 }}>⚡ Try a Demo — Click to auto-fill credentials</p>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
              {demos.map(d=>(
                <button key={d.role} onClick={()=>fillDemo(d.email)} style={{ background:selectedRole===d.email?d.bg:'#fdf9f5', border:`2px solid ${selectedRole===d.email?d.color:'#e8ddd2'}`, borderRadius:10, padding:'10px 6px', cursor:'pointer', transition:'all 0.2s', textAlign:'center', transform:selectedRole===d.email?'scale(1.04)':'scale(1)' }}>
                  <div style={{ fontSize:20, marginBottom:4 }}>{d.icon}</div>
                  <div style={{ fontSize:11, fontWeight:700, color:d.color }}>{d.role}</div>
                </button>
              ))}
            </div>
            <div style={{ marginTop:10, fontSize:11, color:'#b8a090', textAlign:'center' }}>
              <SafetyOutlined /> Each role shows only the features relevant to that person
            </div>
          </div>

          {/* Microsoft SSO */}
          <button onClick={handleSSOClick} style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:10, background:'#fff', border:'2px solid #e8ddd2', borderRadius:10, padding:'12px 16px', cursor:'pointer', marginBottom:6, fontSize:13, fontWeight:700, color:'#2d1a0a', boxShadow:'0 2px 6px rgba(92,61,30,0.08)', transition:'all 0.2s' }}>
            <svg width="18" height="18" viewBox="0 0 21 21"><rect x="1" y="1" width="9" height="9" fill="#f25022"/><rect x="11" y="1" width="9" height="9" fill="#7fba00"/><rect x="1" y="11" width="9" height="9" fill="#00a4ef"/><rect x="11" y="11" width="9" height="9" fill="#ffb900"/></svg>
            Sign in with Microsoft Entra ID
          </button>
          <div style={{ fontSize:11, color:'#b8a090', textAlign:'center', marginBottom:20 }}>Single Sign-On via Microsoft · Your existing company credentials work here</div>

          {/* Tabs */}
          <div style={{ display:'flex', gap:3, background:'#f5ebe0', borderRadius:10, padding:4, marginBottom:24, flexWrap:'wrap' }}>
            {([
              { key:'signin', label:'Sign In' },
              { key:'request', label:'Request Access' },
              { key:'status', label:'Check Status' },
              { key:'admin', label:'🛡️ Admin' },
            ] as {key:TabKey,label:string}[]).map(t=>(
              <button key={t.key} style={{
                ...tabStyle(t.key),
                flex:'1 1 auto',
                fontSize:12,
                background: tab===t.key ? '#291C0E' : 'transparent',
                color: tab===t.key ? '#fff' : '#7a5c3a',
              }} onClick={()=>setTab(t.key)}>{t.label}</button>
            ))}
          </div>

          {/* SIGN IN TAB */}
          {tab==='signin' && (
            <>
              <Form form={loginForm} onFinish={handleLogin} layout="vertical" size="large">
                <Form.Item name="email" rules={[{required:true,message:'Email required'},{type:'email',message:'Invalid email'}]}>
                  <Input prefix={<MailOutlined style={{color:'#b8956a'}}/>} placeholder="corporate.email@company.com" style={{height:48,borderRadius:10,borderColor:'#d9c9b8'}}/>
                </Form.Item>
                <Form.Item name="password" rules={[{required:true,message:'Password required'}]}>
                  <Input.Password prefix={<LockOutlined style={{color:'#b8956a'}}/>} placeholder="••••••••" style={{height:48,borderRadius:10,borderColor:'#d9c9b8'}}/>
                </Form.Item>
                <div style={{ textAlign:'right', marginTop:-16, marginBottom:20 }}>
                  <button type="button" onClick={()=>setForgotOpen(true)} style={{ background:'none', border:'none', color:'#8b5e3c', fontSize:13, fontWeight:600, cursor:'pointer', padding:0 }}>
                    Forgot Password?
                  </button>
                </div>
                <Button type="primary" htmlType="submit" loading={loading} block style={{ height:52, fontSize:16, fontWeight:800, background:'linear-gradient(135deg,#5c3d1e,#8b5e3c)', border:'none', borderRadius:10, boxShadow:'0 8px 20px rgba(92,61,30,0.35)' }}>
                  {loading ? 'Signing in...' : 'Sign In to GoalSync →'}
                </Button>
              </Form>
              <p style={{ textAlign:'center', marginTop:20, fontSize:13, color:'#7a5c3a' }}>
                New employee?{' '}
                <button onClick={()=>setTab('request')} style={{ background:'none', border:'none', color:'#5c3d1e', fontWeight:700, cursor:'pointer', fontSize:13, textDecoration:'underline' }}>
                  Request Access
                </button>
              </p>
            </>
          )}

          {/* REQUEST ACCESS TAB */}
          {tab==='request' && (
            <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e8ddd2', padding:24, boxShadow:'0 2px 8px rgba(92,61,30,0.06)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20 }}>
                <div style={{ width:40, height:40, borderRadius:10, background:'linear-gradient(135deg,#5c3d1e,#8b5e3c)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:18 }}><IdcardOutlined/></div>
                <div>
                  <div style={{ fontWeight:800, color:'#2d1a0a', fontSize:15 }}>Request GoalSync Access</div>
                  <div style={{ fontSize:12, color:'#7a5c3a' }}>HR will review your request · Usually within 1–2 business days</div>
                </div>
              </div>
              <Form form={requestForm} onFinish={handleRequestAccess} layout="vertical" size="middle">
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 12px' }}>
                  <Form.Item name="fullName" label={<span style={{fontSize:12,fontWeight:600,color:'#5c3d1e'}}>Full Name *</span>} rules={[{required:true}]}>
                    <Input prefix={<UserOutlined/>} placeholder="Ravi Kumar" style={{borderRadius:8,borderColor:'#d9c9b8'}}/>
                  </Form.Item>
                  <Form.Item name="employeeId" label={<span style={{fontSize:12,fontWeight:600,color:'#5c3d1e'}}>Employee ID *</span>} rules={[{required:true}]}>
                    <Input prefix={<IdcardOutlined/>} placeholder="EMP-1042" style={{borderRadius:8,borderColor:'#d9c9b8'}}/>
                  </Form.Item>
                </div>
                <Form.Item name="email" label={<span style={{fontSize:12,fontWeight:600,color:'#5c3d1e'}}>Official Email *</span>} rules={[{required:true},{type:'email'}]}>
                  <Input prefix={<MailOutlined/>} placeholder="ravi.kumar@company.com" style={{borderRadius:8,borderColor:'#d9c9b8'}}/>
                </Form.Item>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 12px' }}>
                  <Form.Item name="department" label={<span style={{fontSize:12,fontWeight:600,color:'#5c3d1e'}}>Department *</span>} rules={[{required:true}]}>
                    <Select placeholder="Select dept." style={{borderRadius:8}} options={['Technology','Finance','Operations','Human Resources','Sales','Marketing','Legal'].map(d=>({label:d,value:d}))}/>
                  </Form.Item>
                  <Form.Item name="requestedRole" label={<span style={{fontSize:12,fontWeight:600,color:'#5c3d1e'}}>Requested Role</span>}>
                    <Select defaultValue="employee" options={[{label:'👤 Employee',value:'employee'},{label:'👔 Manager',value:'manager'}]}/>
                  </Form.Item>
                </div>
                <Form.Item name="managerName" label={<span style={{fontSize:12,fontWeight:600,color:'#5c3d1e'}}>Reporting Manager</span>}>
                  <Input prefix={<TeamOutlined/>} placeholder="Manager's full name" style={{borderRadius:8,borderColor:'#d9c9b8'}}/>
                </Form.Item>
                <Form.Item name="reason" label={<span style={{fontSize:12,fontWeight:600,color:'#5c3d1e'}}>Reason / Team</span>}>
                  <Input.TextArea placeholder="Brief reason for access..." rows={2} style={{borderRadius:8,borderColor:'#d9c9b8'}}/>
                </Form.Item>
                <Button type="primary" htmlType="submit" loading={loading} block icon={<SendOutlined/>} style={{ height:44, fontWeight:700, background:'linear-gradient(135deg,#5c3d1e,#8b5e3c)', border:'none', borderRadius:10 }}>
                  Submit Registration Request
                </Button>
              </Form>
              <div style={{ marginTop:14, textAlign:'center', padding:'10px 16px', background:'#F0E8D8', borderRadius:8, fontSize:12, color:'#6E473B', fontWeight:500 }}>
                ⏳ After you submit: HR will review your request and activate your account. You'll receive an email with your login details once approved.
              </div>
            </div>
          )}

          {/* CHECK STATUS TAB */}
          {tab==='status' && (
            <div>
              <Form form={statusForm} onFinish={handleCheckStatus} layout="vertical" size="large">
                <Form.Item name="email" label={<span style={{fontSize:13,fontWeight:600,color:'#5c3d1e'}}>Enter your official email to check status</span>} rules={[{required:true},{type:'email'}]}>
                  <Input prefix={<MailOutlined style={{color:'#b8956a'}}/>} placeholder="ravi.kumar@company.com" style={{height:48,borderRadius:10,borderColor:'#d9c9b8'}}/>
                </Form.Item>
                <Button type="primary" htmlType="submit" loading={statusLoading} block style={{ height:48, fontWeight:700, background:'linear-gradient(135deg,#5c3d1e,#8b5e3c)', border:'none', borderRadius:10 }}>
                  {statusLoading ? <Spin size="small"/> : 'Check My Request Status'}
                </Button>
              </Form>
              {statusResult && (() => {
                const cfg = statusConfig[statusResult.status] || statusConfig.not_found;
                return (
                  <div style={{ marginTop:20, background:cfg.bg, border:`1px solid ${cfg.color}30`, borderRadius:12, padding:20 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                      <span style={{ fontSize:22, color:cfg.color }}>{cfg.icon}</span>
                      <span style={{ fontWeight:800, fontSize:15, color:cfg.color, textTransform:'capitalize' }}>{statusResult.status.replace('_',' ')}</span>
                    </div>
                    <p style={{ margin:0, color:cfg.color, fontSize:13, lineHeight:1.6 }}>{statusResult.message}</p>
                    {statusResult.status==='approved' && (
                      <Button type="primary" block style={{ marginTop:14, background:'linear-gradient(135deg,#5c3d1e,#8b5e3c)', border:'none', borderRadius:8, fontWeight:700 }} onClick={()=>setTab('signin')}>
                        Sign In Now →
                      </Button>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* ADMIN ACCOUNT CREATION TAB */}
          {tab==='admin' && (
            <div style={{ background:'#fff', borderRadius:14, border:'2px solid #BEB5A9', padding:24, boxShadow:'0 4px 16px rgba(41,28,14,0.10)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
                <div style={{ width:40, height:40, borderRadius:10, background:'linear-gradient(135deg,#291C0E,#6E473B)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:18 }}>🛡️</div>
                <div>
                <div style={{ fontWeight:800, color:'#2d1a0a', fontSize:15 }}>Admin / HR Account Setup</div>
                  <div style={{ fontSize:12, color:'#7a5c3a' }}>For authorized HR administrators only · Requires a secret key</div>
                </div>
              </div>
              <div style={{ background:'#F0E8D8', border:'1px solid #C8B490', borderRadius:8, padding:'10px 14px', marginBottom:16, fontSize:12, color:'#6E473B', fontWeight:500 }}>
                🔑 Only authorized HR or IT administrators can create privileged accounts. This ensures no unauthorized access to admin features.
              </div>
              {adminCreated ? (
                <div style={{ textAlign:'center', padding:'20px 0' }}>
                  <div style={{ fontSize:48, marginBottom:12 }}>✅</div>
                  <div style={{ fontWeight:800, fontSize:16, color:'#291C0E', marginBottom:8 }}>Admin Account Created!</div>
                  <p style={{ color:'#4a3520', fontSize:13 }}>Account <strong>{adminCreated}</strong> is now active. They can sign in and start managing goals right away.</p>
                  <Button type="primary" onClick={()=>{ setAdminCreated(null); setTab('signin'); }} style={{ marginTop:12, background:'linear-gradient(135deg,#291C0E,#6E473B)', border:'none', borderRadius:8, fontWeight:700 }}>
                    Sign In as Admin →
                  </Button>
                </div>
              ) : (
                <Form form={adminForm} onFinish={handleCreateAdmin} layout="vertical" size="middle">
                  <Form.Item name="adminSecretKey" label={<span style={{fontSize:12,fontWeight:700,color:'#291C0E'}}>Admin Secret Key *</span>} rules={[{required:true,message:'Secret key required'}]}>
                    <Input.Password prefix={<LockOutlined style={{color:'#6E473B'}}/>} placeholder="Enter admin secret key" style={{borderRadius:8,borderColor:'#BEB5A9'}}/>
                  </Form.Item>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 12px' }}>
                    <Form.Item name="name" label={<span style={{fontSize:12,fontWeight:600,color:'#4a3020'}}>Full Name *</span>} rules={[{required:true}]}>
                      <Input prefix={<UserOutlined/>} placeholder="Admin Name" style={{borderRadius:8}}/>
                    </Form.Item>
                    <Form.Item name="department" label={<span style={{fontSize:12,fontWeight:600,color:'#4a3020'}}>Department *</span>} rules={[{required:true}]}>
                      <Select placeholder="Select" options={['Human Resources','IT','Finance','Operations'].map(d=>({label:d,value:d}))}/>
                    </Form.Item>
                  </div>
                  <Form.Item name="email" label={<span style={{fontSize:12,fontWeight:600,color:'#291C0E'}}>Official Email *</span>} rules={[{required:true},{type:'email'}]}>
                    <Input prefix={<MailOutlined/>} placeholder="admin@company.com" style={{borderRadius:8}}/>
                  </Form.Item>
                  <Form.Item name="password" label={<span style={{fontSize:12,fontWeight:600,color:'#291C0E'}}>Password *</span>} rules={[{required:true},{min:8,message:'Min 8 characters'}]}>
                    <Input.Password prefix={<LockOutlined/>} placeholder="Min 8 characters" style={{borderRadius:8}}/>
                  </Form.Item>
                  <Button type="primary" htmlType="submit" loading={loading} block style={{ height:44, fontWeight:700, background:'linear-gradient(135deg,#291C0E,#6E473B)', border:'none', borderRadius:10 }}>
                    Create Secure Admin Account
                  </Button>
                </Form>
              )}
            </div>
          )}

        </div>
      </div>

      {/* SSO Modal */}
      <Modal open={ssoVisible} onCancel={()=>{setSsoVisible(false);setSsoLoading(false);setSsoStep(0);}}
        footer={ssoStep===3?[
          <Button key="cancel" onClick={()=>setSsoVisible(false)}>Cancel</Button>,
          <Button key="proceed" type="primary" onClick={()=>{setSsoVisible(false);fillDemo('manager@test.com');message.success('Microsoft SSO — Role mapped: L1 Manager');}} style={{background:'#5c3d1e',border:'none',fontWeight:700}}>Continue to GoalSync</Button>,
        ]:null}
        title={<div style={{display:'flex',alignItems:'center',gap:10}}><svg width="16" height="16" viewBox="0 0 21 21"><rect x="1" y="1" width="9" height="9" fill="#f25022"/><rect x="11" y="1" width="9" height="9" fill="#7fba00"/><rect x="1" y="11" width="9" height="9" fill="#00a4ef"/><rect x="11" y="11" width="9" height="9" fill="#ffb900"/></svg><span style={{fontWeight:700}}>Microsoft Entra ID — SSO</span></div>}
        width={500}>
        <Steps direction="vertical" size="small" current={ssoStep} items={[
          {title:'Redirecting to Microsoft',description:'Connecting to Azure Active Directory...',status:ssoStep>0?'finish':ssoStep===0?(ssoLoading?'process':'finish'):'wait'},
          {title:'Authenticating',description:'Verifying corporate credentials via Entra ID...',status:ssoStep>1?'finish':ssoStep===1?(ssoLoading?'process':'finish'):'wait'},
          {title:'Syncing Role',description:'Mapping AD group → GoalSync role (L1 Manager)...',status:ssoStep>2?'finish':ssoStep===2?(ssoLoading?'process':'finish'):'wait'},
          {title:'Access Granted',description:'Identity verified. Redirecting to portal...',status:ssoStep===3?'finish':'wait'},
        ]}/>
        {ssoStep===3&&<div style={{marginTop:12,background:'#EFF4EF',borderRadius:10,padding:'12px 16px',border:'1px solid #B5C8B5'}}>
          <div style={{fontWeight:700,color:'#291C0E',marginBottom:8}}>✅ Identity Verified via Microsoft Entra ID</div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            <Tag style={{background:'#E1D4C2',borderColor:'#BEB5A9',color:'#291C0E'}}>👤 Priya Sharma</Tag><Tag style={{background:'#BEB5A9',borderColor:'#A78D78',color:'#291C0E'}}>AD: L1-Managers</Tag><Tag style={{background:'#DDD5C8',borderColor:'#BEB5A9',color:'#291C0E'}}>Role: Manager</Tag><Tag style={{background:'#E8E0D8',borderColor:'#BEB5A9',color:'#4a3020'}}>Dept: Technology</Tag>
          </div>
        </div>}
      </Modal>

      {/* Forgot Password Modal — 3-Step OTP Flow */}
      <Modal
        open={forgotOpen}
        onCancel={()=>{ setForgotOpen(false); setForgotStep(0); setForgotEmail(''); setForgotResetToken(''); setForgotPreviewUrl(null); forgotForm.resetFields(); otpForm.resetFields(); newPwForm.resetFields(); }}
        footer={null}
        title={<div style={{display:'flex',alignItems:'center',gap:10}}><span style={{fontSize:18}}>🔐</span><span style={{fontWeight:800}}>Password Reset</span></div>}
        width={480}
      >
        {/* Step indicator */}
        {forgotStep < 3 && (
          <Steps size="small" current={forgotStep} style={{marginBottom:24}} items={[
            {title:'Email'},
            {title:'Verify OTP'},
            {title:'New Password'},
          ]}/>
        )}

        {/* STEP 0 — Enter email */}
        {forgotStep===0 && (
          <Form form={forgotForm} layout="vertical" onFinish={async(v)=>{
            setForgotLoading(true);
            try {
              const res = await api.post('/auth/forgot-password', {email:v.email});
              setForgotEmail(v.email);
              setForgotPreviewUrl(res.data.previewUrl || null);
              setForgotStep(1);
              message.success('OTP sent to your email!');
            } catch(err:any){
              const msg = err.response?.data?.message || 'Failed to send OTP.';
              message.error(msg);
            } finally { setForgotLoading(false); }
          }}>
            <p style={{color:'#4a3520',fontSize:14,marginBottom:20,lineHeight:1.65}}>
              Enter your registered corporate email. A 6-digit OTP will be sent to your inbox.
            </p>
            <Form.Item name="email" label="Corporate Email" rules={[{required:true,message:'Email required'},{type:'email',message:'Invalid email'}]}>
              <Input prefix={<MailOutlined style={{color:'#b8956a'}}/>} placeholder="you@company.com" size="large" style={{height:46,borderRadius:10,borderColor:'#d9c9b8'}}/>
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={forgotLoading} block size="large"
              style={{height:46,fontWeight:700,background:'linear-gradient(135deg,#5c3d1e,#8b5e3c)',border:'none',borderRadius:10}}>
              Send Verification OTP
            </Button>
          </Form>
        )}

        {/* STEP 1 — Enter OTP */}
        {forgotStep===1 && (
          <Form form={otpForm} layout="vertical" onFinish={async(v)=>{
            setForgotLoading(true);
            try {
              const res = await api.post('/auth/verify-otp', {email:forgotEmail, otp:v.otp});
              setForgotResetToken(res.data.resetToken);
              setForgotStep(2);
              message.success('OTP verified! Set your new password.');
            } catch(err:any){
              message.error(err.response?.data?.message || 'Invalid OTP.');
            } finally { setForgotLoading(false); }
          }}>
            <div style={{background:'#EFF4EF',border:'1px solid #B5C8B5',borderRadius:10,padding:'14px 18px',marginBottom:20}}>
              <p style={{margin:0,fontSize:13,color:'#291C0E',fontWeight:600}}>✅ OTP sent to <strong>{forgotEmail}</strong></p>
              <p style={{margin:'6px 0 0',fontSize:12,color:'#3A5A3A'}}>Check your inbox and spam folder. Valid for 15 minutes.</p>
              {forgotPreviewUrl && (
                <p style={{margin:'8px 0 0',fontSize:12}}>
                  📧 <a href={forgotPreviewUrl} target="_blank" rel="noreferrer" style={{color:'#6E473B',fontWeight:600}}>Preview test email (Ethereal)</a>
                </p>
              )}
            </div>
            <Form.Item name="otp" label="Enter 6-Digit OTP" rules={[{required:true,message:'OTP required'},{len:6,message:'OTP must be 6 digits'}]}>
              <Input
                placeholder="_ _ _ _ _ _"
                maxLength={6}
                size="large"
                style={{height:56,borderRadius:10,fontSize:28,fontWeight:800,textAlign:'center',letterSpacing:12,borderColor:'#d9c9b8',fontFamily:'monospace'}}
              />
            </Form.Item>
            <div style={{display:'flex',gap:10}}>
              <Button block onClick={()=>{setForgotStep(0);otpForm.resetFields();}} style={{borderRadius:10}}>← Back</Button>
              <Button type="primary" htmlType="submit" loading={forgotLoading} block size="large"
                style={{height:46,fontWeight:700,background:'linear-gradient(135deg,#5c3d1e,#8b5e3c)',border:'none',borderRadius:10}}>
                Verify OTP
              </Button>
            </div>
            <div style={{textAlign:'center',marginTop:12}}>
              <button type="button" style={{background:'none',border:'none',color:'#8b5e3c',fontSize:12,cursor:'pointer',fontWeight:600}}
                onClick={async()=>{
                  try{ await api.post('/auth/forgot-password',{email:forgotEmail}); message.info('New OTP sent!'); }
                  catch(e:any){ message.error(e.response?.data?.message||'Failed'); }
                }}>Resend OTP</button>
            </div>
          </Form>
        )}

        {/* STEP 2 — New Password */}
        {forgotStep===2 && (
          <Form form={newPwForm} layout="vertical" onFinish={async(v)=>{
            if(v.newPassword!==v.confirmPassword){
              message.error('Passwords do not match!'); return;
            }
            setForgotLoading(true);
            try {
              await api.post('/auth/reset-password', {resetToken:forgotResetToken, newPassword:v.newPassword});
              setForgotStep(3);
              message.success('Password reset successful!');
            } catch(err:any){
              message.error(err.response?.data?.message || 'Reset failed.');
            } finally { setForgotLoading(false); }
          }}>
            <p style={{color:'#4a3520',fontSize:13,marginBottom:16,lineHeight:1.6}}>
              Create a strong new password. Must be 8+ characters with uppercase, lowercase, number, and special character.
            </p>
            <Form.Item name="newPassword" label="New Password" rules={[
              {required:true,message:'Password required'},
              {min:8,message:'Min 8 characters'},
              {pattern:/(?=.*[A-Z])/,message:'Must include uppercase'},
              {pattern:/(?=.*[a-z])/,message:'Must include lowercase'},
              {pattern:/(?=.*\d)/,message:'Must include a number'},
              {pattern:/(?=.*[@$!%*?&#^()_\-+=])/,message:'Must include special character'},
            ]}>
              <Input.Password prefix={<LockOutlined style={{color:'#b8956a'}}/>} placeholder="New strong password" size="large" style={{height:46,borderRadius:10,borderColor:'#d9c9b8'}}/>
            </Form.Item>
            <Form.Item name="confirmPassword" label="Confirm Password" rules={[{required:true,message:'Please confirm password'}]}>
              <Input.Password prefix={<LockOutlined style={{color:'#b8956a'}}/>} placeholder="Repeat new password" size="large" style={{height:46,borderRadius:10,borderColor:'#d9c9b8'}}/>
            </Form.Item>
            <div style={{background:'#F0E8D8',border:'1px solid #C8B490',borderRadius:8,padding:'10px 14px',marginBottom:16,fontSize:12,color:'#6E473B'}}>
              🔒 Strong password rules: 8+ chars · Uppercase · Lowercase · Number · Special character (@$!%*?&#)
            </div>
            <Button type="primary" htmlType="submit" loading={forgotLoading} block size="large"
              style={{height:46,fontWeight:700,background:'linear-gradient(135deg,#5c3d1e,#8b5e3c)',border:'none',borderRadius:10}}>
              Reset Password Securely
            </Button>
          </Form>
        )}

        {/* STEP 3 — Success */}
        {forgotStep===3 && (
          <div style={{textAlign:'center',padding:'24px 0'}}>
            <div style={{fontSize:56,marginBottom:16}}>✅</div>
            <div style={{fontWeight:800,fontSize:18,color:'#291C0E',marginBottom:10}}>Password Reset Successful!</div>
            <p style={{color:'#4a3520',fontSize:14,lineHeight:1.65,maxWidth:320,margin:'0 auto 24px'}}>
              Your password has been securely updated. Old password no longer works. You can now sign in with your new credentials.
            </p>
            <Button type="primary" size="large" block
              style={{fontWeight:700,background:'linear-gradient(135deg,#5c3d1e,#8b5e3c)',border:'none',borderRadius:10,height:46}}
              onClick={()=>{ setForgotOpen(false); setForgotStep(0); setForgotEmail(''); setForgotResetToken(''); forgotForm.resetFields(); otpForm.resetFields(); newPwForm.resetFields(); setTab('signin'); }}>
              Sign In with New Password →
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}
