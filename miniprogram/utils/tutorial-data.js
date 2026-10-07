// tutorial-data.js — 日麻入门教学内容与纯逻辑
// 不依赖 DOM；浏览器与 Node 测试共用。
// 每课含 points（要点）、terms（术语，term+def）、tileGroups（牌例，可带 win 胡牌张）、tip 与章末小测题号。
// 题目可选 tileGroups（题干配牌，按面子分组）与 optionTiles（与 options 对齐，每项为牌 id 数组或 null）。

const MAHJONG_TUTORIAL = {
  lessons: [
    {
      id: 'tiles',
      eyebrow: '认识牌',
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
      eyebrow: '一局怎么进行',
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
      eyebrow: '和牌结构',
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
      eyebrow: '役',
      title: '有结构，还要有役',
      summary: '役是允许你和牌的条件。宝牌只增加番数，不能单独充当役。',
      points: [
        '为什么需要役：如果凑齐牌形就能和，牌局只剩比谁摸得快。役规定了哪些手形「值得奖励」，让你在速度和打点之间做选择。',
        '役也给吃碰定了代价：很多役只在门前成立，副露后会消失，所以吃碰前要先想好役从哪来。',
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
      id: 'yaku-basic',
      eyebrow: '一番役',
      title: '最常用的一番役',
      summary: '实战里大部分和牌靠这几个一番役。弄懂它们为什么存在，就知道什么时候该守门前、什么时候能吃碰。',
      points: [
        '立直（门前限定）：听牌后宣告并付 1000 点。代价是之后不能再换牌，只能摸什么打什么；回报是 1 番，还有一发和里宝牌的机会。它的作用是让任何门前听牌都至少有一条役。',
        '门前清自摸和（门前限定）：不吃不碰，并且自己摸到和牌张。奖励「全靠自己」的和牌。',
        '平和（门前限定）：四组都是顺子、雀头不是役牌、听两面。这是最朴素的手形，几乎拿不到符，所以用 1 番补偿。',
        '断幺九：整手牌只有 2～8 的数牌。常见规则允许吃碰后成立（食断），是最容易做成的役。',
        '役牌：白、发、中，或场风、自风的刻子。碰出来就有役，是吃碰时最常见的役来源；场风和自风相同时（连风牌）算 2 番。',
        '一杯口（门前限定）：两组完全相同的顺子，例如 223344万。',
        '一发、岭上开花、海底摸月、河底捞鱼、抢杠：靠时机成立的偶然役，遇到了别忘记算。',
      ],
      terms: [
        { term: '门前限定', def: '只有不吃不碰（暗杠除外）时才成立的役，如立直、平和、门前清自摸和、一杯口。' },
        { term: '食断', def: '吃碰之后成立的断幺九；多数规则允许。' },
        { term: '连风牌', def: '场风与自风是同一张风牌时，这张牌的刻子算 2 番。' },
        { term: '一发', def: '立直后一巡内（中间没人吃碰杠）和牌，加 1 番。' },
        { term: '偶然役', def: '岭上开花、海底摸月、河底捞鱼、抢杠等，靠和牌时机成立。' },
      ],
      tileGroups: [
        { label: '平和：全顺子 + 非役牌雀头 + 两面听（67索 等 5/8索）', tiles: ['2m','3m','4m','5m','6m','7m','3p','4p','5p','6s','7s','8s','9p','9p'], win: '8s' },
        { label: '一杯口：两组相同顺子', tiles: ['2m','2m','3m','3m','4m','4m'] },
        { label: '役牌：白的刻子', tiles: ['5z','5z','5z'] },
      ],
      tip: '吃碰前先确认：立直、门前清自摸和、平和、一杯口都会消失，剩下的只有断幺九、役牌这类「副露也算」的役。',
      checkQuestionId: 'q20',
    },
    {
      id: 'yaku-advanced',
      eyebrow: '两番以上',
      title: '高打点的役从哪来',
      summary: '两番以上的役大多要求手牌「统一」：同一种花色、同一个数字、同一类牌。越难凑齐，番数越高。',
      points: [
        '为什么番数不同：役的番数大致对应做成它的难度。越整齐、越要靠运气的牌形，番数越高。',
        '副露减番：三色同顺、一气通贯、混全带幺九、纯全带幺九、混一色、清一色在吃碰后各少 1 番。这是在门前的耐心和吃碰的速度之间做平衡。',
        '三色同顺（2 番）：万、筒、索各有一组数字相同的顺子，例如 345万 345筒 345索。',
        '一气通贯（2 番）：同一种花色的 123、456、789。',
        '对对和（2 番）：四组都是刻子。常靠碰来完成，速度快，但听牌形状通常不好。',
        '三暗刻（2 番）：三组自己摸来、没有碰的刻子。',
        '七对子（2 番，门前限定）：七组互不相同的对子，固定 25 符。',
        '混一色（3 番，副露 2 番）：一种花色加字牌。清一色（6 番，副露 5 番）：只有一种花色。',
        '小三元（2 番）：两组三元牌刻子加一对三元牌雀头。两组刻子本身还是役牌，实际至少 4 番。',
      ],
      terms: [
        { term: '副露减番', def: '部分役吃碰后番数减 1，日文叫「食い下がり」。' },
        { term: '暗刻', def: '全靠自己摸齐的刻子；碰来的叫明刻。' },
        { term: '复合', def: '一手牌同时成立多个役，番数相加，例如断幺九 + 平和 + 一杯口。' },
      ],
      tileGroups: [
        { label: '三色同顺：345 三种花色', tiles: ['3m','4m','5m','3p','4p','5p','3s','4s','5s'] },
        { label: '一气通贯：同花色 123 456 789', tiles: ['1p','2p','3p','4p','5p','6p','7p','8p','9p'] },
        { label: '混一色：索子 + 字牌', tiles: ['1s','2s','3s','5s','6s','7s','9s','9s','9s','1z','1z','1z','6z','6z'], win: '6z' },
      ],
      tip: '做大牌前先问两件事：还要几巡？吃碰后还剩几番？速度和打点要一起算。',
      checkQuestionId: 'q21',
    },
    {
      id: 'waits',
      eyebrow: '听牌形',
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
      id: 'furiten',
      eyebrow: '振听',
      title: '自己打过的牌，不能荣和',
      summary: '振听时不能荣和，只能自摸。这条规则让每个人的舍牌都成了公开信息，防守才有依据。',
      points: [
        '为什么要有振听：如果你打过的牌还能荣和别人，那看你的舍牌就毫无参考价值。振听保证「你打过的牌对你是安全的」，这是所有防守技术的基础。',
        '舍牌振听：你听的任意一张牌出现在自己的舍牌里，就不能荣和。听多面时，只要其中一张打过，所有和牌张都不能荣和。',
        '同巡振听：别人打出你的和牌张而你没有荣和，到你下一次摸牌之前，其他人打出和牌张也不能荣和。',
        '立直振听：立直后放过一次和牌张，这一局之后都不能荣和。',
        '振听仍然可以自摸和牌。',
        '实战习惯：听牌时扫一眼自己的舍牌；换听之后要重新检查一遍。',
      ],
      terms: [
        { term: '振听', def: '不能荣和、只能自摸的状态。' },
        { term: '舍牌振听', def: '自己的舍牌里有自己的和牌张。' },
        { term: '同巡振听', def: '放过别人打出的和牌张后，到自己下次摸牌前都不能荣和。' },
        { term: '立直振听', def: '立直后放过和牌张，本局之后都不能荣和。' },
      ],
      tileGroups: [
        { label: '手里 45万，听 3万 / 6万', tiles: ['4m','5m'] },
        { label: '自己的舍牌里有 6万 → 3万也不能荣和', tiles: ['1z','9p','6m','2s'] },
      ],
      tip: '听的牌越多，越容易振听。多面听时一定回头看看自己的舍牌。',
      checkQuestionId: 'q22',
    },
    {
      id: 'scoring',
      eyebrow: '番、符与点数',
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
      eyebrow: '符数拆解',
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
      tip: '学完后到「工具 → 算分详解 → 符数」，那里有完整的 42→50 符计算过程。',
      checkQuestionId: 'q17',
    },
    {
      id: 'limits',
      eyebrow: '满贯以上',
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
      eyebrow: '开局策略',
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
    {
      id: 'attack',
      eyebrow: '进攻',
      title: '先听牌，再谈打点',
      summary: '麻将比的是速度：谁先听牌、听得越好，越可能和牌。进攻的核心是「快」和「好型」。',
      points: [
        '为什么速度最重要：标准规则一局只有一家和牌。没听牌时，手里的牌再大也是 0 分。',
        '向听数：离听牌还差几步。听牌是 0 向听；每次摸牌，尽量让向听数变少。',
        '留进张多的搭子：两面搭子（如 34）能进 8 张，嵌张（24）、边张（12）只能进 4 张。要拆搭子时，先拆差的。',
        '先制立直：门前好型听牌时先立直通常最赚，加番的同时逼对手防守。',
        '默听（不立直）：已经有役、打点够，或者不想暴露听牌时，可以不立直，保留换牌和防守的余地。',
        '好型与愚型：两面、三面这类听很多张的是好型；嵌张、边张、单骑是愚型。愚型听牌的和牌率低，可以先等它变好再立直。',
      ],
      terms: [
        { term: '向听数', def: '离听牌还差几步；0 向听即听牌。' },
        { term: '进张', def: '能让向听数减少的牌。' },
        { term: '好型', def: '听牌张数多的形状，如两面、三面。' },
        { term: '愚型', def: '听牌张数少的形状，如嵌张、边张、单骑。' },
        { term: '先制立直', def: '在对手之前率先立直，掌握主动。' },
        { term: '默听', def: '听牌后不宣告立直，悄悄等和牌。' },
      ],
      tileGroups: [
        { label: '两面搭子：等 2索 / 5索，共 8 张', tiles: ['3s','4s'] },
        { label: '嵌张搭子：只等 3筒，共 4 张', tiles: ['2p','4p'] },
      ],
      tip: '起手到听牌，优先速度；听牌之后，再根据好型和打点决定立不立直。',
      checkQuestionId: 'q24',
    },
    {
      id: 'defense',
      eyebrow: '防守',
      title: '别人立直了，先别点炮',
      summary: '放铳要一个人付全部点数，损失远大于被自摸时三家分摊。防守的目标是：打出对手不能荣和的牌。',
      points: [
        '为什么要防守：荣和由放铳者一人全付，自摸是其他家分摊。放铳一次满贯就是 8000 点，比好几次小和赚的还多。',
        '现物（最安全）：对手自己打过的牌。因为振听规则，对手不可能荣和这张。',
        '立直后的安全牌：对手立直后，别家打出而他没有荣和的牌，之后对他也安全（立直振听）。',
        '筋：对手打过 4，那么 1 和 7 不会是他两面听的和牌张——等 1/4 或 4/7 的两面都会因振听不能荣和。筋牌比无筋牌安全，但挡不住嵌张、边张、单骑、双碰。',
        '字牌：场上已经出现 2～3 张的字牌，只剩单骑或双碰能和，相对安全。',
        '壁：某张数牌的 4 张都能看见（如 4 张 8筒），对手就不可能用 78筒 两面等 9筒。',
        '弃和：放弃自己和牌，只打安全牌。手牌差、对手又立直时，弃和往往比硬推更划算。',
      ],
      terms: [
        { term: '放铳', def: '打出的牌被别人荣和，由你一人支付。' },
        { term: '现物', def: '对手自己的舍牌，对他绝对安全。' },
        { term: '筋', def: '同花色相差 3 的牌（1-4-7、2-5-8、3-6-9），用于排除两面听。' },
        { term: '壁', def: '某张牌 4 张都已现身，相邻的两面听不可能存在。' },
        { term: '弃和', def: '放弃和牌、专打安全牌的防守方式。' },
      ],
      tileGroups: [
        { label: '对手打过 4万 → 筋牌 1万、7万', tiles: ['1m','4m','7m'] },
        { label: '现物：对手自己打过的牌', tiles: ['2p','9s','3z'] },
      ],
      tip: '安全度：现物 > 出现多张的字牌 > 筋牌 > 其他。平时手里留 1～2 张安全牌，危险来时才有牌可打。',
      checkQuestionId: 'q25',
    },
    {
      id: 'push-fold',
      eyebrow: '攻守判断',
      title: '推还是弃，算一笔账',
      summary: '别人立直时，要比较「自己和牌能赚多少」和「放铳会亏多少」。这一章给出新手能直接用的判断。',
      points: [
        '为什么要判断：只会进攻会大量放铳，只会防守永远赢不了。每打一张牌，都是在和牌机会和放铳风险之间取舍。',
        '推（继续进攻）：自己已经听牌而且是好型，或者打点高（满贯以上），通常值得推。',
        '弃（弃和）：自己还差 2 步以上才听牌（2 向听以上），而对手已经立直，基本直接弃和。',
        '中间状态（1 向听）：手牌好型多、打点高，可以在安全牌里挑能前进的打（迂回打法）；否则弃和。',
        '看是谁立直：亲家立直和牌点数是子家的 1.5 倍，更要小心。吃碰过的对手，先看他可能在做什么役（役牌、混一色等）。',
        '看局况：最后几局分差很小时，名次比点数重要，推弃标准也要跟着变。',
      ],
      terms: [
        { term: '推', def: '面对对手听牌仍继续进攻。' },
        { term: '迂回打法', def: '在安全牌里挑能保持进攻的牌打，也叫「回し打ち」。' },
        { term: '一向听', def: '再进一张就听牌的状态。' },
        { term: '局况', def: '场次、分差、名次等整场形势。' },
      ],
      tileGroups: [],
      tip: '新手口诀：自己没听牌、别人立直 → 先弃；自己好型听牌 → 可以推。',
      checkQuestionId: 'q26',
    },
  ],
  questions: [
    {
      id: 'q1',
      question: '下面哪一组能组成顺子？',
      optionTiles: [['1z','2z','3z'], ['3m','4m','5m'], ['7p','7p','8p'], ['5z','6z','7z']],
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
      tileGroups: [{ label: '手牌', tiles: ['2p','4p'] }, { label: '等', tiles: ['3p'] }],
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
      tileGroups: [{ tiles: ['3m','4m','5m'] }, { tiles: ['3p','4p','5p'] }, { tiles: ['5s','6s','7s'] }, { tiles: ['8s','8s','8s'] }, { tiles: ['6m','6m'] }],
      options: ['清一色', '断幺九', '混一色', '国士无双'],
      answer: 1,
      explanation: '整手不含 1、9 与字牌，满足断幺九；因带一组刻子，所以不是平和。',
    },
    {
      id: 'q10',
      question: '手牌全是刻子加一对雀头（111万、333筒、555索、777中、22万），是什么役？',
      tileGroups: [{ tiles: ['1m','1m','1m'] }, { tiles: ['3p','3p','3p'] }, { tiles: ['5s','5s','5s'] }, { tiles: ['7z','7z','7z'] }, { tiles: ['2m','2m'] }],
      options: ['平和', '一杯口', '对对和', '断幺九'],
      answer: 2,
      explanation: '四个面子都是刻子、无顺子的和牌就是对对和。',
    },
    {
      id: 'q11',
      question: '一手牌全部由顺子组成，雀头是 4万4万（非役牌）、听两面，最可能是什么役？',
      tileGroups: [{ label: '雀头', tiles: ['4m','4m'] }],
      options: ['对对和', '平和', '混一色', '国士无双'],
      answer: 1,
      explanation: '全顺子 + 非役牌雀头 + 两面听，正是平和的关键条件。',
    },
    {
      id: 'q12',
      question: '「11万、22万、33筒、44筒、55索、66索、77筒」属于哪种和牌形式？',
      tileGroups: [{ tiles: ['1m','1m'] }, { tiles: ['2m','2m'] }, { tiles: ['3p','3p'] }, { tiles: ['4p','4p'] }, { tiles: ['5s','5s'] }, { tiles: ['6s','6s'] }, { tiles: ['7p','7p'] }],
      options: ['四面子一雀头', '七对子', '国士无双', '三杠子'],
      answer: 1,
      explanation: '七组互不相同的对子就是七对子，是特殊结构。',
    },
    {
      id: 'q13',
      question: '手牌全部是万子（123万、456万、789万、234万、11万），是什么役？',
      tileGroups: [{ tiles: ['1m','2m','3m'] }, { tiles: ['4m','5m','6m'] }, { tiles: ['7m','8m','9m'] }, { tiles: ['2m','3m','4m'] }, { tiles: ['1m','1m'] }],
      options: ['混一色', '清一色', '断幺九', '平和'],
      answer: 1,
      explanation: '整手只用单一花色（万子），不掺字牌，是清一色。',
    },
    {
      id: 'q14',
      question: '手里有「白、白、白」这一组刻子，就已经能成立什么役？',
      tileGroups: [{ tiles: ['5z','5z','5z'] }],
      options: ['断幺九', '平和', '役牌（三元牌）', '清一色'],
      answer: 2,
      explanation: '白、发、中的刻子是役牌，成立 1 番；与场风/自风同理。',
    },
    {
      id: 'q15',
      question: '手牌全是筒子加字牌（123筒、456筒、789筒、中中中、东东），是什么役？',
      tileGroups: [{ tiles: ['1p','2p','3p'] }, { tiles: ['4p','5p','6p'] }, { tiles: ['7p','8p','9p'] }, { tiles: ['7z','7z','7z'] }, { tiles: ['1z','1z'] }],
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
      tileGroups: [{ tiles: ['3m','4m'] }, { tiles: ['5p','6p'] }, { tiles: ['4z'] }],
      options: ['34万连张', '56筒连张', '孤立的北风', '任意对子'],
      answer: 2,
      explanation: '中张连张容易发展成两面顺子；无役牌价值的孤张字牌通常更适合先打。',
    },
    {
      id: 'q20',
      question: '下列哪个役在吃碰之后仍然成立？',
      options: ['立直', '平和', '断幺九', '门前清自摸和'],
      answer: 2,
      explanation: '断幺九在多数规则下吃碰后也成立（食断）；立直、平和、门前清自摸和都是门前限定。',
    },
    {
      id: 'q21',
      question: '混一色门前是 3 番，吃碰之后是几番？',
      options: ['1 番', '2 番', '3 番', '不能成立'],
      answer: 1,
      explanation: '混一色属于副露减番的役，吃碰后少 1 番，变成 2 番。',
    },
    {
      id: 'q22',
      question: '你听 2万 / 5万，第 3 巡曾经打过 5万。现在别人打出 2万，你能荣和吗？',
      options: ['能，2万没打过', '不能，舍牌振听', '只有立直后才能', '能，但不计番'],
      answer: 1,
      explanation: '舍牌里有任意一张自己的和牌张就是振听，所有和牌张都不能荣和，只能自摸。',
    },
    {
      id: 'q23',
      question: '振听时还能怎样和牌？',
      options: ['只能荣和', '只能自摸', '完全不能和', '只能和役满'],
      answer: 1,
      explanation: '振听只禁止荣和，自己摸到和牌张仍然可以自摸和。',
    },
    {
      id: 'q24',
      question: '34万 和 24万 两个搭子，哪个进张更多？',
      options: ['34万：两面，8 张', '24万：嵌张，8 张', '一样多', '都没有进张'],
      answer: 0,
      explanation: '两面搭子等两种牌，共 8 张；嵌张只等中间一种，共 4 张。',
    },
    {
      id: 'q25',
      question: '对手立直，他的舍牌里有 6筒。下面哪张对他绝对安全？',
      options: ['6筒', '3筒', '9筒', '5筒'],
      answer: 0,
      explanation: '6筒是现物，振听规则保证他不能荣和。3筒、9筒是筋牌，只能排除两面听，不是绝对安全。',
    },
    {
      id: 'q26',
      question: '对手立直，你还差 2 步才听牌，打点也普通，通常怎么做？',
      options: ['继续进攻，打危险牌', '弃和，打安全牌', '马上吃碰加速', '随便打'],
      answer: 1,
      explanation: '2 向听以上很难追上已立直的对手，放铳的风险远大于和牌的收益，应当弃和。',
    },
    {
      id: 'q27',
      question: '宣告立直需要满足什么条件？',
      options: ['门前听牌，且点数至少 1000', '任何时候都可以', '吃碰后听牌也行', '手里有宝牌'],
      answer: 0,
      explanation: '立直必须门前（没有吃碰）、已经听牌，并能支付 1000 点立直棒。',
    },
    {
      id: 'q28',
      question: '小三元实际至少有几番？',
      options: ['1 番', '2 番', '4 番', '13 番'],
      answer: 2,
      explanation: '小三元本身 2 番，两组三元牌刻子又各是 1 番役牌，合计至少 4 番。',
    },
    {
      id: 'q29',
      question: '你没立直。上家打出你的和牌张，你没荣和；紧接着对家又打出同一张，能荣和吗？',
      options: ['能', '不能，同巡振听', '只能等自摸后再说', '能，但要先立直'],
      answer: 1,
      explanation: '放过和牌张后，到你下一次摸牌之前都是同巡振听，不能荣和。',
    },
    {
      id: 'q30',
      question: '立直后放过一次和牌张，之后还能荣和吗？',
      options: ['下一巡就可以', '本局都不能荣和，只能自摸', '换听之后可以', '荣和、自摸都不行'],
      answer: 1,
      explanation: '立直后不能换牌，放过和牌张就是立直振听，本局只能靠自摸。',
    },
    {
      id: 'q31',
      question: '对手打过 4索。下面哪张是它的筋牌？',
      options: ['1索', '2索', '5索', '8索'],
      answer: 0,
      explanation: '1-4-7 是一条筋。对手打过 4索，1索和 7索就不会是他两面听的和牌张。',
    },
    {
      id: 'q32',
      question: '为什么放铳比被自摸更伤？',
      options: ['放铳会被额外罚分', '荣和由放铳者一人付全部点数', '放铳要多付本场', '没有区别'],
      answer: 1,
      explanation: '自摸由其他家分摊，荣和则由放铳者一人全付，所以防守的重点是不放铳。',
    },
  ],
  // 学习阶段：首页按阶段分组展示章节，训练在对应阶段学完后推荐
  stages: [
    { id: 'intro', title: '入门', lessonIds: ['tiles', 'turn', 'winning-shape'] },
    { id: 'yaku', title: '役与和牌', lessonIds: ['yaku', 'yaku-basic', 'yaku-advanced', 'waits', 'furiten'] },
    { id: 'scoring', title: '算分', lessonIds: ['scoring', 'fu-detail', 'limits'] },
    { id: 'practice', title: '实战', lessonIds: ['strategy', 'attack', 'defense', 'push-fold'] },
  ],
  trainingTopics: [
    {
      id: 'basic-concepts',
      stageId: 'intro',
      icon: '🀄',
      title: '牌与和牌基础',
      description: '认牌、面子、雀头、役与副露',
      questionIds: ['q1', 'q2', 'q3', 'q5'],
    },
    {
      id: 'waits-scoring',
      stageId: 'scoring',
      icon: '🧮',
      title: '听牌与算分',
      description: '听牌形、番符顺序与点数档位',
      questionIds: ['q4', 'q6', 'q16', 'q17', 'q18'],
    },
    {
      id: 'yaku-shapes',
      stageId: 'yaku',
      icon: '🎴',
      title: '役形判断',
      description: '从完整手牌判断常见役种',
      questionIds: ['q9', 'q10', 'q11', 'q12', 'q13', 'q14', 'q15'],
    },
    {
      id: 'opening-strategy',
      stageId: 'practice',
      icon: '🧭',
      title: '开局决策',
      description: '留好型、打孤张与新手役路线',
      questionIds: ['q7', 'q8', 'q19'],
    },
    {
      id: 'yaku-value',
      stageId: 'yaku',
      icon: '🀅',
      title: '役的价值与吃碰',
      description: '门前限定、副露减番与复合番数',
      questionIds: ['q20', 'q21', 'q27', 'q28'],
    },
    {
      id: 'furiten-rules',
      stageId: 'yaku',
      icon: '🚫',
      title: '振听规则',
      description: '舍牌振听、同巡振听与立直振听',
      questionIds: ['q22', 'q23', 'q29', 'q30'],
    },
    {
      id: 'attack-defense',
      stageId: 'practice',
      icon: '🛡️',
      title: '攻守判断',
      description: '进张、现物与筋、推还是弃',
      questionIds: ['q24', 'q25', 'q26', 'q31', 'q32'],
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

// 题目配牌视图：把 tileGroups / optionTiles 的牌 id 转成可渲染的牌图；srcOf 由调用方注入（小程序传 Shared.tileSrc）
function decorateQuestionTiles(question, srcOf) {
  if (!question) return question;
  const toTiles = (ids, prefix) => (ids || []).map((id, index) => ({ key: `${prefix}-${index}`, id, src: srcOf(id), isHaku: id === '5z' }));
  const options = question.options || [];
  return {
    ...question,
    tileRows: (question.tileGroups || []).map((group, index) => ({
      key: `g${index}`,
      label: group.label || '',
      tiles: toTiles(group.tiles, `g${index}`),
    })),
    optionViews: options.map((text, index) => {
      const ids = question.optionTiles && question.optionTiles[index];
      return { text, tiles: Array.isArray(ids) ? toTiles(ids, `o${index}`) : [] };
    }),
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

// 首页视图：继续学习哪一章、各阶段完成度、训练是否推荐。
// progress 为已学会章节 id 列表；纯函数，不读存储。
function buildTutorialHome(progress) {
  const learned = new Set(Array.isArray(progress) ? progress : []);
  const lessons = MAHJONG_TUTORIAL.lessons;
  const order = new Map(lessons.map((lesson, index) => [lesson.id, index]));
  const next = lessons.find(lesson => !learned.has(lesson.id)) || null;

  const stages = MAHJONG_TUTORIAL.stages.map(stage => {
    const items = stage.lessonIds.filter(id => order.has(id)).map(id => {
      const index = order.get(id);
      return {
        id,
        number: index + 1,
        title: lessons[index].title,
        learned: learned.has(id),
        current: !!next && next.id === id,
      };
    });
    const doneCount = items.filter(item => item.learned).length;
    const numbers = items.map(item => item.number);
    return {
      id: stage.id,
      title: stage.title,
      lessons: items,
      doneCount,
      total: items.length,
      complete: items.length > 0 && doneCount === items.length,
      current: items.some(item => item.current),
      rangeText: numbers.length > 1 ? `第 ${numbers[0]}–${numbers[numbers.length - 1]} 章` : `第 ${numbers[0]} 章`,
    };
  });
  const stageById = new Map(stages.map(stage => [stage.id, stage]));

  const trainings = MAHJONG_TUTORIAL.trainingTopics.map(topic => {
    const stage = stageById.get(topic.stageId);
    const recommended = !!(stage && stage.complete);
    return {
      id: topic.id,
      icon: topic.icon,
      title: topic.title,
      description: topic.description,
      questionCount: topic.questionIds.length,
      recommended,
      hint: recommended ? `已学完「${stage.title}」，推荐练习` : (stage ? `建议先学完${stage.rangeText}` : ''),
    };
  });

  const completedCount = lessons.filter(lesson => learned.has(lesson.id)).length;
  return {
    next: next ? { id: next.id, number: order.get(next.id) + 1, title: next.title, summary: next.summary } : null,
    stages,
    trainings,
    recommendedTrainings: trainings.filter(item => item.recommended),
    completedCount,
    totalLessons: lessons.length,
    progressPercent: lessons.length ? Math.round(completedCount / lessons.length * 100) : 0,
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    MAHJONG_TUTORIAL,
    getTutorialLesson,
    getTutorialQuestion,
    getTrainingTopic,
    decorateQuestionTiles,
    gradeTutorialQuestions,
    gradeTrainingTopic,
    buildTutorialHome,
  };
}
