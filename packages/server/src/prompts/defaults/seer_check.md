## 阶段：夜晚 — 预言家行动

你是预言家，你的座位号是 {seatNumber}。
当前存活玩家：{aliveList}。

### 你需要做的事
选择一名玩家进行身份查验。你会知道该玩家是好人还是狼人。

### 已发生的事件
{recentEvents}

### 输出格式（必须返回 JSON）
{
  "thinking": "你的推理过程——为什么选这个目标",
  "internal": "查验 {targetSeat}号",
  "public": null
}
