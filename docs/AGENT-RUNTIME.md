# OpenAI Agents API 接入层

状态：SDK 适配器已合并；离线测试和真实 API 连通测试均通过。2026-09-12 使用本地配置成功验证会话创建、工具调用及同一会话第二轮的随机 token 记忆。Case worker 与浏览器执行仍未实现。

## 三层接口

```text
Relay 界面 → /api/cases → Case 服务与持久化 → OpenAI Agents API session
                                              ↓ required_actions
                                         Relay 工具分发器
                                              ↓
                                   资料查询 / 行动预览 / 浏览器执行
```

前端继续使用 [API-CONTRACT.md](API-CONTRACT.md)。OpenAI Agents API 仅在服务端调用，不让前端持有 key 或会话控制权。
每个 case 保存自己的 `sessionId`；人的回复通过 `agent.session.input.message` 进入同一会话。
来源：[官方会话文档](https://developers.openai.com/api/docs/guides/agents-api/sessions)。

## 已实现的接口

[`src/server/agent/openai-agents.mjs`](../src/server/agent/openai-agents.mjs) 使用官方 SDK 的 `client.beta.agents.sessions`，没有切换到 Responses 或 Agents SDK。

| 方法 | 行为 |
| --- | --- |
| `start({ model, instructions, tools, input, signal }, hooks)` | 创建 `environment: none` 的会话，消费首轮事件 |
| `continue({ sessionId, text, signal }, hooks)` | 先订阅事件，再发送后续消息，等待该轮结果 |
| `cancel(sessionId)` | 请求取消当前轮；不能撤回已经发生的门户写入 |
| `retrieve(sessionId)` | 获取当前会话与待处理动作 |
| `savedItems(sessionId)` | 分页获取已保存消息和工具历史，用于恢复 |

`hooks` 是应用后端必须提供的接口：

- `onSession(sessionId)`：持久化当前 case 和 session 的对应关系。适配器等待保存完成后才分发工具。
- `onEvent(event)`：可选；将观察到的事件转换成可读的 case 进度，不能直接把模型结束转换成采购成功。
- `executeTool({ sessionId, action })`：验证参数、核对权限、执行工具，并持久化结果。返回 `{ success: true, output: JSON.stringify(result) }` 或已确认失败的 `{ success: false, error: message }`。

适配器从重新读取的 `required_actions` 分发调用，用原始 `turn_id` / `call_id` 回传结果；不把历史工具条目当成待执行调用。
调用结果需要按 session/turn/call 持久化；写操作结果不明时先查目标记录。适配器不会自动重试 POST，也不会把执行中断伪装成已确认的工具失败。
来源：[官方函数工具文档](https://developers.openai.com/api/docs/guides/agents-api/tools/functions)。

当前实现负责单轮事件消费；断线后主动抛错，由 Case worker 读取会话和保存的历史，再恢复工作。它尚未实现自动断线恢复、入站事件队列或执行记录存储。
会话创建成功但尚未拿到 ID 时断线，也不能直接重复创建；这项创建对账仍需在 worker 层实现。

## 本地配置与验证

需要 OpenAI Platform 的 application API key，权限包含 `api.agents.read`、`api.agents.write`、`api.responses.write`。
该 key 只放服务端；账号的实际可用权限要通过连通测试确认。
来源：[官方 quickstart](https://developers.openai.com/api/docs/guides/agents-api/quickstart)。

1. 将 `.env.example` 复制为 `.env` 或 `.env.local`，在本地填写 `OPENAI_API_KEY`，按账号可用模型配置 `OPENAI_AGENT_MODEL`。`.env.local` 已被 Git 忽略。
2. 合并分支已安装并锁定 `openai`，本地确认暴露 `beta.agents.sessions`。运行 `npm ci` 安装。
3. 在 Node 22.6+ 环境运行：

```sh
npm run check:agents
```

验证脚本只注册无外部副作用的 `record_probe` 工具：首次调用传入随机 token，第二轮不重复提供 token，要求在同一会话的新一轮中再次调用工具并传回它。两轮结果及工具参数都匹配才打印 PASS；仅 idle 不算通过。
这会产生正常 API 推理用量。每轮有 90 秒超时；失败时尝试取消。会话保留供检查，并输出其 ID。
测试用结果缓存只存在内存中，不能用于生产执行幂等。

离线测试不需要 key 或 OpenAI SDK：

```sh
node --test tests/openai-agents.test.mjs
```

## 接下来接入 Case worker

1. 为 case 持久化 session 映射、入站事件与工具执行账本；在同一 case 内串行处理。
2. 编写 Relay agent instructions，注册 `read_case`、`search_evidence`、`propose_clarification`、`propose_draft` 等业务工具及参数校验。
3. 回复/授权 HTTP 接口先写入业务状态，再将已接受的事件送回 session；API 请求成功不等于业务执行成功。
4. 将受限浏览器工具连接到独立 worker。每次有副作用的操作都核对当前授权；模型声明“用户批准了”不构成授权记录。
5. 核对真实门户字段与附件后，才更新 `receipt` 与 `completed`。

本次没有实现上述业务 worker 或浏览器工具，也没有把离线测试当成真实 Agents API 连通证明。
