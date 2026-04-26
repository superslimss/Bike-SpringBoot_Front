/**
 * UI 交互助手
 * 统一管理全站的弹窗、提示和加载动画，保持视觉一致性
 */
const ui = {
  // 1. 简单的消息提示
  toast: (title, icon = 'none') => {
    wx.showToast({
      title,
      icon,
      duration: 2000,
      mask: false
    });
  },
}

module.exports = ui;