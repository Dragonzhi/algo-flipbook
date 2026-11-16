# AGENTS.md — 力扣学习工作区

> 任何 agent（或未来的我）接手这个目录，先读这一页，能省掉一轮沟通。
> 本文件是**约定**，不是教程；改约定请直接改这里。

## 1. 这是什么

一个本地力扣刷题工作区：**一题一个文件夹**，每个文件夹里除了解法笔记，还有一个可交互的算法演示页（静态页面，双击即开，离线可用）。演示页由共享引擎 `assets/demo.js` 渲染，题目只提供 `problem.js` 这一份数据。

## 2. 目录约定

```
力扣/
├─ AGENTS.md                     ← 本文件：约定 / 流程 / 坑
├─ README.md                     ← 题目索引（每加一题补一行）
├─ assets/
│  ├─ demo.css                   ← 演示页引擎样式（所有题目共用）
│  ├─ demo.js                    ← 演示页引擎：排版 / 动效 / 播放控制 / 键盘 / 响应式 / 无障碍
│  └─ motion.min.js              ← motion 14.9.1 UMD，共享动效库
├─ _tools/
│  ├─ lint-model.cjs             ← 帧模型校验：帧数 / 代码行号 / 索引 / 色调 / 指针，打开页面前先跑
│  ├─ verify.cjs                 ← 一条命令跑完 7 档断点 + 交互回归
│  └─ contrast.mjs               ← 读 DESIGN.md 里的色对做 WCAG 对比度自检
├─ skill/                        ← 「算法演示台」通用 Skill（本工作区的方法论出口）
│  ├─ SKILL.md                   ← 触发语 / 三层结构 / 数据契约 / 帧质量六原则 / 校验
│  └─ references/step-model.md   ← 帧模型规范：字段表 + 四种布局 + 叙事写法 + 完整示例
├─ _template/                    ← 新题起点（index.html / problem.js / DESIGN.md / README.md）
├─ 双指针/ · 前缀和/ · 树/        ← 专题分组：同思路的题收在一起（可按需新增其他专题）
│  └─ <题号> <题目名 - 核心思路>/
│     ├─ README.md              ← 题面、思路、手动推演表、代码、易错点
│     ├─ DESIGN.md              ← 设计契约：色板+实测对比度、字号、动效、断点、反模式
│     ├─ problem.js             ← 【本题唯一要写的代码】数据 + 每步状态
│     └─ index.html             ← 10 行壳子，永远不用改
└─ <题号> <题目名> - <核心思路>/   ← 也可以直接放根目录，不强制分组
   ├─ README.md
   ├─ DESIGN.md
   ├─ problem.js
   └─ index.html
```

**相对路径**：题目在根目录时共享资源写 `../assets/`；收进专题后写 `../../assets/`（`skill/` 同理）。`_tools/` 的脚本接受带子目录的路径，如 `node _tools/verify.cjs "双指针/42 接雨水 - 双指针"`。

## 3. 新题流程（照这个顺序，别跳）

1. **抄模板**：`cp -r _template "双指针/<NN 题目名 - 思路>"`（放根目录就去掉专题前缀），再把 `index.html` 里的共享资源路径按层级改成 `../assets/` 或 `../../assets/`。
2. **写 README.md**：题面（照抄力扣原文，链接必填）→ 思路（讲「为什么」不是「代码在做什么」）→ 手动推演表 → 代码 → 边界与易错点。
3. **只改 `problem.js`**：改 `meta` → `rows` / `markers` → `code` → `examples` + `build()`。`index.html` 不用动。
4. **写 DESIGN.md**：色板沿用模板，只改 1–3 个语义色；把改过的色对补进 `json contrast` 块。
5. **校验数据**：`node _tools/lint-model.cjs "<文件夹名>"`，error 必须清零。
6. **验证页面**：`node _tools/verify.cjs "<文件夹名>"`，全绿才算完。
7. **补索引**：回根 `README.md` 加一行。

**前端不再需要动**：`assets/demo.js` + `assets/demo.css` 是共享引擎，除非要给所有题一起改版，否则任何题目都不改这两个文件。

## 4. 演示页：引擎 / 数据的边界

`window.DEMO` 由 `problem.js` 提供，`assets/demo.js` 负责画。题目侧只需要填这些：

| 字段 | 说明 |
| --- | --- |
| `meta` | eyebrow、title、difficulty（`简单` / `中等` / `困难` → 题面难度徽标）、ledeHtml / ledeShort、facts（渲染成 chip）、tones（语义色）、legend（最多 3 项）、code（代码卡标题/说明/底部信息） |
| `markers` | 指针徽标：`{ p1: { tone: "a" }, tail: { tone: "muted" } }` |
| `layout` | 默认 `sequence`（已实现）；`bars` = `rows[0]` 柱高 + `rows[1]` 积水，渲染成 2D SVG 柱状图（已实现，接雨水用）；`network` = `nodes` + `edges`，渲染成 SVG 节点图（已实现，树的题用）；`matrix` 的数据契约见 `skill/references/step-model.md`，渲染待接入 |
| `rows` | 有几行格子：`[{ label, tone, emptyNote? }]` |
| `code` | 展示的源码，**行号从 1 开始**，与每步的 `code: [...]` 对齐 |
| `examples` | `[{ label, input }]` |
| `build(input)` | 把算法跑一遍，返回 `steps[]` |

一个 **step** 的结构（引擎只认这些字段）：

```js
{
  rows: [{ cells: [{ v: 3, tone: "a" }, { v: 0, placeholder: true }],
           up: ["p1"], down: ["tail"], p: { p1: 2, tail: 5 }, tag: "m = 3" }],
  vars: [{ k: "p1", v: 2, dim: false }],
  branch: "取 nums2（≥）",
  code: [14, 16],                              // 高亮行号
  text: "这一步发生了什么", ref: "第 14 行",
  move: { from: { row: 1, i: 2 }, to: { row: 0, i: 5 }, value: 6, tone: "b" }   // 可选：搬运动效
}
```

格子的三种状态：`tone`（来源色）、`placeholder`（虚线空位）、`consumed`（灰掉）。

模板已实现、**不要重写**：示例切换（力扣式下划线 tab）、上一步/下一步/播放/暂停/重置/倍速、键盘（← → 空格 R，底部用 `<kbd>` 分组提示）、指针徽标移动、数值搬运动效、代码行同步高亮（中性灰底 + 2px 墨线，行号加粗）、进度条（可点击跳步）、解说卡（分支 + 正文 + 行号，17px 墨线卡）、读数变化（整格 2px 墨框 + 变化量小墨牌）、`prefers-reduced-motion` 降级、手机端底部固定步进条、无障碍 live region。

硬规矩：

- 页面里**不许出现裸十六进制色值**，全部走 `DESIGN.md` 登记的 CSS 变量。
- 动效库用相对路径指向 `assets/motion.min.js`（根目录题 `../assets/`，专题内 `../../assets/`），**不引 CDN**；取不到时回退 WAAPI（模板已写好）。
- 颜色只承载语义：绿=主操作（播放按钮）与数据 A、蓝=数据 B、橙=品牌与学习进度（进度条 / 中等难度）。
  「正在执行」不用彩色（灰底 + 墨线），黄色不当状态色——容易被读成警告。语义色取 `-80` 深档，
  品牌橙只做填充不做小字，理由见 DESIGN.md §2。
- 文字对比度 ≥ 4.5:1，控件触点 ≥ 44×44，输入框字号 ≥ 16px。

## 5. 验证（不要再用一次性截图脚本）

```bash
node _tools/lint-model.cjs "双指针/42 接雨水 - 双指针"
node _tools/verify.cjs "双指针/42 接雨水 - 双指针"
node _tools/contrast.mjs "双指针/42 接雨水 - 双指针"
```

`lint-model.cjs` 在沙箱里跑一遍每个 example，逐帧断言：帧数区间（主示例 5–40，硬上限 60）、`code` 行号落在源码范围内、`rows` / `p` / `move` 索引不越界、`markers` 已声明、`tone` 已在 `meta.tones` 登记、首末帧有解说。**数据错在这里就报，不用等浏览器。**

`verify.cjs` 一次跑完 1920 / 1440 / 1280 / 1024 / 390 / 375 / 320 七档，自动断言：无横向溢出、无 <44px 触点、无被裁内容、无运行时报错，并输出每档 base/step/final 三张截图与 `report.json`。代码块允许横向滚动（会单独标「代码横滚 需要」，不算失败）。

它还会把每一行格子滚进视口，断言能**完整露在固定底栏上方**——首屏被底栏压住属正常（页面本就可滚动），滚到底仍看不见才算失败。这条是多行格子题（如 42 接雨水）暴露出来的：单行题时底栏遮挡不会触发。

## 6. 已知坑（都是踩过的，别重复）

| 坑 | 后果 | 正确做法 |
| --- | --- | --- |
| 媒体查询顺序 | `≤700` 写在 `≤1100` 前面，会被后者的 `display: contents` 覆盖 | 断点统一按 **宽 → 窄** 排列，最窄的放最后 |
| 指针徽标不居中 | `offsetWidth` 随文字宽度变，p1 / tail 指向同一格也会错位 | 徽标 `min-width: 42px; justify-content: center`，`.cellwrap` 上下各留 30px |
| 越界指针停在容器外 | -1 时徽标跑到卡片外沿悬空 | 直接 `visibility: hidden`，越界信息交给读数面板 |
| 用 python 字符串替换改 HTML | `\b` 被当成退格、分号/逗号丢失、TDZ 报错 | 优先用 edit 工具 + 唯一锚点；改完提取 `<script>` 跑 `node --check` |
| `justify-content: space-between` | 中缝随视口变化，读数块漂移 | 两列都给定宽 + `column-gap` 固定 |
| 固定底栏遮内容 | 手机滚动时正文被切一半 | 底栏高 + `body` 预留内距，条上方叠 20px 渐隐 |
| C++ 长行 | 375px 下代码横向溢出 | 代码块本身允许横向滚动（`verify` 只提示不判失败）；想彻底不滚就把函数签名折成两行 |
| 给所有盒子加 1px 描边 | 六类元素同一个框，层次全靠字号撑 | 只卡片一层描边，内部用底色差；描边留给激活态 |

## 7. 审核预算（重要，见 §8 的时间账）

- **默认不跑设计盲审**。`verify.cjs` 全绿 + 下面的自检清单过一遍，就交付。
- 只有用户明确要求「评审 / 挑刺 / 验收」时才派生一次独立盲审（新的、无上下文的 subagent，只看截图不看代码）。
- **盲审最多 1 轮**。得分 < 8.5 时：按清单修「阻塞级」项，其余记进 DESIGN.md「已知遗留」，**不连开第二轮**。连续多轮复审是本项目最大的时间黑洞。

## 8. 提速打法（本次实测时间账）

这次从 0 到交付，时间主要花在三处，按浪费程度排序：

1. **5 轮盲审 + 每轮 7 档重拍**（占比最大）。审稿人每轮都会提新偏好，且互相打架（一轮要「两栏等高」，下一轮要「不要等高」）。→ 已由 §7 封顶。
2. **反复手搓临时脚本**：截图、找元素、量尺寸的脚本每次现写，还因为选择器改名而反复报错。→ 已固化成 `_tools/verify.cjs`，下次是一条命令。
3. **样式靠补丁堆**：断点规则被追加了三四次，媒体查询顺序错乱，出现「改了 A 坏 B」。→ 新题直接抄模板，断点一次写全。

下次可复用的顺序（预计能省掉 60–70% 时间）：

1. `cp -r _template` + 只写 `problem.js` → 页面能跑（约 10 分钟）。
2. 一次 `verify.cjs` 看七档截图 → 修真实缺陷（约 10 分钟）。
3. 收工。需要更精致时，只针对**用户点名的部分**做一轮打磨。

## 9. 交付前自检清单

- [ ] `node _tools/lint-model.cjs` error 清零
- [ ] `node _tools/verify.cjs` 全绿
- [ ] `node _tools/contrast.mjs` 全绿
- [ ] 三个官方示例都点得通，终态与题面一致
- [ ] 键盘 ← → 空格 R 可用；`prefers-reduced-motion` 下信息不丢
- [ ] 手机首屏能看到主操作；滚到底无内容被底栏遮住
- [ ] README 的推演表与演示的实际步序一致
- [ ] 根 README 索引已补行

## 10. 不做什么

- 不为演示页引入构建链（不需要 npm install / vite）。
- 不引 webfont、图标库、CDN 资源；图标一律内联 SVG。
- 不做伪指标、发光胶囊、渐变装饰条、三层套娃卡片。
- 不在演示页里写「待补充」；没做完的功能宁可不放按钮。

## 11. 版本管理

- 本地 `main` 分支，没有远程。提交信息用 Conventional Commits + 中文描述：
  `feat(engine): …` / `feat(tools): …` / `feat: 新增 <题号> …` / `fix: …` / `chore: …` / `docs: …`。
- **一次提交只做一件事**。新题 = `problem.js` + `README.md` + `DESIGN.md` + `index.html` + 根索引；
  引擎改版 = `assets/*` + 受影响的 `DESIGN.md` + `skill/*` + `_tools/*`。
  不要在一个提交里既加题又改引擎——真撞在一起时（比如新题逼出新布局），
  按「引擎 → 工具/规范 → 新题」的顺序拆成几个提交。
- 提交前跑过 §5 的命令：只加题跑 `lint-model` + `verify`；**改了共享引擎则四道题全跑**，
  确认老题没被改坏。
- 不提交 `_tools/out/`（截图与 `report.json`，可随时重跑）、`.dsh-ops/`、`.commandcode/`，
  规则见 `.gitignore`。
- 行尾由 `.gitattributes` 统一：索引存 LF，Windows 工作区按 `core.autocrlf=true` 检出 CRLF；
  提交时出现 `LF will be replaced by CRLF` 的提示属正常，不是错误。
