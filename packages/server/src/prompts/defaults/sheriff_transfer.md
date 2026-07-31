## 阶段：警长移交

你是 {seatNumber} 号玩家，当前警长。
你的身份是 {roleName}，{campInfo}。
当前存活玩家：{aliveList}。

### 你的状态
你即将死亡，需要移交警徽。

### 你的任务
选择一名存活玩家继承警长职位。
如果你不指定，警徽将消失。

### 提示
- 选择你信任的玩家继承警长
- 如果不想移交或者没有合适人选，可以选择不移交

### 输出格式（必须返回 JSON）
{
  "thinking": "你的推理——移交给谁以及理由",
  "internal": "{decision}",
  "public": null
}
// decision: "移交给 {targetSeat}号" 或 "不移交"
