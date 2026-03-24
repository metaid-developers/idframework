# IDFramework 链上推特组件化 - V1 需求冻结清单

## 1. 产品范围

- 目标场景：链上推特（组件化优先，不是做单体应用）。
- 首版必须支持：`BTC + MVC`，且 `MVC` 优先。
- 数据视角：聚合流默认混合返回 BTC/MVC，不做链级过滤。

## 2. 信息流与路由

- 首页 tab：`new`（默认）、`hot`；登录后显示 `following`、`recommend`。
- Tab 必须与 URL 同步，刷新后可恢复当前 tab。
- 未登录直接访问 `/home/following` 或 `/home/recommend`：停留当前页，显示空态提示连接钱包，不发受限请求。
- 个人主页路由：`/profile/:metaid`。
- 个人主页首版只有一个帖子流，不拆原帖/转发子 tab。

## 3. 发布与互动规则

- 发帖：弹窗式（非内嵌）。
- 评论：弹窗式，纯文本（不支持图片/文件）。
- 点赞：支持，首版不支持撤销。
- 转发：支持纯转发与引用转发，首版不支持撤销。
- `simplebuzz` 三态：
- 发帖：`content` 有值，`quotePin` 空。
- 纯转发：`content` 空或缺省，`quotePin` 有值。
- 引用转发：`content` 有值，`quotePin` 有值。

## 4. 架构与数据约束

- 严格遵循 IDFramework：Single Source of Truth（Alpine.store）。
- 组件不通过外部 props 注入业务数据；数据读写来自 store。
- API 配置不通过组件属性注入；统一走 `ServiceLocator/IDConfig`。
- 架构模式：混合模式。
- 基础展示组件保持纯组件风格。
- 容器组件负责分发命令和组装页面行为。

## 5. Store 组织约束

- `buzz` store：帖子列表、分页、缓存、上报状态。
- `app` store：当前 tab、路由状态、过滤条件、页面上下文。
- 四个流使用独立缓存与游标，切 tab 不丢数据和分页进度。

## 6. 分页与加载策略

- 分页 size：固定 `10`。
- 首屏策略：若内容不足一屏，自动补拉直到填满或无更多数据。
- 推荐流已读上报：首版采用“翻页前批量上报一次”。

## 7. 资料头与关注

- `/profile/:metaid` 首版用“简化资料头”，风格尽量复用现有用户浮层风格。
- 资料头包含：头像、昵称、metaid、关注数、粉丝数、关注按钮。
- 关注按钮：支持关注/取消关注。
- 关注动作：直接执行。
- 取消关注：二次确认后执行。

## 8. 接口复用基线

- 以 `shownow-frontend` 已使用生产接口为准。
- 优先基址：`https://www.show.now/man`。
- 可能补充基址：`https://file.metaid.io/metafile-indexer/api/v1`、`https://man.metaid.io/api`。
- 如个别接口不可达，允许替换为你提供的等价线上接口。

## 9. 交付要求

- 代码改动主落点：`idframework/components`（必要时 `idframework/commands`）。
- `demos/buzz` 仅用于组合与验证，不承载核心可复用逻辑。
- 交付物：组件代码 + 组件 README + demo 组合样例。
