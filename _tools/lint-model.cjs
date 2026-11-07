/**
 * 帧模型校验器 —— 在打开浏览器之前，先把「数据错」抓出来
 *
 *   node _tools/lint-model.cjs "<题目文件夹>"
 *   node _tools/lint-model.cjs "<题目文件夹>" --strict   # warning 也算失败
 *
 * 它做的事：把 problem.js 装进沙箱跑一遍每个 example，逐帧检查契约。
 * 与 verify.cjs 的分工：
 *   lint-model  → 数据对不对（帧数、行号、索引、色调、指针）
 *   verify      → 页面对不对（溢出、触点、裁切、报错、截图）
 *
 * error 必须清零；warning 至少看一眼。
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const target = process.argv[2];
const strict = process.argv.includes("--strict");
if (!target) {
  console.error('用法: node _tools/lint-model.cjs "<题目文件夹>" [--strict]');
  process.exit(2);
}

const file = path.resolve(process.cwd(), target, "problem.js");
if (!fs.existsSync(file)) {
  console.error("找不到 problem.js:", file);
  process.exit(2);
}

const sandbox = { window: {}, console: console };
vm.createContext(sandbox);
try {
  vm.runInContext(fs.readFileSync(file, "utf8"), sandbox, { filename: file });
} catch (e) {
  console.error("problem.js 执行失败:", e.message);
  process.exit(1);
}

const SPEC = sandbox.window.DEMO;
if (!SPEC) {
  console.error("problem.js 没有设置 window.DEMO");
  process.exit(1);
}

const errors = [];
const warns = [];
const err = (m) => errors.push(m);
const warn = (m) => warns.push(m);

/* ---------------------------------------------------------------- 顶层 */
const meta = SPEC.meta || {};
const codeArr = SPEC.code || [];
const rowsSpec = SPEC.rows || [];
const markers = SPEC.markers || {};
const examples = SPEC.examples || [];
const layout = SPEC.layout || "sequence";
const toneKeys = Object.keys(meta.tones || {}).concat(["muted"]);

if (!meta.title) err("meta.title 缺失");
if (!examples.length) err("examples 为空，至少给 1 个示例");
if (!codeArr.length) err("code 为空，至少要展示几行源码");
if (!rowsSpec.length && layout === "sequence") err("rows 为空，sequence 布局至少要 1 行");
if ((meta.legend || []).length > 3) warn("meta.legend 超过 3 项，手机上会折行");
if (typeof SPEC.build !== "function") err("缺少 build(input) 函数");
["network", "matrix"].includes(layout) &&
  warn('layout="' + layout + '" 的渲染尚未接入引擎，当前只会按 sequence 显示');

/* ------------------------------------------------------------ 每步校验 */
function checkStep(st, i, n, ctx) {
  const at = ctx + " 第 " + i + " 步";
  if (!Array.isArray(st.rows) || !st.rows.length) err(at + "：rows 为空");
  if (!st.text) err(at + "：text 为空（解说不能空着）");
  if (!st.branch) warn(at + "：branch 为空，观众看不到本步走哪个分支");
  if (!st.sr) warn(at + "：sr 为空，屏幕阅读器只能拿到零碎文本");

  // 代码行号
  const lines = st.code;
  if (!Array.isArray(lines) || !lines.length) err(at + "：code 为空，本步不高亮任何行");
  else {
    lines.forEach((ln) => {
      if (!Number.isInteger(ln)) err(at + "：code 含非整数 " + JSON.stringify(ln));
      else if (ln < 1 || ln > codeArr.length) {
        err(at + "：code 行号 " + ln + " 越界（源码共 " + codeArr.length + " 行）");
      }
    });
  }

  // 行 / 格子 / 指针 / 搬运
  (st.rows || []).forEach((r, ri) => {    if (ri >= rowsSpec.length) err(at + "：rows[" + ri + "] 超出 rows 定义（共 " + rowsSpec.length + " 行）");
    const cells = r.cells || [];
    if (!cells.length) warn(at + "：rows[" + ri + "] 没有格子");

    cells.forEach((c, ci) => {
      if (c == null) return err(at + "：rows[" + ri + "].cells[" + ci + "] 是空值");
      if (c.v == null && c.h == null) {
        err(at + "：rows[" + ri + "].cells[" + ci + "] 既没有 v 也没有 h");
      }
      if (c.tone && !toneKeys.includes(c.tone)) {
        err(at + "：rows[" + ri + "].cells[" + ci + "].tone = \"" + c.tone +
            "\" 未在 meta.tones 登记（已登记: " + toneKeys.join(", ") + "）");
      }
    });

    ["up", "down"].forEach((slot) => {
      (r[slot] || []).forEach((name) => {
        if (!markers[name]) {
          err(at + "：rows[" + ri + "]." + slot + " 用到未声明的指针 \"" + name + "\"（markers 里没有）");
        }
        if (r.p && r.p[name] != null) {
          const idx = r.p[name];
          if (!Number.isInteger(idx)) err(at + "：rows[" + ri + "].p." + name + " 不是整数");
          else if (idx >= cells.length && idx !== -1) {
            err(at + "：rows[" + ri + "].p." + name + " = " + idx + " 越界（该行只有 " + cells.length + " 格）");
          }
        }
      });
    });

    Object.keys(r.p || {}).forEach((name) => {
      if (!(r.up || []).includes(name) && !(r.down || []).includes(name)) {
        warn(at + "：rows[" + ri + "].p." + name + " 有位置但没在 up/down 里声明，徽标不会显示");
      }
    });

    if (r.tag != null && typeof r.tag !== "string") warn(at + "：rows[" + ri + "].tag 建议用字符串");
  });

  // bars 布局：两行必须同列数（柱高 / 积水），柱高必须是数字
  if (layout === "bars") {
    const r0 = (st.rows || [])[0];
    const r1 = (st.rows || [])[1];
    if (!r0) err(at + "：bars 布局缺少 rows[0]（柱高）");
    if (!r1) err(at + "：bars 布局缺少 rows[1]（积水）");
    if (r0 && r1 && (r0.cells || []).length !== (r1.cells || []).length) {
      err(at + "：bars 布局 rows[0] 与 rows[1] 列数不一致（" +
        (r0.cells || []).length + " vs " + (r1.cells || []).length + "）");
    }
    ((r0 && r0.cells) || []).forEach((c, ci) => {
      if (c && (typeof c.v !== "number" || !isFinite(c.v) || c.v < 0)) {
        err(at + "：bars 布局 rows[0].cells[" + ci + "].v 必须是 ≥0 的数字");
      }
    });
  }

  if (st.move) {
    const m = st.move;
    [["from", m.from], ["to", m.to]].forEach(([k, ref]) => {
      if (!ref) return err(at + "：move." + k + " 缺失");
      const row = (st.rows || [])[ref.row];
      if (!row) return err(at + "：move." + k + " 指向不存在的行 " + ref.row);
      const len = (row.cells || []).length;
      if (!Number.isInteger(ref.i) || ref.i < 0 || ref.i >= len) {
        err(at + "：move." + k + ".i = " + ref.i + " 越界（第 " + ref.row + " 行共 " + len + " 格）");
      }
    });
    if (m.value == null) err(at + "：move.value 缺失，飞行动效没有内容");
  }

  // 首末帧
  if (i === 0 && st.text && !/初始|开始|输入|起点/.test(st.text)) {
    warn(at + "：首帧建议讲清输入与起点（当前：" + st.text.slice(0, 24) + "…）");
  }
  if (i === n - 1 && st.text && !/结束|完成|返回|结果|命中|未找到|扫完/.test(st.text)) {
    warn(at + "：末帧建议给出结论（当前：" + st.text.slice(0, 24) + "…）");
  }
}

/* ------------------------------------------------------- 跑每个 example */
examples.forEach((ex, ei) => {
  // 标签本身就叫「示例 2」时不重复拼一遍
  const label = ex.label || "";
  const ctx = label ? (/^示例/.test(label) ? label : "示例 " + (ei + 1) + "（" + label + "）") : "示例 " + (ei + 1);
  if (ex.input == null) return err(ctx + "：input 缺失");

  let steps;
  try {
    steps = SPEC.build(ex.input, ex);
  } catch (e) {
    return err(ctx + "：build 抛错 —— " + e.message);
  }
  if (!Array.isArray(steps)) return err(ctx + "：build 没有返回数组");

  const n = steps.length;
  // 边界示例（n = 0 这类）两帧就是完整的，帧数下限只对主示例较真
  if (n < 2) err(ctx + "：" + n + " 帧，没有可演示的过程");
  else if (n > 60) err(ctx + "：" + n + " 帧，超过 60 帧观众会累");
  else if (ei === 0 && n < 5) warn(ctx + "：" + n + " 帧，主示例建议 5–40 帧");
  else if (n > 40) warn(ctx + "：" + n + " 帧，建议压在 40 帧以内");

  steps.forEach((st, i) => {
    if (!st || typeof st !== "object") return err(ctx + " 第 " + i + " 步：不是对象");
    checkStep(st, i, n, ctx);
  });

  // 相邻帧完全相同 → 无意义的重复帧
  for (let i = 1; i < steps.length; i++) {
    const a = JSON.stringify(steps[i - 1].rows) + steps[i - 1].text;
    const b = JSON.stringify(steps[i].rows) + steps[i].text;
    if (a === b) { warn(ctx + " 第 " + i + " 步与上一步完全相同，可以删"); break; }
  }
});

/* -------------------------------------------------------------- 输出 */
function line(s) { process.stdout.write(s + "\n"); }
line("");
line("帧模型校验 · " + path.basename(target));
line("─".repeat(56));
line("  布局      " + layout);
line("  示例      " + examples.length + " 个");
line("  源码      " + codeArr.length + " 行");
line("  指针      " + (Object.keys(markers).join(" / ") || "（无）"));
line("  语义色    " + (Object.keys(meta.tones || {}).join(" / ") || "（无）"));

if (errors.length) {
  line("");
  line("  ✗ error " + errors.length);
  errors.forEach((m) => line("    · " + m));
}
if (warns.length) {
  line("");
  line("  ! warning " + warns.length);
  warns.forEach((m) => line("    · " + m));
}
line("");
if (!errors.length && !warns.length) line("  全绿，可以跑 verify.cjs 了");
else if (!errors.length) line("  无 error（" + warns.length + " 条 warning），可以继续");
else line("  有 " + errors.length + " 条 error，先修完再打开页面");
line("");

process.exit(errors.length || (strict && warns.length) ? 1 : 0);
