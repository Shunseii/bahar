import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
}

const PARTICLE_COUNT_DESKTOP = 60;
const PARTICLE_COUNT_MOBILE = 30;
const CONNECTION_DISTANCE = 150;
const PARTICLE_SPEED = 0.3;

function createParticle(width: number, height: number): Particle {
  return {
    x: Math.random() * width,
    y: Math.random() * height,
    vx: (Math.random() - 0.5) * PARTICLE_SPEED,
    vy: (Math.random() - 0.5) * PARTICLE_SPEED,
    size: Math.random() * 2 + 1,
  };
}

export default function AnimatedBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationRef = useRef<number>(0);
  const [isDark, setIsDark] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    // Check for reduced motion preference
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mediaQuery.matches);

    const handleMotionChange = (e: MediaQueryListEvent) => {
      setReducedMotion(e.matches);
    };
    mediaQuery.addEventListener("change", handleMotionChange);

    // Check for dark mode
    const checkDarkMode = () => {
      setIsDark(document.documentElement.classList.contains("dark"));
    };
    checkDarkMode();

    // Watch for dark mode changes
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      mediaQuery.removeEventListener("change", handleMotionChange);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    const initParticles = (width: number, height: number, count: number) => {
      // Clear and reinitialize all particles with proper positions
      particlesRef.current = [];
      for (let i = 0; i < count; i++) {
        particlesRef.current.push(createParticle(width, height));
      }
    };

    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      const width = window.innerWidth;
      const height = window.innerHeight;

      // Reset canvas dimensions (this also clears the canvas and resets transforms)
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      // Reset transform and apply fresh scale
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);

      // Adjust particle count based on screen size
      const isMobile = width < 768;
      const targetCount = isMobile
        ? PARTICLE_COUNT_MOBILE
        : PARTICLE_COUNT_DESKTOP;

      // Reinitialize particles if count changed or first init
      if (particlesRef.current.length !== targetCount) {
        initParticles(width, height, targetCount);
      }
    };

    // Small delay to ensure proper dimensions on mobile
    const initTimeout = setTimeout(() => {
      resizeCanvas();
    }, 50);

    window.addEventListener("resize", resizeCanvas);

    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Particle animation requires nested loops and conditionals
    const animate = () => {
      if (!(ctx && canvas)) {
        return;
      }

      const width = window.innerWidth;
      const height = window.innerHeight;

      ctx.clearRect(0, 0, width, height);

      // Colors based on theme
      const particleColor = isDark
        ? "rgba(147, 197, 253, 0.6)" // blue-300 with opacity
        : "rgba(59, 130, 246, 0.4)"; // blue-500 with opacity
      const lineColor = isDark
        ? "rgba(147, 197, 253, 0.15)"
        : "rgba(59, 130, 246, 0.1)";

      const particles = particlesRef.current;

      // Update particle positions (skip if reduced motion)
      if (!reducedMotion) {
        for (const particle of particles) {
          particle.x += particle.vx;
          particle.y += particle.vy;

          // Bounce off edges
          if (particle.x < 0 || particle.x > width) {
            particle.vx *= -1;
            particle.x = Math.max(0, Math.min(width, particle.x));
          }
          if (particle.y < 0 || particle.y > height) {
            particle.vy *= -1;
            particle.y = Math.max(0, Math.min(height, particle.y));
          }
        }
      }

      // Draw connections
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 1;

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < CONNECTION_DISTANCE) {
            const opacity = 1 - distance / CONNECTION_DISTANCE;
            ctx.globalAlpha = opacity;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }

      // Draw particles
      ctx.globalAlpha = 1;
      ctx.fillStyle = particleColor;

      for (const particle of particles) {
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      clearTimeout(initTimeout);
      window.removeEventListener("resize", resizeCanvas);
      cancelAnimationFrame(animationRef.current);
    };
  }, [isDark, reducedMotion]);

  return (
    <motion.div
      animate={{ opacity: 1 }}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10"
      initial={{ opacity: 0 }}
      transition={{ duration: 1 }}
    >
      <canvas
        className="absolute inset-0"
        ref={canvasRef}
        style={{ width: "100%", height: "100%" }}
      />
      {/* Subtle gradient overlay for depth */}
      <div
        className="absolute inset-0 opacity-30 dark:opacity-20"
        style={{
          background: `
            radial-gradient(ellipse at 30% 20%, oklch(60% 0.1 260 / 0.15) 0%, transparent 50%),
            radial-gradient(ellipse at 70% 80%, oklch(55% 0.08 200 / 0.1) 0%, transparent 50%)
          `,
        }}
      />
    </motion.div>
  );
}
