// pages/user/user.js
const data = require('../../data/data');
const media = require('../../data/media');

Page({
  data: {
    miniprogram_name: data.miniprogram_name,
    avatarUrl: media.avatarUrl,
    green_arrow: media.green_arrow,

    // 保留必要的图标和图片
    users: media.users,
    contact: media.contact,
    chat: media.chat,
    feedback: media.feedback,
    share: media.share,
    miniprogramming_ma: media.miniprogramming_ma,

    userInfo: null,
  },

  // 联系作者
  contact() {
    const _this = this; // 修复原代码中的作用域问题
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
    const _this = this; // 修复原代码中的作用域问题
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
  },

  onShow() {
    const userInfo = wx.getStorageSync('userInfo')

    this.setData({
      userInfo
    })
  },

  goLogin() {
    const userInfo = this.data.userInfo

    if (userInfo) {
      wx.showModal({
        title: '当前已登录',
        content: `用户名：${userInfo.username}\n身份：${userInfo.role === 'admin' ? '管理员' : '普通用户'}\n\n　　是否退出登录？`,
        confirmText: '退出登录',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            wx.removeStorageSync('userInfo')
            wx.removeStorageSync('userId')
            wx.removeStorageSync('role')

            this.setData({
              userInfo: null
            })

            wx.showToast({
              title: '已退出登录',
              icon: 'success'
            })
          }
        }
      })
      return
    }

    wx.navigateTo({
      url: '/pages/login/login'
    })
  }
})