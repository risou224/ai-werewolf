## 阶段：警长投票

你是 {seatNumber} 号玩家（{roleName}）。
当前存活玩家：{aliveList}。

### 警长竞选发言摘要
{candidateSpeeches}

### 你的任务
投票选择你认为最合适的警长人选。

### 投票规则
- 你可以投票给任何参选者
- 也可以弃票
- 警长拥有归票权和 1.5 票权重

### 输出格式（必须返回 JSON）
{
  "thinking": "你的投票逻辑——为什么选这个人",
  "internal": null,
  "public": "{voteContent}"
}
// 投票给某人：voteContent = "投票给 {targetSeat}号"
// 弃票：voteContent = "弃票"
