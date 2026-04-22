Page({
  data: {
    username: '',
    password: '',
    phone: ''
  },

  onUsernameInput(e) { this.setData({ username: e.detail.value }) },
  onPasswordInput(e) { this.setData({ password: e.detail.value }) },
  onPhoneInput(e) { this.setData({ phone: e.detail.value }) },

  handleRegister() {
    const { username, password, phone } = this.data;
    
    if (!username || !password || !phone) {
      wx.showToast({ title: '请填写完整信息', icon: 'none' });
      return;
    }

    wx.request({
      url: 'http://localhost:8080/user/register',
      method: 'POST',
      data: {
        username,
        password,
        phone
      },
      success: (res) => {
        if (res.data.code === 1) {
          wx.showToast({ title: '注册成功' });
          setTimeout(() => { wx.navigateBack(); }, 1500);
        } else {
          wx.showToast({ title: res.data.msg, icon: 'none' });
        }
      }
    });
  },
  goBack() { wx.navigateBack(); }
})