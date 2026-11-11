/* ============================================================================
   problem.js — 88. 合并两个有序数组
   ----------------------------------------------------------------------------
   这一份是「题目的全部」，前端引擎在 ../../assets/demo.js，不需要动。
   改题时只写：meta / markers / rows / code / examples / build。
   ========================================================================= */
window.DEMO = {
  meta: {
    eyebrow: "力扣 · 88",
    difficulty: "简单",
    title: "合并两个有序数组",
    ledeHtml:
      "<code>nums1</code> 末尾正好有 n 个空位，所以不必往前挤：让两个指针从各自尾部出发，" +
      "每轮把较大的那个值填进最右边的空位，走完即有序。",
    ledeShort: "从后往前填：末尾的空位天然可用，不需要额外空间。",
    facts: ["反向双指针", "原地合并"],
    tones: { a: "#008024", b: "#005BDA" },
    legend: [
      { tone: "a", text: "值来自 nums1" },
      { tone: "b", text: "值来自 nums2" },
      { ring: true, text: "本步写入" }
    ],
    code: {
      title: "C++ · 反向双指针",
      left: "时间复杂度 O(m + n)",
      right: "空间复杂度 O(1)"
    }
  },

  markers: {
    p1: { tone: "a" },
    p2: { tone: "b" },
    tail: { tone: "muted" }
  },

  rows: [
    { label: "nums1", tone: "a" },
    { label: "nums2", tone: "b", emptyNote: "nums2 为空（n = 0），循环只走 p2 已耗尽的分支。" }
  ],

  code: [
    "void merge(vector<int>& nums1, int m,",
    "           vector<int>& nums2, int n) {",
    "    int p1 = m - 1, p2 = n - 1;",
    "    int tail = m + n - 1;",
    "    int cur;",
    "    while (p1 >= 0 || p2 >= 0) {",
    "        if (p1 == -1) {",
    "            cur = nums2[p2--];",
    "        } else if (p2 == -1) {",
    "            cur = nums1[p1--];",
    "        } else if (nums1[p1] > nums2[p2]) {",
    "            cur = nums1[p1--];",
    "        } else {",
    "            cur = nums2[p2--];",
    "        }",
    "        nums1[tail--] = cur;",
    "    }",
    "}"
  ],

  examples: [
    { label: "示例 1", input: { nums1: [1, 2, 3, 0, 0, 0], m: 3, nums2: [2, 5, 6], n: 3 } },
    { label: "示例 2", input: { nums1: [1], m: 1, nums2: [], n: 0 } },
    { label: "示例 3", input: { nums1: [0], m: 0, nums2: [1], n: 1 } }
  ],

  /* ------------------------------------------------------------------------
     build(input) → steps[]
     每一步都要给出：rows（格子状态 + 指针位置）、vars（读数）、branch（分支名）、
     code（高亮行号）、text/ref（解说）、move（可选：这一步把哪个值搬到哪）。
     ---------------------------------------------------------------------- */
  build: function (input) {
    var m = input.m;
    var n = input.n;
    var a = input.nums1.slice();
    var b = input.nums2.slice();
    var steps = [];
    var p1 = m - 1;
    var p2 = n - 1;
    var tail = m + n - 1;
    var origin = [];
    for (var j = 0; j < m + n; j++) origin.push(j < m ? "a" : null);

    function rows() {
      var r0 = {
        tag: "m = " + m + " · 长度 m + n = " + (m + n),
        cells: a.map(function (v, i) {
          return origin[i] ? { v: v, tone: origin[i] } : { v: 0, placeholder: true };
        }),
        up: ["p1"],
        down: ["tail"],
        p: { p1: p1, tail: tail }
      };
      var r1 = {
        tag: "n = " + n,
        cells: b.map(function (v, i) {
          return { v: v, tone: "b", consumed: i > p2 };
        }),
        up: ["p2"],
        p: { p2: p2 }
      };
      return [r0, r1];
    }

    function vars(cur) {
      return [
        { k: "p1", v: p1, dim: p1 < 0 },
        { k: "p2", v: p2, dim: p2 < 0 },
        { k: "tail", v: tail, dim: tail < 0 },
        { k: "cur", v: cur === null ? "—" : cur }
      ];
    }

    function srText() {
      return "nums1 = [" + a.join(", ") + "]，nums2 = [" + b.join(", ") +
        "]，p1 = " + p1 + "，p2 = " + p2 + "，tail = " + tail;
    }

    steps.push({
      rows: rows(),
      vars: vars(null),
      branch: "初始化指针",
      code: [3, 4],
      text: "初始：p1 = " + p1 + "，p2 = " + p2 + "，tail = " + tail +
        "。最大值一定落在两个数组的末尾，所以从最右边开始填。",
      ref: "第 3–4 行",
      sr: srText()
    });

    while (p1 >= 0 || p2 >= 0) {
      var cur, branch, lines, cmp = null, branchText;
      var fromRow = 1, fromIdx = -1;

      if (p1 === -1) {
        cur = b[p2];
        branch = "只剩 nums2（p1 = -1）";
        lines = [7, 8, 16];
        fromRow = 1;
        fromIdx = p2;
        branchText = "nums1 的有效段已经用完（p1 = -1），剩下的都是 nums2 的值：把 " + cur +
          " 写入 nums1[" + tail + "]，p2 左移。";
      } else if (p2 === -1) {
        cur = a[p1];
        branch = "只剩 nums1（p2 = -1）";
        lines = [9, 10, 16];
        fromRow = 0;
        fromIdx = p1;
        branchText = "nums2 已经取完（p2 = -1），" + cur + " 本来就在 nums1[" + tail +
          "] 上，原样保留，指针继续左移。";
      } else if (a[p1] > b[p2]) {
        cur = a[p1];
        cmp = { one: a[p1], two: b[p2] };
        branch = "取 nums1（较大）";
        lines = [11, 12, 16];
        fromRow = 0;
        fromIdx = p1;
        branchText = "nums1[p1] = " + cmp.one + " 大于 nums2[p2] = " + cmp.two +
          "，取 " + cur + " 写入 nums1[" + tail + "]，p1 左移。";
      } else {
        cur = b[p2];
        cmp = { one: a[p1], two: b[p2] };
        branch = "取 nums2（≥）";
        lines = [14, 16];
        fromRow = 1;
        fromIdx = p2;
        branchText = "nums2[p2] = " + cmp.two + " ≥ nums1[p1] = " + cmp.one +
          "，取 " + cur + " 写入 nums1[" + tail + "]，p2 左移；相等时取 nums2，合并保持稳定。";
      }

      var writeAt = tail;
      var move = { from: { row: fromRow, i: fromIdx }, to: { row: 0, i: writeAt }, value: cur, tone: fromRow === 1 ? "b" : "a" };

      a[writeAt] = cur;
      origin[writeAt] = fromRow === 1 ? "b" : "a";
      if (branch === "只剩 nums2（p1 = -1）" || branch === "取 nums2（≥）") p2--;
      else p1--;
      tail--;

      steps.push({
        rows: rows(),
        vars: vars(cur),
        branch: branch,
        code: lines,
        text: branchText,
        ref: lines[0] === 14 ? "第 14 行" : "第 " + lines[0] + "–" + lines[1] + " 行",
        move: move,
        sr: srText()
      });
    }

    return steps;
  }
};
