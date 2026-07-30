// pages/yaku-catalog/index.js — 役种图鉴
const { YAKU_CATALOG, filterYakuCatalog, getYakuById, formatYakuHan } = require('../../utils/yaku-data');
const { tileSrc } = require('../../utils/shared');

const CATEGORIES = [
  { key: 'all', label: '全部' },
  { key: '1han', label: '一翻役' },
  { key: '2han', label: '二翻役' },
  { key: '3han', label: '三翻役' },
  { key: '6han', label: '六翻役' },
  { key: 'yakuman', label: '役满' },
];

Page({
  copyContact() {
    wx.setClipboardData({
      data: 'lisangcode@outlook.com',
      success: () => wx.showToast({ title: '邮箱已复制', icon: 'success' })
    });
  },


  data: {
    categories: CATEGORIES,
    activeCategory: 'all',
    list: [],
    detailYaku: null,
    detailHanLabel: '',
    exampleTiles: [],
  },

  onLoad() {
    this.setData({ list: YAKU_CATALOG });
  },

  onCategoryTap(e) {
    const key = e.currentTarget.dataset.key;
    const list = key === 'all' ? YAKU_CATALOG : filterYakuCatalog({ category: key });
    this.setData({ activeCategory: key, list });
  },

  onCardTap(e) {
    const id = e.currentTarget.dataset.id;
    const yaku = getYakuById(id);
    if (!yaku) return;
    const detailHanLabel = formatYakuHan(yaku);
    const exampleTiles = (yaku.example && yaku.example.length > 0)
      ? yaku.example[0].filter(Boolean).map(tileSrc)
      : [];
    this.setData({ detailYaku: yaku, detailHanLabel, exampleTiles });
  },

  closeDetail() {
    this.setData({ detailYaku: null, exampleTiles: [] });
  },

  stopPropagation() {}, // prevent overlay click-through
});
