/* ============================================================================
   problem.js — 974. 和可被 K 整除的子数组（前缀和 + 同余）
   ----------------------------------------------------------------------------
   这一份是「题目的全部」，前端引擎在 ../../assets/demo.js，不需要动。
   改题时只写：meta / markers / rows / code / examples / build。

   可视化编排：
     - 三行格子：nums / 前缀和 pre / 余数 r，按列对齐，一眼看出「同余」。
     - 右侧读数只列出现过的余数桶 cnt[r]（等价于 vector 里非零的桶），
       未出现的桶恒为 0，不单列——k 最大 10^4，全画出来反而不可能读。
     - 绿色 = 本步正在处理的前缀；蓝色 = 余数命中了之前的前缀。
   ========================================================================= */
window.DEMO = {
  meta: {
    eyebrow: "力扣 · 974",
    difficulty: "中等",
    title: "和可被 K 整除的子数组",
    ledeHtml:
      "子数组和 = <code>pre[r] - pre[l]</code>。它能被 <code>k</code> 整除，" +
      "当且仅当两个前缀和除以 <code>k</code> 的余数相同。于是「枚举子数组」变成" +
      "「给余数记数」：扫一遍，每个余数出现几次就是几对。",
    ledeShort: "同余的前缀相减必被 k 整除：数余数，不数子数组。",
    facts: ["前缀和 + 同余", "时间 O(n)", "空间 O(k)"],
    tones: { a: "#008024", b: "#005BDA" },
    legend: [
      { tone: "a", text: "当前前缀" },
      { tone: "b", text: "同余命中" }
    ],
    code: {
      title: "C++ · 前缀和同余",
      left: "时间复杂度 O(n)",
      right: "空间复杂度 O(k)"
    }
  },

  markers: {
    i: { tone: "a" }
  },

  rows: [
    { label: "nums", tone: "muted" },
    { label: "前缀和 pre", tone: "muted" },
    { label: "余数 r", tone: "muted" }
  ],

  code: [
    "int subarraysDivByK(vector<int>& nums, int k) {",
    "    int count = 0, cur = 0;",
    "    vector<int> cnt(k, 0);",
    "    cnt[0] = 1;",
    "    for (int x : nums) {",
    "        cur += x;",
    "        int r = ((cur % k) + k) % k;",
    "        count += cnt[r];",
    "        cnt[r]++;",
    "    }",
    "    return count;",
    "}"
  ],

  examples: [
    { label: "示例 1", input: { nums: [4, 5, 0, -2, -3, 1], k: 5 } },
    { label: "示例 2", input: { nums: [5], k: 9 } },
    { label: "补充 · 负数取模", input: { nums: [-1, 2, 4, 5], k: 5 } }
  ],

  /* ------------------------------------------------------------------------
     build(input) → steps[]
     每一步：rows（三行格子的状态 + 指针）、vars（读数）、branch（分支名）、
     code（高亮行号）、text / ref（解说）、sr（屏幕阅读器状态）。
     ---------------------------------------------------------------------- */
  build: function (input) {
    var nums = input.nums.slice();
    var k = input.k;
    var n = nums.length;
    var steps = [];

    // 余数桶：只记录真出现过的余数；cnt[0] = 1 代表「空前缀」这一个起点
    var cnt = {};
    cnt[0] = 1;
    var seen = [0];
    var cur = 0;
    var count = 0;
    var pre = [];          // 已算出的前缀和（未算为 undefined）
    var rem = [];          // 已算出的余数
    var iNow = -1;

    // 展示顺序 = 首次出现顺序，新桶只往后追加，读数的位置不会来回跳
    function remaindersShown(r) {
      var list = seen.slice();
      if (r != null && list.indexOf(r) === -1) list.push(r);
      return list;
    }

    function varsFor(r) {
      var iDone = iNow < 0 || iNow >= n;
      var vars = [
        { k: "i", v: iDone ? "—" : iNow, dim: iDone },
        { k: "cur", v: cur },
        { k: "r", v: r == null ? "—" : r, dim: r == null },
        { k: "count", v: count }
      ];
      remaindersShown(r).forEach(function (x) {
        vars.push({ k: "cnt[" + x + "]", v: cnt[x] || 0 });
      });
      return vars;
    }

    function rowsFor(i, numTone, preTone, remTone) {
      var computed = 0;
      for (var t = 0; t < n; t++) if (pre[t] != null) computed++;

      return [
        {
          tag: "k = " + k,
          cells: nums.map(function (v, j) {
            return { v: v, tone: j === i ? numTone : null };
          }),
          up: ["i"],
          p: { i: i }
        },
        {
          tag: "已算出 " + computed + " / " + n + " 个前缀",
          cells: nums.map(function (_, j) {
            return pre[j] == null
              ? { v: "—", placeholder: true }
              : { v: pre[j], tone: j === i ? preTone : null };
          })
        },
        {
          tag: "= ((pre % k) + k) % k",
          cells: nums.map(function (_, j) {
            return rem[j] == null
              ? { v: "—", placeholder: true }
              : { v: rem[j], tone: j === i ? remTone : null };
          })
        }
      ];
    }

    function srText(r) {
      var ps = pre.map(function (v) { return v == null ? "—" : v; }).join(", ");
      var rs = rem.map(function (v) { return v == null ? "—" : v; }).join(", ");
      return "nums = [" + nums.join(", ") + "]，前缀和 = [" + ps + "]，余数 = [" +
        rs + "]，cur = " + cur + "，r = " + (r == null ? "—" : r) +
        "，count = " + count + "。";
    }

    /* 首帧：输入 + 起点（cnt[0] = 1 的由来） */
    steps.push({
      rows: rowsFor(-1, null, null, null),
      vars: varsFor(null),
      branch: "初始化",
      code: [2, 3, 4],
      text: "初始：空前缀的和为 0，先记 cnt[0] = 1 —— 从下标 0 起的子数组靠它计数。",
      ref: "第 2–4 行",
      sr: srText(null)
    });

    for (var i = 0; i < n; i++) {
      iNow = i;
      cur += nums[i];
      var raw = cur % k;                    // C++ 里负数取模仍是负数
      var r = ((raw) + k) % k;
      pre[i] = cur;
      rem[i] = r;

      /* 帧一：累加 + 取余 */
      var calcText;
      if (cur < 0) {
        calcText = "nums[" + i + "] = " + nums[i] + "，cur = " + cur +
          " 为负：C++ 里 " + cur + " % " + k + " = " + raw + "，+ " + k + " 修正为 " + r + "。";
      } else {
        calcText = "nums[" + i + "] = " + nums[i] + "，cur = " + cur +
          "；" + cur + " % " + k + " = " + r + "。";
      }
      steps.push({
        rows: rowsFor(i, "a", "a", "a"),
        vars: varsFor(r),
        branch: "累加并取余",
        code: [6, 7],
        text: calcText,
        ref: "第 6–7 行",
        sr: srText(r)
      });

      /* 帧二：结算 + 入桶 */
      var hit = cnt[r] || 0;
      count += hit;
      cnt[r] = hit + 1;
      if (seen.indexOf(r) === -1) seen.push(r);

      var hitText;
      if (hit > 0) {
        hitText = "余数 " + r + " 已出现 " + hit + " 次，两两之差可被 " + k +
          " 整除：count + " + hit + " = " + count + "，cnt[" + r + "] = " + cnt[r] + "。";
      } else {
        hitText = "余数 " + r + " 第一次出现，count 不变；记下 cnt[" + r +
          "] = 1，等后面的同余前缀来配对。";
      }
      steps.push({
        rows: rowsFor(i, null, "a", "b"),
        vars: varsFor(r),
        branch: hit > 0 ? "命中 " + hit + " 个同余前缀" : "新余数入桶",
        code: [8, 9],
        text: hitText,
        ref: "第 8–9 行",
        sr: srText(r)
      });
    }

    /* 末帧：结论 */
    iNow = n;
    steps.push({
      rows: rowsFor(-1, null, null, null),
      vars: varsFor(null),
      branch: "结束",
      code: [11],
      text: "扫完，返回 " + count + "：每个同余前缀对，恰好对应一个合法子数组。",
      ref: "第 11 行",
      sr: "扫描结束，共 " + count + " 个子数组的和能被 " + k + " 整除。"
    });

    return steps;
  }
};
