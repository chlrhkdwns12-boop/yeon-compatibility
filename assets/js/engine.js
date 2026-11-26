/* ============================================================
 * engine.js — 만세력·궁합 계산 엔진 (브라우저·Node 공용)
 * ------------------------------------------------------------
 * 입력: { name, y, m, d, hour(0~23|null), minute, calendar:'solar'|'lunar', leap:false }
 * 출력: 사주 원국(년·월·일·시), 오행 분포, 십신, 신강도, 두 사람 궁합 점수·근거
 *
 * 규칙(고정)
 *  - 년주는 입춘, 월주는 12절(節)로 바뀐다(절기 시각은 data-jeolgi.js, KST).
 *  - 일주는 자정(00:00) 기준으로 바뀐다. 23시 이후 출생은 시지가 자(子)이며 일주는 그날 것이다.
 *  - 시주는 시지(2시간 단위)와 일간으로 정한다(오서둔법).
 *  - 같은 입력이면 언제나 같은 결과. 난수는 쓰지 않고, 문장 선택도 입력 해시로만 한다.
 * ============================================================ */
(function (root) {
  'use strict';

  var STEM = ['갑', '을', '병', '정', '무', '기', '경', '신', '임', '계'];
  var STEM_H = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  var BRANCH = ['자', '축', '인', '묘', '진', '사', '오', '미', '신', '유', '술', '해'];
  var BRANCH_H = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  var OH = ['목', '화', '토', '금', '수'];           // 상생 순서
  var OH_H = { 목: '木', 화: '火', 토: '土', 금: '金', 수: '水' };
  var STEM_OH = ['목', '목', '화', '화', '토', '토', '금', '금', '수', '수'];
  var BRANCH_OH = ['수', '토', '목', '목', '토', '화', '화', '토', '금', '금', '토', '수'];
  var ANIMAL = ['쥐', '소', '호랑이', '토끼', '용', '뱀', '말', '양', '원숭이', '닭', '개', '돼지'];

  // 12절(節) → 월지. 입춘=인월(2)
  var JEOL_TO_BRANCH = { '입춘': 2, '경칩': 3, '청명': 4, '입하': 5, '망종': 6, '소서': 7,
    '입추': 8, '백로': 9, '한로': 10, '입동': 11, '대설': 0, '소한': 1 };
  var JEOL_NAMES = Object.keys(JEOL_TO_BRANCH);

  function mod(n, m) { return ((n % m) + m) % m; }

  function jdn(y, m, d) {
    var a = Math.floor((14 - m) / 12), y2 = y + 4800 - a, m2 = m + 12 * a - 3;
    return d + Math.floor((153 * m2 + 2) / 5) + 365 * y2 + Math.floor(y2 / 4)
      - Math.floor(y2 / 100) + Math.floor(y2 / 400) - 32045;
  }
  // 2026-11-27 = 을사(乙巳)일 기준 상수 (외부 만세력 대조 완료)
  var DAY_OFFSET = 49;

  /* ---------- 음력 → 양력 ---------- */
  function lunarToSolar(ly, lm, ld, isLeap) {
    var D = root.LUNAR_DATA;
    if (!D || !D[ly]) return null;
    var info = D[ly];
    // 윤달은 같은 달 다음에 온다(6월 → 윤6월 → 7월). 배열 순서 = 월 길이 순서.
    var months = [], i;
    for (i = 1; i <= 12; i++) {
      months.push({ m: i, leap: false });
      if (info.leap === i) months.push({ m: i, leap: true });
    }
    var idx = -1;
    for (i = 0; i < months.length; i++) {
      if (months[i].m === lm && months[i].leap === !!isLeap) { idx = i; break; }
    }
    if (idx < 0) return null;
    if (ld < 1 || ld > info.len[idx]) return null;
    var p = info.ny.split('-').map(Number);
    var t = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
    for (i = 0; i < idx; i++) t.setUTCDate(t.getUTCDate() + info.len[i]);
    t.setUTCDate(t.getUTCDate() + ld - 1);
    return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
  }

  /* ---------- 절기 조회 ---------- */
  function termDate(y, name) {
    var rows = root.JEOLGI_DATA[y];
    if (!rows) return null;
    for (var i = 0; i < rows.length; i++) {
      if (rows[i][0] === name) {
        var s = rows[i][1]; // "YYYY-MM-DDTHH:MM" (KST)
        return {
          y: +s.slice(0, 4), mo: +s.slice(5, 7), d: +s.slice(8, 10),
          h: +s.slice(11, 13), mi: +s.slice(14, 16),
          t: Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10), +s.slice(11, 13) - 9, +s.slice(14, 16))
        };
      }
    }
    return null;
  }

  function termTime(y, name) {
    var t = termDate(y, name);
    return t ? t.t : null;
  }

  /* ---------- 사주 원국 ---------- */
  function pillars(input) {
    var y = input.y, m = input.m, d = input.d;
    var calendarNote = '양력';
    if (input.calendar === 'lunar') {
      var s = lunarToSolar(y, m, d, input.leap);
      if (!s) throw new Error('음력 날짜를 확인해 주세요 (' + y + '-' + m + '-' + d + ')');
      y = s.y; m = s.m; d = s.d;
      calendarNote = '음력 → 양력 ' + y + '-' + pad(m) + '-' + pad(d);
    }
    var hasHour = input.hour !== null && input.hour !== undefined && input.hour !== '';
    var hour = hasHour ? +input.hour : null;
    var minute = hasHour ? (+(input.minute || 0)) : 0;
    var birthUTC = Date.UTC(y, m - 1, d, hour === null ? 12 : hour - 9, minute);

    // 년주: 입춘 기준
    var ipchun = termTime(y, '입춘');
    var sajuYear = birthUTC < ipchun ? y - 1 : y;
    var yIdx = mod(sajuYear - 1984, 60);

    // 월주: 12절 중 생일 직전의 절
    var best = null;
    for (var yy = y - 1; yy <= y + 1; yy++) {
      for (var i = 0; i < JEOL_NAMES.length; i++) {
        var nm = JEOL_NAMES[i];
        var t = termTime(yy, nm);
        if (t === null || t > birthUTC) continue;
        if (!best || t > best.t) best = { t: t, name: nm, y: yy };
      }
    }
    var monthBranch = JEOL_TO_BRANCH[best.name];
    var monthOffset = mod(monthBranch - 2, 12);          // 0 = 인월
    var yStemIdx = yIdx % 10;
    var mStemIdx = mod(yStemIdx * 2 + 2 + monthOffset, 10);

    // 일주: 자정 기준
    var dayIdx = mod(jdn(y, m, d) + DAY_OFFSET, 60);

    // 시주
    var hourPillar = null;
    if (hour !== null) {
      var bIdx = Math.floor(((hour + 1) % 24) / 2);
      var sIdx = mod((dayIdx % 10) * 2 + bIdx, 10);
      hourPillar = { stem: sIdx, branch: bIdx };
    }

    var yearPillar = { stem: yIdx % 10, branch: yIdx % 12 };
    var monthPillar = { stem: mStemIdx, branch: monthBranch };
    var dayPillar = { stem: dayIdx % 10, branch: dayIdx % 12 };

    var chars = [];
    function push(p, kind) {
      chars.push({ kind: kind, stem: p.stem, branch: p.branch,
        stemOH: STEM_OH[p.stem], branchOH: BRANCH_OH[p.branch] });
    }
    push(yearPillar, '년'); push(monthPillar, '월'); push(dayPillar, '일');
    if (hourPillar) push(hourPillar, '시');

    var ohCount = { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 };
    chars.forEach(function (c) { ohCount[c.stemOH] += 1; ohCount[c.branchOH] += 1; });

    var ilganIdx = dayPillar.stem;
    var ilganOH = STEM_OH[ilganIdx];
    var strengthScore = strength(chars, ilganIdx, monthPillar);
    var tenGods = chars.map(function (c) {
      return { kind: c.kind, stem: tenGod(ilganIdx, c.stem), branch: tenGod(ilganIdx, mainStemOfBranch(c.branch)) };
    });

    return {
      input: input, solar: { y: y, m: m, d: d, hour: hour, minute: minute },
      calendarNote: calendarNote,
      year: yearPillar, month: monthPillar, day: dayPillar, hour: hourPillar,
      yearLabel: sajuYear, animal: ANIMAL[yIdx % 12],
      chars: chars, ohCount: ohCount, ilgan: STEM[ilganIdx], ilganIdx: ilganIdx, ilganOH: ilganOH,
      strength: strengthScore,
      tenGods: tenGods,
      jeol: { name: best.name, y: best.y },
      label: toLabel(yearPillar) + '년 ' + toLabel(monthPillar) + '월 ' + toLabel(dayPillar) + '일'
        + (hourPillar ? ' ' + toLabel(hourPillar) + '시' : ' (시간 미입력)'),
      displayName: (input.name || '').trim() || '이름 없음',
      gender: input.gender || null
    };
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function toLabel(p) { return STEM[p.stem] + BRANCH[p.branch]; }
  function toHanja(p) { return STEM_H[p.stem] + BRANCH_H[p.branch]; }

  // 지지의 본기(정기)를 천간으로
  var BRANCH_MAIN = [9, 5, 0, 1, 4, 2, 3, 5, 7, 7, 4, 8]; // 자계 축기 인갑 묘을 진무 사병 오정 미기 신경 유신 술무 해임
  function mainStemOfBranch(b) { return BRANCH_MAIN[b]; }

  function tenGod(ilgan, other) {
    var me = STEM_OH[ilgan], you = STEM_OH[other];
    var same = (ilgan % 2) === (other % 2);
    if (me === you) return same ? '비견' : '겁재';
    if (OH[mod(OH.indexOf(me) + 1, 5)] === you) return same ? '식신' : '상관';
    if (OH[mod(OH.indexOf(me) + 2, 5)] === you) return same ? '편재' : '정재';
    if (OH[mod(OH.indexOf(me) + 3, 5)] === you) return same ? '편관' : '정관';
    return same ? '편인' : '정인';
  }

  function strength(chars, ilgan, monthPillar) {
    var me = STEM_OH[ilgan];
    var inSeong = OH[mod(OH.indexOf(me) + 4, 5)]; // 나를 생하는 오행
    var score = 0;
    chars.forEach(function (c) {
      if (c.stemOH === me) score += 1;
      if (c.branchOH === me) score += 1.2;
      if (c.stemOH === inSeong) score += 1;
      if (c.branchOH === inSeong) score += 1.2;
    });
    // 월령 가중
    if (BRANCH_OH[monthPillar.branch] === me) score += 2;
    if (BRANCH_OH[monthPillar.branch] === inSeong) score += 1.5;
    var grade = score >= 6.5 ? '신강' : score >= 4 ? '중화' : '신약';
    return { score: Math.round(score * 10) / 10, grade: grade };
  }

  /* ---------- 관계 판정 ---------- */
  var YUKHAP = [[0, 1], [2, 11], [3, 10], [4, 9], [5, 8], [6, 7]];
  var SAMHAP = [[8, 0, 4], [11, 3, 7], [2, 6, 10], [5, 9, 1]];
  var CHUNG = [[0, 6], [1, 7], [2, 8], [3, 9], [4, 10], [5, 11]];
  var HYEONG = [[2, 5, 8], [1, 10, 7], [0, 3], [4, 4], [6, 6], [9, 9], [11, 11]];
  var WONJIN = [[0, 7], [1, 6], [2, 9], [3, 8], [4, 11], [5, 10]];
  var HAE = [[0, 7], [1, 6], [2, 5], [3, 4], [8, 11], [9, 10]];
  var CHEONGAN_HAP = [[0, 5], [1, 6], [2, 7], [3, 8], [4, 9]];

  function includesPair(list, a, b) {
    for (var i = 0; i < list.length; i++) {
      var g = list[i];
      if (g.length === 2 && ((g[0] === a && g[1] === b) || (g[0] === b && g[1] === a))) return true;
      if (g.length === 3 && g.indexOf(a) >= 0 && g.indexOf(b) >= 0 && a !== b) return true;
    }
    return false;
  }

  function branchRelation(a, b) {
    if (a === b) return { type: 'same', points: 2, label: '같은 자리' };
    if (includesPair(YUKHAP, a, b)) return { type: 'yukhap', points: 9, label: '육합' };
    if (includesPair(SAMHAP, a, b)) return { type: 'samhap', points: 7, label: '삼합' };
    if (includesPair(CHUNG, a, b)) return { type: 'chung', points: -10, label: '충' };
    if (includesPair(WONJIN, a, b)) return { type: 'wonjin', points: -7, label: '원진' };
    if (includesPair(HYEONG, a, b)) return { type: 'hyeong', points: -5, label: '형' };
    if (includesPair(HAE, a, b)) return { type: 'hae', points: -4, label: '해' };
    return { type: 'none', points: 0, label: '무관' };
  }

  function stemRelation(a, b) {
    if (includesPair(CHEONGAN_HAP, a, b)) return { type: 'hap', points: 12, label: '천간합' };
    var oa = STEM_OH[a], ob = STEM_OH[b];
    if (oa === ob) return { type: 'same', points: 5, label: '같은 기운' };
    if (OH[mod(OH.indexOf(oa) + 1, 5)] === ob) return { type: 'saeng', points: 8, label: 'A가 B를 생함' };
    if (OH[mod(OH.indexOf(ob) + 1, 5)] === oa) return { type: 'saeng', points: 8, label: 'B가 A를 생함' };
    if (OH[mod(OH.indexOf(oa) + 2, 5)] === ob) return { type: 'geuk', points: -7, label: 'A가 B를 극함' };
    return { type: 'geuk', points: -6, label: 'B가 A를 극함' };
  }

  /* 두 사람 궁합 */
  function compat(A, B) {
    var factors = [];
    function add(label, detail, points, type) {
      factors.push({ label: label, detail: detail, points: points, type: type });
    }

    // 1) 일간(중심) — 가장 무겁게
    var sr = stemRelation(A.day.stem, B.day.stem);
    add('일간의 만남', A.ilgan + '(' + A.ilganOH + ') · ' + B.ilgan + '(' + B.ilganOH + ') — ' + stemText(sr),
      Math.round(sr.points * 1.4), sr.type);

    // 2) 지지 자리별 — 일지 > 월지 > 년지 > 시지
    var br = branchRelation(A.day.branch, B.day.branch);
    add('일지의 자리', BRANCH[A.day.branch] + '·' + BRANCH[B.day.branch] + ' — ' + branchText(br), Math.round(br.points * 1.2), br.type);

    var mr = branchRelation(A.month.branch, B.month.branch);
    add('월지의 자리', BRANCH[A.month.branch] + '·' + BRANCH[B.month.branch] + ' — ' + branchText(mr), Math.round(mr.points * 0.8), mr.type);

    var yr = branchRelation(A.year.branch, B.year.branch);
    add('띠의 거리', A.animal + '·' + B.animal + ' — ' + branchText(yr), Math.round(yr.points * 0.6), yr.type);

    var hr = null;
    if (A.hour && B.hour) {
      hr = branchRelation(A.hour.branch, B.hour.branch);
      add('시간의 자리', BRANCH[A.hour.branch] + '·' + BRANCH[B.hour.branch] + ' — ' + branchText(hr),
        Math.round(hr.points * 0.5), hr.type);
    }

    // 3) 오행 보완
    var lackA = OH.filter(function (o) { return A.ohCount[o] === 0; });
    var lackB = OH.filter(function (o) { return B.ohCount[o] === 0; });
    var fill = 0, fillDetail = [];
    lackA.forEach(function (o) { if (B.ohCount[o] >= 2) { fill += 5; fillDetail.push(B.displayName + '이 ' + A.displayName + '의 ' + o + objectParticle(o) + ' 채움'); } });
    lackB.forEach(function (o) { if (A.ohCount[o] >= 2) { fill += 5; fillDetail.push(A.displayName + '이 ' + B.displayName + '의 ' + o + objectParticle(o) + ' 채움'); } });
    fill = Math.min(fill, 10);
    add('비어 있는 기운', fillDetail.length ? fillDetail.join(' · ') : '서로의 빈 자리를 크게 채우지는 못함',
      fill, fill > 0 ? 'fill' : 'none');

    // 4) 음양
    var yinA = countYin(A), yinB = countYin(B);
    var diff = Math.abs(yinA - yinB);
    add('음양의 균형', 'A ' + pct(yinA) + ' / B ' + pct(yinB) + ' — ' + (diff >= 0.2 ? '서로 다른 결이 맞물림' : '닮은 결이라 편안하지만 자극은 적음'),
      diff >= 0.2 ? 4 : 0, diff >= 0.2 ? 'balance' : 'none');

    // 5) 조후: 같은 계절에 태어나 같은 오행이 과한 경우
    var seasonA = monthSeason(A.month.branch), seasonB = monthSeason(B.month.branch);
    if (seasonA === seasonB) {
      var oh = BRANCH_OH[A.month.branch];
      if (A.ohCount[oh] + B.ohCount[oh] >= 9) {
        add('계절의 겹침', '두 사람 모두 ' + seasonA + '에 태어나 ' + oh + ' 기운이 넘침', -3, 'season');
      } else {
        add('계절의 겹침', '두 사람 모두 ' + seasonA + '의 기운 — 계절 감각이 같음', 3, 'balance');
      }
    } else {
      add('계절의 겹침', seasonA + '과 ' + seasonB + ' — 서로 다른 계절의 온도', 1, 'balance');
    }

    // 6) 같은 오행이 한쪽에 몰린 경우(둘이 닮아 서로를 못 채움)
    var heavy = null;
    OH.forEach(function (o) {
      if (A.ohCount[o] >= 5 && B.ohCount[o] >= 5) heavy = o;
    });
    if (heavy) add('겹치는 기운', '두 사람 모두 ' + heavy + '이 넉넉해, 같은 방향으로만 흐르기 쉬움', -2, 'season');

    var raw = 58 + factors.reduce(function (s, f) { return s + f.points; }, 0);
    var score = Math.max(42, Math.min(97, Math.round(raw)));
    var grade = score >= 90 ? '천생연분' : score >= 80 ? '찰떡궁합' : score >= 70 ? '좋은 인연'
      : score >= 60 ? '노력형 인연' : '다른 결의 인연';

    return {
      A: A, B: B, score: score, grade: grade, factors: factors,
      top: factors.slice().sort(function (x, y) { return Math.abs(y.points) - Math.abs(x.points); }).slice(0, 3),
      key: { stem: sr, branch: br, month: mr, year: yr, hour: hr },
      seed: (A.solar.y * 372 + A.solar.m * 31 + A.solar.d) * 100000 + (B.solar.y * 372 + B.solar.m * 31 + B.solar.d)
    };
  }

  var OBJECT_PARTICLE = { '목': '을', '화': '를', '토': '를', '금': '을', '수': '를' };
  function objectParticle(oh) { return OBJECT_PARTICLE[oh] || '을'; }

  function countYin(p) {
    var yin = 0, total = 0;
    p.chars.forEach(function (c) {
      yin += (c.stem % 2) ? 1 : 0; yin += (c.branch % 2) ? 1 : 0; total += 2;
    });
    return yin / total;
  }
  function pct(v) { return Math.round(v * 100) + '%'; }
  function monthSeason(b) {
    if (b === 2 || b === 3) return '봄';
    if (b === 4 || b === 5) return '여름';
    if (b === 6 || b === 7) return '한여름';
    if (b === 8 || b === 9) return '가을';
    if (b === 10 || b === 11) return '겨울';
    return '늦겨울';
  }

  function stemText(r) {
    switch (r.type) {
      case 'hap': return '천간합, 서로가 서로를 붙잡는 사이';
      case 'same': return '같은 오행, 말이 통하는 사이';
      case 'saeng': return '서로를 살리는 상생';
      default: return '서로를 누르는 상극, 배울 것이 많은 사이';
    }
  }
  function branchText(r) {
    switch (r.type) {
      case 'yukhap': return '육합, 함께 있으면 자리가 맞는다';
      case 'samhap': return '삼합, 같은 방향을 보는 사이';
      case 'chung': return '충, 부딪히며 서로를 깨운다';
      case 'wonjin': return '원진, 애증이 함께 있는 사이';
      case 'hyeong': return '형, 서로의 예민한 곳을 안다';
      case 'hae': return '해, 말이 어긋나기 쉬운 사이';
      case 'same': return '같은 자리, 편안함이 곧 무덤이 되기도';
      default: return '특별한 작용 없이 각자의 길';
    }
  }

  /* 오늘 일진 */
  function todayPillar(date) {
    var d = date || new Date();
    var idx = mod(jdn(d.getFullYear(), d.getMonth() + 1, d.getDate()) + DAY_OFFSET, 60);
    return { stem: idx % 10, branch: idx % 12, label: STEM[idx % 10] + BRANCH[idx % 12],
      stemOH: STEM_OH[idx % 10], branchOH: BRANCH_OH[idx % 12] };
  }

  var API = {
    STEM: STEM, STEM_H: STEM_H, BRANCH: BRANCH, BRANCH_H: BRANCH_H, OH: OH, OH_H: OH_H,
    STEM_OH: STEM_OH, BRANCH_OH: BRANCH_OH, ANIMAL: ANIMAL, BRANCH_MAIN: BRANCH_MAIN,
    lunarToSolar: lunarToSolar, termDate: termDate, termTime: termTime,
    pillars: pillars, compat: compat, tenGod: tenGod, branchRelation: branchRelation,
    stemRelation: stemRelation, todayPillar: todayPillar, monthSeason: monthSeason,
    toLabel: toLabel, toHanja: toHanja, jdn: jdn, DAY_OFFSET: DAY_OFFSET,
    version: '2026.11.27'
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  root.ManSe = API;
})(typeof window !== 'undefined' ? window : globalThis);
