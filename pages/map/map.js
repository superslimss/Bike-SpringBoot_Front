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
    if (markerId === 9999) return; 

    if (markerId < 100) {
      wx.showModal({
        title: '预约单车',
        content: '准备使用这辆单车并开启导航吗？',
        confirmText: '开锁',
        success: (res) => {
          if (res.confirm) wx.showToast({ title: '已模拟开锁', icon: 'success' });
        }
      });
    } else {
      const site = this.data.site_data[this.data.category].list[markerId - 100];
      this.setData({
        'end.name': site.name,
        'end.latitude': site.latitude,
        'end.longitude': site.longitude
      });
      wx.showActionSheet({
        itemList: ['开始导航'],
        success: (res) => {
          if (res.tapIndex === 0) this.formSubmit();
        }
      });
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
    if (this.data.myMockLat && this.data.myMockLng)
    {
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