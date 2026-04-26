// utils/timerHelper.js

/**
 * 格式化秒数为 mm:ss
 */
const formatTime = (seconds) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return (m < 10 ? '0' + m : m) + ':' + (s < 10 ? '0' + s : s);
};

/**
 * 计算骑行费用（对应你原本的阶梯：30s内免费，15min内2元，超过5元）
 */
const calculateFee = (seconds) => {
  if (seconds <= 30) return 0.0;
  if (seconds <= 900) return 2.0;
  return 5.0;
};

/**
 * 计算包含违停费在内的总额
 */
const calculateTotalWithPenalty = (baseFee, penalty = 10.0) => {
  return (parseFloat(baseFee) + penalty).toFixed(2);
};

module.exports = {
  formatTime,
  calculateFee,
  calculateTotalWithPenalty
};