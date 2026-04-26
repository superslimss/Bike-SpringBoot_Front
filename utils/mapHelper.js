// utils/mapHelper.js
const geo = require('./geo');


/**
 * 统一的下课时间判定
 */
const isAfterClassTime = () => {
  const now = new Date();
  const t = now.getHours() * 60 + now.getMinutes();
  const ranges = [
    [11 * 60 + 30, 12 * 60 + 10],
    [12 * 60 + 0, 13 * 60 + 0],
    [14 * 60 + 0, 15 * 60 + 0],
    [15 * 60 + 0, 16 * 60 + 0],
    [17 * 60 + 0, 18 * 60 + 0],
    [19 * 60 + 0, 20 * 60 + 0],
    [20 * 60 + 30, 21 * 60 + 10],
  ];
  return ranges.some(([a, b]) => t >= a && t <= b);
};

/**
 * 根据距离和速度预估时间
 */
const estimateMinutesBySpeed = (distanceMeters, speedMps = 4.0) => {
  if (!distanceMeters || distanceMeters <= 0) return 0;
  const sec = distanceMeters / speedMps;
  return sec / 60;
};

/**
 * 坐标格式化转换 (原 toLLPoints)
 */
const toLLPoints = (points) => {
  return points.map(p => ({ latitude: p.latitude, longitude: p.longitude }));
};

/**
 * 判断两条路线是否完全一致（坐标点对比）
 */
const isSameRoute = (routeA, routeB) => {
  if (!routeA || !routeB || routeA.length !== routeB.length) return false;
  return routeA.every((p, i) =>
    Math.abs(p.latitude - routeB[i].latitude) < 1e-7 &&
    Math.abs(p.longitude - routeB[i].longitude) < 1e-7
  );
};

/**
 * 计算路线对比结果文案
 */
const getRouteDiffText = (fastMin, jamMin) => {
  const diff = jamMin - fastMin;
  if (diff > 0.5) return `红线预计多花 ${Math.round(diff)} 分钟`;
  if (diff < -0.5) return `红线反而快 ${Math.round(-diff)} 分钟（检查权重）`;
  return `两条路线耗时接近`;
};

const convertToSiteMarkers = (siteList, iconPath) => {
  if (!siteList || !Array.isArray(siteList)) return [];
  
  return siteList.map((site, index) => ({
    id: index + 100, // 避开 9999(定位) 等特殊 ID
    latitude: site.latitude,
    longitude: site.longitude,
    iconPath: iconPath,
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
 * Marker 工厂函数：统一生成地图标记对象
 * @param {String} type - 类型：'start', 'end', 'bike', 'location'
 * @param {Number} id - 标记ID
 * @param {Number} lat - 纬度
 * @param {Number} lng - 经度
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

const getRouteAnalysis = (fastPoints, jamPoints, speed, travelMode) => {
  if (!fastPoints || fastPoints.length < 2) return null;

  // 1. 调用底层工具计算基础数值
  const fastDist = geo.calcDistanceMeters(fastPoints);
  const fastMin = (fastDist / (speed * 1000 / 60)); // 计算预估分钟

  // 2. 处理对比文案逻辑
  let extraText = '';
  if (jamPoints && jamPoints.length >= 2) {
    const jamDist = geo.calcDistanceMeters(jamPoints);
    const jamMin = (jamDist / (speed * 1000 / 60));
    const diff = jamMin - fastMin;

    if (diff > 0.5) {
      extraText = `红线预计多花 ${Math.round(diff)} 分钟`;
    } else if (diff < -0.5) {
      extraText = `红线反而快 ${Math.round(-diff)} 分钟（检查权重/路网）`;
    } else {
      extraText = `两条路线耗时接近`;
    }
  }

  // 3. 直接组装好渲染用的字符串
  return {
    distanceText: `预计距离：${geo.fmtDistance(fastDist)}`,
    timeText: `预计时间：${geo.fmtMinutes(fastMin)}（${travelMode === 'walk' ? '步行' : '骑行'}）`,
    extraText: extraText
  };
};

module.exports = {
  convertToSiteMarkers,
  isAfterClassTime,
  estimateMinutesBySpeed,
  toLLPoints,
  isSameRoute,
  getRouteDiffText,
  createMarker,
  getRouteAnalysis
};