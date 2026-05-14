function toRad(deg) {
  return deg * Math.PI / 180;
}

function calcDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) ** 2;

  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * 计算点到线段的近似距离
 */
function pointToSegmentDistance(point, a, b) {
  const px = point.lng;
  const py = point.lat;
  const ax = a.lng;
  const ay = a.lat;
  const bx = b.lng;
  const by = b.lat;

  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;

  const ab2 = abx * abx + aby * aby;

  let t = ab2 === 0 ? 0 : (apx * abx + apy * aby) / ab2;

  if (t < 0) t = 0;
  if (t > 1) t = 1;

  const projLng = ax + abx * t;
  const projLat = ay + aby * t;

  return calcDistance(point.lat, point.lng, projLat, projLng);
}

/**
 * 根据当前位置匹配最近路段
 */
function findNearestEdgeKey(graphRaw, lat, lng) {
  if (!graphRaw || !graphRaw.nodes || !graphRaw.edges) return null;

  const nodesById = Object.fromEntries(
    graphRaw.nodes.map(n => [n.id, n])
  );

  let best = null;

  for (const e of graphRaw.edges) {
    const from = e.a || e.from;
    const to = e.b || e.to;

    const A = nodesById[from];
    const B = nodesById[to];

    if (!A || !B) continue;

    const d = pointToSegmentDistance(
      { lat, lng },
      A,
      B
    );

    if (!best || d < best.distance) {
      best = {
        edgeKey: graphRaw.edgeKey
          ? graphRaw.edgeKey(from, to)
          : `${from}-${to}`,
        distance: d
      };
    }
  }

  // 离路线太远就不记录，避免乱上传
  if (!best || best.distance > 30) {
    return null;
  }

  return best.edgeKey;
}

module.exports = {
  findNearestEdgeKey
};