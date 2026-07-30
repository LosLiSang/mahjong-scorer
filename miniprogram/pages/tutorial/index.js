// pages/tutorial/index.js — 日麻计分器 · 教学馆
const Shared = require('../../utils/shared');
const { MAHJONG_TUTORIAL, gradeTutorialQuiz } = require('../../utils/tutorial-data');

const PROGRESS_KEY = 'mj_tutorial_progress_v1';

Page({
  data: {
    lessons: [],
    progress: [],
    totalLessons: 0,
    completedCount: 0,
    progressPercent: 0,

    // lesson modal
    showLesson: false,
    activeLesson: null,
    activeLessonIndex: 0,

    // quiz
    showQuiz: false,
    quizQuestions: [],
    quizIndex: 0,
    quizAnswer: -1,
    quizSubmitted: false,
    quizCorrect: false,
    quizExplanation: '',
    quizAnswers: [],
    quizScore: 0,
    showQuizResult: false,
    quizResultText: '',
  },

  onLoad() {
    this.initPage();
  },

  onShow() {
    this.loadProgress();
  },

  initPage() {
    const rawLessons = MAHJONG_TUTORIAL.lessons || [];
    // pre-process lesson tileGroups to include full image paths
    const lessons = rawLessons.map(lesson => ({
      ...lesson,
      tileGroups: (lesson.tileGroups || []).map(group => ({
        ...group,
        displayTiles: (group.tiles || []).map(id => ({
          id,
          src: Shared.tileSrc(id),
          display: Shared.tileShortName(id),
        })),
      })),
    }));
    this.setData({
      lessons,
      totalLessons: lessons.length,
      quizQuestions: MAHJONG_TUTORIAL.quiz || [],
      quizAnswers: new Array(MAHJONG_TUTORIAL.quiz.length).fill(-1),
    });
    this.loadProgress();
  },

  loadProgress() {
    let progress = [];
    try {
      progress = wx.getStorageSync(PROGRESS_KEY) || [];
    } catch (e) {}
    if (!Array.isArray(progress)) progress = [];
    const completedCount = progress.length;
    const totalLessons = this.data.totalLessons || MAHJONG_TUTORIAL.lessons.length;
    const progressPercent = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;
    this.setData({ progress, completedCount, progressPercent });
  },

  // ===== 课程 =====
  openLesson(e) {
    const id = e.currentTarget.dataset.id;
    const index = this.data.lessons.findIndex(l => l.id === id);
    const lesson = this.data.lessons[index] || null;
    if (!lesson) return;
    this.setData({
      showLesson: true,
      activeLesson: lesson,
      activeLessonIndex: index,
    });
  },

  closeLesson() {
    this.setData({ showLesson: false, activeLesson: null });
  },

  completeLesson() {
    const lesson = this.data.activeLesson;
    if (!lesson) return;
    let progress = this.data.progress.slice();
    if (!progress.includes(lesson.id)) {
      progress.push(lesson.id);
      try { wx.setStorageSync(PROGRESS_KEY, progress); } catch (e) {}
    }
    const completedCount = progress.length;
    const progressPercent = this.data.totalLessons > 0
      ? Math.round((completedCount / this.data.totalLessons) * 100)
      : 0;
    this.setData({ progress, completedCount, progressPercent, showLesson: false, activeLesson: null });
    wx.showToast({ title: '已学完本节 ✓', icon: 'success', duration: 1500 });
  },

  // ===== 测验 =====
  openQuiz() {
    this.setData({
      showQuiz: true,
      quizIndex: 0,
      quizAnswer: -1,
      quizSubmitted: false,
      quizCorrect: false,
      quizExplanation: '',
      quizScore: 0,
      showQuizResult: false,
      quizResultText: '',
      quizAnswers: new Array(this.data.quizQuestions.length).fill(-1),
    });
  },

  closeQuiz() {
    this.setData({
      showQuiz: false,
      quizIndex: 0,
      quizAnswer: -1,
      quizSubmitted: false,
      quizCorrect: false,
      quizExplanation: '',
      quizScore: 0,
      showQuizResult: false,
      quizResultText: '',
    });
  },

  selectQuizOption(e) {
    if (this.data.quizSubmitted) return;
    const answer = Number(e.currentTarget.dataset.answer);
    this.setData({ quizAnswer: answer });
  },

  submitQuizAnswer() {
    if (this.data.quizAnswer < 0) {
      wx.showToast({ title: '请先选择一个答案', icon: 'none' });
      return;
    }
    const q = this.data.quizQuestions[this.data.quizIndex];
    if (!q) return;
    const correct = this.data.quizAnswer === q.answer;
    const answers = this.data.quizAnswers.slice();
    answers[this.data.quizIndex] = this.data.quizAnswer;

    const detail = { id: q.id, correct, answer: q.answer, explanation: q.explanation };
    const score = correct ? this.data.quizScore + 1 : this.data.quizScore;

    this.setData({
      quizSubmitted: true,
      quizCorrect: correct,
      quizExplanation: q.explanation,
      quizAnswers: answers,
      quizScore: score,
    });
  },

  nextQuizQuestion() {
    const nextIndex = this.data.quizIndex + 1;
    if (nextIndex >= this.data.quizQuestions.length) {
      this.finishQuiz();
      return;
    }
    this.setData({
      quizIndex: nextIndex,
      quizAnswer: -1,
      quizSubmitted: false,
      quizCorrect: false,
      quizExplanation: '',
    });
  },

  finishQuiz() {
    const total = this.data.quizQuestions.length;
    const score = this.data.quizScore;
    let text = '';
    if (score === total) {
      text = '🎉 满分通过！你对日麻基础已经有非常好的理解！';
    } else if (score >= total * 0.7) {
      text = '👍 不错！你对大部分基础概念已经掌握，建议再回顾一下错题。';
    } else if (score >= total * 0.4) {
      text = '📖 还可以再加强。建议从头学一遍课程内容，打好基础。';
    } else {
      text = '🌱 刚刚开始很正常！跟着教学馆课程一节一节学下去，很快就能上手。';
    }

    this.setData({
      showQuizResult: true,
      quizResultText: text,
    });
  },

  restartQuiz() {
    this.setData({
      quizIndex: 0,
      quizAnswer: -1,
      quizSubmitted: false,
      quizCorrect: false,
      quizExplanation: '',
      quizScore: 0,
      showQuizResult: false,
      quizResultText: '',
      quizAnswers: new Array(this.data.quizQuestions.length).fill(-1),
    });
  },

  // ===== utility =====
  noop() {},

  tileSrc(id) {
    return Shared.tileSrc(id);
  },

  tileDisplay(id) {
    return Shared.tileDisplay(id);
  },

  // ===== 导航 =====
  goToYakuCatalog() {
    wx.navigateTo({ url: '/pages/yaku-catalog/index' });
  },

  goToScoringGuide() {
    wx.navigateTo({ url: '/pages/scoring-guide/index' });
  },
});
