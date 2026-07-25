// tutorial-data.js — 日麻入门教学内容与纯逻辑
// 不依赖 DOM；浏览器与 Node 测试共用。

const MAHJONG_TUTORIAL = {
  lessons: [
    {
      id: 'tiles',
      eyebrow: '第一课 · 认识牌',
      title: '先认清 34 种牌',
      summary: '日麻使用万、筒、索三种数牌，以及东南西北白发中七种字牌。每种牌通常有 4 张。',
      points: [
        '万、筒、索各有 1～9，共 27 种数牌。',
        '东南西北叫风牌，白发中叫三元牌，合称字牌。',
        '1、9 数牌叫老头牌；老头牌与字牌合称幺九牌。',
      ],
      tileGroups: [
        { label: '万子', tiles: ['1m','2m','3m','4m','5m','6m','7m','8m','9m'] },
        { label: '筒子', tiles: ['1p','2p','3p','4p','5p','6p','7p','8p','9p'] },
        { label: '索子', tiles: ['1s','2s','3s','4s','5s','6s','7s','8s','9s'] },
        { label: '字牌', tiles: ['1z','2z','3z','4z','5z','6z','7z'] },
      ],
      tip: '先记花色和数字，不必第一天背完所有役。',
    },
    {
      id: 'turn',
      eyebrow: '第二课 · 一局怎么进行',
      title: '摸一张，打一张',
      summary: '通常轮到你时摸一张牌，再打出一张。目标是让手牌逐渐接近可和牌的结构。',
      points: [
        '吃：只能吃上家的舍牌，并组成顺子。',
        '碰：其他玩家打出的牌能与你手中两张相同牌组成刻子时可以碰。',
        '杠：四张相同牌组成杠子；开杠后需要从岭上补牌。',
        '吃、碰、明杠会让手牌副露，许多门前役将不再成立。',
      ],
      tileGroups: [
        { label: '吃成顺子', tiles: ['3m','4m','5m'] },
        { label: '碰成刻子', tiles: ['7p','7p','7p'] },
        { label: '组成杠子', tiles: ['1z','1z','1z','1z'] },
      ],
      tip: '新手不要看到能吃碰就立刻按。先问：副露后，我还剩什么役？',
    },
    {
      id: 'winning-shape',
      eyebrow: '第三课 · 和牌结构',
      title: '常规形是四面子一雀头',
      summary: '最常见的和牌由 4 组面子与 1 对雀头组成。面子可以是顺子、刻子或杠子。',
      points: [
        '顺子：同一花色连续三张数牌，例如 3万4万5万。字牌不能组成顺子。',
        '刻子：三张完全相同的牌。杠子可视作四张相同牌构成的面子。',
        '雀头：两张完全相同的牌。',
        '七对子与国士无双是常见的特殊结构，不按四面子一雀头组成。',
      ],
      tileGroups: [
        { label: '顺子', tiles: ['1m','2m','3m'] },
        { label: '顺子', tiles: ['4p','5p','6p'] },
        { label: '顺子', tiles: ['7s','8s','9s'] },
        { label: '刻子', tiles: ['7z','7z','7z'] },
        { label: '雀头', tiles: ['5m','5m'] },
      ],
      tip: '牌凑齐结构仍不一定能和——还必须至少有一个“役”。',
    },
    {
      id: 'yaku',
      eyebrow: '第四课 · 役',
      title: '有结构，还要有役',
      summary: '役是允许你和牌的条件。宝牌只增加番数，不能单独充当役。',
      points: [
        '立直：门前听牌时宣告立直，支付 1000 点，成立 1 番役。',
        '门前清自摸和：保持门前并自摸和牌，成立 1 番役。',
        '断幺九：整副牌不含 1、9 与字牌，常见规则中副露也可成立。',
        '役牌：场风、自风或白、发、中的刻子/杠子，各提供 1 番。',
        '宝牌、里宝牌、赤宝牌会加番，但手牌仍需先有役。',
      ],
      tileGroups: [
        { label: '断幺九示例', tiles: ['2m','3m','4m','2p','3p','4p','4s','5s','6s','6p','7p','8p','5s','5s'] },
      ],
      tip: '最实用的新手检查：我现在靠什么役和牌？答不出来，就先别急着副露。',
    },
    {
      id: 'waits',
      eyebrow: '第五课 · 听牌形',
      title: '最后一张怎么补进来',
      summary: '最终和牌张落在哪个位置，会影响听牌名称、符数，甚至部分役的成立。',
      points: [
        '两面听：例如 34 等 2 或 5，通常不加听牌符。',
        '嵌张听：例如 24 只等 3，加 2 符。',
        '边张听：12 等 3，或 89 等 7，加 2 符。',
        '单骑听：只等雀头，加 2 符。',
        '双碰听：两组对子等待其中一张组成刻子。',
      ],
      tileGroups: [
        { label: '两面：34 等 2/5', tiles: ['3m','4m'] },
        { label: '嵌张：24 等 3', tiles: ['2p','4p'] },
        { label: '边张：12 等 3', tiles: ['1s','2s'] },
        { label: '单骑：等雀头', tiles: ['6z'] },
      ],
      tip: '计分器要求指定“最终和牌张”，就是为了区分这些等待形。',
    },
    {
      id: 'scoring',
      eyebrow: '第六课 · 番、符与点数',
      title: '先数番，再算符',
      summary: '番表示役与宝牌的价值，符描述牌形与和牌方式。两者共同决定基本点，再区分亲子与荣和/自摸。',
      points: [
        '番：把所有成立的役与宝牌番数相加。',
        '符：通常从 20 符开始，再计算刻子、杠子、雀头、等待与和牌方式。',
        '七对子固定 25 符；平和自摸通常是 20 符。',
        '符数通常向上切到十位，再进入点数公式。',
        '5 番起进入满贯档；更高依次为跳满、倍满、三倍满与役满。',
      ],
      tileGroups: [
        { label: '例：3番40符', tiles: ['2m','3m','4m','4m','5m','6m','3p','4p','5p','7s','7s','7s','6p','6p'] },
      ],
      tip: '实战顺序：先确认有役 → 数番 → 算符 → 区分亲子与和牌方式。',
    },
  ],
  quiz: [
    {
      id: 'q1',
      question: '下面哪一组能组成顺子？',
      options: ['东、南、西', '3万、4万、5万', '7筒、7筒、8筒', '白、发、中'],
      answer: 1,
      explanation: '顺子必须是同一花色连续三张数牌；字牌不能组成顺子。',
    },
    {
      id: 'q2',
      question: '一副常规和牌通常由什么组成？',
      options: ['3 面子 + 2 雀头', '4 面子 + 1 雀头', '5 面子', '7 个刻子'],
      answer: 1,
      explanation: '常规形是四面子一雀头；七对子和国士无双属于特殊结构。',
    },
    {
      id: 'q3',
      question: '只有宝牌、没有任何役，可以和牌吗？',
      options: ['可以，宝牌就是役', '有 3 张宝牌才可以', '不可以，必须先有役', '自摸时可以'],
      answer: 2,
      explanation: '宝牌只增加番数，不单独构成役。没有役就不能和牌。',
    },
    {
      id: 'q4',
      question: '“2筒、4筒，只等3筒”属于什么听牌？',
      options: ['两面听', '嵌张听', '边张听', '双碰听'],
      answer: 1,
      explanation: '等待顺子中间一张叫嵌张听，计符时通常加 2 符。',
    },
    {
      id: 'q5',
      question: '吃、碰之后最需要先确认什么？',
      options: ['牌是不是更整齐', '副露后是否仍然有役', '手里还有几张字牌', '能不能立刻开杠'],
      answer: 1,
      explanation: '副露会破坏门前限定役。先确认剩余役路，避免做成“有形无役”。',
    },
    {
      id: 'q6',
      question: '下列哪一种听牌通常不增加听牌符？',
      options: ['两面听', '嵌张听', '边张听', '单骑听'],
      answer: 0,
      explanation: '两面听通常不加符；嵌张、边张、单骑各加 2 符。',
    },
  ],
};

function getTutorialLesson(id) {
  return MAHJONG_TUTORIAL.lessons.find(lesson => lesson.id === id) || null;
}

function gradeTutorialQuiz(answers) {
  const details = MAHJONG_TUTORIAL.quiz.map((question, index) => ({
    id: question.id,
    correct: Number(answers[index]) === question.answer,
    answer: question.answer,
    explanation: question.explanation,
  }));
  return {
    score: details.filter(item => item.correct).length,
    total: details.length,
    details,
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MAHJONG_TUTORIAL, getTutorialLesson, gradeTutorialQuiz };
}
