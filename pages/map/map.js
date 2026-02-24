// pages/map/map.js
import map from '@data/map';
import media from '@data/media';

const QQMapWX = require('@libs/qqmap-wx-jssdk.min');
const qqmapsdk = new QQMapWX({
  key: map.mapKey,
});

Page({
  data: {
    latitude: map.latitude,
    longitude: map.longitude,
    scale: map.scale,

    category: 0,
    all_site_data: map.site_data,
    site_data: [],
    Marker3_Activated: media.Marker3_Activated,

    bikeIcon: "/images/bike.png",
    bikeMarkers: [],

    markers: [],
    polyline: [],

    start: { name: '当前位置', latitude: '', longitude: '' },
    end: { name: '', latitude: '', longitude: '' },

    // 【优化点 1】我的实时定位标记底稿
    myPosIcon: "/images/my_pos.png",
    myLocationMarker: null,

    myMockLat: map.latitude, // 初始为配置坐标
    myMockLng: map.longitude,

    // ... 其他变量
    isRiding: false, // 初始状态：未骑行
    ridingTime: '00:00', // 骑行时间显示
    currentOrderId: null, // 存储当前订单ID，方便还车
  },

  onLoad(options) {
    this.initStaticSites();
    this.loadBikesFromServer();
    this.startLocationUpdate();
  },

  /**
   * 开启微信实时位置监听
   */
  startLocationUpdate() {
    const _this = this;
    wx.startLocationUpdate({
      success: () => {
        console.log("实时定位开启成功");
        wx.onLocationChange((location) => {
          // 仅处理位置更新与 Marker 同步
          _this.handleLocationChange(location);

          // 强制视角跟随（解决 Sensor 调节后视角不动的问题）
          const mapCtx = wx.createMapContext('map');
          mapCtx.moveToLocation({
            latitude: location.latitude,
            longitude: location.longitude
          });
        });
      },
      fail: (err) => {
        console.error("开启实时定位失败", err);
      }
    });
  },

  /**
   * 【优化点 2】统一处理位置变动，并确保持久化显示
   */
  handleLocationChange(res) {
    // 1. 更新最新的定位标记底稿
    const newMyMarker = {
      id: 9999,
      latitude: res.latitude,
      longitude: res.longitude,
      iconPath: this.data.myPosIcon,
      width: 35,
      height: 35,
      zIndex: 1001,
      anchor: { x: 0.5, y: 0.5 }
    };

    // 2. 提取当前 markers 中除了定位点以外的其他点（地标和单车）
    let otherMarkers = this.data.markers.filter(m => m.id !== 9999);

    this.setData({
      myMockLat: res.latitude,
      myMockLng: res.longitude,
      'start.latitude': res.latitude,
      'start.longitude': res.longitude,
      myLocationMarker: newMyMarker, // 保存底稿
      markers: [...otherMarkers, newMyMarker] // 合并渲染
    });
  },

  initStaticSites() {
    const all_site_data = this.data.all_site_data;
    if (all_site_data && all_site_data.length > 0) {
      const campus = all_site_data[0];
      this.setData({
        site_data: campus.category_list || []
      }, () => {
        this.changeCategory({ currentTarget: { id: 0 } });
      });
    }
  },

  /**
   * 【优化点 3】切换地址栏分类时，带上保存好的定位底稿
   */
  changeCategory(e) {
    const categoryIndex = parseInt(e.currentTarget.id);
    const siteData = this.data.site_data[categoryIndex];
    if (!siteData) return;

    const site_list = siteData.list || [];
    let staticMarkers = site_list.map((site, index) => ({
      id: index + 100,
      latitude: site.latitude,
      longitude: site.longitude,
      iconPath: this.data.Marker3_Activated,
      width: 30,
      height: 30,
      callout: { content: " " + site.name + " ", display: 'ALWAYS', padding: 5, borderRadius: 10 }
    }));

    // 合并时，显式检查并加入 myLocationMarker
    let finalMarkers = [...staticMarkers, ...this.data.bikeMarkers];
    if (this.data.myLocationMarker) {
      finalMarkers.push(this.data.myLocationMarker);
    }

    this.setData({
      category: categoryIndex,
      markers: finalMarkers
    }, () => {
      if (staticMarkers.length > 0) {
        this.includePoints(staticMarkers);
      }
    });
  },

  loadBikesFromServer() {
    const _this = this;
    wx.request({
      url: 'http://localhost:8080/api/bikes/list',
      method: 'GET',
      success(res) {
        if (res.data && Array.isArray(res.data)) {
          const bikes = res.data.map(bike => ({
            id: bike.id,
            latitude: bike.latitude,
            longitude: bike.longitude,
            iconPath: _this.data.bikeIcon,
            width: 35,
            height: 35,
            zIndex: 999,
            callout: { content: " 扫码用车 ", display: 'BYCLICK' }
          }));

          // 加载单车后，同样要合并当前的定位点
          let otherMarkers = _this.data.markers.filter(m => m.id >= 100);
          let finalMarkers = [...otherMarkers, ...bikes];
          if (_this.data.myLocationMarker) {
            finalMarkers.push(_this.data.myLocationMarker);
          }

          _this.setData({
            bikeMarkers: bikes,
            markers: finalMarkers
          });
        }
      }
    });
  },

  includePoints(points) {
    const mapCtx = wx.createMapContext('map');
    if (points.length === 1) {
      this.setData({
        latitude: points[0].latitude,
        longitude: points[0].longitude,
        scale: 17
      });
    } else {
      mapCtx.includePoints({
        padding: [150, 100, 100, 100],
        points: points
      });
    }
  },

  markertap(e) {
    const markerId = e.markerId;
    if (markerId === 9999) return; // 过滤掉“我的位置”

    if (markerId < 100) { // 假设单车 ID 小于 100
      wx.showModal({
        title: '开锁确认',
        content: '确认开启这辆单车并开始计费吗？',
        success: (res) => {
          if (res.confirm) {
            this.sendUnlockRequest(markerId);
          }
        }
      });
    }
  },

  sendUnlockRequest(bikeId) {
    wx.showLoading({ title: '正在开锁' });

    wx.request({
      url: 'http://localhost:8080/api/orders/create', // 你的 Spring Boot 地址
      method: 'POST',
      data: {
        bikeId: bikeId,
        userId: 1, // 模拟当前登录用户 ID
        startLat: this.data.myMockLat,
        startLng: this.data.myMockLng
      },
      success: (res) => {
        wx.hideLoading();
        if (res.statusCode === 200) {
          wx.showToast({ title: '开锁成功', icon: 'success' });
          console.log("订单信息已存入数据库:", res.data);

          const currentBikeId = Number(bikeId); // 刚才开锁的单车ID
          // 过滤掉当前这辆车的图标
          let filteredMarkers = this.data.markers.filter(marker => Number(marker.id) !== currentBikeId);
          this.setData({
            isRiding: true,
            currentOrderId: res.data.id, // 保存后端返回的订单ID
            ridingBikeId: currentBikeId, // 记录下这辆车，还车时要放回来
            markers: filteredMarkers
          });

          // 可选：开始计时器
          this.startTimer();
        }
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: '连接后端失败', icon: 'none' });
      }
    });
  },

  finishOrder() {
    wx.showModal({
      title: '提示',
      content: '确认还车并结束计费吗？',
      confirmColor: '#333333',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '正在结算...', mask: true });

          const endLat = this.data.myMockLat;
          const endLng = this.data.myMockLng;
          // 确保 ID 是数字
          const bId = Number(this.data.ridingBikeId); 

          wx.request({
            url: 'http://localhost:8080/api/orders/finish',
            method: 'POST',
            header: { 'content-type': 'application/json' },
            data: {
              id: this.data.currentOrderId,
              endLat: endLat,
              endLng: endLng
            },
            success: (res) => {
              wx.hideLoading();
              if (res.statusCode === 200) {
                this.stopTimer();

                // 1. 获取当前 markers 并进行深度清理
                // 强制将 marker.id 转为数字再对比，确保彻底删掉残留的旧图标
                let markers = this.data.markers.filter(m => Number(m.id) !== bId);

                // 2. 添加新位置的单车
                markers.push({
                  id: bId, // 👈 必须是 Number
                  latitude: endLat,
                  longitude: endLng,
                  iconPath: '/images/bike.png',
                  width: 40,
                  height: 40
                });

                this.setData({
                  isRiding: false,
                  ridingTime: '00:00',
                  currentOrderId: null,
                  ridingBikeId: null,
                  markers: markers // 👈 重新渲染地图
                });

                wx.showToast({ title: '还车成功', icon: 'success' });
              }
            }
          });
        }
      }
    });
  },
  // 1. 开始计时 (确保你在 unlockBike 成功后调用它)
  startTimer() {
    let seconds = 0;
    // 如果已有计时器先清除，防止重叠
    if (this.timer) clearInterval(this.timer);

    this.timer = setInterval(() => {
      seconds++;
      let m = Math.floor(seconds / 60);
      let s = seconds % 60;
      let timeStr = (m < 10 ? '0' + m : m) + ':' + (s < 10 ? '0' + s : s);

      this.setData({
        ridingTime: timeStr
      });
    }, 1000);
  },

  // 2. 停止计时 (这是你刚才报错缺失的函数)
  stopTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null; // 清空变量
      console.log("计时器已停止");
    }
  },


  formSubmit() {
    const { start, end } = this.data;
    if (!end.latitude) return;
    wx.showLoading({ title: '路线规划中' });
    qqmapsdk.direction({
      mode: 'bicycling',
      from: `${start.latitude},${start.longitude}`,
      to: `${end.latitude},${end.longitude}`,
      success: (res) => {
        const route = res.result.routes[0];
        const coors = route.polyline;
        const pl = [];
        const kr = 1000000;
        for (let i = 2; i < coors.length; i++) coors[i] = Number(coors[i - 2]) + Number(coors[i]) / kr;
        for (let i = 0; i < coors.length; i += 2) pl.push({ latitude: coors[i], longitude: coors[i + 1] });
        this.setData({ polyline: [{ points: pl, color: '#007AFF', width: 6 }] });
        wx.hideLoading();
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: '规划失败', icon: 'none' });
      }
    });
  },

  restore() {
    const mapCtx = wx.createMapContext('map');
    if (this.data.myMockLat && this.data.myMockLng) {
      mapCtx.moveToLocation({
        latitude: this.data.myMockLat,
        longitude: this.data.myMockLng,
        success: () => {
          wx.showToast({ title: '已回到我的位置', icon: 'none' });
          this.setData({
            latitude: this.data.myMockLat,
            longitude: this.data.myMockLng
          });
        }
      });
    }

  }
});