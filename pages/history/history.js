Page({
  data: { orders: [] },
  onShow() { this.fetchOrders(); },
  fetchOrders() {
    const userId = wx.getStorageSync('userId');
    if (!userId) return;
    wx.request({
      url: `http://localhost:8080/api/orders/user/${userId}`,
      method: 'GET',
      success: (res) => { this.setData({ orders: res.data }); }
    });
  },
  goToDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/history-detail/history-detail?id=${id}` });
  }
})