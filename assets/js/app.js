/* ============================================================
 * app.js — 화면 조립 (입력 → 계산 → 무료 1장 → 잠금 → 샘플)
 * 의존: data-jeolgi.js, data-lunar.js, engine.js, content.js, report.js, themes.js
 * ============================================================ */
(function () {
  'use strict';
  var M = window.ManSe, C = window.CONTENT, R = window.Report;
  var CFG = window.YEON_CONFIG || { price: 5000, priceLabel: '5,000원', priceShort: '5,000원', kmongUrl: '' };

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var state = {
    rel: '연인',
    relLabel: '연인',
    theme: null,
    compat: null,
    report: null
  };

  var OH_CLASS = { 목: 'oh-mok', 화: 'oh-hwa', 토: 'oh-to', 금: 'oh-geum', 수: 'oh-su' };

  /* ---------------- 공통 ---------------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function todayISO() {
    var d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  /* ---------------- 관계 칩 ---------------- */
  function themeList() {
    var base = ['연인', '부부', '친구', '직장 동료', '썸'];
    var themes = (window.THEMES && window.THEMES.themes) || [];
    var out = base.map(function (k) {
      var t = themes.filter(function (x) { return x.key === k; })[0];
      return { key: k, label: t ? t.label : (C.relation[k] ? C.relation[k].label : k), base: k, theme: t || null };
    });
    themes.forEach(function (t) {
      if (base.indexOf(t.key) < 0) out.push({ key: t.key, label: t.label, base: t.base || '연인', theme: t });
    });
    return out;
  }

  function currentTheme() {
    return themeList().filter(function (t) { return t.key === state.rel; })[0] || null;
  }

  function renderRelChips() {
    var box = $('#relChips');
    box.innerHTML = themeList().map(function (t, i) {
      return '<button type="button" class="rel" data-rel="' + esc(t.key) + '" aria-pressed="' + (i === 0) + '">' + esc(t.label) + '</button>';
    }).join('');
    $$('.rel', box).forEach(function (b) {
      b.addEventListener('click', function () {
        $$('.rel', box).forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
        b.setAttribute('aria-pressed', 'true');
        state.rel = b.getAttribute('data-rel');
        var t = currentTheme();
        state.relLabel = t ? t.label : state.rel;
      });
    });
  }

  /* ---------------- 폼 ---------------- */
  function bindPerson(key) {
    var k = key.toLowerCase();
    var noTime = $('#' + k + 'NoTime'), time = $('#' + k + 'Time');
    noTime.addEventListener('change', function () {
      time.disabled = noTime.checked;
      if (noTime.checked) time.value = '';
    });
    time.disabled = noTime.checked;
    var cal = $('#' + k + 'Cal'), leap = $('#' + k + 'LeapWrap');
    cal.addEventListener('change', function () {
      leap.style.display = cal.value === 'lunar' ? 'flex' : 'none';
    });
  }

  function dateIssue(val) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(val || '').trim());
    if (!m) return 'format';
    var y = +m[1], mo = +m[2], d = +m[3];
    var dt = new Date(Date.UTC(y, mo - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return 'invalid';
    if (y < 1930 || y > 2026) return 'range';
    return null;
  }

  function parseDate(val) {
    var m = /^(\d{4})[-.\/ ]?(\d{1,2})[-.\/ ]?(\d{1,2})$/.exec(String(val || '').trim());
    if (!m) return null;
    var y = +m[1], mo = +m[2], d = +m[3];
    var dt = new Date(Date.UTC(y, mo - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
    if (y < 1930 || y > 2026) return null;
    return [y, mo, d];
  }

  // 입력 중 자동 하이픈 (19930412 → 1993-04-12)
  function bindDateInput(el) {
    el.addEventListener('input', function () {
      var v = el.value.replace(/[^0-9]/g, '').slice(0, 8);
      if (v.length > 6) el.value = v.slice(0, 4) + '-' + v.slice(4, 6) + '-' + v.slice(6);
      else if (v.length > 4) el.value = v.slice(0, 4) + '-' + v.slice(4);
      else el.value = v;
    });
  }

  function readPerson(k) {
    var key = k.toLowerCase();
    var val = $('#' + key + 'Date').value;
    if (!val) return null;
    var p = parseDate(val);
    if (!p) return { bad: dateIssue(val) || 'date', name: $('#' + key + 'Name').value.trim() };
    var noTime = $('#' + key + 'NoTime').checked;
    var tv = $('#' + key + 'Time').value;
    var hour = null, minute = 0;
    if (!noTime && tv) {
      var tp = tv.split(':').map(Number);
      hour = tp[0]; minute = tp[1];
    }
    return {
      name: $('#' + key + 'Name').value.trim(),
      y: p[0], m: p[1], d: p[2],
      hour: hour, minute: minute,
      calendar: $('#' + key + 'Cal').value,
      leap: $('#' + key + 'Leap').checked,
      gender: null
    };
  }

  function showErr(msg) {
    var e = $('#formErr');
    e.textContent = msg;
    e.classList.add('show');
  }
  function clearErr() { $('#formErr').classList.remove('show'); }

  /* ---------------- 결과지 렌더러 ---------------- */
  function cellHTML(cell) {
    if (!cell || cell.empty) return '<div class="pillar-cell empty"><span class="hz">·</span><span class="hg">미입력</span></div>';
    return '<div class="pillar-cell">'
      + '<span class="hz ' + OH_CLASS[cell.ohS] + '">' + cell.stemH + '</span>'
      + '<span class="hg">' + cell.stem + '</span>'
      + '<span class="hz ' + OH_CLASS[cell.ohB] + '">' + cell.branchH + '</span>'
      + '<span class="hg">' + cell.branch + '</span></div>';
  }

  function blockHTML(b) {
    switch (b.type) {
      case 'p': return '<p>' + esc(b.text) + '</p>';
      case 'para': return '<h4>' + esc(b.title) + '</h4><p>' + esc(b.text) + '</p>';
      case 'quote': return '<div class="quote">' + esc(b.text) + '</div>';
      case 'list':
        return '<h4>' + esc(b.label || '') + '</h4><ul>' + b.items.map(function (i) { return '<li>' + esc(i) + '</li>'; }).join('') + '</ul>';
      case 'numlist':
        return '<h4>' + esc(b.label || '') + '</h4><ol>' + b.items.map(function (i) { return '<li>' + esc(i) + '</li>'; }).join('') + '</ol>';
      case 'cards':
        return '<h4>' + esc(b.label || '') + '</h4><div class="cards' + (b.items.length > 1 ? ' two' : '') + '">'
          + b.items.map(function (i) {
            var pt = typeof i.points === 'number' ? ' <span style="color:' + (i.points >= 0 ? '#3E7A52' : '#A4483F') + ';font-size:11.5px">'
              + (i.points > 0 ? '+' : '') + i.points + '</span>' : '';
            return '<div class="mini-card"><b>' + esc(i.title) + pt + '</b><p>' + esc(i.text) + '</p></div>';
          }).join('') + '</div>';
      case 'chips':
        return '<h4>' + esc(b.label || '') + '</h4><div class="chips">' + b.items.map(function (i) { return '<span>' + esc(i) + '</span>'; }).join('') + '</div>';
      case 'bars':
        return '<h4>' + esc(b.label || '') + '</h4><div class="bars">' + b.items.map(function (row) {
          return '<div class="bar-row"><div class="bt"><span>' + esc(row.label) + '</span><span>'
            + ['목', '화', '토', '금', '수'].map(function (o) { return o + ' ' + (row.values[o] || 0); }).join(' · ') + '</span></div>'
            + '<div class="bar">' + row.seq.map(function (o) {
              return '<i class="on ' + OH_CLASS[o] + '" style="background:currentColor"></i>';
            }).join('') + '</div></div>';
        }).join('') + '</div>';
      case 'person':
        return '<div class="person-head"><div class="g ' + OH_CLASS[b.oh] + '">' + esc(b.hanja) + '</div>'
          + '<div><b>' + esc(b.name) + '</b> <span>' + esc(b.ilgan) + ' · ' + esc(b.nature) + '</span></div></div><p>' + esc(b.text) + '</p>';
      case 'pillars':
        return '<h4>' + esc(b.label || '') + '</h4><div class="ptable">' + b.people.map(function (p) {
          return '<div class="pperson"><div class="pname">' + esc(p.name) + '<span>' + esc(p.sub) + '</span></div>'
            + '<div class="pgrid"><span class="phd"></span><span class="phd">년</span><span class="phd">월</span><span class="phd">일</span><span class="phd">시</span>'
            + '<span class="phd row">천간</span>' + p.cells.map(function (c) {
              return c.empty ? '<span class="pcell empty">·</span>'
                : '<span class="pcell"><b class="' + OH_CLASS[c.ohS] + '">' + c.stemH + '</b><i>' + c.stem + '</i></span>';
            }).join('')
            + '<span class="phd row">지지</span>' + p.cells.map(function (c) {
              return c.empty ? '<span class="pcell empty">·</span>'
                : '<span class="pcell"><b class="' + OH_CLASS[c.ohB] + '">' + c.branchH + '</b><i>' + c.branch + '</i></span>';
            }).join('')
            + '</div></div>';
        }).join('') + '</div>'
          + '<p class="note">' + esc(b.note || '') + '</p>'
          + '<p class="legend">초록 목 · 주황 화 · 노랑 토 · 회색 금 · 파랑 수</p>';
      case 'table':
        return '<h4>' + esc(b.label || '') + '</h4><table><thead><tr>'
          + b.head.map(function (h, i) { return '<th>' + esc(h) + '</th>'; }).join('') + '</tr></thead><tbody>'
          + b.rows.map(function (row) {
            return '<tr>' + row.map(function (cell, ci) {
              if (ci === 0) return '<td class="nm">' + esc(cell) + '</td>';
              return '<td>' + cellHTML(cell) + '</td>';
            }).join('') + '</tr>';
          }).join('') + '</tbody></table>'
          + (b.note ? '<p class="note">' + esc(b.note) + '</p>' : '');
      case 'score': return '';
      case 'meta': return '<div class="meta">' + esc(b.text) + '</div>';
      default: return '';
    }
  }

  function pageHTML(page) {
    var blocks = page.blocks.map(blockHTML).join('');
    return '<article class="paper" data-page="' + page.no + '">'
      + '<div class="pno">Chapter ' + pad2(page.no) + ' / 08' + (page.locked ? '' : ' · 무료') + '</div>'
      + '<h2>' + esc(page.title) + '</h2>'
      + '<p class="kick">' + esc(page.kicker || '') + '</p>'
      + (page.lead ? '<p class="lead">' + esc(page.lead) + '</p>' : '')
      + blocks + '</article>';
  }

  /* ---------------- 무료 결과 ---------------- */
  function renderResult(compat, report) {
    var A = compat.A, B = compat.B;
    $('#resTitle').textContent = A.displayName + ' · ' + B.displayName + '의 인연';
    var fmt = function (p) {
      return p.solar.y + '.' + pad2(p.solar.m) + '.' + pad2(p.solar.d)
        + (p.solar.hour === null ? '' : ' ' + pad2(p.solar.hour) + ':' + pad2(p.solar.minute));
    };
    $('#resWho').textContent = state.relLabel + ' · ' + A.displayName + ' ' + fmt(A) + ' · ' + B.displayName + ' ' + fmt(B);
    $('#resGrade').textContent = compat.grade;
    $('#resScore').textContent = '0';
    $('#resSummary').textContent = report.summary;

    // 점수 카운트업 + 링
    var target = compat.score;
    var t0 = performance.now();
    function step(now) {
      var t = Math.min(1, (now - t0) / 1000);
      var v = Math.round(target * (1 - Math.pow(1 - t, 3)));
      $('#resScore').textContent = v;
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
    var circ = 490.1;
    var fill = $('#ringFill');
    fill.setAttribute('stroke-dashoffset', circ);
    setTimeout(function () { fill.setAttribute('stroke-dashoffset', String(circ * (1 - target / 100))); }, 60);

    $('#resKw').innerHTML = report.keywords.map(function (k) { return '<span>' + esc(k) + '</span>'; }).join('');

    // 1장
    $('#freeReport').innerHTML = pageHTML(report.pages[0]);

    // 근거
    $('#whyList').innerHTML = compat.factors.map(function (f) {
      var cls = f.points > 0 ? 'plus' : f.points < 0 ? 'minus' : 'zero';
      var pt = (f.points > 0 ? '+' : '') + f.points;
      return '<div class="factor"><div><b>' + esc(f.label) + '</b><span class="d">' + esc(f.detail) + '</span></div>'
        + '<div class="pt ' + cls + '">' + pt + '</div></div>';
    }).join('') + '<div class="factor"><div><b>기본점 58</b><span class="d">사주가 만나는 자리를 중립(58)에서 가감</span></div><div class="pt zero">'
      + (compat.score - 58 > 0 ? '+' : '') + (compat.score - 58) + '</div></div>';

    // 잠금 카드 (2~8장)
    var grid = $('#lockedGrid');
    grid.innerHTML = report.pages.slice(1).map(function (p) {
      return '<div class="locked-paper"><div class="paper"><div class="pno">Chapter ' + pad2(p.no) + ' / 08</div>'
        + '<h2>' + esc(p.title) + '</h2><p class="kick">' + esc(p.kicker) + '</p>'
        + '<p>' + esc(p.lead) + '</p><div class="body">' + p.blocks.slice(0, 2).map(function (b) {
          if (b.type === 'p' || b.type === 'para') return '<p>' + esc(b.type === 'para' ? b.text : b.text).slice(0, 160) + '…</p>';
          return '';
        }).join('') + '</div></div>'
        + '<div class="veil"><div><b>' + pad2(p.no) + '장 · 잠금</b><span>' + CFG.priceShort + '에 전체 8장</span></div></div></div>';
    }).join('');

    // 공유 카드
    drawShareCard(compat, report);

    $('#result').classList.remove('hidden');
    requestAnimationFrame(function () {
      $('#result').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  /* ---------------- 공유 카드 ---------------- */
  function seeded(seed) {
    var s = seed % 2147483647; if (s <= 0) s += 2147483646;
    return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  }

  /* 공유 카드 디자인 3종 — 같은 계산 결과를 '우주빛 / 한지 / 먹빛'으로 다르게 담는다 */
  var CARD_STYLES = {
    cosmic: {
      bg: function (ctx, W, H, rnd) {
        var g = ctx.createLinearGradient(0, 0, W, H);
        g.addColorStop(0, '#0B0918'); g.addColorStop(.45, '#151030'); g.addColorStop(1, '#0A0816');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        var rg = ctx.createRadialGradient(W * .78, H * .12, 0, W * .78, H * .12, W * .9);
        rg.addColorStop(0, 'rgba(150,120,255,.35)'); rg.addColorStop(1, 'rgba(150,120,255,0)');
        ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
        var rg2 = ctx.createRadialGradient(W * .2, H * .95, 0, W * .2, H * .95, W * .8);
        rg2.addColorStop(0, 'rgba(199,154,85,.22)'); rg2.addColorStop(1, 'rgba(199,154,85,0)');
        ctx.fillStyle = rg2; ctx.fillRect(0, 0, W, H);
        for (var i = 0; i < 90; i++) {
          var x = rnd() * W, y = rnd() * H, r = rnd() * 1.9 + .5;
          ctx.fillStyle = 'rgba(255,255,255,' + (rnd() * .5 + .25).toFixed(2) + ')';
          ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        }
      },
      frame: 'rgba(232,200,146,.45)', frame2: 'rgba(232,200,146,.16)',
      seal: '#E8C892', name: '#F5F0E8', sub: 'rgba(245,240,232,.55)',
      track: 'rgba(255,255,255,.12)', ring1: '#F2D7A6', ring2: '#C79A55',
      score: '#E8C892', summary: 'rgba(245,240,232,.82)', kw: 'rgba(232,200,146,.9)',
      foot: 'rgba(245,240,232,.45)', foot2: 'rgba(245,240,232,.3)'
    },
    hanji: {
      bg: function (ctx, W, H, rnd) {
        var g = ctx.createLinearGradient(0, 0, W, H);
        g.addColorStop(0, '#FAF4E6'); g.addColorStop(.55, '#F3E7D0'); g.addColorStop(1, '#EADBBC');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        var rg = ctx.createRadialGradient(W * .5, H * .04, 0, W * .5, H * .04, W * .92);
        rg.addColorStop(0, 'rgba(255,255,255,.6)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
        var rg2 = ctx.createRadialGradient(W * .5, H * 1.02, 0, W * .5, H * 1.02, W * .8);
        rg2.addColorStop(0, 'rgba(198,158,96,.2)'); rg2.addColorStop(1, 'rgba(198,158,96,0)');
        ctx.fillStyle = rg2; ctx.fillRect(0, 0, W, H);
        // 한지 섬유결 — 짧고 옅은 결을 흩뿌린다
        for (var i = 0; i < 300; i++) {
          var x = rnd() * W, y = rnd() * H;
          ctx.fillStyle = 'rgba(140,108,64,' + (rnd() * .07 + .02).toFixed(3) + ')';
          ctx.fillRect(x, y, rnd() * 28 + 4, .9);
        }
      },
      frame: 'rgba(150,112,58,.52)', frame2: 'rgba(150,112,58,.24)',
      seal: '#A8792F', name: '#2B2318', sub: 'rgba(43,35,24,.58)',
      track: 'rgba(43,35,24,.13)', ring1: '#C08A3C', ring2: '#8A5F22',
      score: '#8A5F22', summary: 'rgba(43,35,24,.8)', kw: '#8A5F22',
      foot: 'rgba(43,35,24,.5)', foot2: 'rgba(43,35,24,.35)'
    },
    ink: {
      bg: function (ctx, W, H, rnd) {
        ctx.fillStyle = '#0A0A0C'; ctx.fillRect(0, 0, W, H);
        var rg = ctx.createRadialGradient(W * .5, H * .34, 0, W * .5, H * .34, W * .78);
        rg.addColorStop(0, 'rgba(255,252,244,.07)'); rg.addColorStop(1, 'rgba(255,252,244,0)');
        ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
        // 먹의 붓결 — 아주 옅은 세로 결
        for (var i = 0; i < 14; i++) {
          var x = W * .1 + rnd() * W * .8;
          ctx.strokeStyle = 'rgba(255,252,244,' + (rnd() * .03 + .01).toFixed(3) + ')';
          ctx.lineWidth = rnd() * 3 + 1;
          ctx.beginPath(); ctx.moveTo(x, H * .06); ctx.lineTo(x + (rnd() - .5) * 16, H * .94); ctx.stroke();
        }
      },
      frame: 'rgba(239,231,214,.5)', frame2: 'rgba(239,231,214,.14)',
      seal: '#F4F1EA', name: '#F4F1EA', sub: 'rgba(244,241,234,.5)',
      track: 'rgba(255,255,255,.1)', ring1: '#EDE5D4', ring2: '#988C74',
      score: '#F4F1EA', summary: 'rgba(244,241,234,.76)', kw: 'rgba(233,226,210,.82)',
      foot: 'rgba(244,241,234,.42)', foot2: 'rgba(244,241,234,.26)'
    }
  };
  var cardStyle = 'cosmic';
  try {
    var savedStyle = localStorage.getItem('yeon.cardStyle');
    if (savedStyle && CARD_STYLES[savedStyle]) cardStyle = savedStyle;
  } catch (e) { /* 저장소를 막은 브라우저는 기본값으로 */ }

  function drawShareCard(compat, report) {
    var cv = $('#shareCanvas');
    var ctx = cv.getContext('2d');
    var W = cv.width, H = cv.height;
    var rnd = seeded(compat.seed || 7);
    var P = CARD_STYLES[cardStyle] || CARD_STYLES.cosmic;

    ctx.clearRect(0, 0, W, H);
    P.bg(ctx, W, H, rnd);

    // frame
    ctx.strokeStyle = P.frame; ctx.lineWidth = 2;
    ctx.strokeRect(54, 54, W - 108, H - 108);
    ctx.strokeStyle = P.frame2; ctx.lineWidth = 1;
    ctx.strokeRect(72, 72, W - 144, H - 144);

    var serif = '"Noto Serif CJK KR","Noto Serif KR",serif';
    var sans = '"Noto Sans CJK KR","Noto Sans KR",sans-serif';
    ctx.textAlign = 'center';

    ctx.fillStyle = P.seal;
    ctx.font = '600 64px ' + serif;
    ctx.fillText('緣', W / 2, 210);
    ctx.font = '500 24px ' + sans;
    ctx.fillStyle = P.sub;
    ctx.fillText('T W O   P E O P L E ’ S   F A T E', W / 2, 262);

    ctx.strokeStyle = P.frame2; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(W / 2 - 92, 292); ctx.lineTo(W / 2 + 92, 292); ctx.stroke();

    // names
    ctx.fillStyle = P.name;
    ctx.font = '600 62px ' + serif;
    var names = compat.A.displayName + '  ·  ' + compat.B.displayName;
    ctx.fillText(names, W / 2, 400);

    ctx.fillStyle = P.sub;
    ctx.font = '400 24px ' + sans;
    var relTxt = state.relLabel || state.rel;
    ctx.fillText(relTxt.indexOf('궁합') >= 0 ? relTxt : relTxt + ' 궁합', W / 2, 448);

    // score circle
    var cx = W / 2, cy = 680, r = 150;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = P.track; ctx.lineWidth = 10; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (compat.score / 100));
    var grad = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    grad.addColorStop(0, P.ring1); grad.addColorStop(1, P.ring2);
    ctx.strokeStyle = grad; ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.stroke();

    ctx.fillStyle = P.score; ctx.font = '600 108px ' + serif;
    ctx.fillText(String(compat.score), cx, cy + 26);
    ctx.fillStyle = P.sub; ctx.font = '400 22px ' + sans;
    ctx.fillText('of 100', cx, cy + 70);

    ctx.fillStyle = P.name; ctx.font = '600 36px ' + serif;
    ctx.fillText(compat.grade, cx, cy + 220);

    // summary (wrap)
    ctx.fillStyle = P.summary; ctx.font = '400 27px ' + sans;
    wrapText(ctx, report.summary, W / 2, cy + 278, W - 260, 42);

    // keywords
    ctx.font = '400 21px ' + sans;
    var kwY = H - 250;
    ctx.fillStyle = P.kw;
    ctx.fillText(report.keywords.join('   ·   '), W / 2, kwY);

    ctx.fillStyle = P.foot; ctx.font = '400 20px ' + sans;
    ctx.fillText('연 · 두 사람 인연 읽기', W / 2, H - 160);
    ctx.font = '400 18px ' + sans;
    ctx.fillStyle = P.foot2;
    ctx.fillText('무료 미리보기 · 첫 장', W / 2, H - 126);
  }

  function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    var words = String(text).split(' ');
    var line = '', lines = [];
    for (var i = 0; i < words.length; i++) {
      var test = line ? line + ' ' + words[i] : words[i];
      if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = words[i]; }
      else line = test;
    }
    if (line) lines.push(line);
    lines.forEach(function (l, i) { ctx.fillText(l, x, y + i * lineHeight); });
  }

  /* ---------------- 샘플 ---------------- */
  function sampleCompat() {
    var A = M.pillars({ name: '김하늘', y: 1992, m: 6, d: 12, hour: 16, minute: 0, calendar: 'solar' });
    var B = M.pillars({ name: '이서준', y: 1993, m: 8, d: 17, hour: 21, minute: 0, calendar: 'solar' });
    return M.compat(A, B);
  }

  function renderSample() {
    var c = sampleCompat();
    var rep = R.build(c, '연인', { sample: true });
    var box = $('#sampleReport');
    if (box.getAttribute('data-done') === '1') return;
    box.innerHTML = rep.pages.map(pageHTML).join('');
    box.setAttribute('data-done', '1');
  }

  /* ---------------- 미니도구 1: 오늘의 오행 ---------------- */
  var TODAY_ADVICE = {
    saeng: { tone: '흐름이 열리는 날', text: '오늘의 기운이 내 기운을 살립니다. 미뤄 둔 연락을 하기에 좋은 날입니다.' },
    same: { tone: '기운이 겹치는 날', text: '오늘은 내 기운이 두 배가 됩니다. 잘하는 일은 잘 되지만, 고집도 두 배가 되니 한 번만 참으세요.' },
    geuk: { tone: '부딪히는 날', text: '오늘의 기운이 내 기운을 누릅니다. 큰 결정은 내일로 미루고, 몸을 먼저 쉬게 하세요.' },
    saengOut: { tone: '내가 내어주는 날', text: '오늘은 내 기운이 밖으로 나갑니다. 누군가를 돕기 좋지만, 다 쓰고 나면 비어 버리니 한 번은 사양하세요.' },
    geukIn: { tone: '내가 눌러야 하는 날', text: '오늘은 내가 무언가를 정리하기 좋은 날입니다. 미뤄 둔 서류·청소·정산에 손을 대 보세요.' }
  };

  function ohOfToday() {
    var p = parseDate($('#ohToday').value);
    var d = p ? new Date(p[0], p[1] - 1, p[2]) : new Date();
    return M.todayPillar(d);
  }

  function computeToday() {
    var p = parseDate($('#ohDate').value);
    if (!p) { alert('생년월일을 1990-05-05 형식으로 넣어 주세요.'); return; }
    var me = M.pillars({ name: '', y: p[0], m: p[1], d: p[2], hour: null, calendar: 'solar' });
    var today = ohOfToday();
    var myOH = me.ilganOH, tOH = today.stemOH;
    var order = ['목', '화', '토', '금', '수'];
    var mi = order.indexOf(myOH), ti = order.indexOf(tOH);
    var key;
    if (mi === ti) key = 'same';
    else if (order[(mi + 1) % 5] === tOH) key = 'saengOut';  // 내가 생하는 쪽으로 흐름
    else if (order[(ti + 1) % 5] === myOH) key = 'saeng';    // 오늘이 나를 생함
    else if (order[(mi + 2) % 5] === tOH) key = 'geukIn';
    else key = 'geuk';
    var adv = TODAY_ADVICE[key];
    var colorMap = { 목: '푸른색', 화: '붉은색', 토: '노란색', 금: '흰색', 수: '검은색' };
    var numMap = { 목: '3 · 8', 화: '2 · 7', 토: '5 · 10', 금: '4 · 9', 수: '1 · 6' };

    $('#ohBig').textContent = adv.tone;
    $('#ohSub').textContent = adv.text;
    $('#ohChips').innerHTML = [
      '내 일간 ' + me.ilgan + '(' + myOH + ')',
      '오늘 일진 ' + today.label + '(' + tOH + ')',
      '오늘의 색 ' + colorMap[tOH],
      '오늘의 숫자 ' + numMap[tOH]
    ].map(function (t) {
      return '<span style="font-size:12px;padding:4px 10px;border-radius:999px;border:1px solid var(--line);color:var(--gold);background:rgba(232,200,146,.06)">' + esc(t) + '</span>';
    }).join('');
    $('#ohOut').classList.add('show');
  }

  /* ---------------- 미니도구 2: 오행 짝 맞추기 ---------------- */
  var puzzle = { tiles: [], open: [], done: 0, left: 60, timer: null, started: false };

  function puzzleSeed() {
    var d = new Date();
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  }

  function initPuzzle() {
    var symbols = [['木', '목'], ['火', '화'], ['土', '토'], ['金', '금']];
    var deck = [];
    symbols.forEach(function (s) { deck.push(s, s); });
    var rnd = seeded(puzzleSeed());
    for (var i = deck.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var t = deck[i]; deck[i] = deck[j]; deck[j] = t;
    }
    puzzle = { tiles: deck, open: [], done: 0, left: 60, timer: null, started: false };
    var grid = $('#puzzleGrid');
    grid.innerHTML = deck.map(function (d, i) {
      return '<button type="button" class="tile" data-i="' + i + '" aria-label="카드 ' + (i + 1) + '"></button>';
    }).join('');
    $$('.tile', grid).forEach(function (el) {
      el.addEventListener('click', function () { flip(el); });
    });
    $('#pzStatus').textContent = '시작하려면 카드를 누르세요';
    $('#pzTime').textContent = '60';
    $('#pzPairs').textContent = '0';
    $('#pzOut').classList.remove('show');
  }

  function flip(el) {
    var i = +el.getAttribute('data-i');
    if (el.classList.contains('done') || el.classList.contains('up')) return;
    if (puzzle.open.length >= 2) return;
    if (!puzzle.started) startTimer();
    el.textContent = puzzle.tiles[i][0];
    el.classList.add('up');
    puzzle.open.push(i);
    if (puzzle.open.length === 2) {
      var a = puzzle.open[0], b = puzzle.open[1];
      if (puzzle.tiles[a][1] === puzzle.tiles[b][1]) {
        setTimeout(function () {
          $$('.tile').forEach(function (t) {
            var idx = +t.getAttribute('data-i');
            if (idx === a || idx === b) { t.classList.remove('up'); t.classList.add('done'); }
          });
          puzzle.open = [];
          puzzle.done++;
          $('#pzPairs').textContent = String(puzzle.done);
          if (puzzle.done === 4) finishPuzzle(true);
        }, 240);
      } else {
        setTimeout(function () {
          $$('.tile').forEach(function (t) {
            var idx = +t.getAttribute('data-i');
            if (idx === a || idx === b) { t.classList.remove('up'); t.textContent = ''; }
          });
          puzzle.open = [];
        }, 620);
      }
    }
  }

  function startTimer() {
    puzzle.started = true;
    $('#pzStatus').textContent = '카드를 뒤집어 짝을 맞추세요';
    puzzle.timer = setInterval(function () {
      puzzle.left--;
      $('#pzTime').textContent = String(Math.max(0, puzzle.left));
      if (puzzle.left <= 0) finishPuzzle(false);
    }, 1000);
  }

  function finishPuzzle(win) {
    clearInterval(puzzle.timer);
    $('#pzOut').classList.add('show');
    if (win) {
      var used = 60 - puzzle.left;
      $('#pzBig').textContent = '4쌍 완성 · ' + used + '초';
      $('#pzSub').textContent = used <= 20 ? '눈이 빠릅니다. 오늘의 두뇌 온도는 최상입니다.'
        : used <= 35 ? '좋습니다. 한 번 더 하면 10초는 줄어듭니다.'
          : '완주했습니다. 오늘은 천천히 가는 날입니다.';
    } else {
      $('#pzBig').textContent = puzzle.done + '쌍에서 시간이 끝났습니다';
      $('#pzSub').textContent = '한 번 더 누르면 다시 시작합니다. 오늘의 판은 자정에 바뀝니다.';
    }
    $('#pzStatus').textContent = win ? '완료' : '시간 종료';
    setTimeout(initPuzzle, 4000);
  }

  /* ---------------- 설정 반영 (가격·크몽 주소) ---------------- */
  function syncConfig() {
    var pt = $('#priceTag');
    if (pt) pt.innerHTML = String(CFG.price).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '<small>원</small>';
    var bb = $('#buyBtn');
    if (bb) bb.innerHTML = '크몽에서 전체 8장 결과지 받기 <span style="white-space:nowrap">(' + CFG.priceLabel + ')</span>';
    var tag = $('#priceTagTop');
    if (tag) tag.textContent = '전체 8장 ' + CFG.priceLabel;
    var ver = $('#engineVer');
    if (ver) ver.textContent = '만세력 엔진 ' + (CFG.version || '') + ' · 절기·음력 계산 검증 완료';
  }

  /* ---------------- 이벤트 ---------------- */
  function bind() {
    syncConfig();
    renderRelChips();
    bindPerson('A'); bindPerson('B');
    ['#aDate', '#bDate', '#ohDate', '#ohToday'].forEach(function (sel) { bindDateInput($(sel)); });
    $('#ohToday').value = todayISO();

    $('#fateForm').addEventListener('submit', function (e) {
      e.preventDefault();
      clearErr();
      var a = readPerson('A'), b = readPerson('B');
      if (!a || !b) { showErr('두 사람의 생년월일을 모두 넣어 주세요. (예: 1993-04-12)'); return; }
      if (a.bad || b.bad) {
        var issue = a.bad || b.bad;
        showErr(issue === 'format' ? '생년월일을 1993-04-12 형식으로 넣어 주세요.'
          : issue === 'invalid' ? '달력에 없는 날짜입니다. 생년월일을 다시 확인해 주세요.'
            : '1930~2026년 사이 생년월일만 계산합니다.');
        return;
      }
      var A, B;
      try {
        A = M.pillars(a); B = M.pillars(b);
      } catch (err) {
        showErr(err.message || '날짜를 확인해 주세요. (음력 1930~2050년 지원)');
        return;
      }
      var compat = M.compat(A, B);
      var tm = currentTheme();
      state.theme = tm && tm.theme ? tm.theme : null;
      state.relLabel = tm ? tm.label : state.rel;
      var baseRel = tm ? tm.base : state.rel;
      var report = R.build(compat, baseRel, {});
      if (state.theme && state.theme.questions && state.theme.questions.length) {
        report.pages[7].blocks.splice(2, 0, { type: 'list', label: '이번 주 함께 이야기해 볼 질문', items: state.theme.questions });
      }
      state.compat = compat; state.report = report;
      renderResult(compat, report);
    });

    $('#editBtn').addEventListener('click', function () {
      document.getElementById('fateForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
      $('#aDate').focus();
    });

    $('#dlCard').addEventListener('click', function () {
      try {
        var a = document.createElement('a');
        a.download = '연_궁합카드_' + (state.compat ? state.compat.A.displayName + '_' + state.compat.B.displayName : 'card') + '.png';
        a.href = $('#shareCanvas').toDataURL('image/png');
        a.click();
      } catch (e) { showErr('이미지 저장을 지원하지 않는 브라우저입니다. 화면을 캡처해 주세요.'); }
    });

    $('#shareCard').addEventListener('click', function () {
      var cv = $('#shareCanvas');
      cv.toBlob(function (blob) {
        if (navigator.canShare && blob) {
          var file = new File([blob], 'yeon-card.png', { type: 'image/png' });
          if (navigator.canShare({ files: [file] })) {
            navigator.share({ files: [file], title: '두 사람의 인연', text: state.report ? state.report.summary : '' }).catch(function () {});
            return;
          }
        }
        copyText(location.href);
      }, 'image/png');
    });

    $('#copyLink').addEventListener('click', function () { copyText(location.href); });

    // 공유 카드 디자인 선택 (우주빛 / 한지 / 먹빛) — 고른 디자인은 브라우저에 기억
    var csBox = $('#cardStyles');
    if (csBox) {
      $$('.card-style', csBox).forEach(function (b) {
        b.setAttribute('aria-pressed', b.getAttribute('data-style') === cardStyle ? 'true' : 'false');
        b.addEventListener('click', function () {
          cardStyle = b.getAttribute('data-style');
          $$('.card-style', csBox).forEach(function (x) {
            x.setAttribute('aria-pressed', x === b ? 'true' : 'false');
          });
          try { localStorage.setItem('yeon.cardStyle', cardStyle); } catch (e) { /* 저장소를 막은 브라우저 */ }
          if (state.compat && state.report) drawShareCard(state.compat, state.report);
        });
      });
    }

    $('#buyBtn').addEventListener('click', function () {
      if (CFG.kmongUrl) {
        window.open(CFG.kmongUrl, '_blank', 'noopener');
        return;
      }
      var h = $('#buyHint');
      h.textContent = '크몽 상품 준비 중입니다. 아래 샘플 결과지에서 전체 8장 구성을 먼저 확인하세요.';
      toast('크몽 상품 준비 중입니다');
      openSample();
    });

    $('#openSample').addEventListener('click', openSample);
    $('#closeSample').addEventListener('click', closeSample);
    $('#sampleModal').addEventListener('click', function (e) { if (e.target.id === 'sampleModal') closeSample(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeSample(); });

    $('#ohBtn').addEventListener('click', computeToday);
    initPuzzle();

    // 스크롤 등장
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (en.isIntersecting) en.target.classList.add('in'); });
      }, { threshold: .12 });
      $$('.tool, .trust .item, .sec-head').forEach(function (el) { el.classList.add('reveal'); io.observe(el); });
    }
  }

  function copyText(t) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(t).then(function () { toast('링크를 복사했습니다'); },
        function () { toast('복사할 수 없습니다. 주소창의 링크를 복사해 주세요.'); });
    } else { toast('주소창의 링크를 복사해 주세요.'); }
  }
  function toast(msg) {
    var d = document.createElement('div');
    d.textContent = msg;
    d.style.cssText = 'position:fixed;left:50%;bottom:28px;transform:translateX(-50%);background:rgba(20,16,36,.95);border:1px solid rgba(232,200,146,.4);color:#F3EEE7;padding:12px 18px;border-radius:12px;font-size:13px;z-index:99';
    document.body.appendChild(d);
    setTimeout(function () { d.remove(); }, 2200);
  }

  function openSample() {
    renderSample();
    $('#sampleModal').classList.add('open');
    document.body.style.overflow = 'hidden';
    $('#sampleModal').scrollTop = 0;
  }
  function closeSample() {
    $('#sampleModal').classList.remove('open');
    document.body.style.overflow = '';
  }

  // 테스트 훅 (ops/smoke_test.py가 사용)
  window.__YEON__ = {
    ready: false,
    state: state,
    sample: sampleCompat,
    build: function (a, b, rel) {
      var A = M.pillars(a), B = M.pillars(b);
      return { compat: M.compat(A, B), report: R.build(M.compat(A, B), rel || '연인', {}) };
    },
    engine: M
  };

  var bound = false;
  function boot() {
    if (bound) return;
    bound = true;
    bind();
    window.__YEON__.ready = true;
  }

  document.addEventListener('DOMContentLoaded', boot);
  if (document.readyState !== 'loading') boot();
})();
