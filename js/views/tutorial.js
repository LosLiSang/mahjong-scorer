// js/views/tutorial.js — 教学馆（移植自小程序 pages/tutorial）
// 数据：js/data/tutorial-data.js（全局 MAHJONG_TUTORIAL/getTutorialQuestion/getTrainingTopic）
// 进度：localStorage 'mj_tutorial_progress_v1'（与小程序同名键，存储各自独立）
(function () {
'use strict';
  const PROGRESS_KEY = 'mj_tutorial_progress_v1';
  const LETTERS = ['A', 'B', 'C', 'D'];

  const state = {
    lessons: [],
    progress: [],
    totalLessons: 0,
    completedCount: 0,
    progressPercent: 0,
    trainingTopics: [],
    // 课程弹窗
    showLesson: false,
    activeLesson: null,
    activeLessonIndex: 0,
    activeLessonLearned: false,
    lessonCheckAnswer: -1,
    lessonCheckSubmitted: false,
    lessonCheckCorrect: false,
    // 专项训练弹窗
    activeTraining: null,
    showQuiz: false,
    quizQuestions: [],
    quizIndex: 0,
    quizAnswer: -1,
    quizSubmitted: false,
    quizCorrect: false,
    quizScore: 0,
    showQuizResult: false,
    quizResultText: '',
    quizAnswers: [],
  };

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // 预处理课程：牌例拆出手牌与胡牌张，路径走 H5 tileImgSrc
  function initLessons() {
    state.lessons = (MAHJONG_TUTORIAL.lessons || []).map(function (lesson) {
      return Object.assign({}, lesson, {
        learned: false,
        check: getTutorialQuestion(lesson.checkQuestionId),
        tileGroups: (lesson.tileGroups || []).map(function (group) {
          const tiles = group.tiles || [];
          const win = group.win || '';
          const handTiles = tiles.slice();
          if (win) {
            const idx = handTiles.lastIndexOf(win);
            if (idx >= 0) handTiles.splice(idx, 1);
          }
          return Object.assign({}, group, {
            win,
            displayTiles: handTiles.map(function (id) { return { id, src: tileImgSrc(id) }; }),
            winTile: win ? { id: win, src: tileImgSrc(win) } : null,
          });
        }),
      });
    });
    state.trainingTopics = (MAHJONG_TUTORIAL.trainingTopics || [])
      .map(function (t) { return getTrainingTopic(t.id); })
      .filter(Boolean);
    state.totalLessons = state.lessons.length;
  }

  function loadProgress() {
    let progress = [];
    try { progress = JSON.parse(localStorage.getItem(PROGRESS_KEY) || '[]'); } catch (e) { progress = []; }
    if (!Array.isArray(progress)) progress = [];
    const lessonIds = new Set((MAHJONG_TUTORIAL.lessons || []).map(function (l) { return l.id; }));
    progress = Array.from(new Set(progress.filter(function (id) { return lessonIds.has(id); })));
    state.progress = progress;
    state.completedCount = progress.length;
    state.progressPercent = state.totalLessons > 0 ? Math.round((progress.length / state.totalLessons) * 100) : 0;
    state.lessons = state.lessons.map(function (lesson) {
      return Object.assign({}, lesson, { learned: progress.indexOf(lesson.id) >= 0 });
    });
  }

  function saveProgress(id) {
    if (state.progress.indexOf(id) < 0) state.progress.push(id);
    try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(state.progress)); } catch (e) { /* 存储不可用时进度不落盘，不影响作答 */ }
  }

  // ============ 渲染 ============
  function render() {
    // Hero 进度
    $('tuProgressFill').style.width = state.progressPercent + '%';
    $('tuProgressText').textContent = '已学会 ' + state.completedCount + ' / ' + state.totalLessons + ' 章（' + state.progressPercent + '%）';

    // 课程列表
    $('tuLessonList').innerHTML = state.lessons.map(function (lesson, index) {
      return '<div class="lesson-card" data-id="' + esc(lesson.id) + '">'
        + '<div class="lesson-card-inner">'
        + '<div class="lesson-number">第' + (index + 1) + '章</div>'
        + '<div class="lesson-info">'
        + '<div class="lesson-card-title-row">'
        + '<div class="lesson-card-title">' + esc(lesson.title) + '</div>'
        + '<div class="lesson-status-badge ' + (lesson.learned ? 'learned' : 'pending') + '">' + (lesson.learned ? '已学会' : '未学会') + '</div>'
        + '</div>'
        + '<div class="lesson-card-summary">' + esc(lesson.summary) + '</div>'
        + '<div class="lesson-card-status ' + (lesson.learned ? 'learned' : '') + '">' + (lesson.learned ? '本章小测已通过' : '学习课程并完成章末小测') + '</div>'
        + '</div></div>'
        + '<div class="lesson-arrow">›</div>'
        + '</div>';
    }).join('');

    // 专项训练
    $('tuTrainingList').innerHTML = state.trainingTopics.map(function (topic) {
      return '<div class="quiz-entry" data-id="' + esc(topic.id) + '">'
        + '<div class="quiz-entry-icon">' + esc(topic.icon || '🎯') + '</div>'
        + '<div class="quiz-entry-info">'
        + '<div class="quiz-entry-title">' + esc(topic.title) + '</div>'
        + '<div class="quiz-entry-desc">' + esc(topic.description) + ' · ' + topic.questions.length + ' 题</div>'
        + '</div>'
        + '<div class="lesson-arrow">›</div>'
        + '</div>';
    }).join('');

    renderLessonModal();
    renderQuizModal();
  }

  // ============ 课程弹窗 ============
  function openLesson(id) {
    const index = state.lessons.findIndex(function (l) { return l.id === id; });
    const lesson = state.lessons[index] || null;
    if (!lesson) return;
    state.showLesson = true;
    state.activeLesson = lesson;
    state.activeLessonIndex = index;
    state.activeLessonLearned = lesson.learned;
    state.lessonCheckAnswer = -1;
    state.lessonCheckSubmitted = false;
    state.lessonCheckCorrect = false;
    renderLessonModal();
  }

  function closeLesson() {
    state.showLesson = false;
    state.activeLesson = null;
    $('tuLessonOverlay').classList.remove('active');
  }

  function renderLessonModal() {
    const overlay = $('tuLessonOverlay');
    if (!state.showLesson || !state.activeLesson) { overlay.classList.remove('active'); return; }
    const lesson = state.activeLesson;
    const q = lesson.check;

    let checkHtml = '';
    if (q) {
      const optionsHtml = q.options.map(function (opt, index) {
        const cls = 'quiz-option'
          + (state.lessonCheckAnswer === index ? ' selected' : '')
          + (state.lessonCheckSubmitted && index === q.answer ? ' correct' : '')
          + (state.lessonCheckSubmitted && state.lessonCheckAnswer === index && !state.lessonCheckCorrect ? ' wrong' : '');
        return '<div class="' + cls + '" data-answer="' + index + '">'
          + '<span class="option-letter">' + LETTERS[index] + '</span>'
          + '<span class="option-text">' + esc(opt) + '</span></div>';
      }).join('');
      checkHtml = '<div class="lesson-check-card">'
        + '<div class="lesson-check-heading"><div>'
        + '<div class="lesson-check-kicker">章末小测</div>'
        + '<div class="lesson-check-title">答对后标记本章已学会</div></div>'
        + (state.activeLessonLearned ? '<div class="lesson-learned-badge">已学会 ✓</div>' : '')
        + '</div>'
        + '<div class="lesson-check-question">' + esc(q.question) + '</div>'
        + '<div class="quiz-options lesson-check-options">' + optionsHtml + '</div>'
        + (state.lessonCheckSubmitted
          ? '<div class="quiz-explanation lesson-check-explanation">'
            + '<div class="quiz-explanation-header ' + (state.lessonCheckCorrect ? 'correct' : 'wrong') + '">'
            + (state.lessonCheckCorrect ? '✅ 回答正确，本章已学会！' : '❌ 还差一点，再想想') + '</div>'
            + '<div class="quiz-explanation-text">' + esc(q.explanation) + '</div>'
            + (!state.lessonCheckCorrect ? '<button class="btn btn-secondary" id="tuLessonRetry">重新作答</button>' : '')
            + '</div>'
          : '<div class="quiz-submit-area"><button class="btn" id="tuLessonSubmit"' + (state.lessonCheckAnswer < 0 ? ' disabled' : '') + '>确认答案</button></div>')
        + '</div>';
    }

    $('tuLessonBody').innerHTML = ''
      + '<div class="modal-close" id="tuLessonClose">✕</div>'
      + '<div class="lesson-scroll">'
      + '<div class="lesson-eyebrow">' + esc(lesson.eyebrow) + '</div>'
      + '<div class="lesson-title">' + esc(lesson.title) + '</div>'
      + '<div class="lesson-summary">' + esc(lesson.summary) + '</div>'
      + (lesson.points.length ? '<div class="lesson-points">' + lesson.points.map(function (p) {
          return '<div class="lesson-point-item"><span class="point-bullet">•</span><span>' + esc(p) + '</span></div>';
        }).join('') + '</div>' : '')
      + (lesson.terms && lesson.terms.length ? '<div class="lesson-terms"><div class="lesson-terms-title">📖 术语</div>'
        + lesson.terms.map(function (t) {
          return '<div class="term-item"><span class="term-name">' + esc(t.term) + '</span><span class="term-def">' + esc(t.def) + '</span></div>';
        }).join('') + '</div>' : '')
      + (lesson.tileGroups.length ? '<div class="lesson-tile-groups">' + lesson.tileGroups.map(function (g) {
          return '<div class="tile-group"><div class="tile-group-label">' + esc(g.label) + '</div><div class="tile-row-inline">'
            + g.displayTiles.map(function (t) { return '<img class="lesson-tile-img" src="' + t.src + '" alt="' + esc(t.id) + '">'; }).join('')
            + (g.winTile ? '<img class="lesson-tile-img lesson-win-tile' + (g.winTile.id === '5z' ? ' haku-tile' : '') + '" src="' + g.winTile.src + '" alt="' + esc(g.winTile.id) + '">' : '')
            + '</div></div>';
        }).join('') + '</div>' : '')
      + (lesson.tip ? '<div class="lesson-tip"><span class="tip-icon">💡</span><span>' + esc(lesson.tip) + '</span></div>' : '')
      + checkHtml
      + '<div class="lesson-scroll-gap"></div>'
      + '</div>';

    overlay.classList.add('active');
  }

  function submitLessonCheck() {
    const lesson = state.activeLesson;
    const q = lesson && lesson.check;
    if (!q || state.lessonCheckAnswer < 0) return; // 未选答案不提交
    state.lessonCheckSubmitted = true;
    state.lessonCheckCorrect = state.lessonCheckAnswer === q.answer;
    if (state.lessonCheckCorrect) {
      saveProgress(lesson.id);
      loadProgress();
      state.activeLesson = Object.assign({}, lesson, { learned: true });
      state.activeLessonLearned = true;
      render();
    } else {
      renderLessonModal();
    }
  }

  // ============ 专项训练弹窗 ============
  function openTraining(id) {
    const training = state.trainingTopics.find(function (t) { return t.id === id; });
    if (!training) return;
    Object.assign(state, {
      activeTraining: training,
      showQuiz: true,
      quizQuestions: training.questions,
      quizIndex: 0,
      quizAnswer: -1,
      quizSubmitted: false,
      quizCorrect: false,
      quizScore: 0,
      showQuizResult: false,
      quizResultText: '',
      quizAnswers: new Array(training.questions.length).fill(-1),
    });
    renderQuizModal();
  }

  function closeQuiz() {
    Object.assign(state, {
      showQuiz: false, activeTraining: null, quizQuestions: [], quizIndex: 0,
      quizAnswer: -1, quizSubmitted: false, quizCorrect: false, quizScore: 0,
      showQuizResult: false, quizResultText: '',
    });
    $('tuQuizOverlay').classList.remove('active');
  }

  function quizResultTextFor(score, total) {
    if (score === total) return '🎉 满分完成！这个主题已经掌握得很扎实。';
    if (score >= total * 0.7) return '👍 大部分都答对了，再回顾错题就能掌握这个主题。';
    if (score >= total * 0.4) return '📖 已经理解了一部分，建议回看对应章节后再练一次。';
    return '🌱 先别着急，回到课程逐章完成小测，再来挑战这个主题。';
  }

  function renderQuizModal() {
    const overlay = $('tuQuizOverlay');
    if (!state.showQuiz || !state.activeTraining) { overlay.classList.remove('active'); return; }
    const q = state.quizQuestions[state.quizIndex];

    let inner;
    if (!state.showQuizResult) {
      const optionsHtml = q.options.map(function (opt, index) {
        const cls = 'quiz-option'
          + (state.quizAnswer === index ? ' selected' : '')
          + (state.quizSubmitted && index === q.answer ? ' correct' : '')
          + (state.quizSubmitted && state.quizAnswer === index && !state.quizCorrect ? ' wrong' : '');
        return '<div class="' + cls + '" data-answer="' + index + '">'
          + '<span class="option-letter">' + LETTERS[index] + '</span>'
          + '<span class="option-text">' + esc(opt) + '</span></div>';
      }).join('');
      inner = ''
        + '<div class="quiz-progress"><span>第 ' + (state.quizIndex + 1) + ' / ' + state.quizQuestions.length + ' 题</span>'
        + '<div class="quiz-progress-bar"><div class="quiz-progress-fill" style="width:' + ((state.quizIndex + 1) / state.quizQuestions.length * 100) + '%"></div></div></div>'
        + '<div class="quiz-question">' + esc(q.question) + '</div>'
        + '<div class="quiz-options">' + optionsHtml + '</div>'
        + (state.quizSubmitted
          ? '<div class="quiz-explanation">'
            + '<div class="quiz-explanation-header ' + (state.quizCorrect ? 'correct' : 'wrong') + '">' + (state.quizCorrect ? '✅ 回答正确！' : '❌ 回答错误') + '</div>'
            + '<div class="quiz-explanation-text">' + esc(q.explanation) + '</div>'
            + '<button class="btn" id="tuQuizNext">' + (state.quizIndex + 1 >= state.quizQuestions.length ? '查看成绩' : '下一题') + '</button></div>'
          : '<div class="quiz-submit-area"><button class="btn" id="tuQuizSubmit"' + (state.quizAnswer < 0 ? ' disabled' : '') + '>确认答案</button></div>');
    } else {
      inner = '<div class="quiz-result">'
        + '<div class="quiz-result-score">' + state.quizScore + ' / ' + state.quizQuestions.length + '</div>'
        + '<div class="quiz-result-label">' + esc(state.activeTraining.title) + ' · 本次得分</div>'
        + '<div class="quiz-result-text">' + esc(state.quizResultText) + '</div></div>'
        + '<div class="lesson-modal-actions">'
        + '<button class="btn btn-secondary" id="tuQuizCloseBtn">返回</button>'
        + '<button class="btn" id="tuQuizRestart">再做一次</button></div>';
    }

    $('tuQuizBody').innerHTML = ''
      + '<div class="modal-close" id="tuQuizClose">✕</div>'
      + '<div class="quiz-topic-heading">'
      + '<div class="quiz-topic-title">' + esc(state.activeTraining.title) + '</div>'
      + '<div class="quiz-topic-desc">' + esc(state.activeTraining.description) + '</div></div>'
      + inner;

    overlay.classList.add('active');
  }

  function submitQuizAnswer() {
    if (state.quizAnswer < 0) return;
    const q = state.quizQuestions[state.quizIndex];
    if (!q) return;
    state.quizCorrect = state.quizAnswer === q.answer;
    state.quizAnswers[state.quizIndex] = state.quizAnswer;
    if (state.quizCorrect) state.quizScore += 1;
    state.quizSubmitted = true;
    renderQuizModal();
  }

  function nextQuizQuestion() {
    const nextIndex = state.quizIndex + 1;
    if (nextIndex >= state.quizQuestions.length) {
      state.showQuizResult = true;
      state.quizResultText = quizResultTextFor(state.quizScore, state.quizQuestions.length);
    } else {
      Object.assign(state, { quizIndex: nextIndex, quizAnswer: -1, quizSubmitted: false, quizCorrect: false });
    }
    renderQuizModal();
  }

  function restartQuiz() {
    Object.assign(state, {
      quizIndex: 0, quizAnswer: -1, quizSubmitted: false, quizCorrect: false,
      quizScore: 0, showQuizResult: false, quizResultText: '',
      quizAnswers: new Array(state.quizQuestions.length).fill(-1),
    });
    renderQuizModal();
  }

  // ============ 事件 ============
  function init() {
    initLessons();
    loadProgress();
    render();

    $('tuLessonList').addEventListener('click', function (e) {
      const card = e.target.closest('.lesson-card[data-id]');
      if (card) openLesson(card.dataset.id);
    });
    $('tuTrainingList').addEventListener('click', function (e) {
      const entry = e.target.closest('.quiz-entry[data-id]');
      if (entry) openTraining(entry.dataset.id);
    });

    const lessonOverlay = $('tuLessonOverlay');
    lessonOverlay.addEventListener('click', function (e) {
      if (e.target === lessonOverlay || e.target.id === 'tuLessonClose') { closeLesson(); return; }
      const opt = e.target.closest('.quiz-option[data-answer]');
      if (opt && !state.lessonCheckSubmitted) { state.lessonCheckAnswer = Number(opt.dataset.answer); renderLessonModal(); return; }
      if (e.target.id === 'tuLessonSubmit') submitLessonCheck();
      if (e.target.id === 'tuLessonRetry') {
        Object.assign(state, { lessonCheckAnswer: -1, lessonCheckSubmitted: false, lessonCheckCorrect: false });
        renderLessonModal();
      }
    });

    const quizOverlay = $('tuQuizOverlay');
    quizOverlay.addEventListener('click', function (e) {
      if (e.target === quizOverlay || e.target.id === 'tuQuizClose' || e.target.id === 'tuQuizCloseBtn') { closeQuiz(); return; }
      const opt = e.target.closest('.quiz-option[data-answer]');
      if (opt && !state.quizSubmitted) { state.quizAnswer = Number(opt.dataset.answer); renderQuizModal(); return; }
      if (e.target.id === 'tuQuizSubmit') submitQuizAnswer();
      if (e.target.id === 'tuQuizNext') nextQuizQuestion();
      if (e.target.id === 'tuQuizRestart') restartQuiz();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
