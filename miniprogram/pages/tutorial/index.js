// pages/tutorial/index.js — 日麻计分器 · 教学馆
const Shared = require('../../utils/shared');
const {
  MAHJONG_TUTORIAL,
  getTutorialQuestion,
  getTrainingTopic,
} = require('../../utils/tutorial-data');

const PROGRESS_KEY = 'mj_tutorial_progress_v1';

Page({
  copyContact() {
    wx.setClipboardData({
      data: 'lisangcode@outlook.com',
      success: () => wx.showToast({ title: '邮箱已复制', icon: 'success' })
    });
  },


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
    activeLessonLearned: false,
    lessonCheckAnswer: -1,
    lessonCheckSubmitted: false,
    lessonCheckCorrect: false,
    lessonCheckExplanation: '',

    // themed training
    trainingTopics: [],
    activeTraining: null,
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
    const tabBar = this.getTabBar && this.getTabBar();
    if (tabBar) tabBar.setData({ selected: 1 });
    this.loadProgress();
  },

  initPage() {
    const rawLessons = MAHJONG_TUTORIAL.lessons || [];
    // pre-process lesson tileGroups to include full image paths
    const lessons = rawLessons.map(lesson => ({
      ...lesson,
      learned: false,
      check: getTutorialQuestion(lesson.checkQuestionId),
      tileGroups: (lesson.tileGroups || []).map(group => {
        const tiles = group.tiles || [];
        const win = group.win || '';
        let handTiles = tiles.slice();
        if (win) {
          const idx = handTiles.lastIndexOf(win);
          if (idx >= 0) handTiles.splice(idx, 1);
        }
        return {
          ...group,
          win,
          displayTiles: handTiles.map(id => ({ id, src: Shared.tileSrc(id), display: Shared.tileShortName(id) })),
          winTile: win ? { id: win, src: Shared.tileSrc(win), display: Shared.tileShortName(win) } : null,
        };
      }),
    }));
    const trainingTopics = (MAHJONG_TUTORIAL.trainingTopics || [])
      .map(topic => getTrainingTopic(topic.id))
      .filter(Boolean);
    this.setData({
      lessons,
      trainingTopics,
      totalLessons: lessons.length,
    });
    // loadProgress 在 onShow 中调用，此处不重复
  },

  loadProgress() {
    let progress = [];
    try {
      progress = wx.getStorageSync(PROGRESS_KEY) || [];
    } catch (e) {}
    if (!Array.isArray(progress)) progress = [];
    const lessonIds = new Set((MAHJONG_TUTORIAL.lessons || []).map(lesson => lesson.id));
    progress = [...new Set(progress.filter(id => lessonIds.has(id)))];
    const completedCount = progress.length;
    const totalLessons = this.data.totalLessons || MAHJONG_TUTORIAL.lessons.length;
    const progressPercent = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;
    const lessons = this.data.lessons.map(lesson => ({
      ...lesson,
      learned: progress.includes(lesson.id),
    }));
    this.setData({ progress, lessons, completedCount, progressPercent });
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
      activeLessonLearned: lesson.learned,
      lessonCheckAnswer: -1,
      lessonCheckSubmitted: false,
      lessonCheckCorrect: false,
      lessonCheckExplanation: '',
    });
  },

  closeLesson() {
    this.setData({
      showLesson: false,
      activeLesson: null,
      activeLessonLearned: false,
      lessonCheckAnswer: -1,
      lessonCheckSubmitted: false,
      lessonCheckCorrect: false,
      lessonCheckExplanation: '',
    });
  },

  selectLessonCheckOption(e) {
    if (this.data.lessonCheckSubmitted) return;
    this.setData({ lessonCheckAnswer: Number(e.currentTarget.dataset.answer) });
  },

  submitLessonCheck() {
    const lesson = this.data.activeLesson;
    const question = lesson && lesson.check;
    if (!question || this.data.lessonCheckAnswer < 0) {
      wx.showToast({ title: '请先选择一个答案', icon: 'none' });
      return;
    }

    const correct = this.data.lessonCheckAnswer === question.answer;
    this.setData({
      lessonCheckSubmitted: true,
      lessonCheckCorrect: correct,
      lessonCheckExplanation: question.explanation,
    });
    if (!correct) return;

    const progress = this.data.progress.slice();
    if (!progress.includes(lesson.id)) progress.push(lesson.id);
    try { wx.setStorageSync(PROGRESS_KEY, progress); } catch (e) {}
    const completedCount = progress.length;
    const progressPercent = this.data.totalLessons > 0
      ? Math.round((completedCount / this.data.totalLessons) * 100)
      : 0;
    const lessons = this.data.lessons.map(item => (
      item.id === lesson.id ? { ...item, learned: true } : item
    ));
    this.setData({
      progress,
      lessons,
      completedCount,
      progressPercent,
      activeLesson: { ...lesson, learned: true },
      activeLessonLearned: true,
    });
    wx.showToast({ title: '本章已学会 ✓', icon: 'success', duration: 1500 });
  },

  retryLessonCheck() {
    this.setData({
      lessonCheckAnswer: -1,
      lessonCheckSubmitted: false,
      lessonCheckCorrect: false,
      lessonCheckExplanation: '',
    });
  },

  // ===== 专项训练 =====
  openTraining(e) {
    const id = e.currentTarget.dataset.id;
    const training = this.data.trainingTopics.find(topic => topic.id === id);
    if (!training) return;
    this.setData({
      activeTraining: training,
      showQuiz: true,
      quizQuestions: training.questions,
      quizIndex: 0,
      quizAnswer: -1,
      quizSubmitted: false,
      quizCorrect: false,
      quizExplanation: '',
      quizScore: 0,
      showQuizResult: false,
      quizResultText: '',
      quizAnswers: new Array(training.questions.length).fill(-1),
    });
  },

  closeQuiz() {
    this.setData({
      showQuiz: false,
      activeTraining: null,
      quizQuestions: [],
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
      text = '🎉 满分完成！这个主题已经掌握得很扎实。';
    } else if (score >= total * 0.7) {
      text = '👍 大部分都答对了，再回顾错题就能掌握这个主题。';
    } else if (score >= total * 0.4) {
      text = '📖 已经理解了一部分，建议回看对应章节后再练一次。';
    } else {
      text = '🌱 先别着急，回到课程逐章完成小测，再来挑战这个主题。';
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
