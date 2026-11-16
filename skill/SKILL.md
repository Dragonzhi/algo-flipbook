---
name: algo-demo
description: >
  把任意算法、数据结构或流程做成可逐帧回放的单文件演示页（引擎复用，只写一份数据）。
  输入：算法名 / 代码 / 题目链接 / 一段流程描述。输出：与引擎同目录的 problem.js +
  可双击打开的 index.html，支持播放/暂停/单步/倍速/键盘，离线可用。
  触发语：做成可视化 / 算法图解 / 逐步演示 / 演示页 / step-by-step visualization /
  interactive algorithm demo。
license: MIT
---

# 算法演示台 · Algorithm Theater

把一个算法、数据结构或信息流程，变成**双击即开、逐步回放**的交互页。产出一个
`problem.js`（本题全部内容），放进任意题目文件夹即可运行；页面结构、动效、
键盘、响应式、无障碍由共享引擎提供，不重复实现。

不引 CDN、不引 webfont、不需要构建链。取不到动效库时自动回退 WAAPI。

## 何时用 / 何时不用

**用**：把 {算法} 做成可视化；给 {数据结构/流程} 写逐步演示；讲清楚 KMP / 快排 /
Dijkstra / 背包；给题解配一个能点着看的推演。

**不用**：只要静态示意图或架构图（无逐步逻辑）；要 React 应用内嵌并需状态管理
（直接按本文的帧模型写 TS 模块，复用宿主播放器，不产出单文件）；只要 Markdown 笔记。

## 三层结构（改哪一层先想清楚）

| 层 | 文件 | 谁来改 |
| --- | --- | --- |
| 引擎 | `assets/demo.js` · `assets/demo.css` | **默认不改**。只有所有题一起升级时才动 |
| 数据 | `<题目>/problem.js` | 本题唯一要写的代码 |
| 校验 | `_tools/lint-model.cjs` | 只改规则，不改用法 |

引擎与数据的边界只有一处：`window.DEMO`。引擎读它，题目写它。

## 产物与流程（照顺序，别跳）

1. **建目录**：`cp -r _template "<名称>"`（或任意题目文件夹）。
2. **跑一遍算法**：在 `build(input)` 里真实执行，**逐帧记录状态，不要凭想象编帧**。
3. **写 problem.js**：`meta` → `rows` / `markers` → `code` → `examples` → `build`。
4. **校验**：`node _tools/lint-model.cjs "<文件夹>"`，error 必须为 0。
5. **人肉走查**：打开 `index.html` 点三步，确认叙事成立、指针不错位、代码行对得上。
6. **补索引**：回根 `README.md` 加一行。

## 数据契约

### 顶层 `window.DEMO`

| 字段 | 说明 |
| --- | --- |
| `meta` | eyebrow / title / ledeHtml / ledeShort / facts / tones / legend（≤3 项）/ code |
| `layout` | 可选，`sequence`（默认）· `bars`（`rows[0]` 柱高 + `rows[1]` 积水 → SVG 柱状图）· `network`（`nodes` + `edges` → SVG 节点图，树 / 图 / Trie）。三者均已实现；`matrix` 见 references/step-model.md |
| `markers` | 指针徽标定义：`{ p1: { tone: "a" }, tail: { tone: "muted" } }` |
| `rows` | 有几行格子：`[{ label, tone, emptyNote? }]` |
| `code` | 展示源码，**行号从 1 起**，与每步 `code: [...]` 对齐 |
| `examples` | `[{ label, input }]`，第一个是默认示例 |
| `build(input)` | 跑一遍算法，返回 `steps[]` |

### 一步 `step`（引擎只认这些字段）

```js
{
  rows: [{
    cells: [{ v: 3, tone: "a" }, { v: 0, placeholder: true }],
    up: ["p1"], down: ["tail"], p: { p1: 2, tail: 5 }, tag: "m = 3"
  }],
  vars: [{ k: "p1", v: 2, dim: false }],
  branch: "取 nums2（≥）",
  code: [14, 16],          // 高亮行号，1 起
  text: "这一步发生了什么",
  ref: "第 14 行",
  move: { from: { row: 1, i: 2 }, to: { row: 0, i: 5 }, value: 6, tone: "b" },  // 可选
  sr: "给屏幕阅读器的一句完整状态"
}
```

格子三态：`tone`（来源色）· `placeholder`（虚线空位）· `consumed`（灰掉）。

## 帧质量六原则（这是 Skill 的核心，不是格式问题）

1. **最小推进单元**：一帧 = 一次可见变化（一次比较 / 交换 / 访问 / 写入）。
   细碎的机械操作合并，目标 **5–40 帧**；少于 3 帧没有演示价值，超过 60 帧演示疲惫。
2. **聚焦收敛**：一帧最多 1–3 个高亮元素。一帧亮二十个等于没亮。
3. **进度单调**：已完成 / 已访问的元素只累积、不回退。观众靠它读进度。
4. **一句一义**：`text` 一句话说清「做了什么 + 为什么」，引用具体数值
   （"3 > 2，取 3 写入 nums1[5]"），不写"进行数组比较"这种空话。
5. **伪代码对齐**：`code` 指向真实执行行；不能每帧都亮同一行，也不能亮不存在的行。
6. **首末收尾**：首帧讲输入与起点，末帧讲结论（"结果 [1,2,2,3,5,6]"）。

反面清单：整轮循环塞一帧 / 一帧全亮 / 每帧重画无累积 / 解说复述画面 /
`code` 恒定不变 / 缺首帧或缺末帧。

## 文案与无障碍

- `meta.ledeHtml` 讲**为什么这么做**，不复述代码。
- `facts` 给 3–4 条：思路名 + 时间 + 空间（+ 关键性质）。
- `legend` ≤ 3 项；颜色之外的形状（虚线 / 灰度）不占图例。
- 每步给 `sr`，`text` 不能只靠颜色传达信息。
- 颜色只承载语义，不做装饰；页面里不许出现裸十六进制（走 `meta.tones` 与 DESIGN.md）。

## 校验

```bash
node _tools/lint-model.cjs "<文件夹>"      # 数据契约 + 帧质量，error 必须清零
node _tools/verify.cjs "<文件夹>"          # 7 档断点 + 交互回归，截图落 _tools/out/
node _tools/contrast.mjs "<文件夹>"        # DESIGN.md 登记的色对做 WCAG 自检
```

`lint-model.cjs` 会跑一遍每个 example，逐帧断言：帧数区间、`code` 行号合法性、
`rows` 索引合法、`markers` 已声明、`tone` 已登记、`move` 端点存在、首末帧非空。
这是本项目相对「每次生成一坨 HTML」的关键差异：**数据错了当场报，不靠肉眼。**

## 反模式

- 不为演示页引构建链、webfont、图标库、CDN。
- 不做伪指标、发光胶囊、渐变装饰条、三层套娃卡片。
- 不在页面里写「待补充」；没做完的功能宁可不放按钮。
- 不把引擎逻辑写进 `problem.js`（布局、动画、事件一律归引擎）。
- 不改 `demo.js` 去迁就单道题。
