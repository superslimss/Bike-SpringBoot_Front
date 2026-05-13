/**
 * 1. 计算两点或多点间的物理距离（米）
 */
const calcDistanceMeters = (points) => {
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
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
    sum += 2 * R * Math.asin(Math.sqrt(x));
  }
  return sum;
};

/**
 * 2. 判定坐标点是否在多边形区域内 (射线法)
 */
const isPointInPolygon = (point, polygon) => {
  const x = Number(point.longitude);
  const y = Number(point.latitude);
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = Number(polygon[i].lng ?? polygon[i].longitude);
    const yi = Number(polygon[i].lat ?? polygon[i].latitude);
    const xj = Number(polygon[j].lng ?? polygon[j].longitude);
    const yj = Number(polygon[j].lat ?? polygon[j].latitude);
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
};

/**
 * 3. 距离格式化显示
 */
const fmtDistance = (m) => {
  if (m < 1000) return `${Math.round(m)}m`;
  return `${(m / 1000).toFixed(2)}km`;
};

/**
 * 4. 时间格式化显示
 */
const fmtMinutes = (min) => {
  if (min < 1) return `约1分钟`;
  return `约${Math.round(min)}分钟`;
};


function getTurnDirection(prev, curr, next) {
  if (!prev || !curr || !next) return '直行';

  const angle1 = Math.atan2(
    curr.latitude - prev.latitude,
    curr.longitude - prev.longitude
  );

  const angle2 = Math.atan2(
    next.latitude - curr.latitude,
    next.longitude - curr.longitude
  );

  let diff = (angle2 - angle1) * 180 / Math.PI;

  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;

  if (Math.abs(diff) < 20) return '直行';
  return diff > 0 ? '左转' : '右转';
}

function buildRouteMeta(points, calcDistance, getTurnDirection) {
  const cumDist = [0];

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];

    const d = calcDistance(
      prev.latitude,
      prev.longitude,
      curr.latitude,
      curr.longitude
    );

    cumDist[i] = cumDist[i - 1] + d;
  }

  const turns = [];

  for (let i = 1; i < points.length - 1; i++) {
    const direction = getTurnDirection(
      points[i - 1],
      points[i],
      points[i + 1]
    );

    if (direction !== '直行') {
      turns.push({
        index: i,
        direction,
        distanceFromStart: cumDist[i]
      });
    }
  }

  return {
    points,
    cumDist,
    turns,
    totalDistance: cumDist[cumDist.length - 1]
  };
}

function getRouteProgress(points, cumDist, lat, lng, calcDistance) {
  let best = {
    distance: Infinity,
    progress: 0
  };

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];

    const ax = a.longitude;
    const ay = a.latitude;
    const bx = b.longitude;
    const by = b.latitude;
    const px = lng;
    const py = lat;

    const abx = bx - ax;
    const aby = by - ay;
    const apx = px - ax;
    const apy = py - ay;

    const ab2 = abx * abx + aby * aby;
    let t = ab2 === 0 ? 0 : (apx * abx + apy * aby) / ab2;

    if (t < 0) t = 0;
    if (t > 1) t = 1;

    const projLat = ay + aby * t;
    const projLng = ax + abx * t;

    const dToRoute = calcDistance(lat, lng, projLat, projLng);

    const segLen = calcDistance(
      a.latitude,
      a.longitude,
      b.latitude,
      b.longitude
    );

    const progress = cumDist[i] + segLen * t;

    if (dToRoute < best.distance) {
      best = {
        distance: dToRoute,
        progress
      };
    }
  }

  return best.progress;
}

function getNextTurnByProgress(turns, progress) {
  for (let i = 0; i < turns.length; i++) {
    if (turns[i].distanceFromStart > progress + 5) {
      return turns[i];
    }
  }

  return null;
}


// 导出这些工具函数
module.exports = {
  calcDistanceMeters,
  isPointInPolygon,
  fmtDistance,
  fmtMinutes,
  getTurnDirection,
  buildRouteMeta,
  getRouteProgress,
  getNextTurnByProgress
};