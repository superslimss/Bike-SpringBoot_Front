/**
 * 根据剩余距离计算剩余时间文案
 * @param {number} remainDist 剩余距离，单位：米
 * @param {string} travelMode walk | bike
 * @param {number} speedWalk 步行速度 km/h
 * @param {number} speedBike 骑行速度 km/h
 */
function calcRemainTimeText(remainDist, travelMode, speedWalk, speedBike) {
  if (remainDist <= 10) return '约0分钟';

  const speed = travelMode === 'walk' ? speedWalk : speedBike;
  const remainMin = remainDist / (speed * 1000 / 60);

  if (remainMin < 1) return '约1分钟';

  return `约${Math.ceil(remainMin)}分钟`;
}

/**
 * 根据导航进度生成已走/未走路线 polyline
 */
function buildNavigationPolylines(navRouteMeta, selectedRouteType, progress) {
  if (!navRouteMeta || !navRouteMeta.points || navRouteMeta.points.length < 2) {
    return [];
  }

  const points = navRouteMeta.points;
  const cumDist = navRouteMeta.cumDist;

  let segIndex = 0;

  for (let i = 0; i < cumDist.length - 1; i++) {
    if (progress >= cumDist[i] && progress <= cumDist[i + 1]) {
      segIndex = i;
      break;
    }
  }

  const p1 = points[segIndex];
  const p2 = points[segIndex + 1];

  if (!p1 || !p2) {
    return [
      {
        points,
        color: '#C8C8C8',
        width: 8
      }
    ];
  }

  const segStart = cumDist[segIndex];
  const segEnd = cumDist[segIndex + 1];
  const segLen = segEnd - segStart;

  let t = segLen === 0 ? 0 : (progress - segStart) / segLen;

  if (t < 0) t = 0;
  if (t > 1) t = 1;

  const currentPoint = {
    latitude: p1.latitude + (p2.latitude - p1.latitude) * t,
    longitude: p1.longitude + (p2.longitude - p1.longitude) * t
  };

  const passedPoints = [
    ...points.slice(0, segIndex + 1),
    currentPoint
  ];

  const remainPoints = [
    currentPoint,
    ...points.slice(segIndex + 1)
  ];

  const routeColor = selectedRouteType === 'jam' ? '#FF0000' : '#007AFF';
  const isJamRoute = selectedRouteType === 'jam';

  const polylines = [];

  if (passedPoints.length >= 2) {
    polylines.push({
      points: passedPoints,
      color: '#C8C8C8',
      width: 8
    });
  }

  if (remainPoints.length >= 2) {
    polylines.push({
      points: remainPoints,
      color: routeColor,
      width: 10,
      dottedLine: isJamRoute
    });
  }

  return polylines;
}

/**
 * 根据当前位置进度生成导航提示
 */
function buildNavTipText(navRouteMeta, progress, remainDist, geo) {
  const nextTurn = geo.getNextTurnByProgress(
    navRouteMeta.turns,
    progress
  );

  if (nextTurn) {
    const distToTurn = Math.round(nextTurn.distanceFromStart - progress);

    if (distToTurn <= 50) {
      return `前方 ${distToTurn} 米 ${nextTurn.direction}`;
    }

    return `沿当前道路直行 ${distToTurn} 米`;
  }

  return `沿当前道路直行 ${remainDist} 米`;
}

module.exports = {
  calcRemainTimeText,
  buildNavigationPolylines,
  buildNavTipText
};