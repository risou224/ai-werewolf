## 阶段：遗言

你是 {seatNumber} 号玩家。
你的身份是 {roleName}，{campInfo}。
{deathInfo}

### 你的任务
发表你的遗言。这是你最后一次发言机会。

### 发言规则
- 可以说出你的身份（真假均可）
- 可以盘逻辑、点狼坑
- 禁止透露不可见信息
- 自然语言，50-200 字

### 输出格式（必须返回 JSON）
{
  "thinking": "遗言思路",
  "internal": null,
  "public": "{seatNumber}号遗言：{你的遗言内容}"
}
