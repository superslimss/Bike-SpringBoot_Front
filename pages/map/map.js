// pages/map/map.js
import map from '@data/map';
import media from '@data/media';

const QQMapWX = require('@libs/qqmap-wx-jssdk.min');
const qqmapsdk = new QQMapWX({
  key: map.mapKey,
});
const campusGraph = require('../../data/campusGraph');
const { aStarRoute } = require('../../utils/route/localAStar');

function isAfterClassTime() {
  const now = new Date();
  const t = now.getHours() * 60 + now.getMinutes();
  const ranges = [
    [11 * 60 + 30, 12 * 60 + 10],
    [15 * 60 + 0, 16 * 60 + 0],   // 新增下午三点到四点
    [16 * 60 + 0, 17 * 60 + 0],   // ✅ 新增：16:00 - 17:00
    [17 * 60 + 0, 17 * 60 + 60],
    [20 * 60 + 30, 21 * 60 + 10],
  ];
  return ranges.some(([a, b]) => t >= a && t <= b);
}

function toLLPoints(points) {
  return points.map(p => ({ latitude: p.latitude, longitude: p.longitude }));
}

function calcDistanceMeters(points) {
  if (!points || points.length < 2) return 0;

  const R = 6371000;
  const toRad = d => (d * Math.PI) / 180;

  let sum = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];

    const dLat = toRad(b.latitude - a.latitude);
    const dLng = toRad(b.longitude - a.longitude);
    const la1 = toRad(a.latitude);
    const la2 = toRad(b.latitude);

    const x =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;

    sum += 2 * R * Math.asin(Math.sqrt(x));
  }
  return sum;
}

// 速度：你可以按实际改（骑行一般 3~6m/s；校园慢点 3.5~4.5）
function estimateMinutesBySpeed(distanceMeters, speedMps = 4.0) {
  if (!distanceMeters) return 0;
  const sec = distanceMeters / speedMps;
  return sec / 60;
}

function fmtDistance(m) {
  if (m < 1000) return `${Math.round(m)}m`;
  return `${(m / 1000).toFixed(2)}km`;
}

function fmtMinutes(min) {
  if (min < 1) return `约1分钟`;
  return `约${Math.round(min)}分钟`;
}

function isPointInPolygon(point, polygon) {
  const x = Number(point.longitude);
  const y = Number(point.latitude);
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = Number(polygon[i].lng ?? polygon[i].longitude);
    const yi = Number(polygon[i].lat ?? polygon[i].latitude);
    const xj = Number(polygon[j].lng ?? polygon[j].longitude);
    const yj = Number(polygon[j].lat ?? polygon[j].latitude);

    const intersect =
      ((yi > y) !== (yj > y)) &&
      (x < (xj - xi) * (y - yi) / (yj - yi) + xi);

    if (intersect) {
      inside = !inside;
    }
  }

  return inside;
}

// 可选：处理“点刚好压在边上”的情况
function isPointOnSegment(point, a, b, epsilon = 1e-10) {
  const px = Number(point.longitude);
  const py = Number(point.latitude);
  const ax = Number(a.lng ?? a.longitude);
  const ay = Number(a.lat ?? a.latitude);
  const bx = Number(b.lng ?? b.longitude);
  const by = Number(b.lat ?? b.latitude);

  const cross = (px - ax) * (by - ay) - (py - ay) * (bx - ax);
  if (Math.abs(cross) > epsilon) return false;

  const dot = (px - ax) * (bx - ax) + (py - ay) * (by - ay);
  if (dot < 0) return false;

  const lenSq = (bx - ax) * (bx - ax) + (by - ay) * (by - ay);
  if (dot > lenSq) return false;

  return true;
}

function isPointInPolygonOrOnEdge(point, polygon) {
  return isPointInPolygon(point, polygon);
}

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

    start: {
      name: '当前位置',
      latitude: '',
      longitude: ''
    },
    end: {
      name: '',
      latitude: '',
      longitude: ''
    },

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

    pickMode: null, // 'start' | 'end' | null
    startMarkerId: 7777,
    endMarkerId: 8888,
    startMarker: null,
    endMarker: null,

    isUnlockMode: false, // 是否处于“扫码开锁/待选车”模式

    useLocalRoute: true, // true=本地A*，false=腾讯

    routeDistanceText: '',
    routeTimeText: '',
    routeExtraText: '',

    travelMode: 'bike',      // 'walk' | 'bike'
    speedWalk: 1.3,          // m/s 步行速度（约 4.7km/h）
    speedBike: 4.0,          // m/s 骑行速度（约 14.4km/h）

    polygons: [],
    parkingMarkers: [],
    parkingAreas: [],

    showConfirmModal: false,      // 第一个：是否还车
    showOutParkingModal: false,   // 第二个：不在停车区
  },

  onLoad() {
    this.initStaticSites();
    this.loadBikesFromServer();
    this.loadParkingAreas(); // ✅ 加这一行
    this.startLocationUpdate();
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
      _jamRoutePoints: []
    });
  },


  /**
   * ✅ 点地图任意位置：设置为终点 end
   */
  onMapTap(e) {
    const {
      latitude,
      longitude
    } = e.detail || {};
    if (latitude == null || longitude == null) return;

    const mode = this.data.pickMode;
    if (!mode) {
      // 没有进入选点模式：点击地图不做任何事（避免“自动设置终点”）
      return;
    }

    // 根据 mode 决定设置起点还是终点
    if (mode === 'start') {
      const startMarker = {
        id: this.data.startMarkerId,
        latitude,
        longitude,
        iconPath: '/images/start.png', // 你没有就先用 /images/center.png 也行
        width: 28,
        height: 28,
        zIndex: 1000,
        anchor: {
          x: 0.5,
          y: 1.0
        }
      };

      const markersNoStart = this.data.markers.filter(m => Number(m.id) !== this.data.startMarkerId);

      this.setData({
        start: {
          name: '地图选点',
          latitude,
          longitude
        },
        startMarker,
        markers: [...markersNoStart, startMarker],
        pickMode: null // ✅ 设置一次就退出选点模式
      });

      wx.showToast({
        title: '起点已设置',
        icon: 'none'
      });
      return;
    }

    if (mode === 'end') {
      const endMarker = {
        id: this.data.endMarkerId,
        latitude,
        longitude,
        iconPath: '/images/end.png', // 你已有 end.png 就用这个
        width: 32,
        height: 32,
        zIndex: 1000,
        anchor: {
          x: 0.5,
          y: 1.0
        }
      };

      const markersNoEnd = this.data.markers.filter(m => Number(m.id) !== this.data.endMarkerId);

      this.setData({
        end: {
          name: '地图选点',
          latitude,
          longitude
        },
        endMarker,
        markers: [...markersNoEnd, endMarker],
        pickMode: null // ✅ 设置一次就退出选点模式
      });

      wx.showToast({
        title: '终点已设置',
        icon: 'none'
      });
      return;
    }
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

    if (!_fastRoutePoints || _fastRoutePoints.length < 2) return;

    const speed = travelMode === 'walk' ? speedWalk : speedBike;

    const fastDist = calcDistanceMeters(_fastRoutePoints);
    const fastMin = estimateMinutesBySpeed(fastDist, speed);

    let extraText = '';
    if (_jamRoutePoints && _jamRoutePoints.length >= 2) {
      const jamDist = calcDistanceMeters(_jamRoutePoints);
      const jamMin = estimateMinutesBySpeed(jamDist, speed);
      const diff = jamMin - fastMin;

      if (diff > 0.5) extraText = `红线预计多花 ${Math.round(diff)} 分钟`;
      else if (diff < -0.5) extraText = `红线反而快 ${Math.round(-diff)} 分钟（检查权重/路网）`;
      else extraText = `两条路线耗时接近`;
    }

    this.setData({
      routeDistanceText: `预计距离：${fmtDistance(fastDist)}`,
      routeTimeText: `预计时间：${fmtMinutes(fastMin)}（${travelMode === 'walk' ? '步行' : '骑行'}）`,
      routeExtraText: extraText
    });
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
      anchor: {
        x: 0.5,
        y: 0.5
      }
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
        this.changeCategory({
          currentTarget: {
            id: 0
          }
        });
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
      callout: {
        content: " " + site.name + " ",
        display: 'ALWAYS',
        padding: 5,
        borderRadius: 10
      }
    }));

    let finalMarkers = [
      ...staticMarkers,
      ...(this.data.parkingMarkers || []),  // ✅ 加停车点
      ...this.data.bikeMarkers
    ];

    if (this.data.startMarker) finalMarkers.push(this.data.startMarker);
    if (this.data.endMarker) finalMarkers.push(this.data.endMarker);
    if (this.data.myLocationMarker) finalMarkers.push(this.data.myLocationMarker);

    this.setData({
      category: categoryIndex,
      markers: finalMarkers
    }, () => {
      if (staticMarkers.length > 0) {
        this.includePoints(staticMarkers);
      }
    });
  },

  loadParkingAreas() {
    wx.request({
      url: 'http://localhost:8080/api/parking-areas/list',
      method: 'GET',
      success: (res) => {
        console.log('停车区接口返回：', res.data);
        if (!Array.isArray(res.data)) return;

        // 原始区域数据缓存下来，后面还车判定要用
        const parkingAreas = res.data.map(area => ({
          ...area,
          points: (area.points || []).map(p => ({
            lat: Number(p.lat),
            lng: Number(p.lng)
          }))
        }));

        // 1) polygons：停车区域（蓝色）
        const polygons = parkingAreas.map((area, idx) => ({
          id: area.id || (9000 + idx),
          points: (area.points || []).map(p => ({
            latitude: p.lat,
            longitude: p.lng
          })),
          strokeWidth: 2,
          strokeColor: '#0062ff',
          fillColor: '#0062ff33',
          zIndex: 1
        }));

        // 2) parking markers：停车点图标（每个区域一个）
        const parkingMarkers = parkingAreas.map((area, idx) => {
          const pts = area.points || [];
          if (pts.length === 0) return null;

          const center = pts.reduce((acc, p) => {
            acc.lat += p.lat;
            acc.lng += p.lng;
            return acc;
          }, { lat: 0, lng: 0 });

          center.lat /= pts.length;
          center.lng /= pts.length;

          return {
            id: 7000 + idx,
            latitude: center.lat,
            longitude: center.lng,
            iconPath: '/images/parking.png',
            width: 28,
            height: 28,
            zIndex: 1002,
            callout: {
              content: ` ${area.name || '停车点'} `,
              display: 'BYCLICK',
              padding: 6,
              borderRadius: 10
            }
          };
        }).filter(Boolean);

        this.setData({
          polygons,
          parkingMarkers,
          parkingAreas
        }, () => {
          this.refreshParkingMarkersOnMap();
        });

      },
      fail: (err) => {
        console.error('加载停车区失败', err);
      }
    });
  },

  checkIfInParkingArea(lat, lng) {
    const parkingAreas = this.data.parkingAreas || [];
    const point = {
      latitude: Number(lat),
      longitude: Number(lng)
    };

    console.log('当前还车坐标：', point);
    console.log('parkingAreas：', parkingAreas);

    for (let i = 0; i < parkingAreas.length; i++) {
      const area = parkingAreas[i];
      const points = area.points || [];

      console.log('正在判断停车区：', area.name);
      console.log('停车区 points：', JSON.stringify(points));

      if (points.length >= 3 && isPointInPolygonOrOnEdge(point, points)) {
        console.log('命中停车区：', area.name);
        return area;
      }
    }

    console.log('没有命中任何停车区');
    return null;
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
            callout: {
              content: " 扫码用车 ",
              display: 'BYCLICK'
            }
          }));

          let otherMarkers = _this.data.markers.filter(m => m.id >= 100 || m.id === 9999);
          let finalMarkers = [...otherMarkers, ...bikes];
          // ✅ 保留起点标记
          if (_this.data.startMarker) {
            finalMarkers.push(_this.data.startMarker);
          }

          // ✅ 保留终点标记
          if (_this.data.endMarker) {
            finalMarkers.push(_this.data.endMarker);
          }
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

  refreshParkingMarkersOnMap() {
    const pm = this.data.parkingMarkers || [];

    // 先清掉旧的停车点 marker（7000~7999）
    const other = (this.data.markers || []).filter(m => {
      const id = Number(m.id);
      return !(id >= 7000 && id < 8000);
    });

    this.setData({
      markers: [...other, ...pm]
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
  toggleUnlockMode() {
    // 正在骑行就不允许进入开锁模式
    if (this.data.isRiding) {
      wx.showToast({ title: '骑行中无法扫码开锁', icon: 'none' });
      return;
    }

    const next = !this.data.isUnlockMode;
    this.setData({ isUnlockMode: next });

    if (next) {
      wx.showToast({ title: '请点击单车开锁', icon: 'none' });
    } else {
      wx.showToast({ title: '已取消扫码开锁', icon: 'none' });
    }
  },

  /**
   * marker 点击：
   * - 地标(>=100)：不处理（终点用点地图任意位置）
   * - 单车(<100)：开锁
   */
  markertap(e) {
    const markerId = e.markerId;
    if (markerId === 9999) return; // 我的定位点不处理

    // 只处理单车点击（你原来假设单车 id < 100）
    if (markerId < 100) {
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

  sendUnlockRequest(bikeId) {
    wx.showLoading({
      title: '正在开锁'
    });

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
          wx.showToast({
            title: '开锁成功',
            icon: 'success'
          });

          const currentBikeId = Number(bikeId);
          let filteredMarkers = this.data.markers.filter(marker => Number(marker.id) !== currentBikeId);

          this.setData({
            isRiding: true,
            isUnlockMode: false,     // ✅ 开锁成功自动退出扫码模式
            currentOrderId: res.data.id,
            ridingBikeId: currentBikeId,
            markers: filteredMarkers
          });

          this.startTimer();
        }
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({
          title: '连接后端失败',
          icon: 'none'
        });
      }
    });
  },

  finishOrder() {
    const endLat = this.data.myMockLat;
    const endLng = this.data.myMockLng;

    wx.showModal({
      title: '提示',
      content: '是否确认还车？',
      confirmText: '确定',
      cancelText: '取消',
      success: (res) => {
        if (!res.confirm) return;

        const matchedArea = this.checkIfInParkingArea(endLat, endLng);

        // 在停车点内：直接还车
        if (matchedArea) {
          this.doFinishOrder(endLat, endLng);
          return;
        }

        // 不在停车点内：显示你新的违停窗口
        this.setData({
          showOutParkingModal: true
        });
      }
    });
  },

  // 原弹窗：取消还车
  cancelFinishConfirm() {
    this.setData({
      showConfirmModal: false
    });
  },

  // 原弹窗：确定还车
  confirmFinishOrder() {
    const endLat = this.data.myMockLat;
    const endLng = this.data.myMockLng;

    // 先关闭原来的“是否确认还车”弹窗
    this.setData({
      showConfirmModal: false
    });

    // 点击“确定”后再进行停车点判断
    const matchedArea = this.checkIfInParkingArea(endLat, endLng);

    // 在停车点内：直接还车
    if (matchedArea) {
      this.doFinishOrder(endLat, endLng);
      return;
    }

    // 不在停车点内：弹出第二个窗口
    this.setData({
      showOutParkingModal: true
    });
  },

  // 第二个弹窗：取消还车
  cancelOutParking() {
    this.setData({
      showOutParkingModal: false
    });
  },

  // 第二个弹窗：支付还车费并还车
  confirmForceFinish() {
    const endLat = this.data.myMockLat;
    const endLng = this.data.myMockLng;

    this.setData({
      showOutParkingModal: false,
      ridingFee: 15   // ✅ 直接强制15元
    });

    this.doFinishOrder(endLat, endLng);
  },

  doFinishOrder(endLat, endLng) {
    wx.showLoading({
      title: '正在结算...',
      mask: true
    });

    const bId = Number(this.data.ridingBikeId);

    wx.request({
      url: 'http://localhost:8080/api/orders/finish',
      method: 'POST',
      header: {
        'content-type': 'application/json'
      },
      data: {
        id: this.data.currentOrderId,
        endLat: endLat,
        endLng: endLng,
        fee: this.data.ridingFee   // ✅ 加这一行
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

          wx.showToast({
            title: '还车成功',
            icon: 'success'
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

  startTimer() {
    let seconds = 0;
    if (this.timer) clearInterval(this.timer);

    this.timer = setInterval(() => {
      seconds++;
      let m = Math.floor(seconds / 60);
      let s = seconds % 60;
      let timeStr = (m < 10 ? '0' + m : m) + ':' + (s < 10 ? '0' + s : s);

      // ✅ 正常骑行费用逻辑
      let fee = 0;

      if (seconds <= 120) {
        fee = 0;   // 2分钟内免费
      } else {
        fee = 2;   // 超过2分钟固定2元
      }

      this.setData({
        ridingTime: timeStr,
        ridingFee: fee
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
      wx.showToast({ title: '请先选择终点', icon: 'none' });
      return;
    }
    if (!start.latitude) {
      wx.showToast({ title: '定位中，请稍后再试', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '路线规划中' });

    try {
      // 蓝色：考虑拥挤（推荐）
      const fast = aStarRoute(
        campusGraph,
        { lat: start.latitude, lng: start.longitude },
        { lat: end.latitude, lng: end.longitude },
        { useJam: true }
      );

      // 红色：忽略拥挤（对比）
      const jam = aStarRoute(
        campusGraph,
        { lat: start.latitude, lng: start.longitude },
        { lat: end.latitude, lng: end.longitude },
        { useJam: false }
      );

      if (!fast.points || fast.points.length < 2) {
        wx.hideLoading();
        wx.showToast({ title: '未找到可用路线', icon: 'none' });
        return;
      }

      // 距离/时间（蓝线用“推荐”）
      const fastDist = calcDistanceMeters(fast.points);
      const fastMin = estimateMinutesBySpeed(fastDist, 4.0);

      // 红线对比（如果存在）
      let extraText = '';
      let showRed = false;

      if (jam.points && jam.points.length >= 2) {
        // 判断两条路线是否完全一样
        const same =
          jam.points.length === fast.points.length &&
          jam.points.every((p, i) =>
            Math.abs(p.latitude - fast.points[i].latitude) < 1e-7 &&
            Math.abs(p.longitude - fast.points[i].longitude) < 1e-7
          );

        if (!same) {
          showRed = true;
          const jamDist = calcDistanceMeters(jam.points);
          const jamMin = estimateMinutesBySpeed(jamDist, 4.0);
          const diff = jamMin - fastMin;

          if (diff > 0.5) {
            extraText = `红线预计多花 ${Math.round(diff)} 分钟`;
          } else if (diff < -0.5) {
            // 极少见：红线更快（说明拥挤惩罚过大/路网问题）
            extraText = `红线反而快 ${Math.round(-diff)} 分钟（检查权重/路网）`;
          } else {
            extraText = `两条路线耗时接近`;
          }
        }
      }

      const polylines = [
        { points: fast.points, color: '#007AFF', width: 6 }
      ];

      if (showRed) {
        polylines.push({
          points: jam.points,
          color: '#FF0000',
          width: 6,
          dottedLine: true
        });
      }

      this.setData({
        polyline: polylines,

        // ✅ 缓存两条路线，用于切换步行/骑行时立刻重算时间
        _fastRoutePoints: fast.points,
        _jamRoutePoints: (showRed ? jam.points : [])
      }, () => {
        this.updateRouteTimeCard(); // ✅ 按当前 travelMode 刷新文字
      });

      wx.hideLoading();
    } catch (e) {
      wx.hideLoading();
      console.error(e);
      wx.showToast({ title: '规划失败', icon: 'none' });
    }
  },

  /**
   * 你的 wxml input 绑定了 tosearch：先给提示避免报错
   */
  tosearch() {
    wx.showToast({
      title: '请直接点地图选择终点',
      icon: 'none'
    });
  },

  /**
   * 交换按钮：这里给最小实现（可删）
   */
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

  /**
   * 右侧定位按钮
   */
  location() {
    this.restore();
  },

  //回到我的位置
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
  //刷新
  resetNavigation() {
    // 1) 清路线/清选点模式/清终点
    const resetStart = {
      name: '当前位置',
      latitude: this.data.myMockLat || this.data.start.latitude,
      longitude: this.data.myMockLng || this.data.start.longitude
    };

    const resetEnd = { name: '', latitude: '', longitude: '' };

    // 2) 清掉起点/终点 marker（如果你用了 startMarker/endMarker）
    const startMarkerId = this.data.startMarkerId || 7777;
    const endMarkerId = this.data.endMarkerId || 8888;

    let markers = (this.data.markers || []).filter(m => {
      const idNum = Number(m.id);
      return idNum !== Number(startMarkerId) && idNum !== Number(endMarkerId);
    });

    // 3) 更新数据
    this.setData({
      polyline: [],
      pickMode: null,
      start: resetStart,
      end: resetEnd,
      startMarker: null,
      endMarker: null,
      markers
    });

    this.resetRouteUI();

    wx.showToast({ title: '已重置导航', icon: 'none' });
  },

  mapmarker_choose() { }
});