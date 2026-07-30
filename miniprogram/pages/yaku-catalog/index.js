// pages/yaku-catalog/index.js — 役种图鉴
const { YAKU_CATALOG, CATEGORY_LABELS, filterYakuCatalog, getYakuById, formatYakuHan } = require('../../utils/yaku-data');
const { tileSrc, tileDisplay } = require('../../utils/shared');

const CATEGORIES = [
  { key: 'all', label: '全部' },
  { key: '1han', label: '一翻役' },
  { key: '2han', label: '二翻役' },
  { key: '3han', label: '三翻役' },
  { key: '6han', label: '六翻役' },
  { key: 'yakuman', label: '役满' },
];

const HAN_COLORS = {
  '1han': '#c96442',
  '2han': '#c99442',
  '3han': '#c4a242',
  '6han': '#a45ac4',
  'yakuman': '#c4425a',
};

Page({
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

  // helpers for WXML
  getHanBadgeStyle(category) {
    return `background:${HAN_COLORS[category] || '#c96442'}`;
  },

  getConditionPreview(condition) {
    if (!condition) return '';
    return condition.length > 24 ? condition.slice(0, 24) + '…' : condition;
  },

  getDetailHanColor(category) {
    return HAN_COLORS[category] || '#c96442';
  },
});
