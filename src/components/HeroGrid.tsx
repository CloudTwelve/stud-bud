"use client";

import { useEffect, useRef } from "react";
import { useLiteMode } from "@/lib/motion";

const CELL = 34;
const POINTER_RADIUS = 170;
const RIPPLE_SPEED = 0.42; // px per ms
const RIPPLE_WIDTH = 90;
const RIPPLE_LIFE = 1600; // ms

interface Ripple {
  x: number;
  y: number;
  born: number;
}

const TEAL_HUE = 174;
const ORANGE_HUE = 24;

/**
 * Canvas grid that behaves like a room full of sensors: cells breathe on their
 * own, brighten near the pointer, and a click sends a sweep outwards the way
 * the robot dog's patrol lights up rooms one after another. Cells are squares
 * on a ruled grid — a floor plan, not a starfield — and warm from teal to
 * orange as they pick up energy.
 */
export default function HeroGrid() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lite = useLiteMode();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Low-WiFi mode draws the grid once and stops: same picture, no frames.
    const reduced =
      lite || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const pointer = { x: -9999, y: -9999, active: false };
    const ripples: Ripple[] = [];
    let width = 0;
    let height = 0;
    let frame = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = (time: number) => {
      const dark = document.documentElement.classList.contains("dark");
      ctx.clearRect(0, 0, width, height);

      const cols = Math.ceil(width / CELL) + 1;
      const rows = Math.ceil(height / CELL) + 1;

      // Ruled lines every fourth cell: the grid the squares are pinned to.
      ctx.strokeStyle = dark ? "rgba(94,234,212,0.07)" : "rgba(13,148,136,0.08)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let col = 0; col < cols; col += 4) {
        ctx.moveTo(col * CELL + 0.5, 0);
        ctx.lineTo(col * CELL + 0.5, height);
      }
      for (let row = 0; row < rows; row += 4) {
        ctx.moveTo(0, row * CELL + 0.5);
        ctx.lineTo(width, row * CELL + 0.5);
      }
      ctx.stroke();

      for (let i = 0; i < ripples.length; i += 1) {
        if (time - ripples[i].born > RIPPLE_LIFE) ripples.splice(i, 1);
      }

      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
          const x = col * CELL;
          const y = row * CELL;

          // Slow diagonal breathing so the grid is alive before you touch it.
          const wave = reduced
            ? 0.5
            : 0.5 + 0.5 * Math.sin((x + y) * 0.012 - time * 0.0011);
          let energy = wave * 0.34;

          if (pointer.active) {
            const dist = Math.hypot(x - pointer.x, y - pointer.y);
            if (dist < POINTER_RADIUS) {
              energy += (1 - dist / POINTER_RADIUS) ** 2;
            }
          }

          for (const ripple of ripples) {
            const dist = Math.hypot(x - ripple.x, y - ripple.y);
            const front = (time - ripple.born) * RIPPLE_SPEED;
            const offset = Math.abs(dist - front);
            if (offset < RIPPLE_WIDTH) {
              const fade = 1 - (time - ripple.born) / RIPPLE_LIFE;
              energy += (1 - offset / RIPPLE_WIDTH) * fade * 1.2;
            }
          }

          energy = Math.min(energy, 1.35);

          // Resting cells are teal; energy pulls them towards the orange accent.
          const warmth = Math.min(1, energy / 1.1);
          const hue = TEAL_HUE + (ORANGE_HUE - TEAL_HUE) * warmth;
          const size = 2 + energy * 5;
          const alpha = dark ? 0.18 + energy * 0.7 : 0.22 + energy * 0.62;

          ctx.fillStyle = `hsla(${hue}, ${dark ? 80 : 72}%, ${
            dark ? 55 + energy * 15 : 46 - energy * 4
          }%, ${alpha})`;
          ctx.fillRect(x - size / 2, y - size / 2, size, size);
        }
      }

      if (!lite) frame = window.requestAnimationFrame(draw);
    };

    // Listen on the window: the hero's text and buttons sit on top of the
    // canvas, so canvas-only listeners would go quiet over most of the hero.
    const inside = (x: number, y: number) =>
      x >= 0 && y >= 0 && x <= width && y <= height;

    const onPointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      pointer.x = x;
      pointer.y = y;
      pointer.active = inside(x, y);
    };
    const onPointerDown = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      if (!inside(x, y)) return;
      ripples.push({ x, y, born: performance.now() });
      if (ripples.length > 6) ripples.shift();
    };

    // requestAnimationFrame keeps firing for a canvas scrolled out of view, so
    // the loop only runs while the hero is actually on screen.
    const observer = new IntersectionObserver(([entry]) => {
      if (lite) {
        if (entry.isIntersecting) draw(performance.now());
      } else if (entry.isIntersecting) {
        if (!frame) frame = window.requestAnimationFrame(draw);
      } else if (frame) {
        window.cancelAnimationFrame(frame);
        frame = 0;
      }
    });

    const onResize = () => {
      resize();
      if (lite) draw(performance.now());
    };

    // With no animation loop, a theme switch would leave last theme's colours
    // painted on the canvas until something else forced a redraw.
    const themeWatcher = lite
      ? new MutationObserver(() => draw(performance.now()))
      : null;
    themeWatcher?.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    resize();
    observer.observe(canvas);
    window.addEventListener("resize", onResize);
    if (!lite) {
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerdown", onPointerDown);
    }

    return () => {
      observer.disconnect();
      themeWatcher?.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [lite]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="absolute inset-0 h-full w-full touch-pan-y"
    />
  );
}
