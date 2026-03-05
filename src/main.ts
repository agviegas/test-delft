const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;

// --- Types ---
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  opacity: number;
}

// --- Config ---
const CONFIG = {
  count: 120,
  maxDistance: 140,
  speed: 0.4,
  mouseRadius: 180,
  particleColor: "26, 108, 255",
};

// --- State ---
let particles: Particle[] = [];
let mouse = { x: -9999, y: -9999 };
let width = 0;
let height = 0;

// --- Init ---
function resize(): void {
  width = canvas.width = window.innerWidth;
  height = canvas.height = window.innerHeight;
}

function createParticle(): Particle {
  return {
    x: Math.random() * width,
    y: Math.random() * height,
    vx: (Math.random() - 0.5) * CONFIG.speed,
    vy: (Math.random() - 0.5) * CONFIG.speed,
    radius: Math.random() * 1.5 + 0.5,
    opacity: Math.random() * 0.5 + 0.2,
  };
}

function init(): void {
  resize();
  particles = Array.from({ length: CONFIG.count }, createParticle);
}

// --- Distance ---
function dist(a: Particle, b: Particle): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function distToMouse(p: Particle): number {
  return Math.hypot(p.x - mouse.x, p.y - mouse.y);
}

// --- Update ---
function update(): void {
  for (const p of particles) {
    // Mouse repulsion
    const d = distToMouse(p);
    if (d < CONFIG.mouseRadius) {
      const force = (CONFIG.mouseRadius - d) / CONFIG.mouseRadius;
      const angle = Math.atan2(p.y - mouse.y, p.x - mouse.x);
      p.vx += Math.cos(angle) * force * 0.6;
      p.vy += Math.sin(angle) * force * 0.6;
    }

    // Damping
    p.vx *= 0.96;
    p.vy *= 0.96;

    p.x += p.vx;
    p.y += p.vy;

    // Wrap edges
    if (p.x < 0) p.x = width;
    if (p.x > width) p.x = 0;
    if (p.y < 0) p.y = height;
    if (p.y > height) p.y = 0;
  }
}

// --- Draw ---
function draw(): void {
  ctx.clearRect(0, 0, width, height);

  // Draw connections
  for (let i = 0; i < particles.length; i++) {
    for (let j = i + 1; j < particles.length; j++) {
      const d = dist(particles[i], particles[j]);
      if (d < CONFIG.maxDistance) {
        const alpha = (1 - d / CONFIG.maxDistance) * 0.25;
        ctx.beginPath();
        ctx.strokeStyle = `rgba(${CONFIG.particleColor}, ${alpha})`;
        ctx.lineWidth = 0.8;
        ctx.moveTo(particles[i].x, particles[i].y);
        ctx.lineTo(particles[j].x, particles[j].y);
        ctx.stroke();
      }
    }
  }

  // Draw particles
  for (const p of particles) {
    const d = distToMouse(p);
    const glow = d < CONFIG.mouseRadius
      ? 1 - d / CONFIG.mouseRadius
      : 0;

    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius + glow * 2, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${CONFIG.particleColor}, ${p.opacity + glow * 0.5})`;
    ctx.fill();
  }
}

// --- Loop ---
function loop(): void {
  update();
  draw();
  requestAnimationFrame(loop);
}

// --- Events ---
window.addEventListener("resize", () => {
  resize();
  particles = Array.from({ length: CONFIG.count }, createParticle);
});

window.addEventListener("mousemove", (e: MouseEvent) => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
});

window.addEventListener("mouseleave", () => {
  mouse.x = -9999;
  mouse.y = -9999;
});

// --- Start ---
init();
loop();