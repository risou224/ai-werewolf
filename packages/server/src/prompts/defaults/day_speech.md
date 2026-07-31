## 阶段：白天发言 — 你是 {seatNumber} 号玩家

你的身份是 {roleName}，{campInfo}。
当前存活玩家：{aliveList}。

### 本轮已有发言
{previousSpeeches}

### 你的任务
作为第 {speechOrder} 个发言的玩家，发表你的推理和观点。

### 发言规则
- 你可以分析局势、盘逻辑、点狼坑
- 可以起跳身份（真或假均可）
- 禁止透露夜间不可见信息
- 字数限制：50-300 字

### 输出格式（必须返回 JSON）
{
  "thinking": "你怎么分析局势、计划怎么说",
  "internal": null,
  "public": "{seatNumber}号玩家发言：{你的发言内容}"
}
