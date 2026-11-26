/* ============================================================
 * landing.js — 주제별 유입 페이지(gunghap-*.html, saju-ilju.html) 계산기
 * ------------------------------------------------------------
 * index.html 과 같은 만세력 엔진·결과지 원고를 그대로 쓴다(별도 계산 없음).
 *   - 같은 입력 → 같은 점수·같은 문장 (engine.js / report.js 재사용)
 *   - 입력값은 이 브라우저 안에서만 계산하고 어디에도 보내지 않는다.
 *   - 결과를 index.html 로 넘길 때는 sessionStorage 한 칸만 쓴다(주소에 생년월일 없음).
 * 설정은 각 페이지가 window.LANDING 으로 넘긴다.
 *   {mode:'pair'|'single', rel:'연인', rels:[{key,base,label}], show:['ddi']}
 * ============================================================ */
(function () {
  'use strict';
  var M = window.ManSe, C = window.CONTENT, R = window.Report;
  var L = window.LANDING || { mode: 'pair', rel: '연인' };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var OH_CLASS = { 목: 'oh-mok', 화: 'oh-hwa', 토: 'oh-to', 금: 'oh-geum', 수: 'oh-su' };

  var state = { rel: L.rel || '연인', rels: L.rels || null, last: null };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function relLabel(key) {
    if (L.rels) {
      var hit = L.rels.filter(function (r) { return r.key === key; })[0];
      if (hit) return hit.label;
    }
    return (C.relation && C.relation[key] && C.relation[key].label) || key;
  }
  function baseRel(key) {
    if (L.rels) {
      var hit = L.rels.filter(function (r) { return r.key === key; })[0];
      if (hit && hit.base) return hit.base;
    }
    return key;
  }

  /* ---------------- 날짜 입력 ---------------- */
  function bindDateInput(el) {
    el.addEventListener('input', function () {
      var v = el.value.replace(/[^0-9]/g, '').slice(0, 8);
      if (v.length > 6) el.value = v.slice(0, 4) + '-' + v.slice(4, 6) + '-' + v.slice(6);
      else if (v.length > 4) el.value = v.slice(0, 4) + '-' + v.slice(4);
      else el.value = v;
    });
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
  function readPerson(p) {
    var nameEl = $('#l' + p + 'Name'), dateEl = $('#l' + p + 'Date');
    var lunarEl = $('#l' + p + 'Lunar'), leapEl = $('#l' + p + 'Leap');
    var val = dateEl ? dateEl.value : '';
    if (!val) return null;
    var date = parseDate(val);
    if (!date) return { bad: true, name: nameEl ? nameEl.value.trim() : '' };
    var lunar = !!(lunarEl && lunarEl.checked);
    return {
      name: (nameEl ? nameEl.value.trim() : ''),
      y: date[0], m: date[1], d: date[2], hour: null, minute: 0,
      calendar: lunar ? 'lunar' : 'solar',
      leap: !!(leapEl && leapEl.checked) && lunar,
      gender: null
    };
  }
  function showErr(msg) {
    var e = $('#landErr');
    if (!e) return;
    e.textContent = msg;
    e.classList.add('show');
  }
  function clearErr() { var e = $('#landErr'); if (e) e.classList.remove('show'); }

  /* ---------------- 관계 칩 ---------------- */
  function renderRels() {
    var box = $('#landRels');
    if (!box || !L.rels || L.rels.length < 2) { if (box) box.style.display = 'none'; return; }
    box.innerHTML = L.rels.map(function (r) {
      return '<button type="button" class="rel" data-rel="' + esc(r.key) + '" aria-pressed="' + (r.key === state.rel) + '">' + esc(r.label) + '</button>';
    }).join('');
    $$('.rel', box).forEach(function (b) {
      b.addEventListener('click', function () {
        $$('.rel', box).forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
        b.setAttribute('aria-pressed', 'true');
        state.rel = b.getAttribute('data-rel');
        if (state.last) run(false);
      });
    });
  }

  /* ---------------- 결과: 두 사람 ---------------- */
  function ddiPair(A, B) {
    var r = M.branchRelation(A.year.branch, B.year.branch);
    var map = { yukhap: '육합', samhap: '삼합', chung: '충', wonjin: '원진', hyeong: '형', hae: '해', same: '같은 띠', none: '무난한 사이' };
    return { label: map[r.type] || r.label, points: r.points, a: A.animal, b: B.animal };
  }

  function renderPair(A, B, compat, report) {
    var out = $('#landOut');
    var aName = A.displayName, bName = B.displayName;
    var label = relLabel(state.rel);
    var ddi = ddiPair(A, B);
    var facs = compat.factors.slice().sort(function (x, y) { return Math.abs(y.points) - Math.abs(x.points); }).slice(0, 4);
    var showDdi = (L.show || []).indexOf('ddi') >= 0;

    out.innerHTML =
      '<div class="top"><div class="score">' + compat.score + '<small>of 100</small></div>'
      + '<div><p class="grade">' + esc(compat.grade) + '</p>'
      + '<p class="who">' + esc(label) + ' · ' + esc(aName) + ' · ' + esc(bName) + '</p></div></div>'
      + '<p class="sum">' + esc(report.summary) + '</p>'
      + '<div class="kw">' + report.keywords.map(function (k) { return '<span>' + esc(k) + '</span>'; }).join('') + '</div>'
      + (showDdi ? '<div class="ddi"><div class="a">' + esc(ddi.a) + '</div>'
        + '<div class="t"><b>' + esc(ddi.a) + '띠 ↔ ' + esc(ddi.b) + '띠</b>' + esc(ddi.label)
        + (ddi.points ? ' (' + (ddi.points > 0 ? '+' : '') + ddi.points + ')' : '') + '</div>'
        + '<div class="a">' + esc(ddi.b) + '</div></div>' : '')
      + '<div class="duo">'
      + [A, B].map(function (p) {
        return '<div class="who-card"><b>' + esc(p.displayName) + '</b>'
          + '<div class="il">' + esc(M.toLabel(p.year)) + '년 ' + esc(M.toLabel(p.month)) + '월 ' + esc(M.toLabel(p.day)) + '일<br>'
          + esc(p.animal) + '띠 · ' + esc(p.solar.y) + '.' + pad2(p.solar.m) + '.' + pad2(p.solar.d) + '</div>'
          + '<div class="oh">일간 ' + esc(p.ilgan) + ' · ' + esc(p.ilganOH) + ' 기운</div></div>';
      }).join('')
      + '</div>'
      + '<div class="facs">' + facs.map(function (f) {
        return '<div class="fac"><span><b>' + esc(f.label) + '</b> ' + esc(f.detail) + '</span>'
          + '<span class="pt ' + (f.points > 0 ? 'plus' : f.points < 0 ? 'minus' : '') + '">' + (f.points > 0 ? '+' : '') + f.points + '</span></div>';
      }).join('') + '</div>'
      + '<div class="next">'
      + '<a class="btn primary" href="index.html?rel=' + encodeURIComponent(state.rel) + '#fateForm" data-go="1">이 결과로 8장 결과지 보기 <span aria-hidden="true">→</span></a>'
      + '<button class="btn ghost" type="button" id="landShare">공유 문구 복사</button>'
      + '</div>';
    out.classList.add('show');
    state.last = {
      kind: 'pair',
      text: aName + '·' + bName + ' ' + label + ' ' + compat.score + '점 · ' + compat.grade
        + '\n연(緣)에서 만세력으로 계산해 봤어. 너도 해볼래?'
    };
    wireResult();
  }

  /* ---------------- 결과: 한 사람(일주·오행) ---------------- */
  var TODAY_LINE = {
    same: '오늘은 내 기운과 같은 결이 겹치는 날입니다. 잘하는 일이 두 배로 되지만 고집도 두 배가 됩니다.',
    saeng: '오늘의 기운이 내 기운을 살려 주는 날입니다. 미뤄 둔 연락·약속을 꺼내기 좋습니다.',
    saengOut: '오늘은 내 기운이 밖으로 나가는 날입니다. 남을 돕기 좋지만 다 쓰고 나면 비기니 한 번은 사양하세요.',
    geukIn: '오늘은 내가 무언가를 정리하기 좋은 날입니다. 미뤄 둔 서류·청소·정산에 손을 대 보세요.',
    geuk: '오늘의 기운이 내 기운을 누르는 날입니다. 큰 결정은 하루 미루고 몸을 먼저 쉬게 하세요.'
  };

  function todayLine(me) {
    var t = M.todayPillar(new Date());
    var order = ['목', '화', '토', '금', '수'];
    var mi = order.indexOf(me.ilganOH), ti = order.indexOf(t.stemOH), key;
    if (mi === ti) key = 'same';
    else if (order[(mi + 1) % 5] === t.stemOH) key = 'saengOut';
    else if (order[(ti + 1) % 5] === me.ilganOH) key = 'saeng';
    else if (order[(mi + 2) % 5] === t.stemOH) key = 'geukIn';
    else key = 'geuk';
    return { today: t, text: TODAY_LINE[key] };
  }

  function renderSingle(P) {
    var out = $('#landOut');
    var stem = C.stem[P.ilgan] || {};
    var total = 0;
    ['목', '화', '토', '금', '수'].forEach(function (o) { total += P.ohCount[o] || 0; });
    var tl = todayLine(P);
    var iljuNo = (function () {
      for (var i = 0; i < 60; i++) if (i % 10 === P.day.stem && i % 12 === P.day.branch) return i + 1;
      return 0;
    })();

    out.innerHTML =
      '<div class="top"><div class="ilju"><b class="' + OH_CLASS[P.ilganOH] + '">' + esc(M.toHanja(P.day)) + '</b>'
      + '<span>' + esc(M.toLabel(P.day)) + ' 일주</span></div>'
      + '<div><p class="grade">' + esc(stem.nature || '') + ' · ' + esc(P.ilganOH) + '</p>'
      + '<p class="who">' + esc(P.displayName) + ' · ' + esc(P.animal) + '띠 · 60갑자 ' + iljuNo + '번째</p></div></div>'
      + '<p class="sum">' + esc(stem.one || '') + '</p>'
      + '<div class="duo"><div class="who-card"><b>사주 네 기둥</b>'
      + '<div class="il">' + esc(M.toLabel(P.year)) + '년 · ' + esc(M.toLabel(P.month)) + '월 · ' + esc(M.toLabel(P.day)) + '일'
      + (P.hour ? ' · ' + esc(M.toLabel(P.hour)) + '시' : ' · 시주 미입력') + '<br>'
      + '양력 ' + P.solar.y + '.' + pad2(P.solar.m) + '.' + pad2(P.solar.d)
      + (P.calendarNote && P.calendarNote.indexOf('음력') === 0 ? ' · ' + esc(P.calendarNote) : '') + '</div></div>'
      + '<div class="who-card"><b>신강·신약</b><div class="il">' + esc(P.strength.grade) + ' (' + P.strength.score + ')<br>'
      + '일간 ' + esc(P.ilgan) + '(' + esc(P.ilganOH) + ') 기준</div></div></div>'
      + '<div class="bars">' + ['목', '화', '토', '금', '수'].map(function (o) {
        var n = P.ohCount[o] || 0;
        return '<div class="bar-row"><div class="bt"><span>' + o + '</span><span>' + n + ' / ' + total + '</span></div>'
          + '<div class="bar">' + [0, 1, 2, 3, 4, 5, 6, 7].map(function (i) {
            return '<i class="' + (i < Math.round(n / Math.max(1, total) * 8) ? 'on' : '') + '"></i>';
          }).join('') + '</div></div>';
      }).join('') + '</div>'
      + '<div class="facs"><div class="fac"><span><b>십신</b> 일간 기준 · 년·월·일·시 순서</span><span></span></div>' + P.tenGods.map(function (g) {
        return '<div class="fac"><span><b>' + esc(g.kind) + '주</b> 천간 ' + esc(g.stem) + ' · 지지 ' + esc(g.branch) + '</span></div>';
      }).join('') + '</div>'
      + '<div class="land-note" style="margin:0 0 12px"><b>오늘(' + esc(tl.today.label) + '일)</b> ' + esc(tl.text) + '</div>'
      + '<div class="next">'
      + '<a class="btn primary" href="index.html#fateForm" data-go="1">이 생일로 궁합 보기 <span aria-hidden="true">→</span></a>'
      + '<button class="btn ghost" type="button" id="landShare">공유 문구 복사</button>'
      + '</div>';
    out.classList.add('show');
    state.last = {
      kind: 'single',
      text: P.displayName + '의 일주는 ' + M.toLabel(P.day) + '(' + M.toHanja(P.day) + ') · ' + P.animal + '띠'
        + '\n연(緣)에서 만세력으로 뽑아 봤어. 너도 해볼래?'
    };
    wireResult();
  }

  /* ---------------- 공유·이동 ---------------- */
  function shareURL() {
    var u = location.origin + location.pathname;
    return u + '?utm_source=share&utm_medium=msg';
  }
  function copyText(t) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(t).then(function () { toast('공유 문구를 복사했습니다'); },
        function () { fallbackCopy(t); });
    } else fallbackCopy(t);
  }
  function fallbackCopy(t) {
    var ta = document.createElement('textarea');
    ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); toast('공유 문구를 복사했습니다'); }
    catch (e) { toast('복사할 수 없습니다. 주소를 직접 복사해 주세요.'); }
    ta.remove();
  }
  function toast(msg) {
    var d = document.createElement('div');
    d.textContent = msg;
    d.style.cssText = 'position:fixed;left:50%;bottom:26px;transform:translateX(-50%);background:rgba(20,16,36,.96);border:1px solid rgba(232,200,146,.4);color:#F3EEE7;padding:11px 18px;border-radius:12px;font-size:13px;z-index:99;max-width:86vw;text-align:center';
    document.body.appendChild(d);
    setTimeout(function () { d.remove(); }, 2400);
  }
  function prefill() {
    var a = readPerson('a');
    if (!a || a.bad) return;
    var data = { a: a, rel: state.rel };
    if (L.mode !== 'single') {
      var b = readPerson('b');
      if (b && !b.bad) data.b = b;
    }
    try { sessionStorage.setItem('yeon.prefill', JSON.stringify(data)); } catch (e) { /* 저장소를 막은 브라우저 */ }
  }
  function wireResult() {
    var sh = $('#landShare');
    if (sh) {
      sh.addEventListener('click', function () {
        if (!state.last) return;
        copyText(state.last.text + '\n' + shareURL());
      });
    }
    $$('[data-go]').forEach(function (a) {
      if (a.getAttribute('data-wired') === '1') return;
      a.setAttribute('data-wired', '1');
      a.addEventListener('click', function () { prefill(); });
    });
  }

  /* ---------------- 실행 ---------------- */
  function run(scroll) {
    clearErr();
    var a = readPerson('a');
    if (!a) { showErr('첫 번째 사람의 생년월일을 넣어 주세요. (예: 1992-06-12)'); return; }
    if (a.bad) { showErr('날짜를 1992-06-12 형식으로 넣어 주세요. 1930~2026년만 계산합니다.'); return; }
    if (L.mode === 'single') {
      a.name = a.name || L.nameA || '나';
      var P;
      try { P = M.pillars(a); } catch (err) { showErr(err.message || '음력 날짜를 확인해 주세요.'); return; }
      renderSingle(P);
    } else {
      var b = readPerson('b');
      if (!b) { showErr('두 번째 사람의 생년월일도 넣어 주세요.'); return; }
      if (b.bad) { showErr('두 번째 사람의 날짜를 다시 확인해 주세요.'); return; }
      a.name = a.name || L.nameA || '나';
      b.name = b.name || L.nameB || '상대';
      var A, B;
      try { A = M.pillars(a); B = M.pillars(b); }
      catch (err) { showErr(err.message || '음력 날짜를 확인해 주세요. (음력 1930~2050년 지원)'); return; }
      var compat = M.compat(A, B);
      var report = R.build(compat, baseRel(state.rel), {});
      renderPair(A, B, compat, report);
    }
    if (scroll) {
      var out = $('#landOut');
      if (out) setTimeout(function () { out.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 60);
    }
  }

  function bindPerson(p) {
    var lunar = $('#l' + p + 'Lunar'), leap = $('#l' + p + 'LeapWrap');
    if (!lunar) return;
    lunar.addEventListener('change', function () {
      if (leap) leap.style.display = lunar.checked ? 'flex' : 'none';
      if (!lunar.checked) { var l = $('#l' + p + 'Leap'); if (l) l.checked = false; }
    });
    bindDateInput($('#l' + p + 'Date'));
  }

  function boot() {
    renderRels();
    bindPerson('a'); bindPerson('b');
    var f = $('#landForm');
    if (f) {
      f.addEventListener('submit', function (e) { e.preventDefault(); run(true); });
    }
    // 주소에 ?rel= 이 있으면 그 관계로 시작 (공유 링크로 들어온 사람)
    try {
      var q = new URLSearchParams(location.search).get('rel');
      if (q && (!L.rels || L.rels.some(function (r) { return r.key === q; }))) state.rel = q;
    } catch (e) { /* 구형 브라우저 */ }
    renderRels();
    $$('#landRels .rel').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-rel') === state.rel));
    });
    window.__LANDING__ = { ready: true, run: run, state: state };
  }

  document.addEventListener('DOMContentLoaded', boot);
  if (document.readyState !== 'loading') boot();
})();
