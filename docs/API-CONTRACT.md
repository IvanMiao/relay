# Relay 接口契约 v1

状态：接口冻结；产品 UI 和持久化门户已适配 v1，OpenAI SDK 适配器已合并。Case 服务端、持久化 worker 和浏览器执行器已实现并通过真实端到端联调，见 RUNBOOK.md。适用于本地、合成数据的双人原型。
共享类型以 [`src/lib/contracts.ts`](../src/lib/contracts.ts) 为准；本文定义类型无法表达的行为。
字段或语义的破坏性修改必须由双方同步更新契约及 fixtures，不能各自修改接口。

## 分工与目录

- Agent / 执行负责人（你）：`src/server/`、`src/app/api/cases/`、`src/app/api/artifacts/`、`fixtures/`，维护共享类型。
- 产品 / 门户负责人（队友）：应用脚手架、依赖配置、`src/components/`、`src/app/portal/`、`src/app/api/portal/`、`src/portal/`。
- Relay 管理 case；门户独立管理草稿和附件。双方通过接口交互，不直接写对方存储。
- 合并分支已提供 Next.js 脚手架及 OpenAI SDK 依赖，详见 UI-HANDOFF.md。

## 通用约定

- JSON 使用 camelCase；时间为 ISO 8601 UTC；ID 为不透明字符串；路径参数需 URL 编码。
- 金额 `unitPrice` 用十进制字符串，禁止指数、千位分隔符和负数；最多使用对应币种的小数位数。
- `quantity` 为正整数，`currency` 为大写 ISO 4217 代码。必填字符串去除首尾空白后不能为空。
- 未知事实用 `null`，集合用 `[]`；不得编造金额、成本中心或审批身份。
- `CaseSnapshot.mode` 必须可见：`fixture` 表示演示快照，`live` 表示真实后端执行；两种模式的门户和人物资料均为合成数据。
- API 密钥、模型会话 ID、内部工具原始内容不进入前端契约。服务端保存 case/session 映射。
- API 输入必须运行时校验；TypeScript 类型不提供输入验证或权限保障。

## Relay HTTP 接口

| 方法与路径 | 请求类型 | 成功状态与响应 |
| --- | --- | --- |
| `POST /api/cases` | `CreateCaseRequest` | `201 CaseResponse`，持久化后立即返回，agent 后台继续 |
| `GET /api/cases/:id` | 无 | `200 CaseResponse` |
| `POST /api/cases/:id/replies` | `ReplyRequest` | `200 CaseResponse`，回复已持久化、后续处理已登记 |
| `POST /api/cases/:id/authorizations` | `AuthorizationRequest` | `200 CaseResponse`，决定已持久化 |
| `POST /api/cases/:id/control` | `ControlRequest` | `200 CaseResponse`，控制状态已持久化 |
| `GET /api/artifacts/:id` | 无 | `200` 原始字节，正确的 Content-Type 和文件名 |

前端每秒读取一次完整快照，使用 `Cache-Control: no-store`，不得以低版本快照覆盖高版本快照。
API 成功只表示输入已接受；进度和业务完成只看快照。所有 case JSON 成功响应统一为 `{ "case": ... }`。
第一版报价从 fixtures 中选择已有 artifact；不增加 Relay 上传接口。资料 ID 在创建 case 时必须存在且可访问。
资料 URL 及快照引用的截图 URL 必须可读取；快照 fixture 本身不代表附件服务已经实现。

## 并发、幂等与授权

1. 创建使用 `eventId`，回复使用 `messageId`，授权/控制使用 `eventId`。调用方为新操作生成唯一 ID；网络重试保留原 ID。
2. 创建去重范围为当前请求者；其他事件去重范围为 case（跨事件类型）。服务端先检查已处理事件，再检查版本，并在同一事务中记录事件及状态。
3. 相同 ID、相同规范化请求返回 `200` 和当前快照，不再次触发 agent 或写操作；相同 ID、不同请求返回 `409 idempotency_conflict`。
4. 新事件的 `expectedVersion` 必须等于当前 `case.version`，否则返回 `409 stale_version` 和 `currentVersion`。前端重取快照，不能自动批准新内容。
5. 每次 case 变更递增版本；待审核行动的 `reviewedVersion` 同步为所在快照版本。读取快照不递增版本。
6. 授权仅接受当前 `pendingAction.id`；`expectedVersion` 同时匹配该行动的 `reviewedVersion`，且未过期。服务端保存行动的完整不可变 payload、决定、当前请求者和时间，不能让浏览器提交的身份赋予权限。
7. 授权后清除 `pendingAction`，通过执行记录引用已批准 payload。收件人、目的地、字段、附件、相关业务权限有变化时，撤销尚未完成的旧行动并生成新 action ID 重新审核。
8. `decline` 清除待审核行动、取消对应任务并暂停 case，不创建草稿或发送消息。恢复 case 不自动恢复被拒绝或失效的授权。
9. 回复只接受本 case 中已送达、尚未回复的 clarification；回复不会自动成为政策或审批权限。未知/不匹配的 clarification 返回 `409 invalid_state`。
10. 创建草稿和联系人员均在服务端工具边界检查授权；协调代理身份不等于预算审批身份。`demo_thread` 只表示本地模拟消息。

原型必须串行处理同一 case 的变更与执行任务，并持久化待执行工作。轮询、重复事件或重复工具回调不能启动第二个相同执行。

## 状态与前端规则

- `stage` 表示业务阶段，`status` 表示当前运行状态，两者不能互相推导。
- `currentTask` 为 `tasks` 中的 ID；人员、任务和事件中的证据 ID 必须指向本快照的 `evidence`。
- `waiting_for_reply` 必须有已送达且未回复的问题；`waiting_for_authorization` 必须有 `pendingAction`。
- 等待期间可以完成独立准备工作；新回复只重算受影响的任务，保留仍有效的完成证据。
- `pause` 持久化后返回 `paused`，停止派发新动作；已在执行的保存可能完成，应显示 `reconciliation_required` 阻塞并记录结果。
- `resume` 先核对未确定的执行结果，之后根据依赖进入运行或等待状态；不能盲目再次点击保存。
- `failed` 必须有可读 blocker；`receipt` 在核验成功前始终为 `null`。
- `completed` 仅用于 `stage: verify` 且存在经过核验的 receipt；展示“草稿已验证，等待组织审批”。模型一轮结束不代表 case 完成。
- `events` 为持久化业务历史，按时间从旧到新；浏览器截图只反映其 `observedAt` 时刻，不是成功凭证。

## 采购门户契约

页面固定为 `/portal/new` 和 `/portal/drafts/:id`。新建表单提供以下稳定的可访问标签：

| HTML name | 可访问标签 | 值 |
| --- | --- | --- |
| `requestReference` | `Request reference` | 同一业务操作重试保持不变 |
| `item` | `Item` | 物品描述 |
| `vendor` | `Vendor` | 供应商名称 |
| `quantity` | `Quantity` | 正整数 |
| `currency` | `Currency` | 币种代码 |
| `unitPrice` | `Unit price` | 十进制字符串 |
| `costCenter` | `Cost center` | 已确认的成本中心 |
| `justification` | `Justification` | 技术/业务理由 |
| `attachments` | `Attachments` | 可上传多个文件，必须包含原始报价 |

保存按钮的可访问名称为 `Save draft`。每个输入必须关联可读的校验错误；错误时保留已填写内容。
保存成功后进入详情页，显示真实 ID、`draft` 状态、全部保存字段及可下载附件。

| 方法与路径 | 请求 | 响应 |
| --- | --- | --- |
| `POST /api/portal/drafts` | `multipart/form-data`：`payload` 为 `CreatePortalDraftPayload` JSON，重复的 `attachments` 为文件字节 | 首次 `201 PortalDraftResponse`；同内容重试 `200` |
| `GET /api/portal/drafts/:id` | 无 | `200 PortalDraftResponse`；不存在 `404` |
| `GET /api/portal/drafts?requestReference=...` | 精确匹配编号 | `200 PortalDraftLookupResponse`，不存在时 `draft: null` |

门户在一次原子写入中保存字段和附件，并对 `requestReference` 设置唯一约束。同编号、相同字段和附件返回已有草稿；内容不同返回 `409 idempotency_conflict`，不覆盖已有记录。
附件等价按文件名、mediaType、sizeBytes、SHA-256 比较为多重集合，不依赖上传顺序、URL 或门户 ID。摘要必须由门户根据收到的实际字节计算。
门户可以按自己的路径提供附件下载，但回执中的 URL 必须可访问，下载字节必须与元数据匹配。

浏览器通过真实表单上传及点击保存，门户表单调用自己的 API。执行器可以用读取 API 查重及核对记录，不能把绕过表单的 API 写入当作浏览器操作。
保存结果不明确时，先按 `requestReference` 查找已有记录；只有明确确认没有记录且先前写入已结束后才允许重试。

Relay 重新打开草稿并读取已保存的记录，对照已授权 payload 检查编号、`draft` 状态、全部字段和附件字节摘要；通过后才能产生 `VerifiedReceipt`。
`verifiedAt` 由 Relay 在核验之后填写，门户不得自己声明 Relay 已验证。

## 错误格式

所有 JSON 错误使用 `ApiError`：`{ "error": { "code": "stale_version", "message": "Case changed; reload before reviewing.", "currentVersion": 8 } }`。

| HTTP | code |
| --- | --- |
| 400 | `invalid_request` |
| 403 | `forbidden` |
| 404 | `not_found` |
| 409 | `stale_version`、`idempotency_conflict`、`invalid_state`、`action_expired` |
| 422 | `validation_failed`（附 `fieldErrors`，键为字段 name；附件错误为 `attachments`） |
| 500 | `internal_error`（不暴露密钥、内部堆栈） |

## 联调验收

- 创建 case 后马上拿到 ID，刷新后能读取原 case；重复事件不产生新工作。
- 人工回复关联原问题并继续同一 case；旧版本操作被拒绝且可重取快照。
- 拒绝授权不创建草稿；修改金额/附件后不能沿用旧授权。
- 暂停后不派发新浏览器动作，恢复时先核对在途保存。
- 保存成功但响应丢失，重试仍只有同一份草稿；不同内容重用编号返回冲突。
- 字段或附件核验失败时 `receipt` 仍为 null；成功结果仍明确需要组织审批。

示例快照见 [`fixtures/case-snapshots.ts`](../fixtures/case-snapshots.ts)。它们用于布局联调，不是运行时、真实文件或已执行成功的证明。
