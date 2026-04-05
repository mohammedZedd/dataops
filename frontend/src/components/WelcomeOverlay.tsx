import { useEffect } from 'react';
import confetti from 'canvas-confetti';

export function WelcomeOverlay() {
  useEffect(() => {
    const flag = sessionStorage.getItem('just_logged_in');
    if (!flag) return;
    sessionStorage.removeItem('just_logged_in');

    const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

    setTimeout(() => confetti({ particleCount: 60, spread: 55, origin: { x: 0.2, y: 0 }, colors, ticks: 150, gravity: 1.2, scalar: 0.9, angle: 270 }), 0);
    setTimeout(() => confetti({ particleCount: 60, spread: 55, origin: { x: 0.8, y: 0 }, colors, ticks: 150, gravity: 1.2, scalar: 0.9, angle: 270 }), 150);
    setTimeout(() => confetti({ particleCount: 100, spread: 90, origin: { x: 0.5, y: 0 }, colors, ticks: 200, gravity: 1.1, scalar: 0.85, angle: 270 }), 250);
  }, []);

  return null;
}
