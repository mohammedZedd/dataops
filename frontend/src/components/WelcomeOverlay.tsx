import { useEffect } from 'react';
import confetti from 'canvas-confetti';

export function WelcomeOverlay() {
  useEffect(() => {
    const flag = sessionStorage.getItem('just_logged_in');
    if (!flag) return;
    sessionStorage.removeItem('just_logged_in');

    const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

    setTimeout(() => confetti({ particleCount: 80, spread: 70, origin: { x: 0.1, y: 0.6 }, colors, ticks: 300, gravity: 0.8, scalar: 1.1 }), 100);
    setTimeout(() => confetti({ particleCount: 80, spread: 70, origin: { x: 0.9, y: 0.6 }, colors, ticks: 300, gravity: 0.8, scalar: 1.1 }), 250);
    setTimeout(() => confetti({ particleCount: 150, spread: 120, origin: { x: 0.5, y: 0.3 }, colors, ticks: 400, gravity: 0.5, scalar: 0.9 }), 400);
    setTimeout(() => { confetti({ particleCount: 60, spread: 55, origin: { x: 0.2, y: 0.9 }, colors, ticks: 250, gravity: 0.6, angle: 60 }); confetti({ particleCount: 60, spread: 55, origin: { x: 0.8, y: 0.9 }, colors, ticks: 250, gravity: 0.6, angle: 120 }); }, 550);
    setTimeout(() => confetti({ particleCount: 40, spread: 80, origin: { x: 0.5, y: 0 }, colors, ticks: 500, gravity: 1, scalar: 0.8 }), 800);
  }, []);

  return null;
}
