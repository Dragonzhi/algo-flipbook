# 帧模型（Step Model）规范

任何一个算法都被翻译成两样东西：**一份静态骨架（行 / 节点 / 代码）+ 一组帧**
（每帧记录可见状态与一句解说）。这与外部同类 Skill 的 `TraceDefinition` /
`frames` 建模思路一致，但这里的字段名以本引擎为准。

引擎只读 `window.DEMO`，所以「骨架」写在顶层，「帧」由 `build()` 返回。

## 布局 `layout`

四个布局共用同一套帧结构（`rows` / `vars` / `branch` / `code` / `text` / `ref`），
差别只在**骨架怎么摆**。

| layout | 骨架字段 | 典型场景 | 引擎状态 |
| --- | --- | --- | --- |
| `sequence`（默认） | `rows` 一行或多行格子 | 数组、字符串、双指针、滑动窗口、栈队列 | **已实现** |
| `network` | `nodes` + `edges` | 图、树、拓扑、Dijkstra、Trie | 数据契约已定，渲染待接入 |
| `matrix` | `grid: {rows, cols}` | 二维 DP、LCS、背包、Floyd | 数据契约已定，渲染待接入 |
| `bars` | `rows[0]` 柱高 + `rows[1]` 积水 | 接雨水、直方图、排序柱、单调栈 | **已实现（SVG 柱状图）** |

> 现阶段的诚实说明：`sequence` 与 `bars` 能直接渲染；`network` / `matrix` 先按本文写数据，
> 引擎接入后无需改 `problem.js`。**不要**为了用新布局去改 `demo.js` 之外的公共文件。

### sequence（已实现）

```js
rows: [
  { label: "nums1", tone: "a" },
  { label: "nums2", tone: "b", emptyNote: "nums2 为空（n = 0）" }
]
```

每个 step 的 `rows[i]` 对应第 i 行，`cells[j]` 对应第 j 格。

### network（数据契约）

```js
nodes: [{ id: "a", label: "A", x: 20, y: 30 }],   // x/y 是相对舞台的百分比 0–100
edges: [{ from: "a", to: "b", label: "4", directed: true }]
```

帧里用 id 而不是下标：

```js
{ active: ["a", "b"], settled: ["c"], activeEdges: ["a-b"], rejectedEdges: ["b-c"] }
```

摆放经验：树分三层、环状图围一圈；节点不重叠、边交叉尽量少。**坐标手算，不自动布局。**

### matrix（数据契约）

```js
grid: { rows: ["A", "B"], cols: ["", "A", "B"] }   // 行头 / 列头，第一格留空
```

帧里用二维下标：

```js
{ active: [[1, 2]], settled: [[1, 1]], values: { "1,2": 3 } }
```

### bars（已实现）

两行数据，引擎画成 2D 柱状图（SVG，列宽自适应，320px 下 12 列仍可读）：

- `rows[0].cells[j].v` = 第 j 根柱子的**高度**（数字，≥ 0）
- `rows[1].cells[j].v` = 第 j 根柱子的**积水**（数字；`placeholder: true` 表示还没结算，不画水）
- 两行**列数必须一致**，`lint-model.cjs` 会报
- `tone` 照旧：柱子描边与柱顶数字跟着变色
- 两行的 `tag` 会拼成图表上方一行标题，如「累计接雨 1 · 已结算 4 / 12 列」
- 指针照旧用 `up` / `down` + `p`，落在柱子上方 / 下方
- 图例里想要「积水」条目，写 `{ water: true, text: "积水" }`

```js
rows: [
  { label: "height", tag: "累计接雨 1",
    cells: [{ v: 0 }, { v: 1, tone: "a" }], up: ["l"], p: { l: 1 } },
  { label: "water", tag: "已结算 1 / 2 列",
    cells: [{ v: 0, tone: "a" }, { v: 1, tone: "a" }] }
]
```

## 帧的字段（全布局通用）

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `rows` | ✅ | 每行的格子状态；`cells[].v` 是显示文本 |
| `vars` | 建议 | 读数面板：`[{ k, v, dim? }]`，`dim` 表示该值已越界/失效 |
| `branch` | ✅ | 本步走的分支名，一行短句 |
| `code` | ✅ | 高亮行号数组，**1 起**，必须落在 `code.length` 内 |
| `text` | ✅ | 一句解说，≤ 约 40 字，引用具体值 |
| `ref` | 建议 | 右对齐的行号引用，如「第 14 行」 |
| `move` | 可选 | 搬运动效：`{ from: {row,i}, to: {row,i}, value, tone }` |
| `sr` | 建议 | 屏幕阅读器用的完整状态句 |

格子字段：`v`（显示文本）· `tone`（语义色，键必须在 `meta.tones` 里）·
`placeholder`（虚线空位）· `consumed`（灰掉）· `h`（bars 专用高度）。

指针字段：`up`（上方徽标名数组）· `down`（下方）· `p`（名字 → 列下标）。
越界写 `-1`，引擎会隐藏徽标，越界信息交给读数面板。

## 叙事写作法

`text` 是讲解的主体，观众基本只看帧和这一句。

1. **一句一义**：一帧只说一件事。
2. **说具体值**：「3 > 2，取 3」而不是「比较大小」。
3. **补一句为什么**：「相等时取 nums2，合并保持稳定」。
4. **首帧讲输入**：「初始 p1 = 2，p2 = 2，tail = 5，从最右边开始填」。
5. **末帧讲结论**：「扫完，返回 4，前 4 个就是留下的元素」。
6. **不堆术语**：必须用术语时，第一次出现给一句白话。

## 帧数控制

- 目标 5–40 帧；少于 3 帧无演示价值，超过 60 帧演示疲惫。
- 递归 / 循环展开时，只保留「改变观众认知」的关键帧，删掉纯重复的中间态。
- 一步可以推进「完成一次比较并给出结论」，不必把比较和写入拆成两帧。

## 完整示例：二分查找（sequence）

```js
window.DEMO = {
  meta: {
    eyebrow: "算法 · 二分查找 · O(log n)",
    title: "二分查找",
    ledeHtml: "每次比较都能排除一半元素，所以查找代价是对数级。",
    facts: ["二分", "时间 O(log n)", "空间 O(1)"],
    tones: { a: "#008024", b: "#005BDA" },
    legend: [{ tone: "a", text: "已排除" }, { ring: true, text: "本步比较" }],
    code: { title: "C++ · 二分", left: "二分查找", right: "时间 O(log n) · 空间 O(1)" }
  },
  markers: { lo: { tone: "a" }, hi: { tone: "b" }, mid: { tone: "muted" } },
  rows: [{ label: "nums", tone: "b" }],
  code: [
    "int lo = 0, hi = nums.size() - 1;",
    "while (lo <= hi) {",
    "    int mid = lo + (hi - lo) / 2;",
    "    if (nums[mid] == target) return mid;",
    "    else if (nums[mid] < target) lo = mid + 1;",
    "    else hi = mid - 1;",
    "}",
    "return -1;"
  ],
  examples: [{ label: "示例 1", input: { nums: [2, 5, 8, 12, 16, 23, 38], target: 23 } }],
  build: function (input) {
    var a = input.nums, t = input.target;
    var steps = [];
    var lo = 0, hi = a.length - 1;
    var gone = {};

    function push(branch, lines, text) {
      steps.push({
        rows: [{
          tag: "target = " + t,
          cells: a.map(function (v, i) {
            return { v: v, consumed: !!gone[i] };
          }),
          up: ["lo", "hi"], down: ["mid"],
          p: { lo: lo, hi: hi, mid: mid }
        }],
        vars: [{ k: "lo", v: lo }, { k: "hi", v: hi }, { k: "mid", v: mid }],
        branch: branch, code: lines, text: text, ref: "第 " + lines[0] + " 行"
      });
    }

    var mid = -1;
    push("初始化", [1], "目标 " + t + "。区间 [0, " + hi + "]，先看正中间。");
    while (lo <= hi) {
      mid = lo + ((hi - lo) >> 1);
      if (a[mid] === t) {
        push("命中", [3, 4], "nums[" + mid + "] = " + a[mid] + "，命中目标，返回 " + mid + "。");
        return steps;
      }
      if (a[mid] < t) {
        for (var i = lo; i <= mid; i++) gone[i] = true;
        push("偏小，排除左半", [3, 5], "nums[" + mid + "] = " + a[mid] + " < " + t + "，左半边整段排除。");
        lo = mid + 1;
      } else {
        for (var j = mid; j <= hi; j++) gone[j] = true;
        push("偏大，排除右半", [3, 6], "nums[" + mid + "] = " + a[mid] + " > " + t + "，右半边整段排除。");
        hi = mid - 1;
      }
    }
    push("未找到", [8], "区间为空，返回 -1。");
    return steps;
  }
};
```

注意示例里刻意控制了帧数：7 个元素只用了 4 帧，没把每轮循环拆成好几帧。
