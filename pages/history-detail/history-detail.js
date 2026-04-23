Page({
  data: { polyline: [], markers: [], order: {} },
  onLoad(options) {
    wx.request({
      url: `http://localhost:8080/api/orders/${options.id}`,
      success: (res) => {
        const order = res.data;
        const start = { latitude: order.startLat, longitude: order.startLng };
        const end = { latitude: order.endLat, longitude: order.endLng };
        this.setData({
          order,
          centerLat: (start.latitude + end.latitude) / 2,
          centerLng: (start.longitude + end.longitude) / 2,
          markers: [
            { id: 1, ...start, iconPath: '/images/start.png', width: 32, height: 32 },
            { id: 2, ...end, iconPath: '/images/end.png', width: 32, height: 32 }
          ],
          polyline: [{
            points: this.createCurve(start, end),
            color: "#0062ff", width: 5, arrowLine: true
          }]
        });
      }
    });
  },
  createCurve(start, end) {
    let points = [];
    let count = 30; // 采样点数量
    let offset = 0.12; // 弧度大小
    let controlLat = (start.latitude + end.latitude) / 2 + (end.longitude - start.longitude) * offset;
    let controlLng = (start.longitude + end.longitude) / 2 - (end.latitude - start.latitude) * offset;
    for (let i = 0; i <= count; i++) {
      let t = i / count;
      let lat = (1-t)**2 * start.latitude + 2*t*(1-t) * controlLat + t**2 * end.latitude;
      let lng = (1-t)**2 * start.longitude + 2*t*(1-t) * controlLng + t**2 * end.longitude;
      points.push({ latitude: lat, longitude: lng });
    }
    return points;
  }
})