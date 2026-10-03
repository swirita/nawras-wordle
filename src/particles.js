export function startParticles(canvas) {
  const context = canvas.getContext('2d');
  if (!context) return;
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const particles = Array.from({ length: 16 }, () => ({
    x: Math.random(), y: Math.random(), radius: 1.3 + Math.random() * 1.5,
    speed: 0.004 + Math.random() * 0.008, phase: Math.random() * Math.PI * 2,
  }));
  let width = 0;
  let height = 0;
  let frame = null;
  let lastTime = null;
  let elapsed = 0;

  function paint() {
    context.clearRect(0, 0, width, height);
    context.fillStyle = 'rgba(28, 187, 215, 0.35)';
    for (const particle of particles) {
      const x = particle.x * width + Math.sin(elapsed * 0.25 + particle.phase) * 10;
      const y = ((particle.y - elapsed * particle.speed) % 1 + 1) % 1 * height;
      // Keep the central text and form clear of floating dots.
      if (Math.abs(x - width / 2) < Math.min(225, width * 0.4) && Math.abs(y - height / 2) < 270) continue;
      context.beginPath();
      context.arc(x, y, particle.radius, 0, Math.PI * 2);
      context.fill();
    }
  }

  function tick(time) {
    if (lastTime !== null) elapsed += Math.min((time - lastTime) / 1000, 0.05);
    lastTime = time;
    paint();
    frame = requestAnimationFrame(tick);
  }

  function syncAnimation() {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    lastTime = null;
    paint();
    if (!document.hidden && !motion.matches) frame = requestAnimationFrame(tick);
  }

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    paint();
  }

  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', syncAnimation);
  motion.addEventListener('change', syncAnimation);
  resize();
  syncAnimation();
}
