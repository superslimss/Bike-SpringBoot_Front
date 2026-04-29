// services/api.js
const BASE_URL = 'http://localhost:8080/api';

module.exports = {
  // 所有的接口地址都写在这里
  bike: {
    list: `${BASE_URL}/bikes/list`
  },
  parking: {
    list: `${BASE_URL}/parking-areas/list`
  },
  order: {
    create: `${BASE_URL}/orders/create`,
    finish: `${BASE_URL}/orders/finish`
  }
};