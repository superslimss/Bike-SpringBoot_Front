// utils/route/tencentRoute.js
import map from '@data/map';

const QQMapWX = require('@libs/qqmap-wx-jssdk.min');

const qqmapsdk = new QQMapWX({
  key: map.mapKey,
});

/**
 * 解码腾讯 direction 返回的 polyline（你 map.js 里原来的那段原封不动搬过来）
 */
function decodePolyline(coors) {
  const pl = [];
  const kr = 1000000;

  for (let i = 2; i < coors.length; i++) {
    coors[i] = Number(coors[i - 2]) + Number(coors[i]) / kr;
  }
  for (let i = 0; i < coors.length; i += 2) {
    pl.push({
      latitude: coors[i],
      longitude: coors[i + 1]
    });
  }
  return pl;
}

/**
 * 计算骑行路线（腾讯）
 * @param {{latitude:number, longitude:number}} from
 * @param {{latitude:number, longitude:number}} to
 * @returns Promise<{points:Array, distance:number, duration:number, provider:string}>
 */
function getTencentRoute(from, to) {
  return new Promise((resolve, reject) => {
    qqmapsdk.direction({
      mode: 'bicycling',
      from: `${from.latitude},${from.longitude}`,
      to: `${to.latitude},${to.longitude}`,
      success: (res) => {
        const route = res?.result?.routes?.[0];
        if (!route || !route.polyline) {
          reject(new Error('未获取到路线数据'));
          return;
        }

        const points = decodePolyline(route.polyline);

        resolve({
          provider: 'tencent',
          points,
          distance: route.distance,
          duration: route.duration
        });
      },
      fail: (err) => reject(err)
    });
  });
}

module.exports = { getTencentRoute };