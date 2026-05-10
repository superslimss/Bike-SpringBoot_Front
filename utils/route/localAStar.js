// utils/route/localAStar.js
const mapHelper = require('../mapHelper');

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

function distMeter(a, b) {
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const la1 = toRad(a.lat);
  const la2 = toRad(b.lat);

  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(x));
}

// ==== 局部平面近似（校园范围足够） ====
function toXY(refLat, refLng, lat, lng) {
  const R = 6371000;
  const x = toRad(lng - refLng) * R * Math.cos(toRad(refLat));
  const y = toRad(lat - refLat) * R;
  return { x, y };
}

function fromXY(refLat, refLng, x, y) {
  const R = 6371000;
  const lat = refLat + (y / R) * (180 / Math.PI);
  const lng = refLng + (x / (R * Math.cos(toRad(refLat)))) * (180 / Math.PI);
  return { lat, lng };
}

function nearestPointOnSegment(refLat, refLng, P, A, B) {
  const p = toXY(refLat, refLng, P.lat, P.lng);
  const a = toXY(refLat, refLng, A.lat, A.lng);
  const b = toXY(refLat, refLng, B.lat, B.lng);

  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const apx = p.x - a.x;
  const apy = p.y - a.y;

  const ab2 = abx * abx + aby * aby;
  let t = ab2 === 0 ? 0 : (apx * abx + apy * aby) / ab2;
  if (t < 0) t = 0;
  if (t > 1) t = 1;

  const projX = a.x + t * abx;
  const projY = a.y + t * aby;

  const projLL = fromXY(refLat, refLng, projX, projY);
  const d = distMeter(P, projLL);

  return { lat: projLL.lat, lng: projLL.lng, t, d };
}

function nearestEdgeProjection(graph, P) {
  const refLat = P.lat;
  const refLng = P.lng;

  let best = null;

  for (const e of graph.edges) {
    const aId = e.a || e.from;
    const bId = e.b || e.to;
    const A = graph.nodesById[aId];
    const B = graph.nodesById[bId];
    if (!A || !B) continue;

    const proj = nearestPointOnSegment(refLat, refLng, P, A, B);
    if (!best || proj.d < best.d) {
      best = {
        aId,
        bId,
        projLat: proj.lat,
        projLng: proj.lng,
        d: proj.d,
      };
    }
  }

  return best;
}

// 修改后的拥挤系数函数
function congestionFactor(graphRaw, aId, bId, options) {
  const useJam = options?.useJam !== false; 
  if (!useJam) return 1.0;

  const JAM_CONFIG = graphRaw.JAM_CONFIG;
  const edgeKey = graphRaw.edgeKey;
  if (!JAM_CONFIG || !edgeKey) return 1.0;

  const key = edgeKey(aId, bId);
  const jam = JAM_CONFIG[key];
  if (!jam) return 1.0;

  // --- 这里是修改重点 ---
  const afterClassOverride = options?.afterClassOverride;
  const isAfter = (afterClassOverride === true || afterClassOverride === false)
    ? afterClassOverride
    : mapHelper.isAfterClassTime(); // ✅ 统一调用 mapHelper 里的函数名

  if (!isAfter) return 1.0;

  const cap = jam.cap || 6;
  const base = 1.45;      
  const capBoost = 1 + (3 / cap); 
  return base * capBoost;
}

function buildAdj(graphRaw, graph, extraEdges = [], options) {
  const adj = new Map();
  for (const n of graph.nodes) adj.set(n.id, []);

  // 原图边
  for (const e of graph.edges) {
    const from = e.a || e.from;
    const to = e.b || e.to;

    const A = graph.nodesById[from];
    const B = graph.nodesById[to];
    if (!A || !B) continue;

    const dist = distMeter(A, B);
    const factor = congestionFactor(graphRaw, from, to, options);
    const w = dist * factor;

    adj.get(from).push({ to, w });
    adj.get(to).push({ to: from, w });
  }

  // 额外边（虚拟节点）
  for (const e of extraEdges) {
    const { from, to, w } = e;
    if (!adj.has(from)) adj.set(from, []);
    if (!adj.has(to)) adj.set(to, []);
    adj.get(from).push({ to, w });
    adj.get(to).push({ to: from, w });
  }

  return adj;
}

function reconstructPath(cameFrom, currentId) {
  const path = [currentId];
  while (cameFrom[currentId]) {
    currentId = cameFrom[currentId];
    path.push(currentId);
  }
  return path.reverse();
}

/**
 * A* 路径规划（支持：终点投影 + 拥挤表开关）
 * @param graphRaw {nodes, edges, JAM_CONFIG, edgeKey}
 * @param startLatLng {lat,lng}
 * @param endLatLng {lat,lng}
 * @param options { useJam?: boolean, afterClassOverride?: boolean|null }
 * @returns { points, nodePath, totalCost }
 */
function aStarRoute(graphRaw, startLatLng, endLatLng, options = {}) {
  const graph = {
    nodes: graphRaw.nodes,
    edges: graphRaw.edges,
    nodesById: Object.fromEntries(graphRaw.nodes.map(n => [n.id, n])),
  };

  const startP = { lat: startLatLng.lat, lng: startLatLng.lng };
  const endP = { lat: endLatLng.lat, lng: endLatLng.lng };

  const sEdge = nearestEdgeProjection(graph, startP);
  const tEdge = nearestEdgeProjection(graph, endP);
  if (!sEdge || !tEdge) return { points: [], nodePath: [], totalCost: Infinity };

  const S = "S_START";
  const T = "T_END";
  graph.nodesById[S] = { id: S, lat: sEdge.projLat, lng: sEdge.projLng };
  graph.nodesById[T] = { id: T, lat: tEdge.projLat, lng: tEdge.projLng };

  // 投影边也按“所在道路边”乘拥挤系数
  const sFactor = congestionFactor(graphRaw, sEdge.aId, sEdge.bId, options);
  const tFactor = congestionFactor(graphRaw, tEdge.aId, tEdge.bId, options);

  const extraEdges = [
    { from: S, to: sEdge.aId, w: distMeter(graph.nodesById[S], graph.nodesById[sEdge.aId]) * sFactor },
    { from: S, to: sEdge.bId, w: distMeter(graph.nodesById[S], graph.nodesById[sEdge.bId]) * sFactor },
    { from: T, to: tEdge.aId, w: distMeter(graph.nodesById[T], graph.nodesById[tEdge.aId]) * tFactor },
    { from: T, to: tEdge.bId, w: distMeter(graph.nodesById[T], graph.nodesById[tEdge.bId]) * tFactor },
  ];

  const adj = buildAdj(graphRaw, graph, extraEdges, options);

  const startId = S;
  const goalId = T;

  const openSet = new Set([startId]);
  const cameFrom = {};
  const gScore = {};
  const fScore = {};

  const allIds = Object.keys(graph.nodesById);
  for (const id of allIds) {
    gScore[id] = Infinity;
    fScore[id] = Infinity;
  }

  gScore[startId] = 0;
  fScore[startId] = distMeter(graph.nodesById[startId], graph.nodesById[goalId]);

  function pickLowestF(open) {
    let bestId = null;
    let bestValue = Infinity;
    for (const id of open) {
      if (fScore[id] < bestValue) {
        bestValue = fScore[id];
        bestId = id;
      }
    }
    return bestId;
  }

  while (openSet.size > 0) {
    const current = pickLowestF(openSet);
    if (!current) break;

    if (current === goalId) {
      const nodePath = reconstructPath(cameFrom, current);
      const points = nodePath.map(id => ({
        latitude: graph.nodesById[id].lat,
        longitude: graph.nodesById[id].lng,
      }));
      return { points, nodePath, totalCost: gScore[current] };
    }

    openSet.delete(current);

    const neighbors = adj.get(current) || [];
    for (const { to, w } of neighbors) {
      const tentativeG = gScore[current] + w;
      if (tentativeG < gScore[to]) {
        cameFrom[to] = current;
        gScore[to] = tentativeG;
        fScore[to] = tentativeG + distMeter(graph.nodesById[to], graph.nodesById[goalId]);
        openSet.add(to);
      }
    }
  }

  return { points: [], nodePath: [], totalCost: Infinity };
}

module.exports = { aStarRoute };