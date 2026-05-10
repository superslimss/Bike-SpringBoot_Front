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

function getNearestRouteIndex(points, lat, lng, calcDistance) {
  let minDist = Infinity;
  let index = 0;

  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const d = calcDistance(lat, lng, p.latitude, p.longitude);

    if (d < minDist) {
      minDist = d;
      index = i;
    }
  }

  return index;
}

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

  if (Math.abs(diff) < 30) return '直行';
  return diff > 0 ? '左转' : '右转';
}

function calcRemainDistance(points, startIndex, calcDistance) {
  let total = 0;

  for (let i = startIndex; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];

    total += calcDistance(
      p1.latitude,
      p1.longitude,
      p2.latitude,
      p2.longitude
    );
  }

  return total;
}


// 导出这些工具函数
module.exports = {
  calcDistanceMeters,
  isPointInPolygon,
  fmtDistance,
  fmtMinutes,
  getNearestRouteIndex,
  getTurnDirection,
  calcRemainDistance
};