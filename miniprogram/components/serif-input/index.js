// components/serif-input — 衬线字体输入框
// 小程序 <input> 是原生组件，font-family 无效，会显示系统无衬线字体（#8）。
// 非输入态用普通 view 以页面衬线字体展示内容；点击后才换成真实 input 输入。
Component({
  options: {
    // 让页面 wxss（如 .setup-name-input / .sichuan-input）作用到组件内部节点
    styleIsolation: 'apply-shared',
    // 去掉组件宿主节点，让内部框直接作为父级 flex 子项填满原 input 的位置
    virtualHost: true
  },

  properties: {
    value: { type: String, value: '' },
    placeholder: { type: String, value: '' },
    type: { type: String, value: 'text' },
    maxlength: { type: Number, value: 140 },
    disabled: { type: Boolean, value: false },
    extClass: { type: String, value: '' }
  },

  data: {
    focused: false,
    current: ''
  },

  observers: {
    value(value) {
      if (!this.data.focused) this.setData({ current: value == null ? '' : String(value) });
    }
  },

  methods: {
    activate() {
      if (this.data.disabled || this.data.focused) return;
      this.setData({ focused: true });
    },

    onInput(e) {
      const value = e.detail.value;
      this.setData({ current: value });
      this.triggerEvent('input', { value });
    },

    onBlur(e) {
      const value = e.detail && e.detail.value != null ? String(e.detail.value) : this.data.current;
      // type="nickname" 选择微信昵称时可能只触发 blur，不触发 input
      if (value !== this.data.current) this.triggerEvent('input', { value });
      this.setData({ focused: false, current: value });
      this.triggerEvent('blur', { value });
    },

    onConfirm(e) {
      this.triggerEvent('confirm', { value: e.detail.value });
    }
  }
});
