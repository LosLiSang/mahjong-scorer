Component({
  data: {
    selected: 0,
    color: '#8a8470',
    selectedColor: '#c46645',
    list: [
      { pagePath: '/pages/index/index', text: '日麻计分', mark: '日' },
      { pagePath: '/pages/tutorial/index', text: '教学馆', mark: '学' },
      { pagePath: '/pages/sichuan/index', text: '川麻积分', mark: '川' }
    ]
  },

  methods: {
    switchTab(e) {
      const index = Number(e.currentTarget.dataset.index);
      const item = this.data.list[index];
      if (!item || index === this.data.selected) return;
      this.setData({ selected: index });
      wx.switchTab({ url: item.pagePath });
    }
  }
});
