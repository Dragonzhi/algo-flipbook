/**
 * 对比度自检：把 DESIGN.md 里登记的色对逐个算 WCAG 比值，低于 4.5 直接报错。
 *
 *   node _tools/contrast.mjs "88 合并两个有序数组 - 双指针"
 *
 * 用法：在题目文件夹的 DESIGN.md 里维护一个 ```json 块（见下），工具只认它。
 *
 *   ```json contrast
 *   [
 *     ["正文 on 面板", "#F8FAFC", "#1B2336"],
 *     ["次级 on 面板", "#94A3B8", "#1B2336"]
 *   ]
 *   ```
 */
import fs from "node:fs";
import path from "node:path";

const target = process.argv[2];
if (!target) {
  console.error('用法: node _tools/contrast.mjs "<题目文件夹名>"');
  process.exit(2);
}

const doc = path.resolve(process.cwd(), target, "DESIGN.md");
if (!fs.existsSync(doc)) {
  console.error("找不到 DESIGN.md:", doc);
  process.exit(2);
}

const text = fs.readFileSync(doc, "utf8");
const block = text.match(/```json contrast\s*\n([\s\S]*?)```/);
if (!block) {
  console.error("DESIGN.md 里没有 ```json contrast 代码块，无法自检对比度。");
  process.exit(2);
}

let pairs;
try {
  pairs = JSON.parse(block[1]);
} catch (e) {
  console.error("contrast 代码块不是合法 JSON:", e.message);
  process.exit(2);
}

const lum = (hex) => {
  const c = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4]
    .map((i) => parseInt(c.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

let bad = 0;
for (const [name, fg, bg] of pairs) {
  const r = ratio(fg, bg);
  const ok = r >= 4.5;
  if (!ok) bad++;
  console.log((ok ? "✓" : "✗") + " " + name.padEnd(28) + r.toFixed(2) + ":1");
}
if (bad) {
  console.error("\n" + bad + " 对文字对比度低于 4.5:1");
  process.exit(1);
}
console.log("\n全部达标（≥ 4.5:1）");
