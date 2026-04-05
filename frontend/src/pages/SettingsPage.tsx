import { useState } from 'react';
import { soundService } from '../utils/soundService';

export default function SettingsPage() {
  const [soundOn, setSoundOn] = useState(soundService.isEnabled());

  function toggleSound(v: boolean) {
    soundService.setEnabled(v);
    setSoundOn(v);
    if (v) setTimeout(() => soundService.playNotification(), 200);
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <div style={{ paddingBottom: 20, borderBottom: '1px solid #E5E7EB', marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827' }}>Paramètres</h1>
        <p style={{ fontSize: 14, color: '#6B7280', marginTop: 4 }}>Configurez vos préférences.</p>
      </div>

      {/* Notifications section */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 16, overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ padding: '14px 20px', background: '#F9FAFB', borderBottom: '1px solid #E5E7EB', fontWeight: 600, fontSize: 14, color: '#374151' }}>
          Préférences de notifications
        </div>

        {/* Sound toggle */}
        <div style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #F3F4F6' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: soundOn ? '#EFF6FF' : '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
              {soundOn ? '🔔' : '🔕'}
            </div>
            <div>
              <p style={{ fontWeight: 500, fontSize: 14, color: '#111827' }}>Sons de notifications</p>
              <p style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>Jouer un son lors des nouvelles notifications et messages</p>
            </div>
          </div>
          {/* Toggle switch */}
          <label style={{ position: 'relative', width: 44, height: 24, cursor: 'pointer', flexShrink: 0 }}>
            <input type="checkbox" checked={soundOn} onChange={e => toggleSound(e.target.checked)} style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }} />
            <div style={{ position: 'absolute', inset: 0, background: soundOn ? '#3B82F6' : '#D1D5DB', borderRadius: 12, transition: 'background 0.2s' }} />
            <div style={{ position: 'absolute', top: 2, left: soundOn ? 22 : 2, width: 20, height: 20, background: '#fff', borderRadius: '50%', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s' }} />
          </label>
        </div>

        {/* Test sounds */}
        <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: '#F5F3FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🎵</div>
            <div>
              <p style={{ fontWeight: 500, fontSize: 14, color: '#111827' }}>Tester les sons</p>
              <p style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>Prévisualiser les sons de l'application</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { label: '🔔 Notif', fn: () => soundService.playNotification() },
              { label: '💬 Message', fn: () => soundService.playMessageReceived() },
              { label: '✅ Succès', fn: () => soundService.playSuccess() },
            ].map(b => (
              <button key={b.label} onClick={b.fn} disabled={!soundOn}
                style={{ padding: '6px 12px', background: soundOn ? '#fff' : '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 8, cursor: soundOn ? 'pointer' : 'not-allowed', fontSize: 12, color: soundOn ? '#374151' : '#9CA3AF' }}>
                {b.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
