/* ============================================================================
   demo.js — 算法演示页引擎（所有题目共用；题目只提供 window.DEMO 数据）
   ----------------------------------------------------------------------------
   题目契约（写在题目文件夹的 problem.js 里）：
     window.DEMO = {
       meta: {
         eyebrow, title, ledeHtml, ledeShort, facts: [],
         tones: { a: "#008024", b: "#005BDA" },          // 语义色调（浅色档），可覆盖
         legend: [{ tone: "a", text: "值来自 nums1" }, { ring: true, text: "本步写入" }],
         code: { title, note, hint, left, right }        // 代码卡标题/说明/底部信息
       },
       markers: { p1: { tone: "a" }, p2: { tone: "b" }, tail: { tone: "muted" } },
       rows:    [{ label: "nums1", tone: "a" }, { label: "nums2", tone: "b" }],
       code:    ["...每行源码..."],
       examples:[{ label: "示例 1", input: {...任意} }],
       build(input) -> steps[]
     }

   一步（engine 只认这个结构，题目想画什么就填什么）：
     {
       rows: [{ cells: [{ v, tone?, placeholder? }], up: ["p1"], down: ["tail"], tag: "m = 3" }],
       vars: [{ k: "p1", v: 2 }],
       branch: "取 nums2（≥）",
       code: [14, 16],                 // 高亮的源码行号（1 起）
       text: "这一步发生了什么",
       ref: "第 14 行",
       move: { from: { row: 1, i: 2 }, to: { row: 0, i: 5 }, value: 6, tone: "b" }  // 可选搬运动效
     }
   ========================================================================= */
(function () {
  "use strict";

  var SPEC = window.DEMO;
  if (!SPEC) {
    document.body.textContent = "缺少 problem.js（window.DEMO 未定义）";
    return;
  }

  /* ---------------------------------------------------------------- 工具 */
  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  var REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var HAS_MOTION = !!(window.Motion && typeof window.Motion.animate === "function");
  var EASE = "cubic-bezier(0.22, 0.9, 0.3, 1)";
  var EASE_ARR = [0.22, 0.9, 0.3, 1];

  function settle(anim, ms) {
    var done = anim && anim.finished ? anim.finished : anim;
    return Promise.race([
      Promise.resolve(done).then(function () {}, function () {}),
      new Promise(function (r) { setTimeout(r, ms + 260); })
    ]);
  }

  /* ------------------------------------------------------- 一、搭静态骨架 */
  var meta = SPEC.meta || {};
  var rowsSpec = SPEC.rows || [];
  var LAYOUT = SPEC.layout || "sequence";
  var IS_BARS = LAYOUT === "bars";
  var IS_NET = LAYOUT === "network";
  var SVG_NS = "http://www.w3.org/2000/svg";

  function applyTones() {
    var t = meta.tones || {};
    if (t.a) document.documentElement.style.setProperty("--tone-a", t.a);
    if (t.b) document.documentElement.style.setProperty("--tone-b", t.b);
  }

  function buildHeader() {
    var head = el("header", "masthead");
    head.appendChild(el("p", "eyebrow", meta.eyebrow || ""));

    var h1 = el("h1", null, meta.title || "");
    head.appendChild(h1);

    if (meta.ledeHtml) {
      var lede = el("p", "lede");
      lede.innerHTML = meta.ledeHtml;
      head.appendChild(lede);
      head.appendChild(el("p", "lede lede-short", meta.ledeShort || ""));
    } else if (meta.ledeShort) {
      head.appendChild(el("p", "lede", meta.ledeShort));
    }

    if (meta.difficulty || (meta.facts && meta.facts.length)) {
      var ul = el("ul", "facts");
      if (meta.difficulty) {
        var diff = el("li", "chip-diff", meta.difficulty);
        diff.setAttribute("data-diff", meta.difficulty);
        ul.appendChild(diff);
      }
      (meta.facts || []).forEach(function (f) { ul.appendChild(el("li", null, f)); });
      head.appendChild(ul);
    }
    return head;
  }

  function buildLegend() {
    var ul = el("ul", "legend");
    (meta.legend || []).forEach(function (item) {
      var li = el("li");
      var sw = el("span", "sw" + (item.ring ? " sw-ring" : "") + (item.water ? " sw-water" : ""));
      if (item.tone) sw.setAttribute("data-tone", item.tone);
      li.appendChild(sw);
      li.appendChild(document.createTextNode(item.text));
      ul.appendChild(li);
    });
    return ul;
  }

  function buildStage() {
    var stage = el("section", "panel stage");
    stage.setAttribute("aria-label", "算法演示舞台");

    // 顶栏：示例切换 + 步数
    var head = el("div", "stage-head");
    var seg = el("div", "seg seg-tabs");
    seg.setAttribute("role", "group");
    seg.setAttribute("aria-label", "选择示例");
    SPEC.examples.forEach(function (ex, i) {
      var b = el("button", "seg-btn" + (i === 0 ? " is-active" : ""), ex.label || "示例 " + (i + 1));
      b.type = "button";
      b.setAttribute("data-ex", String(i));
      b.setAttribute("aria-pressed", String(i === 0));
      b.addEventListener("click", function () { mountExample(i); });
      seg.appendChild(b);
    });
    head.appendChild(seg);

    var count = el("p", "step-count");
    count.innerHTML = "<b id=\"stepNow\">0</b> / <span id=\"stepTotal\">0</span> 步";
    head.appendChild(count);
    stage.appendChild(head);

    // 图例
    stage.appendChild(buildLegend());

    // 数组区（左：格子，右：读数）
    var arrays = el("div", "arrays");
    var main = el("div", "arrays-main");

    rowsSpec.forEach(function (r, ri) {
      var block = el("div", "array-block");
      var label = el("div", "array-label");
      var tag = el("span", null, r.label);
      tag.setAttribute("data-tone", r.tone || "muted");
      label.appendChild(tag);
      var dim = el("span", "dim");
      dim.id = "tag" + ri;
      label.appendChild(dim);
      block.appendChild(label);

      var wrap = el("div", "cellwrap");
      var cells = el("div", "cells");
      cells.id = "rowN" + (ri + 1);
      cells.setAttribute("data-row-index", String(ri));
      cells.setAttribute("role", "list");
      cells.setAttribute("aria-label", r.label + " 的各格");
      wrap.appendChild(cells);

      var note = el("p", "row-empty", r.emptyNote || "");
      note.id = "rowEmpty" + ri;
      note.hidden = true;
      wrap.appendChild(note);

      block.appendChild(wrap);
      main.appendChild(block);
    });
    arrays.appendChild(main);

    var readouts = el("div", "readouts");
    readouts.setAttribute("aria-label", "当前变量");
    var grid = el("div", "readouts-grid");
    grid.id = "varGrid";
    readouts.appendChild(grid);
    arrays.appendChild(readouts);
    stage.appendChild(arrays);

    // 解说卡：这一步叫什么 + 正文 + 行号引用。
    // 全页最该被读到的一段话，所以单独成卡（墨色左侧竖线），不再是一行灰字。
    var narr = el("div", "narration");
    narr.setAttribute("aria-live", "polite");

    var head = el("p", "narr-head");
    var kicker = el("span", "narr-kicker", "这一步");
    var branchValue = el("b", null, "");
    branchValue.id = "branchValue";
    kicker.appendChild(branchValue);
    var ref = el("span", "narr-ref");
    ref.id = "narrRef";
    head.appendChild(kicker);
    head.appendChild(ref);

    var text = el("p", "narr-text");
    text.id = "narrText";

    narr.appendChild(head);
    narr.appendChild(text);
    stage.appendChild(narr);

    var sr = el("p", "sr-only");
    sr.id = "srSummary";
    sr.setAttribute("aria-live", "polite");
    stage.appendChild(sr);

    // 进度
    var prog = el("div", "progress");
    prog.id = "progress";
    prog.setAttribute("role", "progressbar");
    prog.setAttribute("aria-label", "演示进度");
    prog.setAttribute("aria-valuemin", "0");
    prog.setAttribute("aria-valuemax", "0");
    prog.setAttribute("aria-valuenow", "0");
    var bar = el("div", "bar");
    bar.id = "bar";
    prog.appendChild(bar);
    stage.appendChild(prog);

    // 控制条
    var controls = el("div", "controls");
    var transport = el("div", "transport");
    transport.setAttribute("role", "group");
    transport.setAttribute("aria-label", "播放控制");

    transport.appendChild(iconBtn("btnPrev", "上一步", '<path d="M10.5 3.2v9.6a.6.6 0 0 1-.94.5L3.6 8.5a.6.6 0 0 1 0-1l5.96-4.8a.6.6 0 0 1 .94.5z"/>', true));

    var play = el("button", "btn btn-primary");
    play.type = "button";
    play.id = "btnPlay";
    var playIcon = el("span");
    playIcon.id = "playIcon";
    playIcon.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3.3v9.4a.6.6 0 0 0 .93.5l7.1-4.7a.6.6 0 0 0 0-1L5.93 2.8A.6.6 0 0 0 5 3.3z"/></svg>';
    play.appendChild(playIcon);
    var playText = el("span", null, "播放");
    playText.id = "playText";
    play.appendChild(playText);
    transport.appendChild(play);

    transport.appendChild(iconBtn("btnNext", "下一步", '<path d="M5.5 12.8V3.2a.6.6 0 0 1 .94-.5l5.96 4.8a.6.6 0 0 1 0 1l-5.96 4.8a.6.6 0 0 1-.94-.5z"/>', false));
    controls.appendChild(transport);

    var aux = el("div", "transport-aux");
    var spacer = el("span", "spacer");
    aux.appendChild(spacer);
    var reset = el("button", "btn", "重置");
    reset.type = "button";
    reset.id = "btnReset";
    aux.appendChild(reset);

    var speed = el("div", "seg seg-pill");
    speed.setAttribute("role", "group");
    speed.setAttribute("aria-label", "播放速度");
    [0.5, 1, 2].forEach(function (v) {
      var b = el("button", "seg-btn" + (v === 1 ? " is-active" : ""), v + "×");
      b.type = "button";
      b.setAttribute("data-speed", String(v));
      b.setAttribute("aria-pressed", String(v === 1));
      speed.appendChild(b);
    });
    aux.appendChild(speed);
    controls.appendChild(aux);
    stage.appendChild(controls);

    return stage;
  }

  function iconBtn(id, label, path, iconFirst) {
    var b = el("button", "btn");
    b.type = "button";
    b.id = id;
    var svg = document.createElement("span");
    svg.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true">' + path + "</svg>";
    svg.firstChild.classList.add("ico");
    if (iconFirst) {
      b.appendChild(svg.firstChild);
      b.appendChild(document.createTextNode(label));
    } else {
      b.appendChild(document.createTextNode(label));
      b.appendChild(svg.firstChild);
    }
    return b;
  }

  function buildCodeCard() {
    var cm = meta.code || {};
    var panel = el("section", "panel codepanel");
    panel.setAttribute("aria-label", "参考代码");

    var head = el("div", "code-head");
    head.appendChild(el("span", null, cm.title || "参考代码"));
    if (cm.note) head.appendChild(el("span", null, cm.note));
    if (cm.hint) head.appendChild(el("span", "code-note", cm.hint));
    panel.appendChild(head);

    var pre = el("pre", "code");
    pre.id = "codeBody";
    (SPEC.code || []).forEach(function (line, i) {
      var row = el("span", "cl");
      var ln = el("span", "ln", String(i + 1));
      var txt = el("span");
      txt.innerHTML = String(line)
        .replace(/\b(void|int|long|bool|char|double|float|while|for|if|else|return|vector|class|public|struct|auto|string)\b/g, '<span class="kw">$1</span>')
        .replace(/(?<![\w.])-?\d+(?![\w])/g, '<span class="num">$&</span>');
      row.appendChild(ln);
      row.appendChild(txt);
      pre.appendChild(row);
    });
    panel.appendChild(pre);

    if (cm.left || cm.right) {
      var metaBar = el("div", "code-meta");
      metaBar.appendChild(el("span", null, cm.left || ""));
      metaBar.appendChild(el("span", null, cm.right || ""));
      panel.appendChild(metaBar);
    }
    return panel;
  }

  function buildFooter() {
    var foot = el("footer", "foot");
    var keys = el("p", "keys");
    [["←", "上一步"], ["→", "下一步"], ["空格", "播放 / 暂停"], ["R", "重置"]].forEach(function (k) {
      var item = el("span", "key-item");
      item.appendChild(el("kbd", null, k[0]));
      item.appendChild(document.createTextNode(k[1]));
      keys.appendChild(item);
    });
    foot.appendChild(keys);
    foot.appendChild(el("p", "keys-touch", "点「播放」自动走完，或点「下一步」逐格看"));
    return foot;
  }

  function mountShell() {
    var wrap = el("div", "wrap layout-" + LAYOUT);
    wrap.appendChild(buildHeader());

    var layout = el("div", "layout");
    layout.appendChild(buildStage());

    var side = el("aside", "side");
    side.appendChild(buildCodeCard());
    layout.appendChild(side);
    wrap.appendChild(layout);
    wrap.appendChild(buildFooter());
    document.body.appendChild(wrap);
  }

  /* ----------------------------------------------------- 二、渲染与动效 */
  var state = {
    exIndex: 0,
    k: 0,
    steps: [],
    rowCells: [],   // [ [cell...], [cell...] ]
    chart: null,    // bars 布局的柱子表
    net: null,      // network 布局的节点 / 边表
    netNodes: [],
    netEdges: [],
    markers: [],    // { name, row, el }
    playing: false,
    busy: false,
    queue: 0,
    speed: 1,
    timer: 0
  };

  function cellNode() {
    var c = el("div", "cell");
    c.setAttribute("role", "listitem");
    c.appendChild(el("span", "val"));
    return c;
  }

  function markerNodes() {
    var defs = SPEC.markers || {};
    var used = {};
    state.steps.forEach(function (st) {
      (st.rows || []).forEach(function (r, ri) {
        (r.up || []).forEach(function (n) { used[ri + "|up|" + n] = { name: n, row: ri, slot: "top" }; });
        (r.down || []).forEach(function (n) { used[ri + "|down|" + n] = { name: n, row: ri, slot: "bottom" }; });
      });
    });
    return Object.keys(used).map(function (k) { return used[k]; });
  }

  /* ---- bars 布局：rows[0] 当柱高、rows[1] 当积水，画成 2D 柱状图 ---- */
  function buildChart(host, n, maxV) {
    var old = host.querySelector(".chart");
    if (old) old.remove();

    var blockEl = host.closest ? host.closest(".array-block") : null;
    var avail = (blockEl && blockEl.clientWidth) || 420;
    var gap = n > 9 ? 3 : 5;
    var colW = Math.floor((avail - gap * (n - 1)) / n);
    colW = Math.max(12, Math.min(46, colW));
    var innerH = colW <= 24 ? 86 : colW <= 32 ? 106 : 128;
    var w = n * colW + (n - 1) * gap;
    var h = innerH + 18;

    var box = el("div", "chart");
    box.setAttribute("role", "img");

    var svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("class", "chart-svg");
    svg.setAttribute("viewBox", "0 0 " + w + " " + h);
    svg.setAttribute("width", String(w));
    svg.setAttribute("height", String(h));
    svg.setAttribute("aria-hidden", "true");

    var baseline = document.createElementNS(SVG_NS, "line");
    baseline.setAttribute("class", "baseline");
    baseline.setAttribute("x1", "0");
    baseline.setAttribute("x2", String(w));
    baseline.setAttribute("y1", String(innerH + 0.5));
    baseline.setAttribute("y2", String(innerH + 0.5));
    svg.appendChild(baseline);

    function x(i) { return i * (colW + gap); }

    var chart = {
      n: n, maxV: maxV, colW: colW, gap: gap, innerH: innerH, width: w,
      box: box, x: x, bars: [], waters: [], wvals: [], hvals: [], anchors: []
    };

    for (var i = 0; i < n; i++) {
      var bar = document.createElementNS(SVG_NS, "rect");
      bar.setAttribute("class", "bar");
      bar.setAttribute("rx", "3");
      svg.appendChild(bar);
      chart.bars.push(bar);

      var water = document.createElementNS(SVG_NS, "rect");
      water.setAttribute("class", "water");
      water.setAttribute("rx", "2");
      water.setAttribute("visibility", "hidden");
      svg.appendChild(water);
      chart.waters.push(water);

      var wText = document.createElementNS(SVG_NS, "text");
      wText.setAttribute("class", "w-val");
      wText.setAttribute("text-anchor", "middle");
      wText.setAttribute("visibility", "hidden");
      svg.appendChild(wText);
      chart.wvals.push(wText);

      var hText = document.createElementNS(SVG_NS, "text");
      hText.setAttribute("class", "h-val");
      hText.setAttribute("text-anchor", "middle");
      svg.appendChild(hText);
      chart.hvals.push(hText);

      var idx = document.createElementNS(SVG_NS, "text");
      idx.setAttribute("class", "idx");
      idx.setAttribute("text-anchor", "middle");
      idx.setAttribute("x", String(x(i) + colW / 2));
      idx.setAttribute("y", String(innerH + 14));
      idx.textContent = String(i);
      svg.appendChild(idx);

      chart.anchors.push({ offsetLeft: x(i), offsetWidth: colW });
    }

    box.appendChild(svg);
    host.appendChild(box);
    return chart;
  }

  function renderChart(step) {
    var ch = state.chart;
    if (!ch) return;
    var heights = (step.rows && step.rows[0] && step.rows[0].cells) || [];
    var waters = (step.rows && step.rows[1] && step.rows[1].cells) || [];
    var scale = ch.innerH / (ch.maxV || 1);
    var summary = [];

    for (var i = 0; i < ch.n; i++) {
      var c = heights[i] || { v: 0 };
      var v = Number(c.v) || 0;
      var barH = Math.max(1, Math.round(v * scale));
      var top = ch.innerH - barH;
      var bar = ch.bars[i];
      bar.setAttribute("x", String(ch.x(i)));
      bar.setAttribute("y", String(top));
      bar.setAttribute("width", String(ch.colW));
      bar.setAttribute("height", String(barH));
      if (c.tone) bar.setAttribute("data-tone", c.tone);
      else bar.removeAttribute("data-tone");

      var wc = waters[i];
      var wv = wc && !wc.placeholder && isFinite(Number(wc.v)) ? Number(wc.v) : 0;
      var water = ch.waters[i];
      var wText = ch.wvals[i];
      var waterTop = top;

      if (wv > 0) {
        var wh = Math.max(3, Math.round(wv * scale));
        waterTop = top - wh;
        water.setAttribute("x", String(ch.x(i)));
        water.setAttribute("y", String(waterTop));
        water.setAttribute("width", String(ch.colW));
        water.setAttribute("height", String(wh));
        water.setAttribute("visibility", "visible");
        if (wh >= 11) {
          wText.setAttribute("x", String(ch.x(i) + ch.colW / 2));
          wText.setAttribute("y", String(waterTop + wh / 2 + 3.5));
          wText.textContent = String(wv);
          wText.setAttribute("visibility", "visible");
        } else {
          wText.setAttribute("visibility", "hidden");
        }
      } else {
        water.setAttribute("visibility", "hidden");
        wText.setAttribute("visibility", "hidden");
      }

      var hText = ch.hvals[i];
      hText.setAttribute("x", String(ch.x(i) + ch.colW / 2));
      hText.setAttribute("y", String(waterTop - 5));
      hText.textContent = String(v);
      if (c.tone) hText.setAttribute("data-tone", c.tone);
      else hText.removeAttribute("data-tone");

      summary.push(v);
    }

    ch.box.setAttribute("aria-label", "柱状图，各列高度：" + summary.join("、"));
  }

  /* ---- network 布局：nodes / edges 画成 SVG 节点图（树、图、Trie） ----
     坐标用百分比（x/y 都是 0–100），这里换算成像素；viewBox 直接等于像素宽高，
     所以半径和字号不随容器缩放变化，手机上也能读。 */
  function buildNet(host, nodes, edges) {
    var old = host.querySelector(".net");
    if (old) old.remove();

    nodes = nodes || [];
    edges = edges || [];
    var blockEl = host.closest ? host.closest(".array-block") : null;
    var avail = (blockEl && blockEl.clientWidth) || 460;

    var W = Math.max(250, Math.round(avail));
    var R = W < 340 ? 16 : W < 460 ? 19 : 22;
    var pad = R + 12;

    // 纵向只给树本身留高度：按节点实际用到的 y 范围重映射，避免图下方一大片空白
    var yMin = 100;
    var yMax = 0;
    nodes.forEach(function (nd) {
      var y = Number(nd.y);
      if (!isFinite(y)) return;
      if (y < yMin) yMin = y;
      if (y > yMax) yMax = y;
    });
    if (!nodes.length) { yMin = 0; yMax = 100; }
    var spanY = yMax - yMin;
    var treeH = Math.round(Math.min(300, Math.max(120, W * 0.42)));
    var H = Math.round(2 * pad + (spanY > 0 ? treeH : R * 2));

    var box = el("div", "net");
    box.setAttribute("role", "img");

    var svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("class", "net-svg");
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.setAttribute("width", String(W));
    svg.setAttribute("height", String(H));
    svg.setAttribute("aria-hidden", "true");

    var pos = {};
    nodes.forEach(function (nd) {
      var yn = spanY > 0 ? (Number(nd.y) - yMin) / spanY : 0.5;
      pos[nd.id] = {
        cx: pad + ((Number(nd.x) || 0) / 100) * (W - pad * 2),
        cy: pad + yn * (H - pad * 2)
      };
    });

    // 边先画，压在所有节点下面
    var edgeList = [];
    edges.forEach(function (e) {
      var a = pos[e.from];
      var b = pos[e.to];
      if (!a || !b) return;
      var ln = document.createElementNS(SVG_NS, "line");
      ln.setAttribute("class", "net-edge" + (e.ghost ? " is-ghost" : ""));
      ln.setAttribute("x1", String(a.cx));
      ln.setAttribute("y1", String(a.cy));
      ln.setAttribute("x2", String(b.cx));
      ln.setAttribute("y2", String(b.cy));
      svg.appendChild(ln);
      edgeList.push({ el: ln, from: e.from, to: e.to, ghost: !!e.ghost });
    });

    var byId = {};
    var ghostIds = {};
    nodes.forEach(function (nd) {
      var p = pos[nd.id];
      if (!p) return;
      if (nd.ghost) ghostIds[nd.id] = true;

      var g = document.createElementNS(SVG_NS, "g");
      g.setAttribute("class", "net-node" + (nd.ghost ? " is-ghost" : ""));

      var c = document.createElementNS(SVG_NS, "circle");
      c.setAttribute("cx", String(p.cx));
      c.setAttribute("cy", String(p.cy));
      c.setAttribute("r", String(R));
      g.appendChild(c);

      var t = document.createElementNS(SVG_NS, "text");
      t.setAttribute("class", "net-label");
      t.setAttribute("x", String(p.cx));
      t.setAttribute("y", String(p.cy));
      t.setAttribute("text-anchor", "middle");
      t.setAttribute("dominant-baseline", "central");
      t.setAttribute("font-size", String(Math.round(R * 0.86)));
      t.textContent = String(nd.label == null ? "" : nd.label);
      g.appendChild(t);

      if (nd.sub) {
        var s = document.createElementNS(SVG_NS, "text");
        s.setAttribute("class", "net-sub");
        s.setAttribute("x", String(p.cx));
        s.setAttribute("y", String(p.cy + R + 13));
        s.setAttribute("text-anchor", "middle");
        s.textContent = String(nd.sub);
        g.appendChild(s);
      }

      svg.appendChild(g);
      byId[nd.id] = { g: g, circle: c, text: t, cx: p.cx, cy: p.cy, r: R };
    });

    box.appendChild(svg);
    host.appendChild(box);
    return { box: box, svg: svg, byId: byId, edges: edgeList, ghostIds: ghostIds, W: W, H: H };
  }

  function renderNet(step) {
    var net = state.net;
    if (!net) return;

    var active = step.active || [];
    var settled = step.settled || [];
    var rejected = step.rejected || [];
    var values = step.values || {};
    var labels = [];

    Object.keys(net.byId).forEach(function (id) {
      var n = net.byId[id];
      var cls = "net-node";
      if (net.ghostIds[id]) cls += " is-ghost";
      if (rejected.indexOf(id) !== -1) cls += " is-rejected";
      else if (active.indexOf(id) !== -1) cls += " is-active";
      else if (settled.indexOf(id) !== -1) cls += " is-settled";
      n.g.setAttribute("class", cls);

      if (Object.prototype.hasOwnProperty.call(values, id)) {
        n.text.textContent = String(values[id]);
      }
      labels.push(n.text.textContent);
    });

    function hitEdge(arr, a, b) {
      if (!arr) return false;
      return arr.indexOf(a + "-" + b) !== -1 || arr.indexOf(b + "-" + a) !== -1;
    }

    net.edges.forEach(function (e) {
      var cls = "net-edge" + (e.ghost ? " is-ghost" : "");
      if (hitEdge(step.rejectedEdges, e.from, e.to)) cls += " is-rejected";
      else if (hitEdge(step.activeEdges, e.from, e.to)) cls += " is-active";
      else if (hitEdge(step.settledEdges, e.from, e.to)) cls += " is-settled";
      e.el.setAttribute("class", cls);
    });

    net.box.setAttribute("aria-label", "节点图，节点值：" + labels.join("、"));
  }

  function mountExample(i) {
    stopPlay();
    state.exIndex = i;
    state.k = 0;
    state.busy = false;
    state.queue = 0;

    var ex = SPEC.examples[i];
    state.steps = SPEC.build(ex.input, ex);

    // 清空旧行
    rowsSpec.forEach(function (r, ri) {
      var cells = $("rowN" + (ri + 1));
      cells.textContent = "";
      var wrap = cells.parentNode;
      Array.prototype.slice.call(wrap.querySelectorAll(".marker")).forEach(function (m) { m.remove(); });
    });
    state.rowCells = [];
    state.markers = [];

    var first = state.steps[0];
    var counts = rowsSpec.map(function () { return 0; });
    state.steps.forEach(function (st) {
      (st.rows || []).forEach(function (r, ri) { counts[ri] = Math.max(counts[ri], (r.cells || []).length); });
    });

    rowsSpec.forEach(function (r, ri) {
      var cells = $("rowN" + (ri + 1));
      var list = [];
      for (var c = 0; c < counts[ri]; c++) {
        var n = cellNode();
        cells.appendChild(n);
        list.push(n);
      }
      state.rowCells.push(list);

      var empty = $("rowEmpty" + ri);
      if (r.emptyNote) empty.hidden = !(first && first.rows[ri] && first.rows[ri].cells.length === 0);
      cells.style.display = counts[ri] ? "" : "none";
    });

    // bars 布局：格子只当数据源，舞台上换成 2D 柱状图
    if (IS_BARS) {
      var chartHost = $("rowN1").parentNode;
      $("rowN1").style.display = "none";
      for (var extra = 1; extra < rowsSpec.length; extra++) {
        var rowEl = $("rowN" + (extra + 1));
        var holder = rowEl && rowEl.closest ? rowEl.closest(".array-block") : null;
        if (holder) holder.hidden = true;
      }
      var maxV = 1;
      state.steps.forEach(function (st) {
        var cs = (st.rows && st.rows[0] && st.rows[0].cells) || [];
        cs.forEach(function (c) { if (c && Number(c.v) > maxV) maxV = Number(c.v); });
      });
      state.chart = buildChart(chartHost, counts[0] || 1, maxV);
      state.rowCells[0] = state.chart.anchors;
      chartHost.classList.add("has-chart");
    } else {
      state.chart = null;
    }

    // network 布局：格子收起来，舞台上换成 SVG 节点图（行标签与 tag 保留）
    if (IS_NET) {
      var netHost = $("rowN1").parentNode;
      $("rowN1").style.display = "none";
      for (var nx = 1; nx < rowsSpec.length; nx++) {
        var nxRow = $("rowN" + (nx + 1));
        var nxHolder = nxRow && nxRow.closest ? nxRow.closest(".array-block") : null;
        if (nxHolder) nxHolder.hidden = true;
      }
      netHost.classList.add("has-net");
      // 树的形状可能随示例变化：示例对象可以自带 nodes / edges，没有就用顶层那份
      state.netNodes = (ex && ex.nodes) || SPEC.nodes || [];
      state.netEdges = (ex && ex.edges) || SPEC.edges || [];
      state.net = buildNet(netHost, state.netNodes, state.netEdges);
    } else {
      state.net = null;
      state.netNodes = [];
      state.netEdges = [];
    }

    // 指针徽标
    markerNodes().forEach(function (def) {
      var wrap = $("rowN" + (def.row + 1)).parentNode;
      var tone = (SPEC.markers[def.name] || {}).tone || "muted";
      var m = el("div", "marker marker-" + def.slot, def.name);
      m.setAttribute("data-tone", tone);
      if (def.slot === "top") wrap.insertBefore(m, wrap.firstChild);
      else wrap.appendChild(m);
      state.markers.push({ name: def.name, row: def.row, el: m });
    });

    $("stepTotal").textContent = String(state.steps.length - 1);

    Array.prototype.forEach.call(document.querySelectorAll(".seg-btn[data-ex]"), function (b) {
      var on = Number(b.getAttribute("data-ex")) === i;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-pressed", String(on));
    });

    render(0);
  }

  function placeMarker(marker, cells, idx) {
    var cell = idx >= 0 && idx < cells.length ? cells[idx] : null;
    marker.el.style.visibility = cell ? "visible" : "hidden";
    if (!cell) return;
    var mw = marker.el.offsetWidth || 34;
    var x = cell.offsetLeft + (cell.offsetWidth - mw) / 2;
    slide(marker.el, x);
  }

  function slide(node, x) {
    var from = typeof node.__tx === "number" ? node.__tx : x;
    node.__tx = x;
    if (REDUCED || from === x) { node.style.transform = "translateX(" + x + "px)"; return; }
    if (HAS_MOTION) {
      try { settle(window.Motion.animate(node, { x: [from, x] }, { duration: 0.24, ease: EASE_ARR }), 240); return; } catch (e) { /* fallthrough */ }
    }
    node.animate(
      [{ transform: "translateX(" + from + "px)" }, { transform: "translateX(" + x + "px)" }],
      { duration: 240, easing: EASE, fill: "forwards" }
    );
  }

  function render(k) {
    var step = state.steps[k];
    if (!step) return;
    state.k = k;

    if (IS_BARS) {
      renderChart(step);
      var t0 = (step.rows && step.rows[0] && step.rows[0].tag) || "";
      var t1 = (step.rows && step.rows[1] && step.rows[1].tag) || "";
      var chartTag = $("tag0");
      if (chartTag) chartTag.textContent = t0 + (t1 ? " · " + t1 : "");
    } else if (IS_NET) {
      renderNet(step);
      var netTag = $("tag0");
      if (netTag) netTag.textContent = (step.rows && step.rows[0] && step.rows[0].tag) || "";
    } else {
      (step.rows || []).forEach(function (r, ri) {
        var cells = state.rowCells[ri];
        (r.cells || []).forEach(function (c, ci) {
          var node = cells[ci];
          if (!node) return;
          node.className = "cell" + (c.tone ? " tone-" + c.tone : "") +
            (c.placeholder ? " is-empty" : "") + (c.consumed ? " is-consumed" : "");
          node.querySelector(".val").textContent = String(c.v);
        });
        var tagNode = $("tag" + ri);
        if (tagNode) tagNode.textContent = r.tag || "";
        var label = $("rowN" + (ri + 1)).parentNode.parentNode.querySelector(".array-label [data-tone]");
        if (label) label.setAttribute("data-tone", rowsSpec[ri].tone || "muted");
      });
    }

    state.markers.forEach(function (m) {
      var r = (step.rows || [])[m.row];
      if (!r) { m.el.style.visibility = "hidden"; return; }
      var idx = (r.up || []).indexOf(m.name);
      if (idx !== -1) { placeMarker(m, state.rowCells[m.row], r.upIdx ? r.upIdx[m.name] : -1); }
    });
    // 指针索引支持两种写法：row.up = ["p1"] + row.p = {p1: 2}，或 row.upIdx = {p1: 2}
    state.markers.forEach(function (m) {
      var r = (step.rows || [])[m.row];
      if (!r) return;
      var idx = -1;
      if (r.p && typeof r.p[m.name] === "number") idx = r.p[m.name];
      else if (r.upIdx && typeof r.upIdx[m.name] === "number") idx = r.upIdx[m.name];
      else if (r.downIdx && typeof r.downIdx[m.name] === "number") idx = r.downIdx[m.name];
      placeMarker(m, state.rowCells[m.row], idx);
    });

    // 读数：变了的整格亮起来（墨色双框），并在数值后面标出「变了多少」
    var grid = $("varGrid");
    grid.textContent = "";
    var prevVars = {};
    var prevStep = state.steps[k - 1];
    ((prevStep && prevStep.vars) || []).forEach(function (v) { prevVars[v.k] = v.v; });
    (step.vars || []).forEach(function (v) {
      var box = el("div", "var");
      var hadPrev = Object.prototype.hasOwnProperty.call(prevVars, v.k);
      // 占位读数（值为「—」）不标注：它不是「变了」，是「这一步不用它」
      var changed = !!prevStep && !v.dim &&
        (!hadPrev || String(prevVars[v.k]) !== String(v.v));
      if (changed) box.classList.add("is-changed");

      box.appendChild(el("span", "var-k", v.k));
      var val = el("span", "var-v", String(v.v));
      if (v.dim) val.classList.add("is-negative");

      if (changed) {
        var from = hadPrev ? Number(prevVars[v.k]) : 0;
        var to = Number(v.v);
        var numeric = isFinite(from) && isFinite(to);
        if (numeric && to !== from) {
          var sign = to > from ? "+" : "−";
          val.appendChild(el("span", "var-delta", sign + Math.abs(to - from)));
        }
      }

      box.appendChild(val);
      grid.appendChild(box);
    });

    $("branchValue").textContent = step.branch || "";
    var active = step.code || [];
    Array.prototype.forEach.call($("codeBody").children, function (row, i) {
      row.classList.toggle("is-active", active.indexOf(i + 1) !== -1);
    });

    $("narrText").textContent = step.text || "";
    $("narrRef").textContent = step.ref || "";
    $("srSummary").textContent = step.sr || "";

    $("stepNow").textContent = String(k);
    var max = state.steps.length - 1;
    $("bar").style.width = (max ? (k / max) * 100 : 0) + "%";
    var prog = $("progress");
    prog.setAttribute("aria-valuemax", String(max));
    prog.setAttribute("aria-valuenow", String(k));

    $("btnPrev").disabled = k === 0;
    $("btnNext").disabled = k === max;
  }

  function flyGhost(fromEl, toEl, value, tone) {
    if (REDUCED || !fromEl || !toEl) return Promise.resolve();
    var a = fromEl.getBoundingClientRect();
    var b = toEl.getBoundingClientRect();
    var dx = b.left - a.left;
    var dy = b.top - a.top;
    var g = el("div", "ghost", String(value));
    g.setAttribute("data-tone", tone || "a");
    g.style.left = a.left + "px";
    g.style.top = a.top + "px";
    document.body.appendChild(g);

    var done;
    if (HAS_MOTION) {
      try {
        done = settle(window.Motion.animate(g, { x: [0, dx], y: [0, dy] }, { duration: 0.32, ease: EASE_ARR }), 320);
      } catch (e) { done = null; }
    }
    if (!done) {
      done = g.animate(
        [{ transform: "translate(0,0)" }, { transform: "translate(" + dx + "px," + dy + "px)" }],
        { duration: 320, easing: EASE, fill: "forwards" }
      ).finished.catch(function () {});
    }
    return done.then(function () { g.remove(); }, function () { g.remove(); });
  }

  function pulse(node) {
    if (REDUCED || !node) return;
    if (HAS_MOTION) {
      try { window.Motion.animate(node, { scale: [1, 1.08, 1] }, { duration: 0.3, ease: EASE_ARR }); return; } catch (e) { /* fallthrough */ }
    }
    node.animate(
      [{ transform: "scale(1)" }, { transform: "scale(1.08)" }, { transform: "scale(1)" }],
      { duration: 300, easing: EASE }
    );
  }

  /* ------------------------------------------------------- 三、步进控制 */
  function cellAt(ref) {
    if (!ref) return null;
    return (state.rowCells[ref.row] || [])[ref.i] || null;
  }

  async function advance(animated) {
    if (state.k >= state.steps.length - 1) return;
    if (state.busy) {
      if (!state.playing) state.queue = Math.min(state.queue + 1, 3);
      return;
    }
    state.busy = true;
    var nextK = state.k + 1;
    var step = state.steps[nextK];

    render(nextK);

    var from = cellAt(step.move && step.move.from);
    var to = cellAt(step.move && step.move.to);
    if (to) to.classList.add("is-target");
    if (animated && from && to && !REDUCED) {
      to.classList.add("is-flying");
      await flyGhost(from, to, step.move.value, step.move.tone);
      to.classList.remove("is-flying");
      pulse(to);
    }

    state.busy = false;
    if (state.queue > 0 && !state.playing) { state.queue--; advance(animated); }
  }

  function stepBack() {
    if (state.busy || state.k === 0) return;
    stopPlay();
    render(state.k - 1);
  }

  function startPlay() {
    if (state.k >= state.steps.length - 1) render(0);
    state.playing = true;
    $("playText").textContent = "暂停";
    $("playIcon").innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 3h3v10H4zM9 3h3v10H9z"/></svg>';
    loop();
  }

  function stopPlay() {
    state.playing = false;
    state.queue = 0;
    clearTimeout(state.timer);
    if ($("playText")) {
      $("playText").textContent = "播放";
      $("playIcon").innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3.3v9.4a.6.6 0 0 0 .93.5l7.1-4.7a.6.6 0 0 0 0-1L5.93 2.8A.6.6 0 0 0 5 3.3z"/></svg>';
    }
  }

  async function loop() {
    if (!state.playing) return;
    if (state.k >= state.steps.length - 1) { stopPlay(); return; }
    await advance(true);
    if (!state.playing) return;
    state.timer = setTimeout(loop, Math.round(760 / state.speed));
  }

  /* --------------------------------------------------------- 四、事件绑定 */
  function bind() {
    $("btnNext").addEventListener("click", function () { stopPlay(); advance(true); });
    $("btnPrev").addEventListener("click", stepBack);
    $("btnReset").addEventListener("click", function () { stopPlay(); render(0); });

    // 进度条可点：点在哪儿就跳到哪一步（力扣播放器的手感）
    var prog = $("progress");
    prog.title = "点击进度条跳到该步";
    prog.addEventListener("click", function (e) {
      var max = state.steps.length - 1;
      if (!max) return;
      var rect = prog.getBoundingClientRect();
      var p = (e.clientX - rect.left) / rect.width;
      stopPlay();
      render(Math.round(Math.min(1, Math.max(0, p)) * max));
    });
    $("btnPlay").addEventListener("click", function () {
      if (state.playing) stopPlay(); else startPlay();
    });

    Array.prototype.forEach.call(document.querySelectorAll(".seg-btn[data-speed]"), function (b) {
      b.addEventListener("click", function () {
        state.speed = Number(b.getAttribute("data-speed"));
        Array.prototype.forEach.call(document.querySelectorAll(".seg-btn[data-speed]"), function (x) {
          var on = x === b;
          x.classList.toggle("is-active", on);
          x.setAttribute("aria-pressed", String(on));
        });
      });
    });

    document.addEventListener("keydown", function (e) {
      var onControl = e.target.closest && e.target.closest("button, input, select, textarea");
      if ((e.key === " " || e.key === "Enter") && onControl) return;
      if (e.key === "ArrowRight") { e.preventDefault(); stopPlay(); advance(true); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); stepBack(); }
      else if (e.key === " ") { e.preventDefault(); if (state.playing) stopPlay(); else startPlay(); }
      else if (e.key === "r" || e.key === "R") { stopPlay(); render(0); }
    });

    var rt = 0;
    window.addEventListener("resize", function () {
      clearTimeout(rt);
      rt = setTimeout(function () {
        state.markers.forEach(function (m) { m.el.__tx = undefined; });
        if (IS_BARS && state.chart) {
          var host = $("rowN1").parentNode;
          state.chart = buildChart(host, state.chart.n, state.chart.maxV);
          state.rowCells[0] = state.chart.anchors;
        }
        if (IS_NET) {
          state.net = buildNet($("rowN1").parentNode, state.netNodes, state.netEdges);
        }
        render(state.k);
      }, 160);
    });
  }

  /* ------------------------------------------------------------- 五、启动 */
  applyTones();
  mountShell();
  bind();
  mountExample(0);

  // 给外部工具（_tools/verify.cjs）留的自检口
  window.__demo = {
    state: state,
    go: function (k) { stopPlay(); render(Math.max(0, Math.min(k, state.steps.length - 1))); },
    steps: function () { return state.steps.length; }
  };
})();
