/* ============================================================================
   problem.js — 101. 对称二叉树（递归镜像）
   ----------------------------------------------------------------------------
   题目只写这一份数据；引擎在 ../../assets/demo.js。
   规范见 ../../skill/SKILL.md 与 ../../skill/references/step-model.md。

   可视化编排：
     - layout: "network" → 引擎把 nodes / edges 画成 SVG 节点图
     - 绿圈 = 已判定相等；墨圈 = 本步正在比较；虚线圈 = 空位 / 判定失败
     - 树的形状随示例变化，所以 nodes / edges 挂在每个 example 上
     - 空位默认不画；只有当一个空指针真的参与一次比较（示例 2 的失败点）才画成 ∅
   ========================================================================= */

/* 把力扣的层序数组（null = 空位）摆成树：x 按该层的位置均分，y 按层高均分。
   ghostIdx 里的空位会被画成虚线圈。 */
function layoutTree(vals, ghostIdx) {
  var ghost = {};
  (ghostIdx || []).forEach(function (i) { ghost[i] = true; });

  var levels = [];
  var start = 0;
  var size = 1;
  while (start < vals.length) {
    levels.push({ start: start, size: size });
    start += size;
    size *= 2;
  }

  var h = levels.length;
  var nodes = [];
  var edges = [];

  levels.forEach(function (lv, d) {
    var y = h === 1 ? 50 : 10 + (d * 70) / (h - 1);
    for (var k = 0; k < lv.size; k++) {
      var idx = lv.start + k;
      if (idx >= vals.length) break;
      var v = vals[idx];
      var isGhost = v == null;
      if (isGhost && !ghost[idx]) continue;

      nodes.push({
        id: "n" + idx,
        label: isGhost ? "∅" : String(v),
        x: Math.round((((k + 0.5) / lv.size) * 100) * 10) / 10,
        y: Math.round(y * 10) / 10,
        ghost: isGhost || undefined
      });

      if (idx > 0) {
        var p = Math.floor((idx - 1) / 2);
        if (vals[p] != null) {
          edges.push({ from: "n" + p, to: "n" + idx, ghost: isGhost || undefined });
        }
      }
    }
  });

  return { nodes: nodes, edges: edges };
}

window.DEMO = {
  layout: "network",

  meta: {
    eyebrow: "力扣 · 101",
    difficulty: "简单",
    title: "对称二叉树",
    ledeHtml:
      "对称不是「左右两棵子树长得一样」，而是<b>互为镜像</b>：左子树的左孩子配右子树的右孩子，" +
      "左子树的右孩子配右子树的左孩子。所以比较函数要同时拿着两个节点走，" +
      "而不是分别遍历两棵树。",
    ledeShort: "左右子树互为镜像：外侧配外侧，内侧配内侧。",
    facts: ["递归", "镜像比较", "一次遍历"],
    tones: { a: "#008024" },
    legend: [
      { tone: "a", text: "已对上" },
      { ring: true, text: "本步比较" },
      { tone: "muted", text: "不匹配 / 空位" }
    ],
    code: {
      title: "C++ · 递归镜像",
      left: "时间复杂度 O(n)",
      right: "空间复杂度 O(h)"
    }
  },

  rows: [{ label: "tree", tone: "muted" }],

  code: [
    "bool isSymmetric(TreeNode* root) {",                    // 1
    "    return !root || check(root->left, root->right);",   // 2
    "}",                                                     // 3
    "bool check(TreeNode* left, TreeNode* right) {",         // 4
    "    if (!left && !right) return true;",                 // 5
    "    if (!left || !right) return false;",                // 6
    "    return left->val == right->val",                    // 7
    "        && check(left->left, right->right)",            // 8
    "        && check(left->right, right->left);",           // 9
    "}"                                                      // 10
  ],

  examples: (function () {
    var e1 = layoutTree([1, 2, 2, 3, 4, 4, 3]);
    var e2 = layoutTree([1, 2, 2, null, 3, null, 3], [3]);
    var e3 = layoutTree([1]);
    return [
      {
        label: "示例 1",
        input: { tree: [1, 2, 2, 3, 4, 4, 3] },
        nodes: e1.nodes,
        edges: e1.edges
      },
      {
        label: "示例 2",
        input: { tree: [1, 2, 2, null, 3, null, 3] },
        nodes: e2.nodes,
        edges: e2.edges
      },
      {
        label: "边界 · 单节点",
        input: { tree: [1] },
        nodes: e3.nodes,
        edges: e3.edges
      }
    ];
  })(),

  build: function (input, ex) {
    var t = input.tree;
    var n = t.length;
    var steps = [];

    var settled = [];   // 已判定相等的节点 id
    var rejected = [];  // 判定失败的节点 id
    var compared = 0;
    var result = "未定";

    // 空位只有被画出来（ghost）时才能高亮，先把这份名单记下来
    var drawn = {};
    ((ex && ex.nodes) || []).forEach(function (nd) { drawn[nd.id] = true; });

    function missing(i) { return i >= n || t[i] == null; }
    function leftOf(i) { return 2 * i + 1; }
    function rightOf(i) { return 2 * i + 2; }
    function idOf(i) { return "n" + i; }

    function push(o) {
      steps.push({
        rows: [{ tag: compared ? "已比较 " + compared + " 对" : "开始比较" }],
        vars: [
          { k: "比较", v: compared },
          { k: "结果", v: result }
        ],
        branch: o.branch,
        code: o.code,
        text: o.text,
        ref: o.ref,
        active: o.active || [],
        settled: settled.slice(),
        rejected: rejected.slice(),
        sr: o.sr || ("比较 " + compared + " 对，结果 " + result + "。" + o.text)
      });
    }

    /* ---------------------------------------------------- 首帧：讲输入 */
    push({
      branch: "初始化：从根的两个孩子开始",
      code: [2],
      text: n <= 1
        ? "初始：树里只有一个节点，它的左右都为空，天然对称。"
        : "初始：从根 " + t[0] + " 出发，先比它的左孩子 " + t[1] + " 与右孩子 " + t[2] + "。",
      ref: "第 2 行",
      active: [idOf(0)],
      sr: "层序数组 " + JSON.stringify(t)
    });

    /* ------------------------------------------------------ 递归比较 */
    function cmp(li, ri) {
      compared++;

      var ml = missing(li);
      var mr = missing(ri);

      // 两边都空：这一对成立，但不值得单开一帧，由上层合并成一句「都没有孩子」
      if (ml && mr) return true;

      // 一边空：镜像断在这里
      if (ml || mr) {
        var present = ml ? ri : li;
        var absent = ml ? li : ri;
        rejected.push(idOf(present));
        result = "false";
        var act = [idOf(present)];
        if (drawn[idOf(absent)]) act.push(idOf(absent));
        push({
          branch: "一边空一边有值 → 不对称",
          code: [6],
          text: (ml ? "左边" : "右边") + "是空，" + (ml ? "右边" : "左边") +
            "是节点 " + t[present] + "，这一对配不上，直接返回 false。",
          ref: "第 6 行",
          active: act
        });
        return false;
      }

      // 值不等
      if (t[li] !== t[ri]) {
        rejected.push(idOf(li), idOf(ri));
        result = "false";
        push({
          branch: "值不等 → 不对称",
          code: [7],
          text: "左边是 " + t[li] + "，右边是 " + t[ri] + "，值对不上，返回 false。",
          ref: "第 7 行",
          active: [idOf(li), idOf(ri)]
        });
        return false;
      }

      // 值相等：这一对成立，继续往里
      push({
        branch: "值相等 → 往里比",
        code: [7, 8],
        text: t[li] + " 与 " + t[ri] + " 相等。接着比外侧：左.左 ↔ 右.右。",
        ref: "第 7–8 行",
        active: [idOf(li), idOf(ri)]
      });
      settled.push(idOf(li), idOf(ri));

      var outerL = leftOf(li);
      var outerR = rightOf(ri);
      var innerL = rightOf(li);
      var innerR = leftOf(ri);

      // 四个孩子全空：这条支路到底了
      if (missing(outerL) && missing(outerR) && missing(innerL) && missing(innerR)) {
        push({
          branch: "两边孩子都空 → 这条支路成立",
          code: [5],
          text: t[li] + " 与 " + t[ri] + " 都没有孩子，镜像到这里就结束了，成立。",
          ref: "第 5 行",
          active: []
        });
        return true;
      }

      if (!cmp(outerL, outerR)) return false;
      return cmp(innerL, innerR);
    }

    /* ------------------------------------------------- 跑完，给结论 */
    var ok;
    if (n <= 1) {
      ok = true;
    } else if (t[0] == null) {
      ok = true;
    } else {
      ok = cmp(1, 2);
    }
    result = ok ? "true" : "false";
    // 只有 root 一个节点时没有任何比较，把根标成「已对上」，画面才不是一片静止
    if (ok && !settled.length && n >= 1 && t[0] != null) settled.push(idOf(0));

    push({
      branch: ok ? "结束：对称" : "结束：不对称",
      code: [2],
      text: ok
        ? "所有镜像位置都对上了，一共比了 " + compared + " 对，返回 true。"
        : "有一条镜像位置配不上，整体返回 false；短路之后剩下的支路不再比较。",
      ref: "第 2 行",
      active: []
    });

    return steps;
  }
};
