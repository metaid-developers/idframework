# IDFramework 社交组件体系 - 头脑风暴 v0.1

## 1. 目标定义

基于 `IDFramework` 现有架构（`Web Components + Alpine Store + Command Pattern`），沉淀一套可复用的社交前端组件库，让业务方通过“拼积木”快速搭建：

- 链上推特（Buzz Feed）
- 链上 Telegram（即时通讯）
- 链上留言本（Guestbook）

目标不是做单一 Demo，而是形成“可组合、可替换、可主题化”的组件体系。

## 2. 现状盘点（已具备）

当前已存在可复用组件（`idframework/components`）：

- 账户与身份：`id-connect-button`, `id-userinfo-float-panel`
- Feed：`id-buzz-list`, `id-buzz-card`, `id-post-buzz`, `id-attachments`
- Chat：`id-chat-box`, `id-chat-bubble`, `id-chat-input-box`
- 兼容/旧版 Chat 视图：`id-chat-chatlist-panel`, `id-chat-groupmsg-list`, `id-chat-msg-bubble`
- 其他：`id-game-score-leaderboard`

当前已存在命令与数据能力（`idframework/commands`, `idframework/stores/chat`）：

- `fetchBuzz`, `postBuzz`
- `sendChatMessage`, `fetchChatList`, `fetchGroupMessages`
- `simple-talk` 聊天 store（含 IndexedDB、加解密、消息合并）

## 3. 设计思想提炼（后续组件必须遵守）

- 单一数据源：状态在 Alpine Store，不在组件私有状态里分散保存业务真相
- View Dumb：组件只负责展示 + 派发事件；业务逻辑在 Command
- 事件驱动：组件间通过 `CustomEvent` 通信，避免强耦合
- 主题分离：统一走 CSS Variables，结构样式在组件内，皮肤在外部
- 可覆写：关键节点提供 `part`、可扩展属性、稳定事件契约

## 4. 组件分层模型（建议）

### L0 基础能力层

- `id-avatar`
- `id-name`
- `id-timestamp`
- `id-action-button`
- `id-empty-state`
- `id-loading`
- `id-error-banner`

### L1 社交原子层

- `id-reaction-bar`（点赞/转发/评论计数）
- `id-mention-text`（@解析与点击）
- `id-media-preview`（图片/视频/文件统一预览）
- `id-quote-card`（引用消息/引用动态）

### L2 场景块层

- Feed 块：`id-feed-composer`, `id-feed-item`, `id-feed-list`, `id-feed-filter-bar`
- Chat 块：`id-chat-thread-list`, `id-chat-thread-item`, `id-chat-message-list`, `id-chat-composer`
- Guestbook 块：`id-guestbook-entry-list`, `id-guestbook-entry-card`, `id-guestbook-composer`

### L3 页面容器层

- `id-feed-shell`
- `id-chat-shell`
- `id-guestbook-shell`

## 5. 三类应用“积木组合图”

### A. 链上推特（Buzz）

- 组合：`id-connect-button` + `id-feed-shell`
- `id-feed-shell` 内：`id-feed-composer` + `id-feed-filter-bar` + `id-feed-list`
- `id-feed-list` 项：`id-feed-item`（内含 `id-avatar/id-mention-text/id-media-preview/id-reaction-bar/id-quote-card`）

可直接复用：

- `id-buzz-list`, `id-post-buzz`, `id-attachments`, `id-userinfo-float-panel`

优先补齐：

- `id-reaction-bar`（点赞/转发/评论统一接口）
- `id-feed-filter-bar`（按 path/类型/时间过滤）
- `id-feed-item-actions`（菜单：复制链接/举报/删除）

### B. 链上 Telegram（Chat）

- 组合：`id-connect-button` + `id-chat-shell`
- `id-chat-shell` 内：`id-chat-thread-list` + `id-chat-message-list` + `id-chat-composer`

可直接复用：

- `id-chat-box`, `id-chat-bubble`, `id-chat-input-box`
- `sendChatMessage`、`simple-talk` store

优先补齐：

- `id-chat-thread-list`（统一 thread 入口，替换旧版 panel）
- `id-chat-presence-badge`（在线/离线/已读状态位）
- `id-chat-reply-strip`（回复态与取消回复）

### C. 链上留言本（Guestbook）

- 组合：`id-connect-button` + `id-guestbook-shell`
- `id-guestbook-shell` 内：`id-guestbook-composer` + `id-guestbook-entry-list`

可借用 Feed 组件快速实现：

- `id-post-buzz`（简化模式）
- `id-buzz-list`（按 guestbook path 读取）

优先补齐：

- `id-guestbook-entry-card`（轻量文本 + 签名时间 + 地址）
- `id-guestbook-sort-bar`（最新/最热）

## 6. 组件优先级 Backlog（从现在开始）

### P0（先做，形成可用组件库 MVP）

- `id-avatar`
- `id-empty-state`
- `id-error-banner`
- `id-reaction-bar`
- `id-feed-filter-bar`
- `id-chat-thread-list`
- `id-chat-reply-strip`
- `id-guestbook-entry-card`

### P1（增强可用性）

- `id-media-preview`（统一图片/视频/文件预览交互）
- `id-chat-presence-badge`
- `id-feed-item-actions`
- `id-guestbook-sort-bar`

### P2（产品级能力）

- `id-notification-list`
- `id-follow-button`
- `id-profile-header`
- `id-moderation-menu`（举报/拉黑/隐藏）

## 7. 统一接口约定（草案）

每个组件都给出这四类契约：

- Attributes：用于静态配置（如 `group-id`, `mode`, `path`）
- Properties：用于对象数据注入（如 `item`, `messages`, `user`）
- Events：只派发语义事件（如 `reaction-click`, `thread-select`）
- Parts/CSS Vars：保证主题与皮肤可覆写

建议事件命名统一：

- `id:{domain}:{action}`
- 示例：`id:feed:post`, `id:chat:send`, `id:guestbook:sign`

## 8. 开发节奏建议（4 周）

- Week 1：P0 基础原子组件 + 统一样式 token
- Week 2：Feed/Guestbook 统一块组件
- Week 3：Chat thread 与 message 体系统一
- Week 4：示例应用拼装（Buzz / Chat / Guestbook 三套 Demo）

## 9. 下一步（立即执行）

从 P0 中选择一个“最小可交付包”先落地，建议顺序：

1. `id-avatar` + `id-empty-state` + `id-error-banner`
2. `id-reaction-bar`
3. `id-chat-thread-list`
4. `id-guestbook-entry-card`

这样可以最快形成“跨场景复用”的第一批标准积木。
