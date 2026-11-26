/* ============================================================
 * report.js — 궁합 결과지 8장 조립기
 * ------------------------------------------------------------
 * 입력: ManSe.compat(A, B) 결과, 관계 유형 키
 * 출력: 8개 페이지 객체(문장·표·막대) — 같은 입력이면 항상 같은 결과
 * ============================================================ */
(function (root) {
  'use strict';
  var C = root.CONTENT;

  function hash(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return Math.abs(h);
  }
  function pick(pool, seed, salt) {
    if (!pool || !pool.length) return '';
    return pool[hash(String(seed) + '|' + salt) % pool.length];
  }
  function seedOf(c) { return c.seed; }

  // 받침에 따른 조사 (기와 경이 / 기과 경과)
  var STEM_SENT = {
    hap: '서로가 서로를 붙잡는 천간합',
    same: '말이 통하는 같은 오행',
    saeng: '서로를 살리는 상생',
    geuk: '서로를 누르는 상극'
  };
  function hasBatchim(ch) {
    var code = ch.charCodeAt(0);
    if (code < 0xAC00 || code > 0xD7A3) return false;
    return ((code - 0xAC00) % 28) !== 0;
  }
  function waGwa(word) { return word + (hasBatchim(word.charAt(word.length - 1)) ? '과' : '와'); }
  function iGa(word) { return word + (hasBatchim(word.charAt(word.length - 1)) ? '이' : '가'); }
  function eunNeun(word) { return word + (hasBatchim(word.charAt(word.length - 1)) ? '은' : '는'); }

  function band(score) {
    if (score >= 85) return 'high';
    if (score >= 72) return 'good';
    if (score >= 60) return 'mid';
    return 'low';
  }

  function ohLine(p) {
    var order = ['목', '화', '토', '금', '수'];
    var parts = order.map(function (o) { return o + ' ' + p.ohCount[o]; });
    var max = order.slice().sort(function (a, b) { return p.ohCount[b] - p.ohCount[a]; })[0];
    var min = order.slice().sort(function (a, b) { return p.ohCount[a] - p.ohCount[b]; })[0];
    return parts.join(' · ') + ' — ' + max + '이 가장 넉넉하고 ' + min + '이 얇습니다.';
  }

  var OH_FACE = {
    '목': '새로 시작하는 쪽으로 마음이 먼저 갑니다',
    '화': '감정이 먼저 움직이고 표현이 앞섭니다',
    '토': '현실과 안정을 먼저 확인합니다',
    '금': '정리와 기준을 먼저 세웁니다',
    '수': '생각과 흐름을 먼저 살핍니다'
  };
  function dominantOH(p) {
    var best = '토', n = -1;
    ['목', '화', '토', '금', '수'].forEach(function (o) {
      if (p.ohCount[o] > n) { n = p.ohCount[o]; best = o; }
    });
    return { oh: best, n: n };
  }

  function dominantTenGod(p) {
    var count = {};
    p.tenGods.forEach(function (t) {
      count[t.stem] = (count[t.stem] || 0) + 1;
      count[t.branch] = (count[t.branch] || 0) + 1;
    });
    var keys = Object.keys(count).sort(function (a, b) { return count[b] - count[a]; });
    return { name: keys[0], n: count[keys[0]] };
  }

  var TEN_GOD_TEXT = {
    '비견': '자기 사람과 자기 몫을 분명히 하는 힘',
    '겁재': '판을 키우고 함께 나누는 힘',
    '식신': '편안하게 오래 해 먹이는 힘',
    '상관': '드러내고 표현하는 힘',
    '편재': '기회를 보고 크게 움직이는 힘',
    '정재': '새는 곳을 막고 모으는 힘',
    '편관': '밀어붙여 판을 바꾸는 힘',
    '정관': '규칙을 세우고 지키는 힘',
    '편인': '남들이 안 보는 곳을 보는 힘',
    '정인': '배우고 품어 안는 힘'
  };

  function build(c, relationKey, opts) {
    opts = opts || {};
    var A = c.A, B = c.B, relKey = relationKey || '연인';
    var rel = C.relation[relKey] || C.relation['연인'];
    var sd = seedOf(c);
    var score = c.score;

    var negFactors = c.factors.filter(function (f) { return f.points < 0; });
    var posFactors = c.factors.filter(function (f) { return f.points > 0; });
    var kwTypes = [];
    [c.key.stem, c.key.branch, c.factors[2], c.factors[3]].forEach(function (f) {
      if (f && C.kw[f.type] && kwTypes.indexOf(C.kw[f.type]) < 0) kwTypes.push(C.kw[f.type]);
    });
    var keywords = kwTypes.slice(0, 3);
    while (keywords.length < 3) keywords.push(['인연의 결', '오행의 균형', '말의 온도'][keywords.length]);

    var summary = pick(C.summary[band(score)], sd, 'sum');
    var pages = [];

    /* ---------- 1장: 총점 (무료) ---------- */
    pages.push({
      no: 1, title: '두 사람의 인연', kicker: '무료 미리보기 · 1장', locked: false,
      lead: '두 사람의 사주가 만나는 자리를 여덟 장으로 나눠 읽었습니다. 첫 장은 점수와, 그 점수를 만든 근거입니다.',
      blocks: [
        { type: 'score' },
        { type: 'chips', label: '이 관계의 결', items: keywords },
        {
          type: 'pillars', label: '두 사람의 원국',
          people: [
            { name: A.displayName, sub: A.label, cells: pillarCells(A) },
            { name: B.displayName, sub: B.label, cells: pillarCells(B) }
          ],
          note: '일주(가운데 두 글자)가 그 사람의 중심입니다. 시간을 넣지 않으면 시주는 비어 있습니다.'
        },
        {
          type: 'cards', label: '점수를 만든 근거',
          items: c.top.map(function (f) {
            return { title: f.label, text: f.detail, points: f.points };
          })
        },
        { type: 'quote', text: '점수는 두 사람의 사주가 만나는 자리를 계산한 값입니다. 좋고 나쁨이 아니라, 어디서 통하고 어디서 부딪히는지를 보여 줍니다.' }
      ]
    });

    /* ---------- 2장: 기질 ---------- */
    pages.push({
      no: 2, ...C.page[2], locked: true,
      lead: eunNeun(A.displayName) + ' ' + A.ilgan + '(' + A.ilganOH + '), ' + C.stem[A.ilgan].nature + '의 기운. '
        + eunNeun(B.displayName) + ' ' + B.ilgan + '(' + B.ilganOH + '), ' + C.stem[B.ilgan].nature + '의 기운입니다. 같은 시대를 살지만, 몸이 반응하는 방식은 다릅니다.',
      blocks: [
        { type: 'person', name: A.displayName, label: 'A', ilgan: A.ilgan, hanja: root.ManSe.toHanja(A.day),
          oh: A.ilganOH, nature: C.stem[A.ilgan].nature, text: C.stem[A.ilgan].one + ' ' + C.stem[A.ilgan].love },
        { type: 'person', name: B.displayName, label: 'B', ilgan: B.ilgan, hanja: root.ManSe.toHanja(B.day),
          oh: B.ilganOH, nature: C.stem[B.ilgan].nature, text: C.stem[B.ilgan].one + ' ' + C.stem[B.ilgan].love },
        { type: 'bars', label: '오행의 비율 (여덟 글자)', items: [
          { label: A.displayName, values: A.ohCount, seq: ohSeq(A) },
          { label: B.displayName, values: B.ohCount, seq: ohSeq(B) }
        ] },
        { type: 'cards', label: '각자의 강점과 그늘', items: [
          { title: A.displayName + ' · ' + C.strength[A.strength.grade].title,
            text: C.strength[A.strength.grade].body + ' 이 사주의 중심은 ' + dominantOH(A).oh + '(' + dominantOH(A).n + '글자)이라, ' + OH_FACE[dominantOH(A).oh] + '.' },
          { title: B.displayName + ' · ' + C.strength[B.strength.grade].title,
            text: C.strength[B.strength.grade].body + ' 이 사주의 중심은 ' + dominantOH(B).oh + '(' + dominantOH(B).n + '글자)이라, ' + OH_FACE[dominantOH(B).oh] + '.' }
        ] },
        { type: 'p', text: '두 사람이 가진 기운의 무게가 ' + (Math.abs(A.strength.score - B.strength.score) >= 3 ? '꽤 다릅니다' : '비슷합니다') + '. ' + (Math.abs(A.strength.score - B.strength.score) >= 3 ? '한 사람이 관계의 무게를 더 많이 들고 있는 구조라, 들고 있는 쪽이 말없이 지칠 수 있습니다.' : '그래서 서로에게 기대는 방식이 자연스럽고, 대신 둘 다 지칠 때 버틸 사람이 없습니다.') }
      ]
    });

    /* ---------- 3장: 끌리는 이유 ---------- */
    var p3Factors = posFactors.slice().sort(function (a, b) { return b.points - a.points; }).slice(0, 2);
    if (p3Factors.length < 2) p3Factors = p3Factors.concat(c.factors.filter(function (f) { return f.points >= 0 && p3Factors.indexOf(f) < 0; }).slice(0, 2));
    pages.push({
      no: 3, ...C.page[3], locked: true,
      lead: rel.p3,
      blocks: p3Factors.map(function (f) {
        var t = C.factor[f.type] || C.factor.none;
        return { type: 'para', title: t.title, text: t.p3 };
      }).concat([
        { type: 'quote', text: '끌림은 이유를 모를 때 더 강합니다. 이 장은 그 이유에 이름을 붙이는 작업입니다.' },
        { type: 'p', text: A.displayName + '의 일간 ' + A.ilgan + '과 ' + B.displayName + '의 일간 ' + B.ilgan + '이 만나는 자리는 ' + (STEM_SENT[c.key.stem.type] || '각자의 자리') + '입니다. ' + (c.key.stem.type === 'hap' ? '천간합은 오래된 인연처럼 느껴지는 조합이라, 처음 만난 날부터 이미 아는 사람 같았을 것입니다.' : c.key.stem.type === 'saeng' ? '상생은 한 사람이 다른 사람의 기운을 살리는 조합이라, 함께 있으면 한쪽이 유난히 편안해집니다.' : c.key.stem.type === 'geuk' ? '상극은 불편하지만 자극이 있는 조합입니다. 상대에게 없는 것을 가진 사람에게 끌리는 것은 자연스러운 일입니다.' : '같은 기운은 설명이 필요 없는 조합입니다. 취향과 말투가 빨리 맞습니다.') }
      ])
    });

    /* ---------- 4장: 속마음 ---------- */
    pages.push({
      no: 4, ...C.page[4], locked: true,
      lead: '겉으로 보이는 모습과, 속에서 돌아가는 생각은 다릅니다. 이 장은 두 사람이 말하지 않고 넘기는 것들입니다.',
      blocks: [
        { type: 'para', title: A.displayName + '의 겉과 속',
          text: '겉으로는 ' + C.stem[A.ilgan].one.split('.')[0] + '. 그런데 속에서는 ' + C.stem[A.ilgan].shadow + ' 그래서 ' + A.displayName + '이 조용해지는 날은 기분이 나빠서가 아니라, 정리하는 중인 날입니다.' },
        { type: 'para', title: B.displayName + '의 겉과 속',
          text: '겉으로는 ' + C.stem[B.ilgan].one.split('.')[0] + '. 그런데 속에서는 ' + C.stem[B.ilgan].shadow + ' 그래서 ' + B.displayName + '이 갑자기 선을 긋는 날은 갑자기 온 것이 아니라, 오래 쌓인 것입니다.' },
        { type: 'list', label: '두 사람이 서로에게 바라는 것 (말로는 안 하는 것)', items: [
          A.displayName + '은 확인을 원합니다. “괜찮아?” 한 마디면 충분한 날이 많습니다.',
          B.displayName + '은 방해받지 않을 시간을 원합니다. 그 시간을 존중받으면 훨씬 부드러워집니다.',
          '두 사람 모두 “먼저 연락하는 쪽”이 되기를 원하지만, 먼저 하면 지는 것 같아 참고 있습니다.'
        ] }
      ]
    });

    /* ---------- 5장: 갈등 ---------- */
    var conflictFactors = negFactors.slice(0, 2);
    // 부정 요인이 하나뿐이면, 가장 약한 지점(0점 요인)이나 일지 관계로 한 문단을 더 채운다
    if (conflictFactors.length < 2) {
      var soft = c.factors.filter(function (f) { return f.points <= 2 && conflictFactors.indexOf(f) < 0; });
      if (soft.length) conflictFactors.push(soft[0]);
      else if (conflictFactors.indexOf({ type: c.key.branch.type }) < 0) conflictFactors.push({ type: c.key.branch.type });
    }
    pages.push({
      no: 5, ...C.page[5], locked: true,
      lead: rel.p5,
      blocks: conflictFactors.map(function (f) {
        var t = C.factor[f.type] || C.factor.same;
        return { type: 'para', title: t.title, text: t.p5 };
      }).concat([
        { type: 'list', label: '이 관계의 대화법 3', items: [
          '감정이 올라온 상태에서 결론을 내지 않습니다. “내일 다시 얘기하자”가 이 관계에서는 이기는 말입니다.',
          '상대의 행동을 평가하지 않고, 내가 느낀 것을 먼저 말합니다. “너는 항상”으로 시작하면 끝이 없습니다.',
          '다툰 뒤에는 반드시 한 가지를 정합니다. 무엇을 바꿀지, 무엇은 그냥 두기로 할지.'
        ] },
        { type: 'p', text: '두 사람의 갈등은 애정이 부족해서가 아니라, 애정을 확인하는 방식이 달라서 생깁니다. 이 문장 하나를 기억하면 절반은 줄어듭니다.' }
      ])
    });

    /* ---------- 6장: 재물·일 ---------- */
    var ta = dominantTenGod(A), tb = dominantTenGod(B);
    pages.push({
      no: 6, ...C.page[6], locked: true,
      lead: '돈과 일은 관계의 온도를 가장 솔직하게 드러내는 자리입니다.',
      blocks: [
        { type: 'p', text: C.money.text },
        { type: 'cards', label: '각자의 재물그릇', items: [
          { title: A.displayName + ' · ' + ta.name, text: TEN_GOD_TEXT[ta.name] + '이 두드러집니다. 그래서 ' + (A.ilganOH === '토' || A.ilganOH === '금' ? '모으는 쪽에 강합니다.' : '벌어들이는 쪽에 강합니다.') },
          { title: B.displayName + ' · ' + tb.name, text: TEN_GOD_TEXT[tb.name] + '이 두드러집니다. 그래서 ' + (B.ilganOH === '토' || B.ilganOH === '금' ? '모으는 쪽에 강합니다.' : '벌어들이는 쪽에 강합니다.') }
        ] },
        { type: 'list', label: '이 조합의 역할 분담', items: [
          A.displayName + ' — ' + (A.ilganOH === '토' || A.ilganOH === '금' ? '장부와 지출의 기준을 잡는 쪽' : '새로운 수입의 문을 여는 쪽'),
          B.displayName + ' — ' + (B.ilganOH === '토' || B.ilganOH === '금' ? '장부와 지출의 기준을 잡는 쪽' : '새로운 수입의 문을 여는 쪽'),
          '큰 지출은 혼자 정하지 않습니다. 이 조합은 한 사람이 결심하고 다른 사람이 알게 되는 순간 가장 크게 다툽니다.'
        ] },
        { type: 'p', text: C.money.text2 }
      ]
    });

    /* ---------- 7장: 올해 ---------- */
    pages.push({
      no: 7, ...C.page[7], locked: true,
      lead: '2026년은 병오(丙午)년, 불의 기운이 겹치는 해입니다.',
      blocks: [
        { type: 'p', text: C.year2026[A.ilganOH] },
        { type: 'p', text: C.year2026[B.ilganOH] },
        { type: 'cards', label: '월별 흐름', items: C.month2026.map(function (m) {
          return { title: m.range, text: m.text };
        }) },
        { type: 'p', text: rel.label + ' 사이로 보면, 올해는 ' + (c.score >= 72 ? '관계의 진도가 실제로 앞으로 나가는 해' : '서로의 속도를 확인하는 해') + '입니다. ' + (negFactors.length ? '특히 ' + negFactors[0].label + '에서 올해 온도차가 크게 드러나니, 그 지점만 미리 알고 있어도 한 번의 큰 다툼을 줄일 수 있습니다.' : '큰 충돌 없이 지나가지만, 그 조용함을 무관심으로 착각하지 마세요.') }
      ]
    });

    /* ---------- 8장: 약속 ---------- */
    var promises = [];
    negFactors.forEach(function (f) {
      if (C.promise[f.type] && promises.length < 2) promises.push(C.promise[f.type]);
    });
    [c.key.branch.type, c.key.stem.type].forEach(function (t) {
      if (C.promise[t] && promises.indexOf(C.promise[t]) < 0 && promises.length < 3) promises.push(C.promise[t]);
    });
    while (promises.length < 3) {
      var cand = C.promise[['hap', 'saeng', 'same', 'fill'][promises.length]];
      if (promises.indexOf(cand) < 0) promises.push(cand); else break;
    }
    pages.push({
      no: 8, ...C.page[8], locked: true,
      lead: '여덟 장을 한 문장으로 줄이면 이 세 가지입니다.',
      blocks: [
        { type: 'numlist', label: '두 사람이 지킬 세 가지', items: promises.slice(0, 3) },
        { type: 'p', text: rel.p8 },
        { type: 'quote', text: pick(C.closing, sd, 'close') },
        { type: 'meta', text: A.displayName + ' ' + A.label + ' · ' + B.displayName + ' ' + B.label + ' 기준 · 만세력 엔진 v' + root.ManSe.version }
      ]
    });

    return {
      score: score, grade: c.grade, summary: summary, keywords: keywords,
      relation: relKey, pages: pages,
      createdAt: opts.createdAt || null,
      sample: !!opts.sample
    };
  }

  function ohSeq(p) {
    var seq = [];
    p.chars.forEach(function (c) { seq.push(c.stemOH, c.branchOH); });
    return seq;
  }

  function pillarCells(p) {
    var order = ['년', '월', '일', '시'];
    return order.map(function (k) {
      if (k === '년') return cell(p.year);
      if (k === '월') return cell(p.month);
      if (k === '일') return cell(p.day);
      return p.hour ? cell(p.hour) : { empty: true };
    });
  }
  function cell(pl) {
    return { stem: root.ManSe.STEM[pl.stem], stemH: root.ManSe.STEM_H[pl.stem],
      branch: root.ManSe.BRANCH[pl.branch], branchH: root.ManSe.BRANCH_H[pl.branch],
      ohS: root.ManSe.STEM_OH[pl.stem], ohB: root.ManSe.BRANCH_OH[pl.branch] };
  }

  root.Report = { build: build, band: band, ohLine: ohLine, hash: hash };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.Report;
})(typeof window !== 'undefined' ? window : globalThis);
