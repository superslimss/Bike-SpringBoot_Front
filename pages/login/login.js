Page({
  data: {
    username: '',
    password: ''
  },

  onUsernameInput(e) {
    this.setData({
      username: e.detail.value
    })
  },

  onPasswordInput(e) {
    this.setData({
      password: e.detail.value
    })
  },

  handleLogin() {
    const { username, password } = this.data

    if (!username || !password) {
      wx.showToast({
        title: '请输入账号和密码',
        icon: 'none'
      })
      return
    }

    wx.request({
      // 这里改成你电脑的局域网IP
      url: 'http://localhost:8080/user/login',
      method: 'POST',
      header: {
        'content-type': 'application/json'
      },
      data: {
        username,
        password
      },
      success: (res) => {
        const result = res.data

        if (result.code === 1) {
          const userInfo = result.data

          wx.setStorageSync('userInfo', userInfo)
          wx.setStorageSync('userId', userInfo.id)
          wx.setStorageSync('role', userInfo.role)

          wx.showToast({
            title: '登录成功',
            icon: 'success'
          })

          setTimeout(() => {
            wx.switchTab({
              url: '/pages/map/map'
            })
          }, 800)
        } else {
          wx.showToast({
            title: result.detail || '登录失败',
            icon: 'none'
          })
        }
      },
      fail: () => {
        wx.showToast({
          title: '请求失败，请检查后端或IP地址',
          icon: 'none'
        })
      }
    })
  }
})