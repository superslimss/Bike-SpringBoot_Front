// utils/faultHelper.js

const FAULT_TYPES = [
  '无法开锁',
  '车锁异常',
  '轮胎损坏',
  '刹车失灵',
  '车座损坏',
  '其他问题'
];

/**
 * 是否为故障车
 */
function isFaultBike(bike) {
  return Number(bike && bike.status) === 2;
}

/**
 * 根据单车状态返回图标
 */
function getBikeIconByStatus(bike) {
  return isFaultBike(bike)
    ? '/images/bike_fault.png'
    : '/images/bike.png';
}

/**
 * 根据单车状态返回 marker 气泡
 */
function getBikeCalloutByStatus(bike) {
  return {
    content: isFaultBike(bike)
      ? ` 故障：${bike.faultDesc || '待处理'} `
      : ' 扫码用车 ',
    display: 'BYCLICK'
  };
}

/**
 * 根据 markerId 找到单车 marker
 */
function findBikeByMarkerId(bikeMarkers, markerId) {
  return (bikeMarkers || []).find(
    item => Number(item.id) === Number(markerId)
  );
}

module.exports = {
  FAULT_TYPES,
  isFaultBike,
  getBikeIconByStatus,
  getBikeCalloutByStatus,
  findBikeByMarkerId
};