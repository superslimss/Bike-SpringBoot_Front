// pages/user/user.js
const data = require('../../data/data');
const media = require('../../data/media');

Page({
  data: {
    miniprogram_name: data.miniprogram_name,
    avatarUrl: media.avatarUrl,
    order: media.order,
    users: media.users,
    contact: media.contact,
    chat: media.chat,
    feedback: media.feedback,
    share: media.share,
    miniprogramming_ma: media.miniprogramming_ma,

    userInfo: null,
  },

  // --- 核心新增：跳转到历史订单页面 ---
  goHistory() {
    // 先检查是否登录，没登录就提示并去登录
    const userInfo = wx.getStorageSync('userInfo');
    if (!userInfo) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      });
      setTimeout(() => {
        wx.navigateTo({ url: '/pages/login/login' });
      }, 1000);
      return;
    }
    
    // 已经登录，直接跳转
    wx.navigateTo({
      url: '/pages/history/history'
    });
  },

  // 页面显示时刷新用户信息
  onShow() {
    const userInfo = wx.getStorageSync('userInfo');
    this.setData({
      userInfo: userInfo
    });
  },

  // 登录/退出登录逻辑
  goLogin() {
    const userInfo = this.data.userInfo;

    if (userInfo) {
      wx.showModal({
        title: '当前已登录',
        content: `用户名：${userInfo.username}\n身份：${userInfo.role === 'admin' ? '管理员' : '普通用户'}\n\n是否退出登录？`,
        confirmText: '退出登录',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            // 清理所有相关缓存
            wx.removeStorageSync('userInfo');
            wx.removeStorageSync('userId');
            wx.removeStorageSync('role');

            this.setData({
              userInfo: null
            });

            wx.showToast({
              title: '已退出登录',
              icon: 'success'
            });
          }
        }
      });
      return;
    }

    wx.navigateTo({
      url: '/pages/login/login'
    });
  },

  // 联系作者
  contact() {
    const _this = this;
    wx.showModal({
      title: '联系作者',
      content: '如果遇到什么问题\n请点击确认与我联系',
      success(res) {
        if (res.confirm == true) {
          wx.previewImage({
            current: _this.data.contact,
            urls: [_this.data.contact],
          });
        }
      },
    });
  },

  // 分享
  share() {
    const _this = this;
    wx.showModal({
      title: '推荐给好友',
      content: '点击确认即可查看小程序码\n长按小程序码即可转发给好友',
      success(res) {
        if (res.confirm == true) {
          wx.previewImage({
            current: _this.data.miniprogramming_ma,
            urls: [_this.data.miniprogramming_ma],
          });
        }
      },
    });
  }
})