export const C = {
  paper: "#f4f6f8",
  white: "#ffffff",
  ink: "#20262c",
  line: "#cbd8dc",
  blue: "#3265e8",
  coral: "#e87169",
  yellow: "#f2ce59",
  muted: "#77858c",
};
const rect = (c, x, y, w, h, color) => {
  c.fillStyle = color;
  c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
};
export function drawMark(c, x, y, u = 4, color = C.ink, progress = 1) {
  const rows = [
    "0011111100",
    "0110000010",
    "1100000000",
    "0111111000",
    "0000001110",
    "0100000011",
    "0011111110",
  ];
  rows.forEach((row, j) =>
    [...row].forEach((v, i) => {
      if (v === "1" && (j * 10 + i) / 70 <= progress)
        rect(c, x + (i - 5) * u, y + (j - 3.5) * u, u, u, color);
    }),
  );
  rect(c, x + 6 * u, y - 3.5 * u, 2 * u, 2 * u, C.blue);
  rect(c, x + 6 * u, y - 0.5 * u, 2 * u, 2 * u, C.coral);
  rect(c, x + 6 * u, y + 2.5 * u, 2 * u, 2 * u, C.yellow);
}
export function drawAgent(
  c,
  x,
  y,
  u = 3,
  { kind = 0, time = 0, working = false } = {},
) {
  const color = [C.blue, C.coral, C.yellow][kind],
    shadow = ["#2148a7", "#b64e49", "#b08e26"][kind],
    blink = time % 6 > 5.82,
    arm = working ? Math.sin(time * 9) * 2 : 0;
  c.save();
  c.translate(Math.round(x), Math.round(y));
  const r = (a, b, w, h, col) => rect(c, a * u, b * u, w * u, h * u, col);
  r(-9, 0, 20, 1, "#d5dfe1");
  r(-6, -4, 5, 4, C.ink);
  r(3, -4, 5, 4, C.ink);
  r(-5, -8, 3, 5, shadow);
  r(4, -8, 3, 5, shadow);
  r(-9, -20, 19, 12, shadow);
  r(-7, -20, 17, 10, color);
  r(-4, -18, 10, 6, C.white);
  r(-2, -17, 2, 3, color);
  r(2, -17, 2, 3, color);
  r(-12, -19 + arm, 3, 8, color);
  r(10, -19 - arm, 3, 8, color);
  r(-12, -12 + arm, 4, 3, C.ink);
  r(10, -12 - arm, 4, 3, C.ink);
  r(-10, -33, 21, 13, shadow);
  r(-8, -34, 17, 14, color);
  r(-8, -32, 17, 8, C.ink);
  r(-5, -30, 3, blink ? 1 : 3, C.white);
  r(3, -30, 3, blink ? 1 : 3, C.white);
  r(-3, -24, 7, 1, shadow);
  if (kind === 0) {
    r(-7, -37, 15, 3, color);
    r(5, -35, 9, 2, shadow);
    r(-6, -39, 5, 2, "#7099f9");
  }
  if (kind === 1) {
    r(-1, -40, 2, 6, C.ink);
    r(-3, -42, 6, 3, color);
    r(-12, -30, 3, 7, C.coral);
  }
  if (kind === 2) {
    r(-7, -41, 14, 7, C.white);
    r(-5, -39, 10, 1, C.line);
    r(-5, -37, 7, 1, C.line);
    r(10, -30, 3, 6, shadow);
  }
  c.restore();
}
function document(c, x, y, u = 2, accent = C.blue) {
  rect(c, x, y, 15 * u, 19 * u, C.ink);
  rect(c, x + u, y + u, 13 * u, 17 * u, C.white);
  rect(c, x + 3 * u, y + 4 * u, 8 * u, 2 * u, accent);
  for (let i = 0; i < 3; i++)
    rect(c, x + 3 * u, y + (9 + i * 3) * u, (i === 2 ? 5 : 9) * u, u, C.line);
}
export function drawWorkbench(
  c,
  w,
  h,
  { time = 0, stage = null, selected = null, reduced = false } = {},
) {
  c.clearRect(0, 0, w, h);
  rect(c, 0, 0, w, h, C.paper);
  const mobile = w < 620,
    scale = mobile ? w / 680 : Math.min(w / 1120, h / 280),
    u = mobile
      ? Math.max(1, Math.floor(3 * scale))
      : Math.max(2, Math.floor(3 * scale)),
    ground = h * 0.74;
  for (let j = 0; j < 3; j++) {
    const x = (w * (j + 0.5)) / 3,
      active = stage === ["scout", "inspector", "scribe"][j],
      color = [C.blue, C.coral, C.yellow][j];
    const bx = x + 10 * scale,
      by = ground - 104 * scale;
    if (j === 0) {
      rect(c, bx, by, 95 * scale, 92 * scale, "#b5c6cf");
      rect(c, bx + 5 * scale, by + 5 * scale, 85 * scale, 80 * scale, C.white);
      rect(c, bx + 12 * scale, by + 14 * scale, 71 * scale, 40 * scale, C.ink);
      for (let k = 0; k < 4; k++)
        rect(
          c,
          bx + 20 * scale,
          by + (22 + k * 7) * scale,
          (k % 2 ? 31 : 46) * scale,
          2 * scale,
          "#7199f9",
        );
      rect(c, bx + 13 * scale, by + 67 * scale, 51 * scale, 8 * scale, C.blue);
      rect(
        c,
        bx + 73 * scale,
        by + 66 * scale,
        7 * scale,
        7 * scale,
        active ? C.yellow : C.line,
      );
      document(
        c,
        bx + 30 * scale,
        by - 23 * scale,
        Math.max(0.8, scale),
        C.blue,
      );
    }
    if (j === 1) {
      rect(
        c,
        bx - 5 * scale,
        ground - 38 * scale,
        108 * scale,
        8 * scale,
        C.ink,
      );
      rect(
        c,
        bx + 2 * scale,
        ground - 30 * scale,
        8 * scale,
        28 * scale,
        C.line,
      );
      rect(
        c,
        bx + 86 * scale,
        ground - 30 * scale,
        8 * scale,
        28 * scale,
        C.line,
      );
      document(c, bx + 19 * scale, ground - 73 * scale, 1.7 * scale, C.coral);
      rect(
        c,
        bx + 83 * scale,
        ground - 106 * scale,
        5 * scale,
        67 * scale,
        C.ink,
      );
      rect(
        c,
        bx + 42 * scale,
        ground - 108 * scale,
        47 * scale,
        5 * scale,
        C.ink,
      );
      rect(
        c,
        bx + 37 * scale,
        ground - 104 * scale,
        18 * scale,
        8 * scale,
        C.coral,
      );
      if (active)
        rect(
          c,
          bx + 37 * scale,
          ground - (80 + Math.sin(time * 5) * 9) * scale,
          33 * scale,
          3 * scale,
          C.coral,
        );
    }
    if (j === 2) {
      rect(c, bx, ground - 75 * scale, 96 * scale, 61 * scale, "#b5c6cf");
      rect(
        c,
        bx + 4 * scale,
        ground - 71 * scale,
        88 * scale,
        51 * scale,
        C.white,
      );
      rect(
        c,
        bx + 12 * scale,
        ground - 63 * scale,
        54 * scale,
        10 * scale,
        C.ink,
      );
      rect(
        c,
        bx + 76 * scale,
        ground - 62 * scale,
        8 * scale,
        8 * scale,
        C.yellow,
      );
      rect(
        c,
        bx + 10 * scale,
        ground - 27 * scale,
        72 * scale,
        8 * scale,
        C.ink,
      );
      document(
        c,
        bx + 30 * scale,
        ground - (active ? 65 + Math.sin(time * 4) * 9 : 62) * scale,
        2.1 * scale,
        C.yellow,
      );
      rect(
        c,
        bx + 6 * scale,
        ground - 10 * scale,
        86 * scale,
        8 * scale,
        C.ink,
      );
    }
    drawAgent(c, x - 44 * scale, ground, u, {
      kind: j,
      time: reduced ? 0 : time + j,
      working: active && !reduced,
    });
    if (selected === j) {
      rect(
        c,
        x - 94 * scale,
        ground + 10 * scale,
        13 * scale,
        3 * scale,
        color,
      );
      rect(
        c,
        x + 97 * scale,
        ground + 10 * scale,
        13 * scale,
        3 * scale,
        color,
      );
    }
  }
  rect(c, 0, ground + 18 * scale, w, 2, C.ink);
  rect(c, 0, ground + 34 * scale, w, 1, C.line);
  const step = Math.max(17, 28 * scale),
    offset = stage && !reduced ? (time * 30) % step : 0;
  for (let x = -step; x < w; x += step)
    rect(c, x + offset, ground + 21 * scale, 7 * scale, 10 * scale, "#c7d3d7");
  for (let j = 0; j < 2; j++) {
    const x = (w * (j + 1)) / 3;
    rect(c, x - 2 * scale, ground - 8 * scale, 8 * scale, 4 * scale, C.line);
    rect(c, x + 2 * scale, ground - 12 * scale, 4 * scale, 12 * scale, C.line);
  }
}
export function drawIntro(c, w, h, t) {
  rect(c, 0, 0, w, h, C.paper);
  const unit = Math.min(11, Math.max(5, w / 95)),
    progress = Math.min(1, t / 1.6),
    scan = w * Math.min(1, t / 2.1);
  drawMark(c, w / 2 - 12, h * 0.44, unit, C.ink, progress);
  for (let i = 0; i < 3; i++)
    drawAgent(
      c,
      w / 2 + (i - 1) * Math.min(130, w * 0.27),
      h * 0.72,
      Math.min(3, Math.max(1.4, w / 360)),
      { kind: i, time: t, working: t < 1.8 },
    );
  rect(c, scan, h * 0.22, 3, h * 0.39, C.blue);
  if (t > 2.1) {
    c.save();
    c.globalCompositeOperation = "destination-out";
    const p = Math.min(1, (t - 2.1) / 0.85);
    for (let y = 0; y < h; y += 20)
      for (let x = 0; x < w; x += 20) {
        if ((x / w + y / h) / 2 < p) rect(c, x, y, 21, 21, "#000");
      }
    c.restore();
  }
}
export function drawFilm(c, w, h, t, scene = 0) {
  rect(c, 0, 0, w, h, C.paper);
  const scale = w / 1280;
  c.save();
  c.scale(scale, scale);
  const H = h / scale;
  drawMark(c, 81, 65, 4);
  c.fillStyle = C.ink;
  c.font = "24px Silkscreen";
  c.fillText("SIFT", 123, 75);
  c.font = '12px "IBM Plex Mono"';
  c.fillText("SMALL AGENTS. CLEAR SIGNALS.", 820, 72);
  const phase = Math.min(2, Math.floor(t / 2.5)),
    titles = [
      ["MEET THE TEAM.", "GIVE THEM A SOURCE.", "GET A CLEAR PICTURE."],
      ["PIP COLLECTS.", "DOT INSPECTS.", "BIT PUBLISHES."],
      ["A SOURCE REVISION.", "A VISIBLE PROCESS.", "A REPORT YOU CAN CHECK."],
    ];
  c.fillStyle = C.ink;
  c.font = "40px Silkscreen";
  c.textAlign = "center";
  c.fillText(titles[scene][phase], 640, 175);
  c.textAlign = "left";
  c.save();
  c.translate(60, 208);
  drawWorkbench(c, 1160, 310, {
    time: t,
    stage: ["scout", "inspector", "scribe"][phase],
    selected: phase,
  });
  c.restore();
  c.fillStyle = "#526770";
  c.font = '18px "IBM Plex Mono"';
  c.textAlign = "center";
  c.fillText(
    scene === 0
      ? "Repository observation agents, working in public."
      : scene === 1
        ? "Collect. Inspect. Publish. Every step leaves a record."
        : "Commit links. Changed files. Downloadable reports.",
    640,
    580,
  );
  c.textAlign = "left";
  rect(c, 60, H - 77, 1160, 1, C.line);
  c.fillStyle = "#607680";
  c.font = '12px "IBM Plex Mono"';
  c.fillText("ILLUSTRATED WORKFLOW / RULE-BASED ANALYSIS", 60, H - 41);
  drawMark(c, 1180, H - 43, 3);
  c.restore();
}
