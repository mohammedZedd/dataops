import { useEffect } from 'react';
import confetti from 'canvas-confetti';

export function WelcomeOverlay() {
  useEffect(() => {
    const flag = sessionStorage.getItem('just_logged_in');
    if (!flag) return;
    sessionStorage.removeItem('just_logged_in');

    const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

    setTimeout(() => confetti({ particleCount: 80, spread: 60, origin: { x: 0.2, y: 0 }, colors, ticks: 350, gravity: 0.9, scalar: 0.95, angle: 270 }), 0);
    setTimeout(() => confetti({ particleCount: 80, spread: 60, origin: { x: 0.8, y: 0 }, colors, ticks: 350, gravity: 0.9, scalar: 0.95, angle: 270 }), 200);
    setTimeout(() => confetti({ particleCount: 120, spread: 100, origin: { x: 0.5, y: 0 }, colors, ticks: 400, gravity: 0.8, scalar: 0.9, angle: 270 }), 350);
    setTimeout(() => confetti({ particleCount: 60, spread: 50, origin: { x: 0.3, y: 0 }, colors, ticks: 300, gravity: 1.0, scalar: 0.85, angle: 270 }), 550);
    setTimeout(() => confetti({ particleCount: 60, spread: 50, origin: { x: 0.7, y: 0 }, colors, ticks: 300, gravity: 1.0, scalar: 0.85, angle: 270 }), 700);
  }, []);

  return null;
}
