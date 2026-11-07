/* ============================================================================
   problem.js 模板 —— 复制这个文件，改成本题的算法即可。
   页面结构、样式、动效、键盘、响应式都在 ../assets/demo.js，不要在这里重写。
   完整规范见 skill/SKILL.md 与 skill/references/step-model.md。

   下面这份是「27. 移除元素（快慢指针）」的完整实现，可以直接打开看效果：
     - 一行格子 + 两个指针（up: slow / fast）
     - 读数 slow / fast / k
     - 一步可选的「搬运动效」

   改题四步：
     1. meta（标题、导语、图例、代码卡文案）
     2. rows / markers（有几行格子、哪些指针）
     3. code（展示的源码，行号从 1 开始）
     4. examples + build(input)：把算法走一遍，每步返回一个 step 对象

   写完先跑：node _tools/lint-model.cjs "<题目文件夹>"
   ========================================================================= */
window.DEMO = {
  layout: "sequence",   // sequence（默认，已实现）· network · matrix · bars，见 step-model.md

  meta: {
    eyebrow: "力扣 · 27",
    title: "移除元素",
    ledeHtml: "快指针扫过去，遇到不等于 <code>val</code> 的元素就交给慢指针写回；等于的直接跳过。",
    ledeShort: "快慢指针：留下来的元素写回数组前部，覆盖即删除。",
    facts: ["快慢双指针", "时间 O(n)", "空间 O(1)"],
    tones: { a: "#008024", b: "#005BDA" },
    legend: [
      { tone: "a", text: "已留下" },
      { tone: "b", text: "待检查" },
      { ring: true, text: "本步写入" }
    ],
    code: {
      title: "C++ · 快慢指针",
      note: "为阅读换行，逻辑未改",
      hint: "左边绿条 = 当前执行行",
      left: "快慢指针",
      right: "时间 O(n) · 空间 O(1)"
    }
  },

  markers: {
    slow: { tone: "a" },
    fast: { tone: "b" }
  },

  rows: [{ label: "nums", tone: "b" }],

  code: [
    "int removeElement(vector<int>& nums, int val) {",
    "    int slow = 0;",
    "    for (int fast = 0; fast < nums.size(); fast++) {",
    "        if (nums[fast] != val) {",
    "            nums[slow] = nums[fast];",
    "            slow++;",
    "        }",
    "    }",
    "    return slow;",
    "}"
  ],

  examples: [
    { label: "示例 1", input: { nums: [3, 2, 2, 3], val: 3 } },
    { label: "示例 2", input: { nums: [0, 1, 2, 2, 3, 0, 4, 2], val: 2 } }
  ],

  build: function (input) {
    var val = input.val;
    var a = input.nums.slice();
    var steps = [];
    var slow = 0;
    var kept = [];

    function cells(fast) {
      return a.map(function (v, i) {
        return {
          v: v,
          tone: kept[i] ? "a" : null,
          consumed: fast >= 0 && i < fast && !kept[i]
        };
      });
    }

    function push(fast, extra) {
      steps.push(Object.assign({
        rows: [{
          tag: "val = " + val + " · 已留下 " + slow + " 个",
          cells: cells(fast),
          up: ["slow", "fast"],
          p: { slow: slow, fast: fast }
        }],
        vars: [
          { k: "slow", v: slow },
          { k: "fast", v: fast, dim: fast < 0 },
          { k: "k", v: slow }
        ],
        branch: "初始化",
        code: [2],
        text: "初始：slow = 0，fast 从 0 开始扫。",
        ref: "第 2 行",
        sr: "nums = [" + a.join(", ") + "]，slow = " + slow + "，fast = " + fast
      }, extra));
    }

    push(0);

    for (var fast = 0; fast < a.length; fast++) {
      if (a[fast] === val) {
        push(fast, {
          branch: "跳过（等于 val）",
          code: [3, 4],
          text: "nums[" + fast + "] = " + a[fast] + " 等于 val，跳过不写回，fast 右移。",
          ref: "第 3–4 行"
        });
      } else {
        var from = { row: 0, i: fast };
        var to = { row: 0, i: slow };
        var value = a[fast];
        a[slow] = a[fast];
        kept[slow] = true;
        push(fast + 1, {
          branch: "留下并写回",
          code: [5, 6],
          text: "nums[" + fast + "] = " + value + " 不等于 val，写回到 nums[" + slow + "]，slow 右移。",
          ref: "第 5–6 行",
          move: { from: from, to: to, value: value, tone: "a" }
        });
        slow++;
        // 指针位置跟着 slow 走
        steps[steps.length - 1].rows[0].p.slow = slow;
        steps[steps.length - 1].vars[0].v = slow;
        steps[steps.length - 1].vars[2].v = slow;
      }
    }

    steps.push({
      rows: [{
        tag: "val = " + val + " · 已留下 " + slow + " 个",
        cells: cells(-1),
        up: ["slow"],
        p: { slow: Math.min(slow, a.length - 1) }
      }],
      vars: [{ k: "slow", v: slow }, { k: "fast", v: a.length, dim: true }, { k: "k", v: slow }],
      branch: "结束",
      code: [9],
      text: "扫完，返回 " + slow + "。前 " + slow + " 个就是留下的元素。",
      ref: "第 9 行",
      sr: "nums = [" + a.join(", ") + "]，返回 " + slow
    });

    return steps;
  }
};
