// js/views/router.js — hash 路由：#/scorer #/tutorial #/sichuan #/vision #/settings
// 只切换 section 可见性；各视图的 DOM 与事件在各自脚本加载时初始化一次。
(function () {
'use strict';
  const ROUTES = ['scorer', 'tutorial', 'sichuan', 'vision', 'settings', 'yaku-catalog', 'scoring-guide'];
  const TAB_ROUTES = ['scorer', 'tutorial', 'sichuan', 'settings']; // tab 栏顺序

  function currentRoute() {
    const h = location.hash.replace(/^#\/?/, '');
    return ROUTES.indexOf(h) >= 0 ? h : 'scorer';
  }

  function render() {
    const route = currentRoute();
    document.querySelectorAll('.view').forEach(function (section) {
      section.classList.toggle('active', section.id === 'view-' + route);
    });
    document.querySelectorAll('.tab-item').forEach(function (tab) {
      tab.classList.toggle('active', tab.dataset.route === route);
    });
    window.scrollTo(0, 0);
  }

  window.addEventListener('hashchange', render);
  render(); // 初始路由（无 hash 时落在 #/scorer）
})();
