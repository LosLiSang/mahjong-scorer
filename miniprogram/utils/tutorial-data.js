// tutorial-data.js — 日麻入门教学内容与纯逻辑
// 不依赖 DOM；浏览器与 Node 测试共用。
// 每课含 points（要点）、terms（术语，term+def）、tileGroups（牌例，可带 win 胡牌张）、tip 与章末小测题号。

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
      terms: [
        { term: '数牌', def: '万、筒、索三种花色，各 1～9，共 27 种，是顺子的原料。' },
        { term: '字牌', def: '七种：东南西北（风牌）+ 白发中（三元牌），不能组成顺子。' },
        { term: '风牌', def: '东、南、西、北，和场次、座位有关，可当役牌。' },
        { term: '三元牌', def: '白、发、中，可组合成大三元/小三元等大役。' },
        { term: '老头牌', def: '1 和 9 的数牌，例如 1万、9万、1筒。' },
        { term: '幺九牌', def: '老头牌 + 字牌的统称，很多役靠它划定范围。' },
      ],
      tileGroups: [
        { label: '万子', tiles: ['1m','2m','3m','4m','5m','6m','7m','8m','9m'] },
        { label: '筒子', tiles: ['1p','2p','3p','4p','5p','6p','7p','8p','9p'] },
        { label: '索子', tiles: ['1s','2s','3s','4s','5s','6s','7s','8s','9s'] },
        { label: '字牌', tiles: ['1z','2z','3z','4z','5z','6z','7z'] },
      ],
      tip: '先记花色和数字，不必第一天背完所有役。',
      checkQuestionId: 'q1',
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
      terms: [
        { term: '摸牌', def: '轮到你时从牌山抓一张，再打一张，手牌数量保持不变。' },
        { term: '上家', def: '你左手边、先于你出牌的玩家；只有你能吃上家的舍牌。' },
        { term: '吃（顺子）', def: '用上家打出的牌配上手中两张，组成一组顺子。' },
        { term: '碰（刻子）', def: '任何玩家打出的牌，配上手中两张相同牌组成刻子。' },
        { term: '杠（杠子）', def: '四张相同牌组成杠子；开杠后从岭上补一张。' },
        { term: '副露', def: '吃、碰、明杠后手牌公开；会破坏「门前限定」的役。' },
        { term: '门前', def: '手牌从未被副露，保持隐蔽。' },
      ],
      tileGroups: [
        { label: '吃成顺子', tiles: ['3m','4m','5m'] },
        { label: '碰成刻子', tiles: ['7p','7p','7p'] },
        { label: '组成杠子', tiles: ['1z','1z','1z','1z'] },
      ],
      tip: '新手不要看到能吃碰就立刻按。先问：副露后，我还剩什么役？',
      checkQuestionId: 'q5',
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
      terms: [
        { term: '面子', def: '顺子、刻子、杠子的统称，是构成和牌的一组牌。' },
        { term: '顺子', def: '同花色连续三张数牌（如 3万4万5万）；字牌不能成顺。' },
        { term: '刻子', def: '三张完全相同的牌。' },
        { term: '杠子', def: '四张相同的牌，可视作一组面子。' },
        { term: '雀头（对子）', def: '两张完全相同的牌，和牌时必有一对。' },
        { term: '四面子一雀头', def: '常规和牌结构：4 组面子 + 1 对雀头，共 14 张。' },
      ],
      tileGroups: [
        { label: '顺子', tiles: ['1m','2m','3m'] },
        { label: '顺子', tiles: ['4p','5p','6p'] },
        { label: '顺子', tiles: ['7s','8s','9s'] },
        { label: '刻子', tiles: ['7z','7z','7z'] },
        { label: '雀头', tiles: ['5m','5m'] },
      ],
      tip: '牌凑齐结构仍不一定能和——还必须至少有一个“役”。',
      checkQuestionId: 'q2',
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
      terms: [
        { term: '役', def: '允许你和牌的条件；没有役就不能和牌。' },
        { term: '番', def: '役和宝牌的价值单位，番数越高点数越多。' },
        { term: '自摸', def: '自己摸到和牌张。' },
        { term: '荣和', def: '和别家打出的牌（点炮/放铳）。' },
        { term: '门前清自摸和', def: '保持门前且自摸和牌，成立 1 番。' },
        { term: '立直', def: '门前听牌时宣告，付 1000 点，成立 1 番 （且可看里宝牌）。' },
        { term: '役牌', def: '场风、自风、白/发/中的刻子或杠子，成立 1 番。' },
        { term: '断幺九', def: '整手牌不含 1、9 与字牌；副露也可成立。' },
        { term: '宝牌', def: '指示牌的下一张；只加番，不能单独当役。' },
      ],
      tileGroups: [
        { label: '断幺九示例', tiles: ['2m','3m','4m','2p','3p','4p','4s','5s','6s','6p','7p','8p','5s','5s'], win: '5s' },
      ],
      tip: '最实用的新手检查：我现在靠什么役和牌？答不出来，就先别急着副露。',
      checkQuestionId: 'q3',
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
      terms: [
        { term: '听牌', def: '只差一张就能和牌的状态。' },
        { term: '和牌张', def: '能使你和牌的那一张（计分时要指定这个「最终和牌张」）。' },
        { term: '两面听', def: '例 34 等 2 或 5，效率最高，通常不加听牌符。' },
        { term: '嵌张听', def: '例 24 只等 3，加 2 符。' },
        { term: '边张听', def: '例 12 等 3、89 等 7，加 2 符。' },
        { term: '单骑听', def: '只等雀头，加 2 符。' },
        { term: '双碰听', def: '两组对子，等其中一张组成刻子。' },
      ],
      tileGroups: [
        { label: '两面：34 等 2/5', tiles: ['3m','4m'] },
        { label: '嵌张：24 等 3', tiles: ['2p','4p'] },
        { label: '边张：12 等 3', tiles: ['1s','2s'] },
        { label: '单骑：等雀头', tiles: ['6z'] },
      ],
      tip: '计分器要求指定“最终和牌张”，就是为了区分这些等待形。',
      checkQuestionId: 'q4',
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
      terms: [
        { term: '番', def: '把所有成立的役与宝牌番数相加，决定点数档位。' },
        { term: '符', def: '描述牌形与和牌方式的数值，和番一起套进点数公式。' },
        { term: '亲家', def: '本局庄家（东位），荣和/自摸点数更高。' },
        { term: '子家', def: '庄家以外的玩家。' },
        { term: '基本点', def: '由番与符算出的基础值，再按亲子与荣和/自摸翻倍。' },
        { term: '满贯', def: '点数档位；5 番或 4番40符等到达的封顶值。' },
      ],
      tileGroups: [
        { label: '例：3番40符', tiles: ['2m','3m','4m','4m','5m','6m','3p','4p','5p','7s','7s','7s','6p','6p'], win: '6p' },
      ],
      tip: '实战顺序：先确认有役 → 数番 → 算符 → 区分亲子与和牌方式。',
      checkQuestionId: 'q16',
    },
    {
      id: 'fu-detail',
      eyebrow: '第七课 · 符数拆解',
      title: '符要一项一项加',
      summary: '普通牌型从 20 符副底开始，依次加和牌方式、雀头、等待与刻杠符，最后向上进位到十位。',
      points: [
        '门前荣和加 10 符；一般自摸加 2 符。',
        '役牌雀头、嵌张、边张、单骑通常各加 2 符。',
        '刻子与杠子根据明暗、是否幺九牌决定 2～32 符。',
        '普通牌型合计后向上切十位；七对子固定 25 符。',
      ],
      terms: [
        { term: '副底', def: '普通牌型的固定 20 符起点。' },
        { term: '门前荣和 +10', def: '未副露时荣和额外加 10 符。' },
        { term: '自摸加符', def: '通常自摸加 2 符（门前自摸常计 20 符）。' },
        { term: '听牌符', def: '嵌张、边张、单骑各加 2 符；两面不加。' },
        { term: '役牌雀头 +2', def: '雀头是役牌（场风/自风/白发中）加 2 符。' },
        { term: '刻杠符', def: '刻子/杠子按明暗、是否幺九给 2～32 符。' },
        { term: '七对子固定符', def: '七对子固定 25 符，不进位。' },
      ],
      tileGroups: [
        { label: '嵌张等待示例', tiles: ['2p','4p'] },
        { label: '幺九暗刻示例', tiles: ['1z','1z','1z'] },
      ],
      tip: '学完后打开下方“算分详解 → 符数”，那里有完整的 42→50 符计算过程。',
      checkQuestionId: 'q17',
    },
    {
      id: 'limits',
      eyebrow: '第八课 · 满贯以上',
      title: '满贯不是役，是点数档位',
      summary: '番符达到上限后，不再按普通公式无限增长，而是进入满贯、跳满、倍满、三倍满或役满。',
      points: [
        '5 番直接是满贯；4 番 40 符、3 番 70 符也达到满贯。',
        '6～7 番是跳满，8～10 番是倍满，11～12 番是三倍满。',
        '役满是最高常规档位；役满役与“累计 13 番”是否等同取决于规则。',
        '档位只决定点数上限，不能替代“至少有一个役”的和牌条件。',
      ],
      terms: [
        { term: '满贯', def: '5 番；或 4番40符、3番70符以上的封顶档。' },
        { term: '跳满', def: '6～7 番的点数档位。' },
        { term: '倍满', def: '8～10 番的点数档位。' },
        { term: '三倍满', def: '11～12 番的点数档位。' },
        { term: '役满', def: '最高常规档位；役满役或累计 13 番。' },
      ],
      tileGroups: [
        { label: '4番40符：达到满贯线', tiles: ['2m','3m','4m','4m','5m','6m','3p','4p','5p','7s','7s','7s','6p','6p'], win: '6p' },
      ],
      tip: '记档位边界，不要死背每一格点数表；亲子和荣和/自摸交给公式拆分。',
      checkQuestionId: 'q18',
    },
    {
      id: 'strategy',
      eyebrow: '第九课 · 开局策略',
      title: '起手这么想，少走弯路',
      summary: '一套简单好记的开局思路，帮你快速判断该留什么、打什么、往什么役做。',
      points: [
        '1️⃣ 先数牌型：起手扫一眼有几组顺子/刻子、几个对子，离「四面子一雀头」还差几组。',
        '2️⃣ 留好型：顺子最灵活（容易两面听），刻子做牌快但难改；带对子、连张的好型优先留。',
        '3️⃣ 打孤张：单张、孤风牌、孤张字牌、边张 12/89 优先打；中张连张（34、56）是好牌要留。',
        '4️⃣ 先想役：定下这手牌靠什么役和牌。没说清役，就先守住门前，等立直或门前清自摸。',
        '5️⃣ 有役牌刻子先留：白发中或场风/自风凑齐刻子就是现成的 1 番。',
        '6️⃣ 别乱副露：吃碰会破坏门前役；除非副露后仍有役（如断幺九），否则先犹豫。',
        '7️⃣ 新手路线：先做「断幺九」（无 1/9/字），再练「平和」（全顺子 + 两面听），都稳定。',
        '8️⃣ 别贪大役：清一色、混一色很吃运气，容易做成「有形无役」；先学会稳定和牌。',
      ],
      terms: [
        { term: '孤张', def: '孤立、连不上顺子也凑不成对子的单张，通常优先打。' },
        { term: '连张', def: '相邻两张的搭子（如 34、56），最容易成顺子。' },
        { term: '好型', def: '听牌后效率高的形状，例如两面听、多面听。' },
      ],
      tileGroups: [
        { label: '好型：两面连张 + 对子（留）', tiles: ['3m','4m','6p','6p','2s','3s'] },
        { label: '孤张 / 边张（先打）', tiles: ['1m','9m','1s','4z'] },
      ],
      tip: '新手练牌从「断幺九 + 平和」起步最稳：牌型基础、讲解简单、能吃能碰不亏。',
      checkQuestionId: 'q7',
    },
  ],
  questions: [
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
    {
      id: 'q7',
      question: '起手第一件事最该做什么？',
      options: ['立刻吃碰', '数牌型、看还剩多少面子和对子', '直接定清一色', '把幺九全打光'],
      answer: 1,
      explanation: '先数牌型、定役，再决定留牌方向，是开局最稳的思路。',
    },
    {
      id: 'q8',
      question: '新手最推荐先练哪个役？',
      options: ['清一色', '混一色', '断幺九', '国士无双'],
      answer: 2,
      explanation: '断幺九只需避开 1/9 和字牌，牌型简单、能吃能碰，最适合新手。',
    },
    {
      id: 'q9',
      question: '手牌「3万4万5万、3筒4筒5筒、5索6索7索、8索8索8索、6万6万」最可能成立什么役？',
      options: ['清一色', '断幺九', '混一色', '国士无双'],
      answer: 1,
      explanation: '整手不含 1、9 与字牌，满足断幺九；因带一组刻子，所以不是平和。',
    },
    {
      id: 'q10',
      question: '手牌全是刻子加一对雀头（111万、333筒、555索、777中、22万），是什么役？',
      options: ['平和', '一杯口', '对对和', '断幺九'],
      answer: 2,
      explanation: '四个面子都是刻子、无顺子的和牌就是对对和。',
    },
    {
      id: 'q11',
      question: '一手牌全部由顺子组成，雀头是 4万4万（非役牌）、听两面，最可能是什么役？',
      options: ['对对和', '平和', '混一色', '国士无双'],
      answer: 1,
      explanation: '全顺子 + 非役牌雀头 + 两面听，正是平和的关键条件。',
    },
    {
      id: 'q12',
      question: '「11万、22万、33筒、44筒、55索、66索、77筒」属于哪种和牌形式？',
      options: ['四面子一雀头', '七对子', '国士无双', '三杠子'],
      answer: 1,
      explanation: '七组互不相同的对子就是七对子，是特殊结构。',
    },
    {
      id: 'q13',
      question: '手牌全部是万子（123万、456万、789万、234万、11万），是什么役？',
      options: ['混一色', '清一色', '断幺九', '平和'],
      answer: 1,
      explanation: '整手只用单一花色（万子），不掺字牌，是清一色。',
    },
    {
      id: 'q14',
      question: '手里有「白、白、白」这一组刻子，就已经能成立什么役？',
      options: ['断幺九', '平和', '役牌（三元牌）', '清一色'],
      answer: 2,
      explanation: '白、发、中的刻子是役牌，成立 1 番；与场风/自风同理。',
    },
    {
      id: 'q15',
      question: '手牌全是筒子加字牌（123筒、456筒、789筒、中中中、东东），是什么役？',
      options: ['清一色', '混一色', '断幺九', '平和'],
      answer: 1,
      explanation: '单一花色数牌 + 字牌就是混一色；若混入字牌便不是清一色。',
    },
    {
      id: 'q16',
      question: '确认手牌可以和牌后，计算点数的正确顺序是什么？',
      options: ['先算符，再找役', '先数番，再算符', '只看宝牌数量', '先区分亲家，再找役'],
      answer: 1,
      explanation: '先确认有役并把役与宝牌的番数相加，再计算符，最后区分亲子与和牌方式。',
    },
    {
      id: 'q17',
      question: '普通牌型合计得到 42 符，最终应按多少符计算？',
      options: ['40 符', '42 符', '45 符', '50 符'],
      answer: 3,
      explanation: '普通牌型的符数要向上进位到十位，所以 42 符按 50 符计算。',
    },
    {
      id: 'q18',
      question: '一手牌合计 6 番，进入哪个点数档位？',
      options: ['满贯', '跳满', '倍满', '三倍满'],
      answer: 1,
      explanation: '6～7 番是跳满；5 番是满贯，8～10 番是倍满。',
    },
    {
      id: 'q19',
      question: '东一局南家，起手有 34万、56筒和一张孤立的北风，通常优先打哪一类牌？',
      options: ['34万连张', '56筒连张', '孤立的北风', '任意对子'],
      answer: 2,
      explanation: '中张连张容易发展成两面顺子；无役牌价值的孤张字牌通常更适合先打。',
    },
  ],
  trainingTopics: [
    {
      id: 'basic-concepts',
      icon: '🀄',
      title: '牌与和牌基础',
      description: '认牌、面子、雀头、役与副露',
      questionIds: ['q1', 'q2', 'q3', 'q5'],
    },
    {
      id: 'waits-scoring',
      icon: '🧮',
      title: '听牌与算分',
      description: '听牌形、番符顺序与点数档位',
      questionIds: ['q4', 'q6', 'q16', 'q17', 'q18'],
    },
    {
      id: 'yaku-shapes',
      icon: '🎴',
      title: '役形判断',
      description: '从完整手牌判断常见役种',
      questionIds: ['q9', 'q10', 'q11', 'q12', 'q13', 'q14', 'q15'],
    },
    {
      id: 'opening-strategy',
      icon: '🧭',
      title: '开局决策',
      description: '留好型、打孤张与新手役路线',
      questionIds: ['q7', 'q8', 'q19'],
    },
  ],
};

function getTutorialLesson(id) {
  return MAHJONG_TUTORIAL.lessons.find(lesson => lesson.id === id) || null;
}

function getTutorialQuestion(id) {
  return MAHJONG_TUTORIAL.questions.find(question => question.id === id) || null;
}

function getTrainingTopic(id) {
  const topic = MAHJONG_TUTORIAL.trainingTopics.find(item => item.id === id);
  if (!topic) return null;
  return {
    ...topic,
    questions: topic.questionIds.map(getTutorialQuestion).filter(Boolean),
  };
}

function gradeTutorialQuestions(questions, answers) {
  const details = questions.map((question, index) => ({
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

function gradeTrainingTopic(topicId, answers) {
  const topic = getTrainingTopic(topicId);
  return topic ? gradeTutorialQuestions(topic.questions, answers) : null;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    MAHJONG_TUTORIAL,
    getTutorialLesson,
    getTutorialQuestion,
    getTrainingTopic,
    gradeTutorialQuestions,
    gradeTrainingTopic,
  };
}
