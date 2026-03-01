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

    // 我的实时定位标记底稿
    myPosIcon: "/images/my_pos.png",
    myLocationMarker: null,

    myMockLat: map.latitude,
    myMockLng: map.longitude,

    isRiding: false,
    ridingTime: '00:00',
    currentOrderId: null,
    ridingBikeId: null,

    endMarkerId: 8888,
    endMarker: null,
  },

  onLoad() {
    this.initStaticSites();
    this.loadBikesFromServer();
    this.startLocationUpdate();
  },

  /**
   * ✅ 点地图任意位置：设置为终点 end
   */
  onMapTap(e) {
    const { latitude, longitude } = e.detail || {};
    if (latitude == null || longitude == null) return;
  
    // 终点 marker
    const endMarker = {
      id: this.data.endMarkerId,      // 固定 id，方便每次替换
      latitude,
      longitude,
      iconPath: '/images/end.png',    // ✅ 你自己准备一个终点图标；没有就先用现成的
      width: 32,
      height: 32,
      zIndex: 1000,
      anchor: { x: 0.5, y: 1.0 }      // 底部对齐点位
    };
  
    // 把 markers 里旧的终点 marker 去掉，再加新的
    const markersWithoutEnd = this.data.markers.filter(m => Number(m.id) !== this.data.endMarkerId);
  
    this.setData({
      end: { name: '地图选点', latitude, longitude },
      endMarker,
      markers: [...markersWithoutEnd, endMarker]
    });
  
    wx.showToast({ title: '终点已设置', icon: 'none' });
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
          _this.handleLocationChange(location);

          // 视角跟随（保留你原逻辑）
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
   * 统一处理位置变动
   */
  handleLocationChange(res) {
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

    let otherMarkers = this.data.markers.filter(m => m.id !== 9999);

    this.setData({
      myMockLat: res.latitude,
      myMockLng: res.longitude,
      'start.latitude': res.latitude,
      'start.longitude': res.longitude,
      myLocationMarker: newMyMarker,
      markers: [...otherMarkers, newMyMarker]
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
   * 切换快捷地标分类
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

  /**
   * 从后端加载单车 marker
   */
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

          let otherMarkers = _this.data.markers.filter(m => m.id >= 100 || m.id === 9999);
          let finalMarkers = [...otherMarkers, ...bikes];
          if (_this.data.myLocationMarker) {
            if (!finalMarkers.find(m => m.id === 9999)) finalMarkers.push(_this.data.myLocationMarker);
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

  /**
   * marker 点击：
   * - 地标(>=100)：不处理（终点用点地图任意位置）
   * - 单车(<100)：开锁
   */
  markertap(e) {
    const markerId = Number(e.markerId);
    if (markerId === 9999) return;
    if (markerId >= 100) return;

    wx.showModal({
      title: '开锁确认',
      content: '确认开启这辆单车并开始计费吗？',
      success: (res) => {
        if (res.confirm) {
          this.sendUnlockRequest(markerId);
        }
      }
    });
  },

  sendUnlockRequest(bikeId) {
    wx.showLoading({ title: '正在开锁' });

    wx.request({
      url: 'http://localhost:8080/api/orders/create',
      method: 'POST',
      data: {
        bikeId: bikeId,
        userId: 1,
        startLat: this.data.myMockLat,
        startLng: this.data.myMockLng
      },
      success: (res) => {
        wx.hideLoading();
        if (res.statusCode === 200) {
          wx.showToast({ title: '开锁成功', icon: 'success' });

          const currentBikeId = Number(bikeId);
          let filteredMarkers = this.data.markers.filter(marker => Number(marker.id) !== currentBikeId);

          this.setData({
            isRiding: true,
            currentOrderId: res.data.id,
            ridingBikeId: currentBikeId,
            markers: filteredMarkers
          });

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

                let markers = this.data.markers.filter(m => Number(m.id) !== bId);

                markers.push({
                  id: bId,
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
                  markers: markers
                });

                wx.showToast({ title: '还车成功', icon: 'success' });
              }
            }
          });
        }
      }
    });
  },

  startTimer() {
    let seconds = 0;
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

  stopTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  },

  /**
   * ✅ 腾讯骑行路线
   */
  formSubmit() {
    const { start, end } = this.data;

    if (!end.latitude) {
      wx.showToast({ title: '请先点地图选择终点', icon: 'none' });
      return;
    }
    if (!start.latitude) {
      wx.showToast({ title: '定位中，请稍后再试', icon: 'none' });
      return;
    }

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

        this.setData({
          polyline: [{ points: pl, color: '#007AFF', width: 6 }]
        });

        wx.hideLoading();
      },
      fail: (err) => {
        wx.hideLoading();
        console.error('规划失败', err);
        wx.showToast({ title: '规划失败', icon: 'none' });
      }
    });
  },

  /**
   * 你的 wxml input 绑定了 tosearch：先给提示避免报错
   */
  tosearch() {
    wx.showToast({ title: '请直接点地图选择终点', icon: 'none' });
  },

  /**
   * 交换按钮：这里给最小实现（可删）
   */
  exchange() {
    const { start, end } = this.data;
    if (!end.latitude) {
      wx.showToast({ title: '请先选择终点', icon: 'none' });
      return;
    }
    this.setData({
      start: { ...end, name: '起点' },
      end: { ...start, name: '终点' }
    });
  },

  /**
   * 右侧定位按钮
   */
  location() {
    this.restore();
  },

  restore() {
    const mapCtx = wx.createMapContext('map');
    if (this.data.myMockLat && this.data.myMockLng) {
      mapCtx.moveToLocation({
        latitude: this.data.myMockLat,
        longitude: this.data.myMockLng,
        success: () => {
          this.setData({
            latitude: this.data.myMockLat,
            longitude: this.data.myMockLng
          });
        }
      });
    }
  },

  mapmarker_choose() {}
});