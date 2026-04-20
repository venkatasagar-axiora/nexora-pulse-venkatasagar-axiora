import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import useAuthStore from '../hooks/useAuth';
import toast from 'react-hot-toast';
import { useLoading } from '../context/LoadingContext';

const Logo = ({ dark }) => (
  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0, lineHeight: 1 }}>
    <span style={{ fontFamily: 'Syne, sans-serif', fontSize: 9, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: dark ? 'rgba(253,245,232,0.35)' : 'rgba(22,15,8,0.35)', marginRight: 8, position: 'relative', top: -2 }}>Nexora</span>
    <span style={{ fontFamily: 'Playfair Display, serif', fontWeight: 900, fontSize: 24, letterSpacing: '-1px', color: dark ? 'var(--cream)' : 'var(--espresso)', lineHeight: 1 }}>Pulse</span>
    <div style={{ position: 'relative', width: 9, height: 9, background: 'var(--coral)', borderRadius: '50%', boxShadow: '0 0 10px rgba(255,69,0,0.55)', alignSelf: 'flex-start', marginTop: 5, marginLeft: 8, flexShrink: 0 }}>
      <div className="sonar-ring" /><div className="sonar-ring" /><div className="sonar-ring" />
    </div>
  </div>
);

export default function AcceptInvite() {
  const nav = useNavigate();
  const { stopLoading: stopNav } = useLoading();
  useEffect(() => { stopNav(); }, [stopNav]);

  // Read query params — injected by invite-user.js into redirectTo
  const params = new URLSearchParams(window.location.search);
  const tenantId = params.get('tenant_id') || '';
  const tenantName = params.get('tenant_name') || '';
  const prefillName = params.get('full_name') || '';

  // Detect expired-link errors from Supabase (req #20)
  // Supabase appends error info to the hash: #error=access_denied&error_description=...
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const urlError = params.get('error') || hashParams.get('error');
  const urlErrorDesc = params.get('error_description') || hashParams.get('error_description');

  const [f, setF] = useState({ fullName: prefillName, password: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  // BUG FIX #1: Do NOT redirect if account_status === 'invited'.
  // The invite link auto-signs the user in via magic link; useAuth.onAuthStateChange
  // fires SIGNED_IN and sets `user` in the store BEFORE the user has completed setup.
  // The old guard `if (initialized && user) → /dashboard` fired immediately, skipping
  // the setup form entirely. Now we track whether we are mid-invite-flow and suppress
  // the redirect until setup is confirmed complete.
  const [setupComplete, setSetupComplete] = useState(false);
  const [linkExpired, setLinkExpired] = useState(
    urlError === 'access_denied' || !!urlErrorDesc?.toLowerCase().includes('expired')
  );

  // If setup was just finished, send to dashboard
  useEffect(() => {
    if (setupComplete) nav('/dashboard');
  }, [setupComplete, nav]);

  const inputStyle = {
    width: '100%', boxSizing: 'border-box', padding: '0 0 12px',
    background: 'transparent', border: 'none',
    borderBottom: '2px solid rgba(22,15,8,0.12)',
    fontFamily: 'Fraunces, serif', fontSize: 16, color: 'var(--espresso)',
    outline: 'none', transition: 'border-color 0.2s',
  };
  const labelStyle = {
    fontFamily: 'Syne, sans-serif', fontSize: 9, fontWeight: 700,
    letterSpacing: '0.18em', textTransform: 'uppercase',
    color: 'rgba(22,15,8,0.4)', display: 'block', marginBottom: 10,
  };
  const disabledStyle = {
    ...inputStyle,
    color: 'rgba(22,15,8,0.3)',
    borderBottomColor: 'rgba(22,15,8,0.06)',
    cursor: 'not-allowed',
  };

  async function handleSubmit(e) {
    e.preventDefault();
    if (!f.fullName.trim()) return toast.error('Please enter your name');
    if (f.password.length < 6) return toast.error('Password must be at least 6 characters');
    if (f.password !== f.confirm) return toast.error('Passwords do not match');

    setBusy(true);
    try {
      // Supabase auto-authenticates the user when the invite link is clicked.
      // The session is already established by the time the user hits this page.
      const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
      if (sessionErr || !sessionData?.session) {
        throw new Error('Your session has expired. Please ask to be re-invited.');
      }

      // Set the user's chosen password
      const { error: pwErr } = await supabase.auth.updateUser({ password: f.password });
      if (pwErr) throw pwErr;

      // Mark profile as active and store their real name
      const { error: profileErr } = await supabase
        .from('user_profiles')
        .update({
          full_name: f.fullName.trim(),
          account_status: 'active',
          invite_accepted_at: new Date().toISOString(),
        })
        .eq('id', sessionData.session.user.id);

      if (profileErr) throw profileErr;

      // Reload the profile in the auth store so the dashboard has fresh data
      await useAuthStore.getState().loadProfile(sessionData.session.user);

      toast.success('Account set up! Welcome to Nexora Pulse.');
      setSetupComplete(true);
    } catch (err) {
      console.error('AcceptInvite error:', err);
      const msg = err.message || '';
      if (msg.toLowerCase().includes('expired') || msg.toLowerCase().includes('invalid')) {
        setLinkExpired(true);
      } else {
        toast.error(msg || 'Failed to complete setup. Please try again.');
      }
    } finally {
      setBusy(false);
    }
  }

  // ── Expired / invalid link state ─────────────────────────────────────────
  if (linkExpired) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--cream)', padding: 24 }}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          style={{ background: 'var(--warm-white)', borderRadius: 24, padding: '48px 44px', maxWidth: 400, width: '100%', textAlign: 'center', boxShadow: '0 24px 80px rgba(22,15,8,0.1)' }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(214,59,31,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--terracotta)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
          </div>
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontWeight: 900, fontSize: 26, letterSpacing: '-0.5px', color: 'var(--espresso)', marginBottom: 10 }}>Invitation link expired</h2>
          <p style={{ fontFamily: 'Fraunces, serif', fontWeight: 300, fontSize: 15, lineHeight: 1.7, color: 'rgba(22,15,8,0.5)', marginBottom: 28 }}>
            This invitation link is invalid or has expired. Invitation links are valid for{' '}
            <strong style={{ color: 'var(--espresso)' }}>24 hours</strong>.
            Please ask your administrator to send a new invitation.
          </p>
          <button onClick={() => nav('/login')}
            style={{ padding: '13px 28px', borderRadius: 999, background: 'var(--espresso)', color: 'var(--cream)', border: 'none', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer', transition: 'background 0.25s' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--coral)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--espresso)'}>
            Back to sign in
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: '1fr 480px' }}>

      {/* ── LEFT: dark editorial panel ── */}
      <div style={{ background: 'var(--espresso)', position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '80px 72px', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', width: 600, height: 600, borderRadius: '50%', filter: 'blur(80px)', background: 'radial-gradient(circle,rgba(255,69,0,0.3),transparent 70%)', top: -150, right: -150 }} />
          <div style={{ position: 'absolute', width: 400, height: 400, borderRadius: '50%', filter: 'blur(80px)', background: 'radial-gradient(circle,rgba(255,184,0,0.18),transparent 70%)', bottom: -80, left: -100 }} />
        </div>
        <div className="grain" style={{ opacity: 0.035 }} />
        <div style={{ position: 'absolute', bottom: -30, left: -10, fontFamily: 'Playfair Display, serif', fontWeight: 900, fontSize: 'clamp(120px,15vw,220px)', color: 'transparent', WebkitTextStroke: '1px rgba(253,245,232,0.04)', letterSpacing: -5, lineHeight: 1, userSelect: 'none', pointerEvents: 'none' }}>Pulse</div>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ marginBottom: 72 }}><Logo dark /></div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--saffron)', marginBottom: 20, opacity: 0.8 }}>
            You've been invited
          </div>
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(34px,3.5vw,50px)', fontWeight: 900, lineHeight: 1.05, letterSpacing: '-1.5px', color: 'var(--cream)', marginBottom: 24 }}>
            Join{' '}
            <em style={{ fontStyle: 'italic', color: 'var(--saffron)' }}>{tenantName || 'your team'}</em>
            {' '}on Nexora Pulse.
          </h2>
          <p style={{ fontFamily: 'Fraunces, serif', fontSize: 17, fontWeight: 300, lineHeight: 1.7, color: 'rgba(253,245,232,0.5)', maxWidth: 380 }}>
            Set up your account to start collaborating on surveys and research.
          </p>
        </div>
      </div>

      {/* ── RIGHT: form panel ── */}
      <div style={{ background: 'var(--warm-white)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 56px', borderLeft: '1px solid rgba(22,15,8,0.06)', overflowY: 'auto' }}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} style={{ width: '100%', maxWidth: 340 }}>
          <div style={{ display: 'block', marginBottom: 48 }}><Logo dark={false} /></div>

          <h2 style={{ fontFamily: 'Playfair Display, serif', fontWeight: 900, fontSize: 30, letterSpacing: '-1px', color: 'var(--espresso)', marginBottom: 6 }}>Complete your account</h2>
          <p style={{ fontFamily: 'Fraunces, serif', fontWeight: 300, fontSize: 15, color: 'rgba(22,15,8,0.45)', marginBottom: 36 }}>
            You're joining <strong style={{ color: 'var(--espresso)' }}>{tenantName}</strong>
          </p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

            <div>
              <label style={labelStyle}>Your name</label>
              <input type="text" value={f.fullName}
                onChange={e => setF(p => ({ ...p, fullName: e.target.value }))}
                placeholder="Jane Smith" style={inputStyle}
                onFocus={e => e.target.style.borderBottomColor = 'var(--coral)'}
                onBlur={e => e.target.style.borderBottomColor = 'rgba(22,15,8,0.12)'} />
            </div>

            {/* Organisation — pre-filled, non-editable (req #16) */}
            <div>
              <label style={labelStyle}>Organisation</label>
              <div style={{ position: 'relative' }}>
                <input type="text" value={tenantName} disabled style={disabledStyle} />
                <span style={{ position: 'absolute', right: 0, bottom: 14, fontFamily: 'Syne, sans-serif', fontSize: 8, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(22,15,8,0.25)', background: 'var(--cream-deep)', padding: '3px 8px', borderRadius: 999 }}>
                  Pre-filled
                </span>
              </div>
            </div>

            <div>
              <label style={labelStyle}>Password</label>
              <input type="password" value={f.password}
                onChange={e => setF(p => ({ ...p, password: e.target.value }))}
                placeholder="Min 6 characters" style={inputStyle}
                onFocus={e => e.target.style.borderBottomColor = 'var(--coral)'}
                onBlur={e => e.target.style.borderBottomColor = 'rgba(22,15,8,0.12)'} />
            </div>

            <div>
              <label style={labelStyle}>Confirm password</label>
              <input type="password" value={f.confirm}
                onChange={e => setF(p => ({ ...p, confirm: e.target.value }))}
                placeholder="Repeat password" style={inputStyle}
                onFocus={e => e.target.style.borderBottomColor = 'var(--coral)'}
                onBlur={e => e.target.style.borderBottomColor = 'rgba(22,15,8,0.12)'} />
            </div>

            {f.password && f.confirm && f.password !== f.confirm && (
              <p style={{ fontFamily: 'Syne, sans-serif', fontSize: 10, fontWeight: 700, color: 'var(--terracotta)', margin: '-14px 0 0', letterSpacing: '0.06em' }}>
                Passwords don't match
              </p>
            )}

            <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
              type="submit" disabled={busy}
              style={{ marginTop: 4, padding: '16px 28px', background: busy ? 'rgba(22,15,8,0.4)' : 'var(--espresso)', color: 'var(--cream)', border: 'none', borderRadius: 999, fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', cursor: busy ? 'not-allowed' : 'pointer', transition: 'background 0.25s ease' }}
              onMouseEnter={e => { if (!busy) e.currentTarget.style.background = 'var(--coral)'; }}
              onMouseLeave={e => { if (!busy) e.currentTarget.style.background = 'var(--espresso)'; }}>
              {busy ? 'Setting up…' : 'Complete setup →'}
            </motion.button>
          </form>
        </motion.div>
      </div>

      <style>{`@media (max-width: 900px) { div[style*="gridTemplateColumns: '1fr 480px'"] { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}
