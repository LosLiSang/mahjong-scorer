const assert = require('assert');
const fs = require('fs');
const { MAHJONG_TUTORIAL, getTutorialLesson, gradeTutorialQuiz } = require('./tutorial-data');

assert.equal(MAHJONG_TUTORIAL.lessons.length, 6, '应包含 6 节入门课');
assert.equal(MAHJONG_TUTORIAL.quiz.length, 6, '应包含 6 道入门测验');
assert.equal(getTutorialLesson('yaku').title, '有结构，还要有役');
assert.equal(getTutorialLesson('missing'), null);

const perfect = gradeTutorialQuiz(MAHJONG_TUTORIAL.quiz.map(q => q.answer));
assert.equal(perfect.score, perfect.total, '全部正确时应满分');

const wrong = gradeTutorialQuiz(MAHJONG_TUTORIAL.quiz.map(() => -1));
assert.equal(wrong.score, 0, '全部错误时应为 0 分');
assert(wrong.details.every(item => item.explanation.length > 0), '每道题都应提供解释');

for (const lesson of MAHJONG_TUTORIAL.lessons) {
  assert(lesson.id && lesson.title && lesson.summary, '课程必须有基础字段');
  assert(lesson.points.length >= 3, `${lesson.id} 至少应有 3 个知识点`);
  assert(lesson.tileGroups.length >= 1, `${lesson.id} 至少应有 1 组牌例`);
}

const pageHtml = fs.readFileSync('./index.html', 'utf8');
assert(
  /\.lesson-card\s*\{[^}]*grid-template-columns\s*:\s*42px\s+minmax\(0\s*,\s*1fr\)\s+auto/s.test(pageHtml),
  '课程卡片中间列必须使用 minmax(0, 1fr)，避免长摘要撑破手机宽度'
);
assert(
  /\.lesson-card\s*>\s*span:nth-child\(2\)\s*\{[^}]*min-width\s*:\s*0/s.test(pageHtml),
  '课程卡片文字容器必须允许收缩'
);
assert(
  /\.lesson-card-summary\s*\{[^}]*display\s*:\s*block[^}]*max-width\s*:\s*100%/s.test(pageHtml),
  '课程摘要必须限制在卡片内部'
);

console.log('tutorial tests: 28 assertions passed');
