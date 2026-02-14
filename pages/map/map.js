// pages/map/map.js
import map from '@data/map';
import media from '@data/media';

// 引入腾讯地图SDK核心类
const QQMapWX = require('@libs/qqmap-wx-jssdk.min');
const qqmapsdk = new QQMapWX({
  key: map.mapKey, 
});

Page({
  data: {
    // 1. 基础定位：优先读取配置文件中的辽石化坐标
    latitude: map.latitude,
    longitude: map.longitude,
    scale: map.scale,

    // 2. 地标分类属性
    category: 0,
    all_site_data: map.site_data,
    site_data: [],
    Marker3_Activated: media.Marker3_Activated,

    // 3. 单车属性
    bikeIcon: "/images/bike.png", 
    bikeMarkers: [], 

    // 4. 地图显示集合
    markers: [],
    polyline: [],
    
    // 5. 导航起点与终点
    start: { name: '当前位置', latitude: '', longitude: '' },
    end: { name: '', latitude: '', longitude: '' },

    
  },

  onLoad(options) {
    // 确保启动时即使网络报错，基础数据也能加载
    this.initStaticSites();
    this.initUserLocation();
    this.loadBikesFromServer(); 
  },

  /**
   * 初始化校园地标（图书馆、食堂等）
   */
  initStaticSites() {
    const all_site_data = this.data.all_site_data;
    if (all_site_data && all_site_data.length > 0) {
      const campus = all_site_data[0]; 
      this.setData({
        site_data: campus.category_list || []
      }, () => {
        // 初始显示第一个分类
        this.changeCategory({ currentTarget: { id: 0 } });
      });
    }
  },

  /**
   * 切换分类并自动跳转视角
   */
  changeCategory(e) {
    const categoryIndex = parseInt(e.currentTarget.id);
    const siteData = this.data.site_data[categoryIndex];
    if (!siteData) return;

    const site_list = siteData.list || [];
    
    // 生成地标 Markers (ID从100开始)
    let staticMarkers = site_list.map((site, index) => ({
      id: index + 100, 
      latitude: site.latitude,
      longitude: site.longitude,
      iconPath: this.data.Marker3_Activated,
      width: 30,
      height: 30,
      callout: {
        content: " " + site.name + " ",
        display: 'ALWAYS',
        padding: 5,
        borderRadius: 10
      }
    }));

    this.setData({
      category: categoryIndex,
      markers: [...staticMarkers, ...this.data.bikeMarkers]
    }, () => {
      // 只有当地标存在时才执行视角缩放
      if (staticMarkers.length > 0) {
        this.includePoints(staticMarkers);
      }
    });
  },

  /**
   * 从后端加载单车
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
            zIndex: 999,              // 确保单车图层在最上方
            callout: {
              content: " 扫码用车 ",
              display: 'BYCLICK'
            }
          }));
          _this.setData({ 
            bikeMarkers: bikes,
            markers: [..._this.data.markers, ...bikes]
          });
        }
      },
      fail(err) {
        console.warn("后端单车数据获取失败，仅显示静态地标");
      }
    });
  },

  /**
   * 自动缩放视野
   */
  includePoints(points) {
    const mapCtx = wx.createMapContext('map');
    
    // 如果只有一个点，我们不使用 includePoints，而是直接平移并设置一个舒适的缩放值
    if (points.length === 1) {
      this.setData({
        latitude: points[0].latitude,
        longitude: points[0].longitude,
        scale: 17 // 17 是一个比较舒适的近距离观察比例，不会像 20 那么夸张
      });
    } else {
      // 如果有多个点（如“学院”分类），则使用自动缩放
      mapCtx.includePoints({
        padding: [150, 100, 100, 100], // 增加边距，让视野更开阔
        points: points,
        success: () => {
          // 这里的回调可以确保在缩放完成后执行
          console.log("多点视野跳转成功");
        }
      });
    }
  },
  initUserLocation() {
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        this.setData({
          'start.latitude': res.latitude,
          'start.longitude': res.longitude
        });
      }
    });
  },

  /**
   * 点击交互：区分单车和地标
   */
  markertap(e) {
    const markerId = e.markerId;
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
    mapCtx.moveToLocation();
    this.loadBikesFromServer();
  }
});