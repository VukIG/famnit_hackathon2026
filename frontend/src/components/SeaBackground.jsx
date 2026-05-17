import { useEffect, useRef } from "react";

const BUBBLES = Array.from({ length: 26 }, (_, i) => ({
  id: i,
  left: `${4 + Math.random() * 92}%`,
  size: `${3 + Math.random() * 9}px`,
  delay: `${-Math.random() * 18}s`,
  duration: `${14 + Math.random() * 16}s`,
  opacity: 0.12 + Math.random() * 0.28,
}));

function Caustics() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext("2d");
    let raf, w, h;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = c.clientWidth; h = c.clientHeight;
      c.width = w * dpr; c.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);
    const start = performance.now();
    const draw = () => {
      const t = (performance.now() - start) / 1000;
      ctx.clearRect(0, 0, w, h);
      const glow = ctx.createRadialGradient(w*0.5, -h*0.1, 10, w*0.5, -h*0.1, h*0.9);
      glow.addColorStop(0, "rgba(180,240,235,0.35)");
      glow.addColorStop(0.4, "rgba(95,243,214,0.05)");
      glow.addColorStop(1, "rgba(95,243,214,0)");
      ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < 22; i++) {
        const y0 = (i / 22) * h * 0.85;
        const phase = t * (0.55 + (i % 5) * 0.07) + i * 1.7;
        const amp = 8 + (i % 6) * 4;
        ctx.beginPath();
        for (let x = -20; x <= w + 20; x += 12) {
          const y = y0
            + Math.sin(x * 0.012 + phase) * amp
            + Math.sin(x * 0.031 + phase * 1.7) * amp * 0.45
            + Math.cos(x * 0.005 - phase * 0.6) * amp * 0.3;
          if (x === -20) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = `rgba(170,240,230,${(0.04 + 0.05 * Math.max(0, 1 - i / 22))})`;
        ctx.lineWidth = 1.1;
        ctx.stroke();
      }
      ctx.globalCompositeOperation = "source-over";
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);
  return (
    <canvas ref={canvasRef} className="absolute inset-x-0 top-0 w-full pointer-events-none"
      style={{ height: "85vh", maskImage: "linear-gradient(180deg,#000 0%,#000 55%,transparent 100%)", WebkitMaskImage: "linear-gradient(180deg,#000 0%,#000 55%,transparent 100%)" }} />
  );
}

function Plankton() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext("2d");
    let raf, w, h, particles = [];
    const seed = () => {
      const count = Math.min(320, Math.floor((w * h) / 12000));
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        r: 0.4 + Math.random() * 1.6,
        vy: -(0.05 + Math.random() * 0.22),
        vx: (Math.random() - 0.5) * 0.06,
        a: 0.15 + Math.random() * 0.5,
        blur: Math.random() > 0.72 ? 4 + Math.random() * 8 : 0,
        tw: Math.random() * Math.PI * 2,
      }));
    };
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = c.clientWidth; h = c.clientHeight;
      c.width = w * dpr; c.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    };
    resize();
    window.addEventListener("resize", resize);
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      const t = performance.now() / 1000;
      for (const p of particles) {
        p.y += p.vy; p.x += p.vx + Math.sin(t * 0.5 + p.tw) * 0.05;
        if (p.y < -4) { p.y = h + 4; p.x = Math.random() * w; }
        if (p.x < -4) p.x = w + 4;
        if (p.x > w + 4) p.x = -4;
        ctx.shadowColor = "rgba(95,243,214,0.45)";
        ctx.shadowBlur = p.blur;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(190,235,230,${p.a * (0.6 + 0.4 * Math.sin(t * 1.3 + p.tw))})`;
        ctx.fill();
      }
      ctx.shadowBlur = 0;
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={canvasRef} className="fixed inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }} />;
}

function Bubbles() {
  return (
    <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 2, overflow: "hidden" }}>
      {BUBBLES.map((bubble) => (
        <span
          key={bubble.id}
          style={{
            position: "absolute",
            left: bubble.left,
            bottom: "-24px",
            width: bubble.size,
            height: bubble.size,
            borderRadius: "50%",
            border: "1px solid rgba(190,245,240,0.36)",
            opacity: bubble.opacity,
            filter: "blur(0.2px)",
            animation: `bubbleRise ${bubble.duration} linear infinite`,
            animationDelay: bubble.delay,
          }}
        />
      ))}
    </div>
  );
}

function LightShafts() {
  return (
    <svg className="absolute top-0 left-0 w-full pointer-events-none"
      style={{ height: "100vh", zIndex: 1 }}
      viewBox="0 0 1440 1000" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="shaftA" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"  stopColor="#bff5ea" stopOpacity="0.35" />
          <stop offset="60%" stopColor="#5FF3D6" stopOpacity="0.06" />
          <stop offset="100%" stopColor="#5FF3D6" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g className="shaft" style={{ transformOrigin: "200px 0px" }}>
        <polygon points="180,0 320,0 540,1000 380,1000" fill="url(#shaftA)" />
      </g>
      <g className="shaft shaft-b" style={{ transformOrigin: "780px 0px" }}>
        <polygon points="780,0 870,0 1000,1000 880,1000" fill="url(#shaftA)" />
      </g>
      <g className="shaft shaft-c" style={{ transformOrigin: "1200px 0px" }}>
        <polygon points="1180,0 1300,0 1380,1000 1240,1000" fill="url(#shaftA)" />
      </g>
    </svg>
  );
}

export function SeaBackground() {
  return (
    <div className="fixed inset-0 seacolumn pointer-events-none" style={{ zIndex: 0 }}>
      <div className="absolute inset-0">
        <Caustics />
        <LightShafts />
      </div>
      <Plankton />
      <Bubbles />
      <div className="absolute inset-x-0 bottom-0" style={{
        height: "40vh",
        background: "linear-gradient(180deg, rgba(6,24,39,0) 0%, rgba(3,10,18,0.9) 100%)"
      }} />
    </div>
  );
}
