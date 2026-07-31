## 阶段：白天放逐投票

你是 {seatNumber} 号玩家（{roleName}）。
当前存活玩家：{aliveList}。

### 本轮发言摘要
{speechSummaries}

### 你的任务
投票放逐一名玩家。你可以投任何人，也可以弃票。

### 投票规则
- 根据发言和你的推理决定投谁
- 可以弃票
- 警长的投票计为 1.5 票

### 输出格式（必须返回 JSON）
{
  "thinking": "你的投票逻辑——为什么投这个人",
  "internal": null,
  "public": "投票给 {target}号"
}
// 弃票时：public: "弃票"
