// utils/mapHelper.js
const geo = require('./geo');
const faultHelper = require('./faultHelper');

// 在文件顶部加一个常量（方便以后改系数）
const CONGESTION_TIME_FACTOR = 1.2;
// ========================================================================
// 第一分区：基础数据转换 (Data Conversion)
// ========================================================================

/**
 * 坐标格式化转换 (将各种格式统一为小程序需要的 {latitude, longitude})
 */
const toLLPoints = (points) => {
  if (!points) return [];
  return points.map(p => ({ 
    latitude: p.latitude || p.lat, 
    longitude: p.longitude || p.lng 
  }));
};

/**
 * 判断两条路线是否完全一致（通过坐标点高精度对比）
 */
const isSameRoute = (routeA, routeB) => {
  if (!routeA || !routeB || routeA.length !== routeB.length) return false;
  return routeA.every((p, i) =>
    Math.abs(p.latitude - routeB[i].latitude) < 1e-7 &&
    Math.abs(p.longitude - routeB[i].longitude) < 1e-7
  );
};


// ========================================================================
// 第二分区：地图元素加工 (Markers & Polygons Factory)
// ========================================================================

/**
 * Marker 工厂函数：统一生成地图标记对象 (起/终点、单车)
 */
const createMarker = (type, id, lat, lng) => {
  const base = {
    id,
    latitude: lat,
    longitude: lng,
    zIndex: 1000,
    anchor: { x: 0.5, y: 1.0 }
  };

  const configs = {
    start: { iconPath: '/images/start.png', width: 28, height: 28 },
    end: { iconPath: '/images/end.png', width: 32, height: 32 },
    bike: { iconPath: '/images/bike.png', width: 40, height: 40 }
  };

  return { ...base, ...configs[type] };
};

/**
 * 校园地标/地点 Marker 转化
 */
const convertToSiteMarkers = (siteList, iconPath) => {
  if (!siteList || !Array.isArray(siteList)) return [];
  return siteList.map((site, index) => ({
    id: 10000 + index, // 地标ID从10000开始，永远不会和单车ID冲突
    latitude: site.latitude,
    longitude: site.longitude,
    iconPath:'https://3gimg.qq.com/lightmap/xcx/demoCenter/images/Marker3_Activated@3x.png',
    width: 30,
    height: 30,
    callout: {
      content: ` ${site.name} `,
      display: 'ALWAYS',
      padding: 5,
      borderRadius: 10
    }
  }));
};

/**
 * 单车列表数据格式化
 */
const formatBikes = (list) => {
  if (!list) return [];

  return list.map(bike => ({
    id: bike.id,
    latitude: bike.latitude,
    longitude: bike.longitude,

    iconPath: faultHelper.getBikeIconByStatus(bike),

    width: 35,
    height: 35,
    zIndex: 999,

    status: bike.status,
    bikeNo: bike.bikeNo,
    faultDesc: bike.faultDesc,

    callout: faultHelper.getBikeCalloutByStatus(bike)
  }));
};

/**
 * 停车区数据处理：同时生成多边形(Polygons)和中心标记(Markers)
 */
const processParkingData = (rawData) => {
  if (!Array.isArray(rawData)) return { areas: [], polygons: [], markers: [] };

  // 标准化原始数据中的坐标字段名
  const parkingAreas = rawData.map(area => ({
    ...area,
    points: (area.points || []).map(p => ({ lat: Number(p.lat), lng: Number(p.lng) }))
  }));

  // 1. 生成地图覆盖层多边形
  const polygons = parkingAreas
    .filter(a => a.points.length >= 3)
    .map((a, idx) => ({
      id: a.id || (9000 + idx),
      points: a.points.map(p => ({ latitude: p.lat, longitude: p.lng })),
      strokeWidth: 2,
      strokeColor: '#0062ff',
      fillColor: '#0062ff33',
      zIndex: 1
    }));

  // 2. 计算多边形中心点，生成停车图标
  const markers = parkingAreas
    .filter(a => a.points.length > 0)
    .map((a, idx) => {
      const pts = a.points;
      const latSum = pts.reduce((sum, p) => sum + p.lat, 0);
      const lngSum = pts.reduce((sum, p) => sum + p.lng, 0);
      
      return {
        id: 700000 + Number(a.id),
        latitude: latSum / pts.length,
        longitude: lngSum / pts.length,
        iconPath: '/images/parking.png',
        width: 28, height: 28, zIndex: 1002,
        callout: {
          content: ` ${a.name || '停车点'} `,
          display: 'BYCLICK', padding: 6, borderRadius: 10
        }
      };
    });

  return { parkingAreas, polygons, markers };
};


// ========================================================================
// 第三分区：路径与导航分析 (Route Analysis)
// ========================================================================
const calcRouteMinutesWithDynamicSpeed = (points, nodePath, baseSpeed, dynamicJamMap = {}) => {
  if (!points || points.length < 2) return 0;

  let totalMin = 0;

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];

    const dist = geo.calcDistanceMeters([p1, p2]);

    let realSpeed = baseSpeed;

    if (nodePath && nodePath[i] && nodePath[i + 1]) {
      const key1 = `${nodePath[i]}-${nodePath[i + 1]}`;
      const key2 = `${nodePath[i + 1]}-${nodePath[i]}`;

      const info = dynamicJamMap[key1] || dynamicJamMap[key2];

      if (info && info.avgSpeed) {
        const avgSpeed = Number(info.avgSpeed);

        if (avgSpeed > 0) {
          // 动态速度只用于降低速度，不让异常高速把预计时间变短
          realSpeed = Math.min(baseSpeed, avgSpeed);
        }
      }
    }

    totalMin += dist / (realSpeed * 1000 / 60);
  }

  return totalMin;
};

/**
 * 导航路线综合分析 (距离、耗时、路线对比)
 */
const getRouteAnalysis = (
  fastPoints,
  jamPoints,
  speed,
  travelMode,
  fastNodePath = [],
  jamNodePath = [],
  dynamicJamMap = {}
) => {
  if (!fastPoints || fastPoints.length < 2) return null;

  const fastDist = geo.calcDistanceMeters(fastPoints);

  const fastMin = calcRouteMinutesWithDynamicSpeed(
    fastPoints,
    fastNodePath,
    speed,
    dynamicJamMap
  );

  let extraText = '';

  if (jamPoints && jamPoints.length >= 2) {
    const jamMin = calcRouteMinutesWithDynamicSpeed(
      jamPoints,
      jamNodePath,
      speed,
      dynamicJamMap
    );

    extraText = getRouteDiffText(fastMin, jamMin);
  }

  return {
    distanceText: `预计距离：${geo.fmtDistance(fastDist)}`,
    timeText: `预计时间：${geo.fmtMinutes(fastMin)}（${travelMode === 'walk' ? '步行' : '骑行'}）`,
    extraText: extraText
  };
};

/**
 * 计算两条路线的耗时差异文案
 */
const getRouteDiffText = (fastMin, jamMin) => {
  const diff = jamMin - fastMin;
  if (diff > 0.5) return `红线预计多花 ${Math.round(diff)} 分钟`;
  if (diff < -0.5) return `红线反而快 ${Math.round(-diff)} 分钟（检查权重）`;
  return `两条路线耗时接近`;
};


// ========================================================================
// 第四分区：时间与业务判定 (Business Logic)
// ========================================================================

/**
 * 统一的下课时间高峰期判定
 */
const isAfterClassTime = () => {
  const now = new Date();
  const t = now.getHours() * 60 + now.getMinutes();
  const ranges = [
    [9 * 60 + 0, 10 * 60 + 0], // 
    [10 * 60 + 0, 11 * 60 + 0], // 
    [11 * 60 + 0, 12 * 60 + 0], // 
    [12 * 60 + 0, 13 * 60 + 0],  // 
    [13 * 60 + 0, 14 * 60 + 0],  // 
    [14 * 60 + 0, 15 * 60 + 0],
    [15 * 60 + 0, 17 * 60 + 0],
    [17 * 60 + 0, 18 * 60 + 0],  
    [18 * 60 + 0, 19 * 60 + 0],  
    [19 * 60 + 0, 20 * 60 + 0],  
    [20 * 60 + 0, 21 * 60 + 0],  // 晚下课
    [21 * 60 + 0, 22 * 60 + 0],
    [22 * 60 + 0, 23 * 60 + 0],
  ];
  return ranges.some(([a, b]) => t >= a && t <= b);
};

/**
 * 查找点位所属的停车区
 */
const findMatchedParkingArea = (point, parkingAreas) => {
  if (!parkingAreas || parkingAreas.length === 0) return null;
  // 调用 geo 射线法算法判定[cite: 2]
  return parkingAreas.find(area => geo.isPointInPolygon(point, area.points)) || null;
};

/**
 * 纯速度计算预估时间
 */
const estimateMinutesBySpeed = (distanceMeters, speedMps = 4.0) => {
  if (!distanceMeters || distanceMeters <= 0) return 0;
  return (distanceMeters / speedMps) / 60;
};


// ========================================================================
// 模块统一导出
// ========================================================================
module.exports = {
  // 转换类
  toLLPoints,
  isSameRoute,
  
  // 地图元素类
  createMarker,
  convertToSiteMarkers,
  formatBikes,
  processParkingData,
  
  // 导航分析类
  getRouteAnalysis,
  getRouteDiffText,
  
  // 业务判定类
  isAfterClassTime,
  findMatchedParkingArea,
  estimateMinutesBySpeed
};