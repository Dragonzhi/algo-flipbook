/* ============================================================================
   problem.js — 42. 接雨水（双指针）
   ----------------------------------------------------------------------------
   题目只写这一份数据；引擎在 ../assets/demo.js。
   规范见 ../skill/SKILL.md 与 ../skill/references/step-model.md。

   可视化编排：
     - layout: "bars" → 引擎把 rows[0] 当柱高、rows[1] 当积水，画成 2D 柱状图
     - 上行 height：柱高，绿=左侧已结算、蓝=右侧已结算
     - 下行 water ：每列积水（未结算的列是虚位占位，不画水）
     - 指针 l 在上方、r 在下方，避免两者相遇时徽标重叠
   ========================================================================= */
window.DEMO = {
  layout: "bars",

  meta: {
    eyebrow: "力扣 · 42",
    difficulty: "困难",
    title: "接雨水",
    ledeHtml:
      "某一列能存多少水，只由它<b>左右两边最高柱子中较矮的那一根</b>决定。" +
      "双指针的好处是不用同时知道两边：哪边的柱子矮，就先结算哪边——" +
      "因为矮的那一侧，天花板已经被自己的 max 封死了。",
    ledeShort: "矮的一侧先结算：它的天花板已经确定，不会再变。",
    facts: ["双指针", "一次遍历", "哪边矮先算哪边"],
    tones: { a: "#008024", b: "#005BDA" },
    legend: [
      { tone: "a", text: "左侧已结算" },
      { tone: "b", text: "右侧已结算" },
      { water: true, text: "积水" }
    ],
    code: {
      title: "C++ · 双指针",
      left: "时间复杂度 O(n)",
      right: "空间复杂度 O(1)"
    }
  },

  markers: {
    l: { tone: "a" },
    r: { tone: "b" }
  },

  rows: [
    { label: "height", tone: "muted" },
    { label: "water", tone: "muted" }
  ],

  code: [
    "int trap(vector<int>& height) {",            // 1
    "    int res = 0;",                           // 2
    "    int n = height.size();",                 // 3
    "    int l = 0;",                             // 4
    "    int r = n - 1;",                         // 5
    "    int maxl = 0;",                          // 6
    "    int maxr = 0;",                          // 7
    "    while (l < r) {",                        // 8
    "        if (height[l] < height[r]) {",       // 9
    "            maxl = max(height[l], maxl);",   // 10
    "            res += maxl - height[l];",       // 11
    "            l++;",                           // 12
    "        }",                                  // 13
    "        else {",                             // 14
    "            maxr = max(height[r], maxr);",   // 15
    "            res += maxr - height[r];",       // 16
    "            r--;",                           // 17
    "        }",                                  // 18
    "    }",                                      // 19
    "    return res;",                            // 20
    "}"                                           // 21
  ],

  examples: [
    {
      label: "示例 1",
      input: { height: [0, 1, 0, 2, 1, 0, 1, 3, 2, 1, 2, 1] }
    },
    {
      label: "示例 2",
      input: { height: [4, 2, 0, 3, 2, 5] }
    },
    {
      label: "边界 · 单调递减",
      input: { height: [5, 4, 3, 2, 1] }
    }
  ],

  build: function (input) {
    var h = input.height.slice();
    var n = h.length;
    var steps = [];
    var l = 0;
    var r = n - 1;
    var maxl = 0;
    var maxr = 0;
    var res = 0;
    var side = [];
    var water = [];
    var i;

    for (i = 0; i < n; i++) {
      side.push(null);
      water.push(null);
    }

    function doneCount() {
      var c = 0;
      for (var k = 0; k < n; k++) if (side[k]) c++;
      return c;
    }

    function rowsNow() {
      return [
        {
          tag: "累计接雨 " + res,
          cells: h.map(function (v, idx) {
            return { v: v, tone: side[idx] || null };
          }),
          up: ["l"],
          down: ["r"],
          p: { l: l, r: r }
        },
        {
          tag: "已结算 " + doneCount() + " / " + n + " 列",
          cells: h.map(function (v, idx) {
            if (water[idx] == null) return { v: "·", placeholder: true };
            return { v: water[idx], tone: side[idx] || null };
          })
        }
      ];
    }

    function varsNow() {
      return [
        { k: "l", v: l, dim: l > r },
        { k: "r", v: r, dim: r < l },
        { k: "maxl", v: maxl },
        { k: "maxr", v: maxr }
      ];
    }

    function srNow() {
      return "height = [" + h.join(", ") + "]，l = " + l + "，r = " + r +
        "，maxl = " + maxl + "，maxr = " + maxr + "，累计 " + res;
    }

    if (n < 2) {
      steps.push({
        rows: rowsNow(),
        vars: varsNow(),
        branch: "只有 " + n + " 列",
        code: [20],
        text: n === 0
          ? "height 为空，没有柱子，接不住水，返回 0。"
          : "只有一根柱子，左边或右边总有一侧是空的，接不住水，返回 0。",
        ref: "第 20 行",
        sr: srNow()
      });
      return steps;
    }

    steps.push({
      rows: rowsNow(),
      vars: varsNow(),
      branch: "初始化两端",
      code: [4, 5, 6, 7],
      text: "初始 l = 0，r = " + (n - 1) + "，maxl = maxr = 0。" +
        "从两端往中间收，哪边的柱子矮，就先结算哪边。",
      ref: "第 4–7 行",
      sr: srNow()
    });

    while (l < r) {
      var hl = h[l];
      var hr = h[r];

      if (hl < hr) {
        var atL = l;
        maxl = Math.max(hl, maxl);
        var addL = maxl - hl;
        res += addL;
        water[atL] = addL;
        side[atL] = "a";
        l++;

        steps.push({
          rows: rowsNow(),
          vars: varsNow(),
          branch: "左端更矮 → 结算左列",
          code: [9, 10, 11, 12],
          text: "height[" + atL + "] = " + hl + " < height[" + r + "] = " + hr +
            "，左端更矮，第 " + atL + " 列的天花板就是 maxl = " + maxl +
            "，本列积水 " + addL + "。",
          ref: "第 9–12 行",
          sr: srNow()
        });
      } else {
        var atR = r;
        maxr = Math.max(hr, maxr);
        var addR = maxr - hr;
        res += addR;
        water[atR] = addR;
        side[atR] = "b";
        r--;

        steps.push({
          rows: rowsNow(),
          vars: varsNow(),
          branch: "右端更矮（或相等）→ 结算右列",
          code: [9, 14, 15, 16, 17],
          text: "height[" + l + "] = " + hl + " 不小于 height[" + atR + "] = " + hr +
            "，右端更矮，第 " + atR + " 列的天花板就是 maxr = " + maxr +
            "，本列积水 " + addR + "。",
          ref: "第 9、14–17 行",
          sr: srNow()
        });
      }
    }

    steps.push({
      rows: rowsNow(),
      vars: varsNow(),
      branch: "结束：指针相遇",
      code: [20],
      text: "l 与 r 在下标 " + l + " 相遇。这个位置一定是全局最高的柱子，" +
        "它自身存不住水，所以不必再算，直接返回 " + res + "。",
      ref: "第 20 行",
      sr: srNow()
    });

    return steps;
  }
};
