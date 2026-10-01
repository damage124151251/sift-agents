import React, { useEffect, useRef, useState, useId } from "react";
import { X, Copy, Check, ArrowUpRight, SkipForward } from "lucide-react";
import { drawIntro, drawMark } from "./art.mjs";
export function useReducedMotion() {
  const [value, set] = useState(
    () => matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const m = matchMedia("(prefers-reduced-motion: reduce)"),
      f = () => set(m.matches);
    m.addEventListener("change", f);
    return () => m.removeEventListener("change", f);
  }, []);
  return value;
}
export function Canvas({ draw, label, className = "", animate = false }) {
  const ref = useRef(),
    fn = useRef(draw),
    red = useReducedMotion();
  fn.current = draw;
  useEffect(() => {
    const el = ref.current,
      c = el.getContext("2d");
    let frame = 0,
      w = 1,
      h = 1,
      stop = false;
    const paint = (t) => {
      if (stop) return;
      const dpr = Math.min(devicePixelRatio || 1, 2);
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.imageSmoothingEnabled = false;
      fn.current(c, w, h, red ? 0 : t / 1000);
      if (animate && !red && !document.hidden)
        frame = requestAnimationFrame(paint);
    };
    const resize = () => {
      const r = el.getBoundingClientRect();
      w = r.width;
      h = r.height;
      const dpr = Math.min(devicePixelRatio || 1, 2);
      el.width = Math.max(1, Math.round(w * dpr));
      el.height = Math.max(1, Math.round(h * dpr));
      cancelAnimationFrame(frame);
      paint(performance.now());
    };
    const visible = () => {
      cancelAnimationFrame(frame);
      if (!document.hidden) paint(performance.now());
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    document.addEventListener("visibilitychange", visible);
    resize();
    return () => {
      stop = true;
      ro.disconnect();
      document.removeEventListener("visibilitychange", visible);
      cancelAnimationFrame(frame);
    };
  }, [animate, red, draw]);
  return (
    <canvas ref={ref} className={className} role="img" aria-label={label} />
  );
}
export function Mark() {
  return (
    <Canvas
      label="SIFT mark"
      className="mark"
      draw={(c, w, h) => {
        c.clearRect(0, 0, w, h);
        drawMark(c, w * 0.42, h / 2, Math.min(w / 15, h / 9));
      }}
    />
  );
}
export function IconButton({ title, children, ...props }) {
  return (
    <button
      type="button"
      className="icon-button"
      aria-label={title}
      title={title}
      {...props}
    >
      {children}
    </button>
  );
}
export function CopyButton({ value }) {
  const [copied, set] = useState(false);
  return (
    <IconButton
      title={copied ? "Copied" : "Copy address"}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          set(true);
          setTimeout(() => set(false), 1500);
        } catch {
          set(false);
        }
      }}
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
    </IconButton>
  );
}
export function External({ href, children, className = "" }) {
  return (
    <a
      className={`external ${className}`}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
      <ArrowUpRight size={13} />
    </a>
  );
}
export function Modal({ title, onClose, children, wide = false }) {
  const ref = useRef(),
    fn = useRef(onClose),
    titleId = useId();
  fn.current = onClose;
  useEffect(() => {
    const prior = document.activeElement,
      d = ref.current;
    d.showModal();
    const cancel = (e) => {
      e.preventDefault();
      fn.current();
    };
    d.addEventListener("cancel", cancel);
    return () => {
      d.removeEventListener("cancel", cancel);
      d.close();
      prior?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className={wide ? "wide" : ""}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="dialog-head">
        <h2 id={titleId}>{title}</h2>
        <IconButton title="Close" onClick={onClose}>
          <X size={19} />
        </IconButton>
      </div>
      {children}
    </dialog>
  );
}
export function Intro({ onDone }) {
  const ref = useRef(),
    done = useRef(onDone),
    red = useReducedMotion();
  done.current = onDone;
  useEffect(() => {
    if (red) {
      done.current();
      return;
    }
    let frame,
      start = performance.now(),
      ended = false;
    const finish = () => {
      if (ended) return;
      ended = true;
      cancelAnimationFrame(frame);
      done.current();
    };
    const canvas = ref.current,
      c = canvas.getContext("2d");
    const paint = (t) => {
      if (ended) return;
      const dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.round(innerWidth * dpr);
      canvas.height = Math.round(innerHeight * dpr);
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawIntro(c, innerWidth, innerHeight, (t - start) / 1000);
      if (t - start > 3100) finish();
      else frame = requestAnimationFrame(paint);
    };
    const key = (e) => {
      if (e.key === "Escape") finish();
    };
    document.addEventListener("keydown", key);
    const timeout = setTimeout(finish, 4500);
    frame = requestAnimationFrame(paint);
    return () => {
      ended = true;
      cancelAnimationFrame(frame);
      clearTimeout(timeout);
      document.removeEventListener("keydown", key);
    };
  }, [red]);
  return (
    <div
      className="intro"
      role="dialog"
      aria-modal="true"
      aria-label="SIFT assembly"
    >
      <canvas ref={ref} />
      <div className="intro-logo">
        <Mark />
        SIFT
      </div>
      <button className="skip" onClick={onDone} autoFocus>
        Skip <SkipForward size={14} />
      </button>
      <span className="intro-caption">Small agents. Clear signals.</span>
    </div>
  );
}
