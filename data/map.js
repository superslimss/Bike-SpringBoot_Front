/* data/map.js */
module.exports = {
  mapKey: 'ZQWBZ-NQBLV-W7CPF-U7QIR-5HBNQ-AOFUE',
  longitude: 123.793838,
  latitude: 41.857826,
  enablepoi: true,
  showLocation: true,
  scale: 16.0,
  minscale: 15.8,

  site_data: [
    {
      id: 1,
      name: '辽石化',
      longitude: 123.793838,
      latitude: 41.857826,
      range: [
        { "latitude": 41.85306, "longitude": 123.785513 },
        { "latitude": 41.856583, "longitude": 123.784943 },
        { "latitude": 41.859406, "longitude": 123.784639 },
        { "latitude": 41.861421, "longitude": 123.787537 },
        { "latitude": 41.862525, "longitude": 123.79003 },
        { "latitude": 41.862892, "longitude": 123.792394 },
        { "latitude": 41.862767, "longitude": 123.794923 },
        { "latitude": 41.862602, "longitude": 123.798071 },
        { "latitude": 41.862478, "longitude": 123.801304 },
        { "latitude": 41.862386, "longitude": 123.802030 },
        { "latitude": 41.862019, "longitude": 123.802356 },
        { "latitude": 41.861661, "longitude": 123.802423 },
        { "latitude": 41.861419, "longitude": 123.799458 },
        { "latitude": 41.859542, "longitude": 123.799790 },
        { "latitude": 41.857662, "longitude": 123.800068 },
        { "latitude": 41.857159, "longitude": 123.793998 },
        { "latitude": 41.853833, "longitude": 123.794487 }
      ],
      site_id: [1, 1],
      isUseMapImg: true,
      img: 'https://cdnjson.com/images/2024/03/13/GXNU9b2e3c77b9ff605a.jpg',
      bounds: {
        opacity: 0.9,
        east: 123.803113,
        north: 41.866894,
        south: 41.848891,
        west: 123.783914,
      },

      category_list: [
        // 1. 校门
        {
          id: 1,
          name: '校门',
          list: [
            {
              id: 1,
              name: '南二门',
              aliases: '主校门',
              img: '',
              desc: '辽石化南二门，主要通行入口',
              latitude: 41.853882,
              longitude: 123.791513,
              scale: 16.0
            },
            // 新增校门：南3
            {
              id: 2,
              name: '南3门',
              aliases: '',
              img: '',
              desc: '辽石化南3门入口',
              latitude: 41.853599,
              longitude: 123.789897,
              scale: 16.0
            },
            // 新增校门：南4
            {
              id: 3,
              name: '南4门',
              aliases: '',
              img: '',
              desc: '辽石化南4门入口',
              latitude: 41.853427,
              longitude: 123.788355,
              scale: 16.0
            },
            // 新增校门：南1门
            {
              id: 4,
              name: '南1门',
              aliases: '',
              img: '',
              desc: '辽石化南1门入口',
              latitude: 41.853781,
              longitude: 123.792924,
              scale: 16.0
            },
            // 新增校门：东2门
            {
              id: 5,
              name: '东2门',
              aliases: '',
              img: '',
              desc: '辽石化东2门入口',
              latitude: 41.857304,
              longitude: 123.793951,
              scale: 16.0
            },
            // 新增校门：东1门
            {
              id: 6,
              name: '东1门',
              aliases: '',
              img: '',
              desc: '辽石化东1门入口',
              latitude: 41.859396,
              longitude: 123.799728,
              scale: 16.0
            },
          ],
        },
        // 2. 图书馆
        {
          id: 2,
          name: '图书馆',
          list: [
            {
              id: 1,
              name: '辽石化图书馆',
              aliases: '主图书馆',
              img: '',
              desc: '辽石化核心图书馆，提供借阅、自习服务',
              latitude: 41.859154, // 最新坐标
              longitude: 123.790708, // 最新坐标
              scale: 16.0
            },
          ],
        },
        // 3. 体育馆
        {
          id: 3,
          name: '体育馆',
          list: [
            {
              id: 1,
              name: '辽石化体育馆',
              aliases: '综合体育馆',
              img: '',
              desc: '室内体育活动场地，含篮球场、羽毛球场',
              latitude: 41.856268, // 最新坐标
              longitude: 123.789473, // 最新坐标
              scale: 16.0
            },
          ],
        },
        // 4. 游泳馆
        {
          id: 4,
          name: '游泳馆',
          list: [
            {
              id: 1,
              name: '辽石化游泳馆',
              aliases: '校内游泳馆',
              img: '',
              desc: '辽石化校内游泳馆，提供游泳教学、日常使用',
              latitude: 41.856341, // 最新坐标
              longitude: 123.790351, // 最新坐标
              scale: 16.0
            },
          ],
        },
        // 新增：学院分类（点击后显示全部学院）
        {
          id: 5,
          name: '学院',
          list: [
            // 理学院
            {
              id: 1,
              name: '理学院',
              aliases: '',
              img: '',
              desc: '辽石化理学院教学办公场地',
              latitude: 41.858596,
              longitude: 123.794635,
              scale: 16.0
            },
            // 外国语学院
            {
              id: 2,
              name: '辽宁石油大学外国语学院',
              aliases: '外国语学院',
              img: '',
              desc: '辽石化外国语学院教学办公场地',
              latitude: 41.858481,
              longitude: 123.795302,
              scale: 16.0
            },
            // 人工智能与软件学院
            {
              id: 3,
              name: '人工智能与软件学院',
              aliases: '',
              img: '',
              desc: '辽石化人工智能与软件学院教学办公场地',
              latitude: 41.859520,
              longitude: 123.794450,
              scale: 16.0
            },
            // 信息与工程学院
            {
              id: 4,
              name: '信息与控制工程学院',
              aliases: '',
              img: '',
              desc: '辽石化信息与工程学院教学办公场地',
              latitude: 41.860204,
              longitude: 123.794161,
              scale: 16.0
            },
            // 经济管理学院
            {
              id: 5,
              name: '经济管理学院',
              aliases: '',
              img: '',
              desc: '辽石化经济管理学院教学办公场地',
              latitude: 41.861203,
              longitude: 123.794437,
              scale: 16.0
            },   { 
              id: 5, 
              name: '经济管理学院', 
              aliases: '', 
              img: '', 
              desc: '辽石化经济管理学院教学办公场地', 
              latitude: 41.861203, 
              longitude: 123.794437,
              scale: 16.0 
            },
            // 新增4个学院（每个条目单独换行）
            { 
              id: 6, 
              name: '土木工程学院', 
              aliases: '', 
              img: '', 
              desc: '辽石化土木工程学院教学办公场地', 
              latitude: 41.854611, 
              longitude: 123.792718,
              scale: 16.0 
            },
            { 
              id: 7, 
              name: '石油工程学院', 
              aliases: '', 
              img: '', 
              desc: '辽石化石油工程学院教学办公场地', 
              latitude: 41.859793, 
              longitude: 123.788557,
              scale: 16.0 
            },
            { 
              id: 8, 
              name: '化学与科学学院', 
              aliases: '', 
              img: '', 
              desc: '辽石化化学与科学学院教学办公场地', 
              latitude: 41.859306, 
              longitude: 123.788461,
              scale: 16.0 
            },
            { 
              id: 9, 
              name: '环境与工程学院', 
              aliases: '', 
              img: '', 
              desc: '辽石化环境与工程学院教学办公场地', 
              latitude: 41.858828, 
              longitude: 123.788124,
              scale: 16.0 
            },
          ],
        },
      ],
    },
  ],
};