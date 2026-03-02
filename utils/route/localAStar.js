// utils/route/localAStar.js

// 角度转弧度
function toRad(deg) {
  return (deg * Math.PI) / 180;
}

// Haversine公式：计算两个经纬度之间的距离（单位：米）
function distMeter(a, b) {
  const R = 6371000; // 地球半径
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const la1 = toRad(a.lat);
  const la2 = toRad(b.lat);

  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(x));
}

// 构建邻接表（无向边：自动补双向）
function buildAdj(graph) {
  const adj = new Map();
  for (const n of graph.nodes) adj.set(n.id, []);

  for (const e of graph.edges) {
    const from = e.from || e.a;
    const to = e.to || e.b;

    const A = graph.nodesById[from];
    const B = graph.nodesById[to];
    if (!A || !B) continue;

    const w = distMeter(A, B);

    // 正向
    adj.get(from).push({ to, w });
    // 反向（自动补）
    adj.get(to).push({ to: from, w });
  }
  return adj;
}

// 还原路径
function reconstructPath(cameFrom, currentId) {
  const path = [currentId];
  while (cameFrom[currentId]) {
    currentId = cameFrom[currentId];
    path.push(currentId);
  }
  return path.reverse();
}

// 找最近节点
function nearestNodeId(graph, lat, lng) {
  let bestId = null;
  let bestDist = Infinity;

  for (const n of graph.nodes) {
    const d = distMeter({ lat, lng }, n);
    if (d < bestDist) {
      bestDist = d;
      bestId = n.id;
    }
  }
  return bestId;
}

/* ===========================
   关键增强：把起点/终点挂到最近“边”上
   =========================== */

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

// 小范围把经纬度近似转为平面XY（校园范围足够准）
function latlngToXY(lat, lng, refLat) {
  const x = lng * 111320 * Math.cos(toRad(refLat));
  const y = lat * 110540;
  return { x, y };
}

// 点P到线段AB最近点（返回 lat/lng + t）
function closestPointOnSegment(P, A, B) {
  const refLat = (A.lat + B.lat) / 2;

  const p = latlngToXY(P.lat, P.lng, refLat);
  const a = latlngToXY(A.lat, A.lng, refLat);
  const b = latlngToXY(B.lat, B.lng, refLat);

  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const apx = p.x - a.x;
  const apy = p.y - a.y;

  const ab2 = abx * abx + aby * aby;
  if (ab2 === 0) return { lat: A.lat, lng: A.lng, t: 0 };

  let t = (apx * abx + apy * aby) / ab2;
  t = clamp(t, 0, 1);

  const cx = a.x + t * abx;
  const cy = a.y + t * aby;

  const lng = cx / (111320 * Math.cos(toRad(refLat)));
  const lat = cy / 110540;

  return { lat, lng, t };
}

// 把一个点挂到最近边上：拆边并插入临时节点
function attachPointToNearestEdge(graphRaw, pointLatLng, tmpId) {
  // 如果没有边，直接返回
  if (!graphRaw.edges || graphRaw.edges.length === 0) {
    return { graph: graphRaw, attachedId: null };
  }

  const nodes = graphRaw.nodes.map(n => ({ ...n }));
  const edges = graphRaw.edges.map(e => ({ ...e }));
  const nodesById = Object.fromEntries(nodes.map(n => [n.id, n]));

  let best = null;

  for (const e of edges) {
    const from = e.from || e.a;
    const to = e.to || e.b;
    const A = nodesById[from];
    const B = nodesById[to];
    if (!A || !B) continue;

    const C = closestPointOnSegment(
      { lat: pointLatLng.lat, lng: pointLatLng.lng },
      { lat: A.lat, lng: A.lng },
      { lat: B.lat, lng: B.lng }
    );

    const d = distMeter(pointLatLng, C);
    if (!best || d < best.d) {
      best = { d, from, to };
    }
  }

  if (!best) {
    return { graph: graphRaw, attachedId: null };
  }

  // 插入临时节点（用你真实点击的坐标）
  nodes.push({
    id: tmpId,
    name: tmpId,
    lat: pointLatLng.lat,
    lng: pointLatLng.lng
  });

  // 去掉 best 对应的那条无向边（允许 a-b 或 b-a）
  const newEdges = [];
  for (const e of edges) {
    const a = e.from || e.a;
    const b = e.to || e.b;
    const same =
      (a === best.from && b === best.to) ||
      (a === best.to && b === best.from);
    if (!same) newEdges.push(e);
  }

  // 拆边：from - tmp - to
  newEdges.push({ a: best.from, b: tmpId });
  newEdges.push({ a: tmpId, b: best.to });

  return {
    graph: { nodes, edges: newEdges },
    attachedId: tmpId
  };
}

/**
 * A* 路径规划
 * @param graphRaw 你的校园图数据
 * @param startLatLng { lat, lng }
 * @param endLatLng { lat, lng }
 * @returns { points: [{latitude, longitude}], nodePath: [] }
 */
function aStarRoute(graphRaw, startLatLng, endLatLng) {
  // ✅ 把起点/终点挂到最近道路边（临时节点）
  const r1 = attachPointToNearestEdge(graphRaw, startLatLng, "__TMP_START__");
  const r2 = attachPointToNearestEdge(r1.graph, endLatLng, "__TMP_END__");
  const raw2 = r2.graph;

  // 构造 graph 辅助结构
  const graph = {
    nodes: raw2.nodes,
    edges: raw2.edges,
    nodesById: Object.fromEntries(raw2.nodes.map(n => [n.id, n]))
  };

  const adj = buildAdj(graph);

  // ✅ 起点/终点直接用临时节点（保证精确到你点的位置）
  const startId = graph.nodesById["__TMP_START__"]
    ? "__TMP_START__"
    : nearestNodeId(graph, startLatLng.lat, startLatLng.lng);

  const goalId = graph.nodesById["__TMP_END__"]
    ? "__TMP_END__"
    : nearestNodeId(graph, endLatLng.lat, endLatLng.lng);

  if (!startId || !goalId) {
    return { points: [], nodePath: [] };
  }

  const openSet = new Set([startId]);
  const cameFrom = {};

  const gScore = {};
  const fScore = {};

  for (const n of graph.nodes) {
    gScore[n.id] = Infinity;
    fScore[n.id] = Infinity;
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
        longitude: graph.nodesById[id].lng
      }));

      return { points, nodePath };
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

  return { points: [], nodePath: [] };
}

module.exports = {
  aStarRoute
};