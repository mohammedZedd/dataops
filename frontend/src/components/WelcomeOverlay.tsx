import { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { useAuth } from '../context/AuthContext';

export function WelcomeOverlay() {
  const { user } = useAuth();
  const [show, setShow] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const flag = sessionStorage.getItem('just_logged_in');
    if (!flag) return;
    sessionStorage.removeItem('just_logged_in');

    setShow(true);
    setTimeout(() => setVisible(true), 50);

    // Confetti
    setTimeout(() => {
      const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];
      confetti({ particleCount: 80, spread: 70, origin: { x: 0.15, y: 0.5 }, colors, ticks: 250 });
      setTimeout(() => confetti({ particleCount: 80, spread: 70, origin: { x: 0.85, y: 0.5 }, colors, ticks: 250 }), 150);
      setTimeout(() => confetti({ particleCount: 120, spread: 120, origin: { x: 0.5, y: 0.2 }, colors, ticks: 350 }), 300);
    }, 400);

    setTimeout(() => dismiss(), 6000);
  }, []);

  function dismiss() {
    setVisible(false);
    setTimeout(() => setShow(false), 400);
  }

  if (!show) return null;

  const firstName = user?.first_name ?? user?.email?.split('@')[0] ?? '';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';

  return (
    <>
      <style>{`
        @keyframes woBounce { 0%{transform:scale(0) rotate(-10deg)} 60%{transform:scale(1.2) rotate(5deg)} 80%{transform:scale(.95) rotate(-2deg)} 100%{transform:scale(1) rotate(0)} }
        @keyframes woWave { 0%{transform:rotate(0)} 15%{transform:rotate(14deg)} 30%{transform:rotate(-8deg)} 45%{transform:rotate(14deg)} 60%{transform:rotate(-4deg)} 75%{transform:rotate(10deg)} 100%{transform:rotate(0)} }
        @keyframes woShrink { from{width:100%} to{width:0%} }
      `}</style>

      {/* Backdrop */}
      <div onClick={dismiss} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 9998,
        opacity: visible ? 1 : 0, transition: 'opacity 0.4s ease', backdropFilter: 'blur(2px)',
      }} />

      {/* Card */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: visible ? 'translate(-50%,-50%) scale(1)' : 'translate(-50%,-50%) scale(0.85)',
        opacity: visible ? 1 : 0, transition: 'all 0.4s cubic-bezier(0.34,1.56,0.64,1)',
        zIndex: 9999, width: '90%', maxWidth: 460,
      }}>
        <div style={{
          background: '#fff', borderRadius: 24, padding: '40px 36px', boxShadow: '0 32px 80px rgba(0,0,0,0.2)',
          textAlign: 'center', position: 'relative', overflow: 'hidden',
        }}>
          {/* Decorative */}
          <div style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: '50%', background: 'rgba(59,130,246,0.06)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: -50, left: -30, width: 140, height: 140, borderRadius: '50%', background: 'rgba(139,92,246,0.06)', pointerEvents: 'none' }} />

          {/* Close */}
          <button onClick={dismiss} style={{ position: 'absolute', top: 16, right: 16, width: 28, height: 28, borderRadius: '50%', background: '#F3F4F6', border: 'none', cursor: 'pointer', fontSize: 12, color: '#6B7280', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>

          {/* Emoji */}
          <div style={{ fontSize: 64, marginBottom: 16, display: 'inline-block', animation: 'woBounce 0.6s ease-out, woWave 1s ease-in-out 0.6s 2' }}>👋</div>

          {/* Title */}
          <h1 style={{ margin: '0 0 8px', fontSize: 26, fontWeight: 800, background: 'linear-gradient(135deg, #2563EB, #7C3AED)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 1.2 }}>
            {greeting}, {firstName} !
          </h1>

          {/* Subtitle */}
          <p style={{ margin: '0 0 24px', fontSize: 15, color: '#6B7280', lineHeight: 1.6 }}>
            Content de vous revoir sur ComptaFlow.
          </p>

          {/* CTA */}
          <button onClick={dismiss} style={{
            width: '100%', padding: 14, background: 'linear-gradient(135deg, #2563EB, #7C3AED)',
            color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: 'pointer',
          }}>
            Accéder à mon espace →
          </button>

          {/* Progress */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, height: 3, background: 'linear-gradient(90deg, #2563EB, #7C3AED)', borderRadius: '0 0 24px 24px', animation: 'woShrink 6s linear forwards' }} />
        </div>
      </div>
    </>
  );
}
