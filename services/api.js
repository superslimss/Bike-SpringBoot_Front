// services/api.js
const BASE_URL = 'http://localhost:8080/api';

module.exports = {
  // 所有的接口地址都写在这里
  bike: {
    list: `${BASE_URL}/bikes/list`,
    batchDispatch: `${BASE_URL}/bikes/admin/batchDispatch`,
    reportFault: `${BASE_URL}/bikes/reportFault`,
    handleFault: `${BASE_URL}/bikes/admin/fault`
  },
  parking: {
    list: `${BASE_URL}/parking-areas/list`
  },
  order: {
    create: `${BASE_URL}/orders/create`,
    finish: `${BASE_URL}/orders/finish`
  },
  congestion: {
    reportSpeed: `${BASE_URL}/congestion/reportSpeed`,
    dynamicMap: `${BASE_URL}/congestion/dynamicMap`
  }
};