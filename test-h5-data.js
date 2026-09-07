// test-h5-data.js — 教学数据层：与小程序副本字节一致 + 基本结构
// 用法: node test-h5-data.js
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (detail ? ' — ' + detail : '')); }
}
function section(name) { console.log('\n=== ' + name + ' ==='); }

// ---- 字节一致性（防双副本漂移，与 test-logic 同一纪律）----
section('js/data 与小程序副本字节一致')
for (const f of ['tutorial-data', 'yaku-data', 'scoring-guide-data', 'sichuan-score']) {
  const h5 = fs.readFileSync(__dirname + '/js/data/' + f + '.js', 'utf8');
  const mini = fs.readFileSync(__dirname + '/miniprogram/utils/' + f + '.js', 'utf8');
  check(f + '.js 一致', h5 === mini);
}

// ---- 结构 ----
section('tutorial-data 结构')
const TD = require('./js/data/tutorial-data');
check('lessons 非空', Array.isArray(TD.MAHJONG_TUTORIAL.lessons) && TD.MAHJONG_TUTORIAL.lessons.length > 0);
check('每课含 id/title/summary/points', TD.MAHJONG_TUTORIAL.lessons.every(l => l.id && l.title && l.summary && Array.isArray(l.points)));
const q = TD.getTutorialQuestion(TD.MAHJONG_TUTORIAL.lessons[0].checkQuestionId);
check('第一章小测题可取且含答案与解析', q && Array.isArray(q.options) && typeof q.answer === 'number' && !!q.explanation);
check('getTrainingTopic 未知 id → null', TD.getTrainingTopic('__nope__') === null);
const topic = TD.getTrainingTopic(TD.MAHJONG_TUTORIAL.trainingTopics[0].id);
check('训练主题可取', topic && Array.isArray(topic.questions) && topic.questions.length > 0);
const graded = TD.gradeTutorialQuestions(topic.questions, topic.questions.map(x => x.answer));
check('全对判分 = 满分', graded.score === graded.total && graded.total === topic.questions.length);

section('yaku-data 结构')
const YD = require('./js/data/yaku-data');
check('役种目录非空', Array.isArray(YD.YAKU_CATALOG) && YD.YAKU_CATALOG.length >= 40);
check('每役含 id/name/category/condition', YD.YAKU_CATALOG.every(y => y.id && y.name && y.category && y.condition));
const withExample = YD.YAKU_CATALOG.filter(y => y.example && y.example.length);
check('带牌例的役种可展开 13 张手+独立胡牌张', withExample.length > 0 && withExample.every(y => {
  const ex = YD.getYakuExample(y);
  return Array.isArray(ex.hand) && ex.hand.length === 13;
}));
check('分类过滤可用', YD.filterYakuCatalog({ category: 'yakuman' }).length > 0
  && YD.filterYakuCatalog({ category: 'yakuman' }).every(y => y.category === 'yakuman'));
check('formatYakuHan 役满文案', YD.formatYakuHan(YD.YAKU_CATALOG.find(y => y.category === 'yakuman')) === '役满');

section('scoring-guide-data 结构')
const SD = require('./js/data/scoring-guide-data');
check('符数参考表非空', Array.isArray(SD.FU_REFERENCE) && SD.FU_REFERENCE.length > 0);
check('满贯档位表非空', Array.isArray(SD.LIMIT_REFERENCE) && SD.LIMIT_REFERENCE.length >= 5);
const fuEx = SD.calculateFuExample({ closedRon: true, pairFu: 2, waitFu: 2, mentsuFu: 8 });
check('门前荣和+雀头+嵌张+幺九暗刻 = 42符进位50', fuEx.rawFu === 42 && fuEx.roundedFu === 50);
check('roundFu(41)=50', SD.roundFu(41) === 50);

section('sichuan-score 结构')
const SS = require('./js/data/sichuan-score');
check('罚分类型非空（花猪/大叫/退税/诈和）', Array.isArray(SS.SICHUAN_PENALTY_TYPES) && SS.SICHUAN_PENALTY_TYPES.length >= 4);

console.log(`\n结果: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
