校园共享单车导航项目前端程序
待实现功能 
1.增加停车是否在停车区域判定（已完成）
2.个人登录界面（已完成）
3.个人界面查看历史骑行记录功能（已完成）
4.管理员身份单车调度功能（已完成）
5.路线选择导航实时指示功能（已完成）
6.拥堵路线判定加入单车用户， 单车速度辅助判断
7.用户上报单车故障， 管理员维修(已完成)
8.拥堵路线时间计算增加参数

数据与区域补充
1.路点扩充（已完成）
2.停车区域增加（已完成）
3.增加在停车点内的单车数量（已完成）
4.增加快捷地标点（已完成）

细节修改
1.上下课堵塞时间改为真实时间
2.优化拆分代码

```mermaid
flowchart LR
    A[当前路段进入 A* 权重计算] --> B{是否启用拥堵权重}

    B -->|否| G[权重系数 = 1.0]
    B -->|是| C{当前路段是否在 JAM_CONFIG 中}

    C -->|否| G
    C -->|是| D{当前时间是否为下课高峰}

    D -->|否| G
    D -->|是| E[根据 cap 计算拥堵放大系数]

    E --> F[JamWeight_time = 1.45 × （1 + 3/cap）]
    F --> H[边权重 = 路段距离 × JamWeight_time]

    G --> I[边权重 = 路段距离 × 1.0]

    H --> J[A* 根据新的边权重选择路线]
    I --> J
```

```mermaid
flowchart LR
    A[开始计算某条路段边权重] --> B[计算路段实际距离 Distance]

    B --> C[调用 congestionFactor]
    C --> D{是否满足下课时间预设拥堵条件}
    D -->|否| E[StaticFactor = 1.0]
    D -->|是| F[根据 JAM_CONFIG 的 cap 计算 StaticFactor]

    E --> G[调用 dynamicSpeedFactor]
    F --> G

    G --> H{dynamicJamMap 中是否存在该路段}
    H -->|否| I[SpeedFactor = 1.0]
    H -->|是| J[读取该路段 avgSpeed]

    J --> K{avgSpeed 范围判断}
    K -->|0 < avgSpeed < 6| L[SpeedFactor = 2.0]
    K -->|6 ≤ avgSpeed < 10| M[SpeedFactor = 1.5]
    K -->|avgSpeed ≥ 10| N[SpeedFactor = 1.0]

    I --> O[最终边权重 W = Distance × StaticFactor × SpeedFactor]
    L --> O
    M --> O
    N --> O

    O --> P[加入邻接表 adj]
    P --> Q[A* 根据边权重计算 gScore 和 fScore]
    Q --> R[选择总代价更低的路线]
```
