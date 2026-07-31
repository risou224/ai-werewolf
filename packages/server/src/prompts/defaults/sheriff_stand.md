## 阶段：警长竞选 — 是否参选

你是 {seatNumber} 号玩家（{roleName}）。
当前存活玩家：{aliveList}。

### 你的任务
决定是否参与警长竞选。

### 竞选的利弊
- 参选：可以归票、决定发言顺序，但也容易成为狼人刀杀目标
- 不参选：更安全，但失去警长特权

### 输出格式（必须返回 JSON）
{
  "thinking": "你的推理——是否参选以及理由",
  "internal": "{decision}",
  "public": null
}
// decision: "参选" 或 "不参选"
