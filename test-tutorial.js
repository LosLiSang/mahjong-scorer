const assert = require('assert');
const fs = require('fs');
const { MAHJONG_TUTORIAL, getTutorialLesson, gradeTutorialQuiz } = require('./tutorial-data');

assert.equal(MAHJONG_TUTORIAL.lessons.length, 8, '应包含 8 节入门课');
assert.equal(MAHJONG_TUTORIAL.quiz.length, 6, '应包含 6 道入门测验');
assert.equal(getTutorialLesson('yaku').title, '有结构，还要有役');
assert.equal(getTutorialLesson('fu-detail').title, '符要一项一项加');
assert.equal(getTutorialLesson('limits').title, '满贯不是役，是点数档位');
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
assert(
  /\.modal\s*\{[^}]*overscroll-behavior\s*:\s*contain[^}]*-webkit-overflow-scrolling\s*:\s*touch/s.test(pageHtml),
  '课程弹窗必须阻止滚动穿透并启用触摸惯性滚动'
);
assert(
  /function\s+lockPageScroll\s*\([^)]*\)[\s\S]*document\.body\.style\.position\s*=\s*'fixed'/s.test(pageHtml),
  '打开课程弹窗时必须锁定底层页面滚动'
);
assert(
  /function\s+unlockPageScroll\s*\([^)]*\)[\s\S]*window\.scrollTo\(0,\s*modalScrollY\)/s.test(pageHtml),
  '关闭课程弹窗后必须恢复原页面位置'
);
assert(
  /overlay\.classList\.add\('active'\);\s*(?:if\s*\(modal\)\s*)?modal\.scrollTop\s*=\s*0/s.test(pageHtml),
  '弹窗必须先显示再重置滚动位置，避免下一课程标题被旧滚动位置遮住'
);
assert(
  /id="yakuCatalogOverlay"[\s\S]*class="modal-close"[^>]*onclick="closeModal\('yakuCatalogOverlay'\)"/s.test(pageHtml),
  '役种图鉴必须提供明确的关闭按钮'
);
assert(
  /\.modal-close\s*\{[^}]*position\s*:\s*sticky/s.test(pageHtml),
  '关闭按钮必须固定在弹窗顶部，滚动后仍可退出'
);

console.log('tutorial tests: 34 assertions passed');
