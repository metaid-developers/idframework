# IDFramework 链上推特组件化 - V1 实现蓝图

## 1. 实施目标

- 先完成“时间线能力优先”迭代：
- `tab + 四流(new/hot/following/recommend) + URL 同步 + 个人主页流`
- 保持组件可复用与框架一致性（Alpine.store + Command Pattern + 事件驱动）。

## 2. 目标文件范围

## 2.1 新增文件

- `idframework/components/id-buzz-tabs.js`
- `idframework/commands/ReportBuzzViewedCommand.js`（推荐流翻页前批量上报）
- `doc/components/id-buzz-tabs.md`（组件说明）

## 2.2 修改文件

- `idframework/components/id-buzz-list.js`
- `idframework/commands/FetchBuzzCommand.js`
- `demos/buzz/app.js`
- `demos/buzz/index.html`
- `README.md`（补充组件与 demo 用法入口）

## 3. Store 设计

## 3.1 `buzz` store 扩展

- `tabs.new.list`, `tabs.new.nextCursor`, `tabs.new.hasMore`, `tabs.new.isLoading`, `tabs.new.error`
- `tabs.hot.*`
- `tabs.following.*`
- `tabs.recommend.*`
- `profile.byMetaid[metaid].list`, `nextCursor`, `hasMore`, `isLoading`, `error`
- `reportedRecommendIds`（推荐流已上报集合）
- `pageSize`（固定 10）

## 3.2 `app` store 扩展

- `route.path`
- `route.params`
- `buzzTab`（`new|hot|following|recommend`）
- `profileMetaid`（`/profile/:metaid` 场景）

## 4. 组件职责

## 4.1 `id-buzz-tabs`（新增）

- 读取 `wallet`、`app` store 决定 tab 显示。
- 未登录仅渲染 `new/hot`。
- 点击 tab：
- 更新 `app.buzzTab`
- 同步 URL
- 派发统一事件（供容器监听）

## 4.2 `id-buzz-list`（增强）

- 从 `app.buzzTab` 决定读取哪个 tab 缓存。
- 根据上下文模式加载：
- 首页模式：四流之一
- 个人主页模式：`profileMetaid` 流
- 实现“首屏自动补拉”。
- 保持现有项渲染和附件、引用展示能力。

## 5. 命令与接口映射

## 5.1 `FetchBuzzCommand` 扩展为统一入口

- 输入：`{ tab, lastId, size, metaid, followed, userAddress }`
- 选择接口：
- `new` -> `GET /social/buzz/newest`
- `hot` -> `GET /social/buzz/hot`
- `following` -> `GET /social/buzz/newest` + `metaid` + `followed=1`
- `recommend` -> `GET /social/buzz/recommended` + `userAddress`
- `profile` -> `GET /social/buzz/newest` + `metaid`
- 输出归一化：`{ list, nextCursor, hasMore }`

## 5.2 `ReportBuzzViewedCommand`（新增）

- 输入：`{ pinIdList, address }`
- 调用：`POST /social/buzz/viewed/add`
- 触发时机：推荐流翻页前，批量上报“未上报”pinId。

## 6. 路由与页面装配（demo 侧）

- `demos/buzz/index.html` 增加 tab 容器与路由容器。
- `demos/buzz/app.js` 负责：
- 注册 `fetchBuzz`（统一命令）
- 注册 `reportBuzzViewed`
- 监听 URL 与 `app.buzzTab` 双向同步
- 处理 `/profile/:metaid` 上下文写入 `app.profileMetaid`

## 7. 行为细节

- 未登录访问 `following/recommend`：
- 不请求受限流。
- `id-buzz-list` 显示技术风空态文案。
- 推荐流翻页：
- 调 `reportBuzzViewed` 后再拉下一页。
- 首屏补拉：
- 当容器高度大于内容高度且 `hasMore=true` 时继续请求。

## 8. 迭代边界（本轮不做）

- 点赞/评论/转发交互接入（下一轮）。
- 评论内容列表与提交弹窗（下一轮）。
- profile 页完整视觉打磨（仅做简化头部在后续轮）。

## 9. 验收标准

- 登录前：仅 `new/hot` 可见，且可浏览。
- 登录后：显示四个 tab，切换不丢历史数据。
- 刷新页面：保留 URL 对应 tab。
- `/profile/:metaid` 可展示该用户流。
- 推荐流翻页前能成功触发批量已读上报。
- 组件逻辑主落点在 `idframework/components`，demo 不承载核心逻辑。

## 10. 开工顺序

1. 新增 `id-buzz-tabs` 并在 demo 装配。
2. 扩展 `buzz/app` store 结构。
3. 改造 `FetchBuzzCommand` 为多流统一入口。
4. 改造 `id-buzz-list`（按 tab 读取缓存 + 补拉逻辑）。
5. 新增 `ReportBuzzViewedCommand` 并接推荐流翻页前上报。
6. 补充 README 与组件文档。
