import { chromium } from "playwright";
import { mkdir, writeFile, copyFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
const root = new URL("../", import.meta.url),
  film = process.argv.includes("--film");
const ffmpeg = process.env.FFMPEG_PATH;
if (film && !ffmpeg) throw Error("Set FFMPEG_PATH to generate the videos.");
for (const dir of ["public/brand/", "marketing/", "artifacts/film/"])
  await mkdir(new URL(dir, root), { recursive: true });
const browser = await chromium.launch(),
  page = await browser.newPage();
try {
  await page.goto("http://127.0.0.1:5249");
  await page.evaluate(async () => {
    await document.fonts.load("60px Silkscreen");
    await document.fonts.load('16px "IBM Plex Mono"');
  });
  async function render(kind, w, h, t = 6.5, scene = 0) {
    const raw = await page.evaluate(
      async ({ kind, w, h, t, scene }) => {
        const { C, drawMark, drawAgent, drawFilm } = await import(
            "/src/art.mjs"
          ),
          canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const c = canvas.getContext("2d");
        c.imageSmoothingEnabled = false;
        if (kind === "film") drawFilm(c, w, h, t, scene);
        else if (kind === "banner") {
          c.fillStyle = C.paper;
          c.fillRect(0, 0, w, h);
          drawMark(c, 550, 110, 7);
          c.fillStyle = C.ink;
          c.font = "80px Silkscreen";
          c.fillText("SIFT", 630, 140);
          c.textAlign = "center";
          c.font = '16px "IBM Plex Mono"';
          c.fillStyle = "#637c8e";
          c.fillText("Small agents. Clear signals.", 750, 186);
          for (let i = 0; i < 3; i++) {
            const x = 440 + i * 310;
            drawAgent(c, x, 407, 4.2, { kind: i });
            c.font = '13px "IBM Plex Mono"';
            c.fillStyle = "#3a5364";
            c.fillText(
              ["PIP / COLLECT", "DOT / INSPECT", "BIT / PUBLISH"][i],
              x,
              446,
            );
          }
          c.fillStyle = "#c4d1dc";
          c.fillRect(290, 411, 925, 2);
          c.textAlign = "left";
          c.font = '12px "IBM Plex Mono"';
          c.fillStyle = "#698195";
          c.fillText("PUBLIC SOURCES. TRACEABLE REPORTS.", 45, 470);
        } else {
          if (kind !== "transparent") {
            c.fillStyle = C.paper;
            c.fillRect(0, 0, w, h);
          }
          if (kind === "avatar")
            drawAgent(c, w / 2, h * 0.84, w / 60, { kind: 0 });
          else drawMark(c, w * 0.43, h * 0.5, w * 0.052);
        }
        return canvas.toDataURL("image/png").split(",")[1];
      },
      { kind, w, h, t, scene },
    );
    return Buffer.from(raw, "base64");
  }
  for (const [file, kind, w, h] of [
    ["sift-logo.png", "logo", 1024, 1024],
    ["sift-transparent.png", "transparent", 1024, 1024],
    ["sift-avatar.png", "avatar", 1024, 1024],
    ["sift-mark.png", "mark", 128, 128],
    ["sift-banner.png", "banner", 1500, 500],
  ]) {
    await writeFile(
      new URL(`public/brand/${file}`, root),
      await render(kind, w, h),
    );
    await copyFile(
      new URL(`public/brand/${file}`, root),
      new URL(`marketing/${file}`, root),
    );
  }
  for (let scene = 0; scene < 3; scene++) {
    await writeFile(
      new URL(`marketing/post-0${scene + 1}.png`, root),
      await render("film", 1600, 900, 6.5, scene),
    );
    if (!film) continue;
    const folder = new URL(`artifacts/film/${scene}/`, root);
    await mkdir(folder, { recursive: true });
    for (let f = 0; f < 240; f++)
      await writeFile(
        new URL(`${String(f).padStart(4, "0")}.png`, folder),
        await render("film", 1280, 720, f / 30, scene),
      );
    const output = fileURLToPath(
      new URL(`marketing/post-0${scene + 1}.mp4`, root),
    );
    await new Promise((resolve, reject) => {
      const p = spawn(
        ffmpeg,
        [
          "-y",
          "-framerate",
          "30",
          "-i",
          fileURLToPath(folder) + "%04d.png",
          "-c:v",
          "libx264",
          "-preset",
          "fast",
          "-crf",
          "18",
          "-pix_fmt",
          "yuv420p",
          "-movflags",
          "+faststart",
          "-t",
          "8",
          output,
        ],
        { windowsHide: true, stdio: "ignore" },
      );
      p.on("error", reject);
      p.on("exit", (code) =>
        code === 0 ? resolve() : reject(Error(`FFmpeg ${code}`)),
      );
    });
    console.log(`Post ${scene + 1}: 8 seconds / 1280x720 / 30fps`);
  }
  console.log("SIFT brand assets generated.");
} finally {
  await browser.close();
}
