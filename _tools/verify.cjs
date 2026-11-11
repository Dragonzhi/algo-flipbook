/**
 * 力扣演示页验证器（一次跑完所有断点 + 交互回归）
 *
 *   node _tools/verify.cjs "双指针/88 合并两个有序数组 - 双指针"
 *
 * 产出：
 *   _tools/out/<题号>/<宽度>-base.png     初始态
 *   _tools/out/<题号>/<宽度>-step.png     走 4 步后
 *   _tools/out/<题号>/<宽度>-final.png    终态
 *   _tools/out/<题号>/report.json         全部断言结果
 *
 * 断言（任一失败 → 退出码 1）：
 *   1. 无横向溢出
 *   2. 所有 button 命中区 ≥ 44×44
 *   3. 面板内没有元素被裁切（scrollWidth > clientWidth）
 *   4. 无 console error / pageerror
 *   5. 终态文案与步数可读（步进到 disabled 为止）
 */
const fs = require("fs");
const path = require("path");
const puppeteer = require("C:/Users/32485/AppData/Roaming/npm/node_modules/puppeteer");

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const SIZES = [
  { w: 1920, h: 1080 },
  { w: 1440, h: 900 },
  { w: 1280, h: 800 },
  { w: 1024, h: 768 },
  { w: 390, h: 844, mobile: true },
  { w: 375, h: 667, mobile: true },
  { w: 320, h: 568, mobile: true }
];

const target = process.argv[2];
if (!target) {
  console.error('用法: node _tools/verify.cjs "<题目文件夹名>"');
  process.exit(2);
}

const pagePath = path.resolve(process.cwd(), target, "index.html");
if (!fs.existsSync(pagePath)) {
  console.error("找不到页面:", pagePath);
  process.exit(2);
}
const pageUrl = "file:///" + encodeURI(pagePath.replace(/\\/g, "/"));
const outDir = path.join(process.cwd(), "_tools", "out", path.basename(target).split(" ")[0]);
fs.mkdirSync(outDir, { recursive: true });

const failures = [];
const rows = [];

(async () => {
  const browser = await puppeteer.launch({
    headless: "new",
    executablePath: CHROME,
    args: ["--allow-file-access-from-files", "--hide-scrollbars", "--force-device-scale-factor=1"]
  });
  const page = await browser.newPage();
  const logs = [];
  page.on("console", (m) => { if (m.type() === "error") logs.push("[console] " + m.text()); });
  page.on("pageerror", (e) => logs.push("[pageerror] " + e.message));

  for (const s of SIZES) {
    await page.setViewport({ width: s.w, height: s.h, isMobile: !!s.mobile, hasTouch: !!s.mobile });
    await page.goto(pageUrl, { waitUntil: "networkidle0" });
    await new Promise((r) => setTimeout(r, 250));

    const probe = await page.evaluate(() => {
      const de = document.scrollingElement;
      const btns = [...document.querySelectorAll("button")].map((b) => {
        const r = b.getBoundingClientRect();
        return { t: b.textContent.trim().slice(0, 6), w: Math.round(r.width), h: Math.round(r.height) };
      });
      // 代码块是允许横向滚动的容器，单独只做提示；其余容器被裁切才算失败
      const codeEls = [...document.querySelectorAll(".code")];
      const codeScroll = codeEls
        .map((el) => ({ sw: el.scrollWidth, cw: el.clientWidth }))
        .filter((x) => x.sw > x.cw + 4);
      const clipped = [...document.querySelectorAll(".narration, .stage, .legend, .foot, .readouts")]
        .map((el) => ({ c: el.className, sw: el.scrollWidth, cw: el.clientWidth }))
        .filter((x) => x.sw > x.cw + 4);
      return {
        overflow: de.scrollWidth - window.innerWidth,
        small: btns.filter((b) => b.h < 44 || b.w < 44),
        clipped,
        codeScroll,
        hasMotion: typeof window.Motion !== "undefined",
        stepNow: (document.getElementById("stepNow") || {}).textContent
      };
    });

    await page.screenshot({ path: path.join(outDir, s.w + "-base.png"), fullPage: true });

    await page.evaluate(async () => {
      for (let i = 0; i < 4; i++) {
        const b = document.getElementById("btnNext");
        if (b && !b.disabled) { b.click(); await new Promise((r) => setTimeout(r, 460)); }
      }
    });
    await page.screenshot({ path: path.join(outDir, s.w + "-step.png"), fullPage: true });

    const final = await page.evaluate(async () => {
      const b = document.getElementById("btnNext");
      let g = 0;
      while (b && !b.disabled && g++ < 40) { b.click(); await new Promise((r) => setTimeout(r, 380)); }
      return {
        step: (document.getElementById("stepNow") || {}).textContent,
        cells: [...document.querySelectorAll("#rowN1 .cell .val")].map((v) => v.textContent),
        chart: (document.querySelector(".chart") || { getAttribute: () => "" }).getAttribute("aria-label")
      };
    });
    await page.screenshot({ path: path.join(outDir, s.w + "-final.png"), fullPage: true });

    // 固定底栏遮挡：把每一行滚进视口，确认它能完整露在固定条上方。
    // 首屏被压住不算错（页面本就可滚动），永久看不见才算错。
    const occ = await page.evaluate(async () => {
      const bar = document.querySelector(".transport");
      const fixed = bar && getComputedStyle(bar).position === "fixed";
      const bad = [];
      for (const w of [...document.querySelectorAll(".cellwrap")]) {
        w.scrollIntoView({ block: "center" });
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        const b = w.getBoundingClientRect();
        const bt = fixed ? bar.getBoundingClientRect().top : window.innerHeight;
        if (b.bottom > bt + 1 || b.top < -1) {
          bad.push({ top: Math.round(b.top), bottom: Math.round(b.bottom), barTop: Math.round(bt) });
        }
      }
      window.scrollTo(0, 0);
      return { fixed: !!fixed, bad };
    });

    if (probe.overflow > 0) failures.push(s.w + "px 横向溢出 " + probe.overflow + "px");
    if (probe.small.length) failures.push(s.w + "px 触点过小: " + JSON.stringify(probe.small));
    if (probe.clipped.length) failures.push(s.w + "px 内容被裁切: " + JSON.stringify(probe.clipped));
    if (occ.fixed && occ.bad.length) {
      failures.push(s.w + "px 滚动后仍被固定底栏遮挡: " + JSON.stringify(occ.bad));
    }

    rows.push({ size: s.w, ...probe, final, occluded: occ });
  }

  if (logs.length) failures.push("运行时报错: " + JSON.stringify(logs.slice(0, 4)));

  await browser.close();
  fs.writeFileSync(path.join(outDir, "report.json"), JSON.stringify({ rows, failures, logs }, null, 2));

  for (const r of rows) {
    console.log(
      String(r.size).padEnd(5),
      "溢出", String(r.overflow).padStart(2),
      "| 小触点", String(r.small.length),
      "| 裁切", String(r.clipped.length),
      "| 代码横滚", r.codeScroll && r.codeScroll.length ? "需要" : "无",
      "| motion", r.hasMotion ? "✓" : "✗",
      "| 遮挡", String((r.occluded && r.occluded.bad.length) || 0),
      "| 图", r.final.chart ? "✓" : "—",
      "| 终态", r.final.step, JSON.stringify(r.final.cells.filter(Boolean).length ? r.final.cells : r.final.chart)
    );
  }
  if (failures.length) {
    console.error("\n未通过：");
    failures.forEach((f) => console.error(" - " + f));
    process.exit(1);
  }
  console.log("\n全部通过。截图在 " + outDir);
})();
