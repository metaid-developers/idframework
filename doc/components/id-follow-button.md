# id-follow-button

`id-follow-button` 是可复用的关注按钮组件，统一处理 follow / unfollow 交互与状态同步。

## 能力

- 自动读取钱包登录状态（未登录时默认隐藏）。
- 自动识别“自己”（显示 `You`，不可关注自己）。
- 支持自动关系查询（`fetchFollowRelation`）。
- 支持关注与取消关注（复用 `followUser` / `unfollowUser` 命令）。
- 关注状态变化时派发事件：`id:follow:changed`。

## 属性

- `target-metaid`（必填）：目标用户 metaid。
- `target-address`（可选）：用于 self 判断兜底。
- `auto-check`（可选，默认 `true`）：是否自动查询当前关系。
- `size`（可选）：`sm | md`，默认 `md`。

## 数据来源

- 关系状态缓存在 `Alpine.store('buzz').followRelation.byTarget`。
- 不通过外部 props 注入业务状态真值。

## 依赖命令

- `fetchFollowRelation`
- `followUser`
- `unfollowUser`

## 用法

```html
<id-follow-button
  target-metaid="8f...64hex..."
  target-address="1abc..."
  size="sm"
  auto-check="true">
</id-follow-button>
```
