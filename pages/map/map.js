// pages/map/map.js
const map = require('../../data/map'); // 
const media = require('../../data/media');
const geo = require('../../utils/geo');
const campusGraph = require('../../data/campusGraph');
const { aStarRoute } = require('../../utils/route/localAStar');
const mapHelper = require('../../utils/mapHelper');
const timerHelper = require('../../utils/timerHelper');
const navigationHelper = require('../../utils/navigationHelper');
const ui = require('../../utils/uiHelper');
const api = require('../../services/api');

const QQMapWX = require('@libs/qqmap-wx-jssdk.min');
const qqmapsdk = new QQMapWX({
  key: map.mapKey,
});

Page({
  data: {
    // --- 1. 地图基础状态 ---
    latitude: map.latitude,
    longitude: map.longitude,
    scale: map.scale,
    myMockLat: map.latitude,  // 模拟/实时纬度
    myMockLng: map.longitude,  // 模拟/实时经度
    useLocalRoute: true,      // true=本地A*，false=腾讯接口

    // --- 2. Marker 分类仓库 (优化核心：将点分类存放) ---
    bikeMarkers: [],          // 存放后端单车
    parkingMarkers: [],       // 存放停车区图标
    siteMarkers: [],          // 存放校园地点/地标 (即原本的 site_data 转化后的点)
    myLocationMarker: null,   // 存放“我的位置”蓝点
    startMarker: null,        // 导航起点
    endMarker: null,          // 导航终点

    // --- 3. 地图渲染容器 (真正绑定在 wxml map 组件上的变量) ---
    markers: [],              // 由上述仓库合并而成
    polyline: [],             // 导航路线
    polygons: [],             // 停车区多边形

    // --- 4. 骑行与计费状态 ---
    isRiding: false,          // 骑行中状态
    isUnlockMode: false,      // 扫码/待选车模式
    ridingTime: '00:00',      // 计时器显示
    ridingFee: '0.00',        // 前端实时模拟费 (你自己加的逻辑)
    outOfAreaFee: '0.00',     // 违停结算显示费
    currentOrderId: null,
    ridingBikeId: null,

    // --- 5. 导航与路径规划数据 ---
    start: { name: '当前位置', latitude: '', longitude: '' },
    end: { name: '', latitude: '', longitude: '' },
    pickMode: null,           // 'start' | 'end' | null
    travelMode: 'bike',       // 'walk' | 'bike'
    routeDistanceText: '',    // 距离显示
    routeTimeText: '',        // 时间显示
    routeExtraText: '',
    speedWalk: 4.5,
    speedBike: 12.0,
    startManuallySet: false,  // 起点是否被手动更改过
    isNavigating: false,     // 是否处于导航中
    navTipText: '',          // 导航提示文字，如“前方30米左转”
    navRemainDist: 0,        // 剩余距离（米）
    navRouteMeta: null,

    selectedRouteType: 'fast',   // fast=推荐路线，jam=拥堵路线
    selectedRouteText: '推荐路线',
    hasJamRoute: false,
    navRemainTimeText: '',
    // --- 6. 校园地点与分类数据 ---
    category: 0,
    all_site_data: map.site_data, // 原始地标库
    site_data: [],                // 当前分类下的地标
    parkingAreas: [],             // 存储停车区原始坐标(逻辑判定用)

    // --- 7. 静态资源与配置 ---
    bikeIcon: "/images/bike.png",
    myPosIcon: "/images/my_pos.png",
    Marker3_Activated: media.Marker3_Activated,
    startMarkerId: 7777,
    endMarkerId: 8888,

    // --- 8. UI 交互控制 ---
    showConfirmModal: false,     // 第一个：是否还车（你之前说想删，先留着）
    showOutParkingModal: false,  // 第二个：违停结算弹窗

    // --- 9. 管理员调度 ---
    isAdmin: false,
    isDispatchMode: false,
    selectedBikeIds: [],
    dispatchTargetArea: null,
  },

  // =========================================================================
  // 2. 生命周期与初始化逻辑
  // =========================================================================
  onLoad() {
    this.refreshUserRole();

    this.initStaticSites();
    this.loadBikesFromServer();
    this.loadParkingAreas();
    this.startLocationUpdate();
  },
  initStaticSites() {
    const all_site_data = this.data.all_site_data;
    if (all_site_data && all_site_data.length > 0) {
      const campus = all_site_data[0];
      this.setData({
        site_data: campus.category_list || []
      }, () => {
        this.changeCategory({
          currentTarget: {
            id: 0
          }
        });
      });
    }
  },
  onShow() {
    this.refreshUserRole();
  },
  // =========================================================================
  // 3. 核心渲染引擎 (Warehouse Logic)
  // 所有 Marker 更新必须调用此函数同步到 markers 数组
  // =========================================================================
  _refreshAllMarkers() {
    const {
      bikeMarkers, parkingMarkers, siteMarkers,
      myLocationMarker, startMarker, endMarker,
      isRiding, ridingBikeId // 确保 data 中有这两个状态
    } = this.data;

    // 1. 过滤单车图层：如果正在骑行，则从列表中剔除对应的单车
    let displayBikes = bikeMarkers || [];
    if (isRiding && ridingBikeId) {
      displayBikes = displayBikes.filter(bike => bike.id !== ridingBikeId);
    }

    // 2. 合并所有图层
    let finalMarkers = [
      ...(siteMarkers || []),
      ...(parkingMarkers || []),
      ...displayBikes // 使用过滤后的单车列表
    ];

    // 3. 合并顶层图标
    if (myLocationMarker) finalMarkers.push(myLocationMarker);
    if (startMarker) finalMarkers.push(startMarker);
    if (endMarker) finalMarkers.push(endMarker);

    this.setData({ markers: finalMarkers });
  },
  refreshUserRole() {
    const role = wx.getStorageSync('role');
  
    const isAdmin = role === 'admin';
  
    this.setData({
      isAdmin,
  
      // 如果不是管理员，强制关闭调度模式
      isDispatchMode: isAdmin ? this.data.isDispatchMode : false,
      selectedBikeIds: isAdmin ? this.data.selectedBikeIds : [],
      dispatchTargetArea: isAdmin ? this.data.dispatchTargetArea : null
    }, () => {
      this.refreshBikeSelectedStyle && this.refreshBikeSelectedStyle();
    });
  },
  // =========================================================================
  // 4. 定位、坐标监听与服务器数据拉取
  // =========================================================================
  loadBikesFromServer() {
    wx.request({
      url: api.bike.list, // 结构清晰：api -> bike -> list
      success: (res) => {
        this.setData({
          bikeMarkers: mapHelper.formatBikes(res.data)
        }, () => this._refreshAllMarkers());
      }
    });
  },
  loadParkingAreas() {
    wx.request({
      url: api.parking.list,
      method: 'GET',
      success: (res) => {
        // 1. 调用工具类进行“一键转化”
        const result = mapHelper.processParkingData(res.data);

        // 2. 直接存入对应的仓库
        this.setData({
          polygons: result.polygons,
          parkingMarkers: result.markers,
          parkingAreas: result.parkingAreas
        }, () => {
          // 3. 刷新地图 Marker 引擎
          this._refreshAllMarkers();
        });
      }
    });
  },
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

    // 1. 更新仓库数据
    this.setData({
      myMockLat: res.latitude,
      myMockLng: res.longitude,
      'start.latitude': res.latitude,
      'start.longitude': res.longitude,
      myLocationMarker: newMyMarker
    }, () => {
      // 2. 调用引擎统一刷新
      this._refreshAllMarkers();
    });
  },
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

  // =========================================================================
  // 5. 导航、选点与 A* 路径规划
  // =========================================================================
  formSubmit() {
    const { start, end } = this.data;

    // 1. 基础校验
    if (!end.latitude || !start.latitude) {
      wx.showToast({ title: end.latitude ? '定位中...' : '请选择终点', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '路线规划中' });

    try {
      // 2. 执行 A* 运算（获取原始数据）
      const fast = aStarRoute(campusGraph, { lat: start.latitude, lng: start.longitude }, { lat: end.latitude, lng: end.longitude }, { useJam: true });
      const jam = aStarRoute(campusGraph, { lat: start.latitude, lng: start.longitude }, { lat: end.latitude, lng: end.longitude }, { useJam: false });

      if (!fast.points || fast.points.length < 2) {
        wx.hideLoading();
        wx.showToast({ title: '未找到可用路线', icon: 'none' });
        return;
      }

      // 3. 利用 Helper 进行逻辑对比判定
      const showRed = !mapHelper.isSameRoute(fast.points, jam.points);

      // 4. 组装渲染用的 Polyline 数组
      const polylines = [
        {
          points: fast.points,
          color: '#007AFF',
          width: 10
        }
      ];

      if (showRed) {
        polylines.push({
          points: jam.points,
          color: '#FF0000',
          width: 5,
          dottedLine: true
        });
      }

      const navRouteMeta = geo.buildRouteMeta(
        fast.points,
        this.calcDistance,
        geo.getTurnDirection
      );

      // 5. 更新 UI
      this.setData({
        _fastRoutePoints: fast.points,
        _jamRoutePoints: showRed ? jam.points : [],
        navRouteMeta: navRouteMeta,
        selectedRouteType: 'fast',
        selectedRouteText: '推荐路线',
        hasJamRoute: showRed,
      }, () => {
        this.setData({
          polyline: this.buildRoutePolylines('fast')
        });

        this.updateRouteTimeCard();
        wx.hideLoading();
      });

    } catch (e) {
      wx.hideLoading();
      console.error(e);
      wx.showToast({ title: '规划失败', icon: 'none' });
    }
  },
  onMapTap(e) {
    const { latitude, longitude } = e.detail || {};
    if (latitude == null || longitude == null) return;

    const mode = this.data.pickMode;
    if (!mode) return;

    // 1. 使用工厂函数生成 Marker 对象
    const markerId = mode === 'start' ? this.data.startMarkerId : this.data.endMarkerId;
    const newMarker = mapHelper.createMarker(mode, markerId, latitude, longitude);

    // 2. 统一更新数据
    const updateData = {
      [mode]: { name: '地图选点', latitude, longitude }, // 动态键名设置 start 或 end
      [`${mode}Marker`]: newMarker, // 动态更新 startMarker 或 endMarker 仓库
      pickMode: null
    };
    // ✅ 只有设置起点时才标记为手动更改
    if (mode === 'start') {
      updateData.startManuallySet = true;
    }

    this.setData(updateData, () => {
      this._refreshAllMarkers(); // 一键刷新
      ui.toast(`${mode === 'start' ? '起点' : '终点'}已设置`); // 使用之前封装的 uiHelper
    });
  },
  startPick(e) {
    const type = e.currentTarget.dataset.type;

    if (this.data.pickMode === type) {
      // 再点一次取消
      this.setData({ pickMode: null });
      wx.showToast({ title: '已取消选点', icon: 'none' });
      return;
    }

    this.setData({ pickMode: type });

    wx.showToast({
      title: type === 'start' ? '请选择起点' : '请选择终点',
      icon: 'none'
    });
  },
  resetRouteUI() {
    this.setData({
      polyline: [],
      routeDistanceText: '',
      routeTimeText: '',
      routeExtraText: '',

      _fastRoutePoints: [],
      _jamRoutePoints: [],
      navRouteMeta: null
    });
  },
  onModeTap(e) {
    const mode = e.currentTarget.dataset.mode; // 'walk' or 'bike'
    if (!mode) return;

    this.setData({ travelMode: mode }, () => {
      // 如果已经规划过路线，切换模式时直接刷新时间显示
      this.updateRouteTimeCard();
    });
  },
  updateRouteTimeCard() {
    const { travelMode, speedWalk, speedBike, _fastRoutePoints, _jamRoutePoints } = this.data;

    // 1. 确定当前速度
    const speed = travelMode === 'walk' ? speedWalk : speedBike;

    // 2. 调用分析器拿回“精装修”后的文案
    const res = mapHelper.getRouteAnalysis(_fastRoutePoints, _jamRoutePoints, speed, travelMode);

    if (!res) return;

    // 3. 页面只负责更新 UI
    this.setData({
      routeDistanceText: res.distanceText,
      routeTimeText: res.timeText,
      routeExtraText: res.extraText
    });
  },

  toggleSelectedRoute() {
    const {
      hasJamRoute,
      selectedRouteType,
      _fastRoutePoints,
      _jamRoutePoints
    } = this.data;

    if (!hasJamRoute || !_jamRoutePoints || _jamRoutePoints.length < 2) {
      wx.showToast({
        title: '当前只有一条可用路线',
        icon: 'none'
      });
      return;
    }

    const nextType = selectedRouteType === 'fast' ? 'jam' : 'fast';
    const selectedPoints = nextType === 'fast' ? _fastRoutePoints : _jamRoutePoints;

    const navRouteMeta = geo.buildRouteMeta(
      selectedPoints,
      this.calcDistance,
      geo.getTurnDirection
    );

    this.setData({
      selectedRouteType: nextType,
      selectedRouteText: nextType === 'fast' ? '推荐路线' : '拥堵路线',
      navRouteMeta
    }, () => {
      this.setData({
        polyline: this.buildRoutePolylines(nextType)
      });
    });
  },
  buildRoutePolylines(selectedType = 'fast') {
    const { _fastRoutePoints, _jamRoutePoints, hasJamRoute } = this.data;

    const polylines = [];

    if (_fastRoutePoints && _fastRoutePoints.length >= 2) {
      polylines.push({
        points: _fastRoutePoints,
        color: '#007AFF',
        width: selectedType === 'fast' ? 10 : 5
      });
    }

    if (hasJamRoute && _jamRoutePoints && _jamRoutePoints.length >= 2) {
      polylines.push({
        points: _jamRoutePoints,
        color: '#FF0000',
        width: selectedType === 'jam' ? 8 : 5,
        dottedLine: true
      });
    }

    return polylines;
  },
  resetNavigation(showToast = true) {
    const resetStart = {
      name: '当前位置',
      latitude: this.data.myMockLat || this.data.start.latitude,
      longitude: this.data.myMockLng || this.data.start.longitude
    };

    this.setData({
      polyline: [],
      pickMode: null,
      start: resetStart,
      end: { name: '', latitude: '', longitude: '' },
      startMarker: null,
      endMarker: null,
      startManuallySet: false,
      isNavigating: false,
    }, () => {
      this._refreshAllMarkers();
      this.resetRouteUI();
    });

    if (showToast) {
      wx.showToast({ title: '已重置导航', icon: 'none' });
    }
  },
  exchange() {
    const {
      start,
      end
    } = this.data;
    if (!end.latitude) {
      wx.showToast({
        title: '请先选择终点',
        icon: 'none'
      });
      return;
    }
    this.setData({
      start: {
        ...end,
        name: '起点'
      },
      end: {
        ...start,
        name: '终点'
      }
    });
  },
  // 点击“开始导航”按钮
  onStartNavTap() {
    const routePoints = this.data.selectedRouteType === 'jam'
      ? this.data._jamRoutePoints
      : this.data._fastRoutePoints;
    if (!routePoints || routePoints.length < 2) {
      wx.showToast({ title: '暂无可用路线', icon: 'none' });
      return;
    }

    // 起点被手动设置 → 弹窗
    if (this.data.startManuallySet) {
      wx.showModal({
        title: '提示',
        content: '您已更改起点，是否从当前位置开始导航？',
        cancelText: '取消',
        confirmText: '开始导航',
        success: (res) => {
          if (res.confirm) {
            // ======================================
            // 核心修复：重置起点为当前位置 + 重置标记
            // ======================================
            this.setData({
              startManuallySet: false,
              // 强制把起点还原为默认的当前位置（关键！）
              'start.latitude': this.data.myMockLat,
              'start.longitude': this.data.myMockLng,
              'start.name': '当前位置',
              startMarker: null
            }, () => {
              this._refreshAllMarkers();
              // 重新规划路线（必须加！否则路线还是旧的）
              this.formSubmit();
              // 规划完成后，执行原生导航逻辑
              setTimeout(() => {
                const routePoints = this.data.selectedRouteType === 'jam'
                  ? this.data._jamRoutePoints
                  : this.data._fastRoutePoints;

                this.startNavigation(routePoints);
              }, 200);
            });
          }
        }
      });
      return;
    }

    // 未设置起点 → 默认当前位置的原生导航逻辑
    this.startNavigation(routePoints);
  },

  // 启动导航
  startNavigation(points) {
    if (!points || points.length < 2) {
      wx.showToast({ title: '暂无可用路线', icon: 'none' });
      return;
    }

    if (!this.data.navRouteMeta) {
      wx.showToast({ title: '导航数据未生成', icon: 'none' });
      return;
    }

    if (this.navTimer) {
      clearInterval(this.navTimer);
      this.navTimer = null;
    }

    this.setData({
      isNavigating: true,
      navTipText: '',
      navRemainDist: 0
    }, () => {
      this.updateNavInfo(points);

      this.navTimer = setInterval(() => {
        this.updateNavInfo(points);
      }, 1000);
    });
  },
  calcDistance(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  },
  // 计算导航卡片内容（核心）
  updateNavInfo(points) {
    const { myMockLat, myMockLng, navRouteMeta } = this.data;

    if (!navRouteMeta || !navRouteMeta.points || navRouteMeta.points.length < 2) {
      this.exitNavigation();
      return;
    }

    const progress = geo.getRouteProgress(
      navRouteMeta.points,
      navRouteMeta.cumDist,
      myMockLat,
      myMockLng,
      this.calcDistance
    );

    const remainDist = Math.max(
      0,
      Math.round(navRouteMeta.totalDistance - progress)
    );

    const navRemainTimeText = navigationHelper.calcRemainTimeText(
      remainDist,
      this.data.travelMode,
      this.data.speedWalk,
      this.data.speedBike
    );

    if (remainDist < 10) {
      const finishPolylines = navigationHelper.buildNavigationPolylines(
        navRouteMeta,
        this.data.selectedRouteType,
        navRouteMeta.totalDistance
      );

      this.setData({
        navTipText: '已到达目的地',
        navRemainDist: 0,
        navRemainTimeText: '约0分钟',
        polyline: finishPolylines
      });

      if (this.navTimer) {
        clearInterval(this.navTimer);
        this.navTimer = null;
      }

      return;
    }

    const navTipText = navigationHelper.buildNavTipText(
      navRouteMeta,
      progress,
      remainDist,
      geo
    );

    const navPolylines = navigationHelper.buildNavigationPolylines(
      navRouteMeta,
      this.data.selectedRouteType,
      progress
    );

    this.setData({
      navTipText,
      navRemainDist: remainDist,
      navRemainTimeText,
      polyline: navPolylines
    });
  },

  exitNavigation() {
    if (this.navTimer) {
      clearInterval(this.navTimer);
      this.navTimer = null;
    }

    this.resetNavigation(false);
  },

  //测试移动按钮到第六大区
  moveMockPosition(direction) {
    let { myMockLat, myMockLng } = this.data;

    // 每次移动距离（大约 3~5 米）
    const step = 0.00003;

    switch (direction) {
      case 'up':
        myMockLat += step;
        break;

      case 'down':
        myMockLat -= step;
        break;

      case 'left':
        myMockLng -= step;
        break;

      case 'right':
        myMockLng += step;
        break;
    }

    this.handleLocationChange({
      latitude: myMockLat,
      longitude: myMockLng
    });
  },

  moveUp() {
    this.moveMockPosition('up');
  },

  moveDown() {
    this.moveMockPosition('down');
  },

  moveLeft() {
    this.moveMockPosition('left');
  },

  moveRight() {
    this.moveMockPosition('right');
  },
  // =========================================================================
  // 6. 骑行状态、开锁、计时计费与还车结算
  // =========================================================================
  markertap(e) {
    const markerId = e.markerId;

    if (markerId === 9999) return; // 我的定位点不处理

    // ✅ 管理员调度模式下：点击停车区图标 = 选择目标停车区
    if (this.data.isAdmin && this.data.isDispatchMode && markerId >= 700000) {
      this.selectDispatchTargetAreaByMarker(markerId);
      return;
    }
    // 只处理单车点击
    if (markerId < 1000) {
      // 管理员调度模式：点击单车 = 选中 / 取消选中
      if (this.data.isAdmin && this.data.isDispatchMode) {
        this.toggleSelectBike(markerId);
        return;
      }

      // ✅ 必须先进入扫码开锁模式，才能点车开锁
      if (!this.data.isUnlockMode) {
        wx.showToast({ title: '请先点击“扫码用车”', icon: 'none' });
        return;
      }

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
  toggleDispatchMode() {
    const next = !this.data.isDispatchMode;

    this.setData({
      isDispatchMode: next,
      isUnlockMode: false,
      selectedBikeIds: next ? this.data.selectedBikeIds : [],
      dispatchTargetArea: next ? this.data.dispatchTargetArea : null
    }, () => {
      this.refreshBikeSelectedStyle();
    });

    wx.showToast({
      title: next ? '已进入调度模式' : '已退出调度模式',
      icon: 'none'
    });
  },

  selectDispatchTargetAreaByMarker(markerId) {
    const areaId = markerId - 700000;

    const area = (this.data.parkingAreas || []).find(
      item => Number(item.id) === Number(areaId)
    );
    if (!area) {
      wx.showToast({
        title: '停车区数据不存在',
        icon: 'none'
      });
      return;
    }
  
    this.setData({
      dispatchTargetArea: area
    });
  
    wx.showToast({
      title: `已选择${area.name || '停车区'}`,
      icon: 'none'
    });
  },

  toggleSelectBike(bikeId) {
    let selectedBikeIds = this.data.selectedBikeIds || [];

    if (selectedBikeIds.includes(bikeId)) {
      selectedBikeIds = selectedBikeIds.filter(id => id !== bikeId);
    } else {
      selectedBikeIds.push(bikeId);
    }

    this.setData({
      selectedBikeIds
    }, () => {
      this.refreshBikeSelectedStyle();
    });
  },

  refreshBikeSelectedStyle() {
    const selectedIds = this.data.selectedBikeIds || [];

    const bikeMarkers = this.data.bikeMarkers.map(marker => {
      const selected = selectedIds.includes(marker.id);

      return {
        ...marker,
        width: selected ? 45 : 35,
        height: selected ? 45 : 35,
        callout: selected
          ? {
            content: ' 已选中 ',
            display: 'ALWAYS',
            padding: 5,
            borderRadius: 8,
            bgColor: '#1677ff',
            color: '#ffffff',
            fontSize: 12
          }
          : { content: ' 扫码用车 ', display: 'BYCLICK' }
      };
    });

    this.setData({
      bikeMarkers
    }, () => {
      this._refreshAllMarkers();
    });
  },


  confirmBatchDispatch() {
    const { selectedBikeIds, dispatchTargetArea } = this.data;

    if (!selectedBikeIds || selectedBikeIds.length === 0) {
      wx.showToast({
        title: '请先选择单车',
        icon: 'none'
      });
      return;
    }

    if (!dispatchTargetArea) {
      wx.showToast({
        title: '请选择目标停车区',
        icon: 'none'
      });
      return;
    }

    wx.showModal({
      title: '确认调度',
      content: `确认将 ${selectedBikeIds.length} 辆单车调度到${dispatchTargetArea.name || '目标停车区'}吗？`,
      success: (res) => {
        if (!res.confirm) return;

        wx.request({
          url: api.bike.batchDispatch,
          method: 'PUT',
          header: {
            'content-type': 'application/json'
          },
          data: {
            bikeIds: selectedBikeIds,
            parkingAreaId: dispatchTargetArea.id,
            role: wx.getStorageSync('role')
          },
          success: (res) => {
            const result = res.data;

            if (result.code === 1) {
              wx.showToast({
                title: `成功调度${result.successCount || selectedBikeIds.length}辆`,
                icon: 'success'
              });

              this.setData({
                selectedBikeIds: [],
                dispatchTargetArea: null,
                isDispatchMode: false
              });

              this.loadBikesFromServer();
            } else {
              wx.showToast({
                title: result.msg || '调度失败',
                icon: 'none'
              });
            }
          },
          fail: () => {
            wx.showToast({
              title: '请求失败',
              icon: 'none'
            });
          }
        });
      }
    });
  },

  clearDispatchSelection() {
    this.setData({
      selectedBikeIds: [],
      dispatchTargetArea: null
    }, () => {
      this.refreshBikeSelectedStyle();
    });
  },
  toggleUnlockMode() {
    // --- 1. 新增：登录拦截逻辑 ---
    const currentUserId = wx.getStorageSync('userId');
    if (!currentUserId) {
      wx.showModal({
        title: '提示',
        content: '请先登录后再进行骑行',
        confirmText: '去登录',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({
              url: '/pages/login/login' // 确保你的登录页面路径正确
            });
          }
        }
      });
      return; // 拦截成功，不再往下执行
    }

    // --- 3. 原有的进入选车模式逻辑 ---
    const next = !this.data.isUnlockMode;
    this.setData({ isUnlockMode: next });

    if (next) {
      wx.showToast({ title: '请点击单车开锁', icon: 'none' });
    } else {
      wx.showToast({ title: '已取消扫码开锁', icon: 'none' });
    }
  },
  sendUnlockRequest(bikeId) {
    // 此时能进到这里的用户肯定已经登录了，直接获取 ID 即可
    const currentUserId = wx.getStorageSync('userId');

    wx.showLoading({ title: '正在开锁' });

    wx.request({
      url: api.order.create,
      method: 'POST',
      data: {
        bikeId: bikeId,
        userId: currentUserId,
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
            isUnlockMode: false,
            currentOrderId: res.data.id,
            ridingBikeId: currentBikeId,
            markers: filteredMarkers
          });

          this.startTimer();
        } else {
          wx.showToast({
            title: res.data || '创建订单失败',
            icon: 'none'
          });
        }
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: '连接服务器失败', icon: 'none' });
      }
    });
  },
  startTimer() {
    if (this.timer) clearInterval(this.timer);

    // 建议在 data 里存一个 rideSeconds 记录纯秒数，方便计算
    this.setData({ rideSeconds: 0 });

    this.timer = setInterval(() => {
      const seconds = this.data.rideSeconds + 1;

      this.setData({
        rideSeconds: seconds,
        ridingTime: timerHelper.formatTime(seconds),
        ridingFee: timerHelper.calculateFee(seconds).toFixed(2)
      });
    }, 1000);
  },
  stopTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  },
  finishOrder() {
    const endLat = this.data.myMockLat;
    const endLng = this.data.myMockLng;
    const matchedArea = this.checkIfInParkingArea(endLat, endLng);

    if (matchedArea) {
      this.doFinishOrder(endLat, endLng);
    } else {
      // ✅ 逻辑外迁：使用工具类计算违停总额
      const total = timerHelper.calculateTotalWithPenalty(this.data.ridingFee);

      this.setData({
        outOfAreaFee: total,
        showOutParkingModal: true
      });
    }
  },
  doFinishOrder(endLat, endLng) {
    wx.showLoading({
      title: '正在结算...',
      mask: true
    });

    wx.request({
      url: api.order.finish,
      method: 'POST',
      header: {
        'content-type': 'application/json'
      },
      data: {
        id: this.data.currentOrderId,
        endLat: endLat,
        endLng: endLng
      },
      success: (res) => {
        wx.hideLoading();
        if (res.statusCode === 200) {
          // 1. 停止计时器
          this.stopTimer();

          // ✅ 2. 核心重构：不再手动拼 markers，直接重新加载后端单车数据
          // 这会自动触发 _refreshAllMarkers()，把刚还的车显示出来
          this.loadBikesFromServer();

          // 3. 重置骑行相关的 UI 状态
          this.setData({
            isRiding: false,
            ridingTime: '00:00',
            currentOrderId: null,
            ridingBikeId: null
            // markers 字段不需要在这里手动设置了，loadBikesFromServer 会处理
          });

          // 4. 弹窗提示
          wx.showModal({
            title: '还车成功',
            content: '本次费用已结算',
            showCancel: false
          });
        } else {
          wx.showToast({
            title: '还车失败',
            icon: 'none'
          });
        }
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({
          title: '结算请求失败',
          icon: 'none'
        });
      }
    });
  },
  cancelOutParking() {
    this.setData({
      showOutParkingModal: false
    });
  },
  confirmForceFinish() {
    const endLat = this.data.myMockLat;
    const endLng = this.data.myMockLng;

    // 只负责关闭弹窗
    this.setData({
      showOutParkingModal: false
    });

    // 调用还车执行函数
    this.doFinishOrder(endLat, endLng);
  },
  checkIfInParkingArea(lat, lng) {
    // 页面不再关心怎么算、怎么遍历，只管拿结果
    return mapHelper.findMatchedParkingArea({ latitude: lat, longitude: lng }, this.data.parkingAreas);
  },

  // =========================================================================
  // 7. 其他 UI 交互（分类切换、弹窗控制、搜索跳转）
  // =========================================================================
  changeCategory(e) {
    const categoryIndex = parseInt(e.currentTarget.id);
    const siteData = this.data.site_data[categoryIndex];
    if (!siteData) return;

    // 直接调用转换函数
    const staticMarkers = mapHelper.convertToSiteMarkers(
      siteData.list || [],
      this.data.Marker3_Activated
    );

    this.setData({
      category: categoryIndex,
      siteMarkers: staticMarkers // 更新仓库
    }, () => {
      this._refreshAllMarkers(); // 统一渲染
      if (staticMarkers.length > 0) {
        this.includePoints(staticMarkers);
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
  tosearch() {
    wx.showToast({
      title: '请直接点地图选择终点',
      icon: 'none'
    });
  },

});