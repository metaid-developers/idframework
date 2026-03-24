# id-profile-header

`id-profile-header` 是 `/profile/:metaid` 页面顶部的简化资料头组件，负责展示：

- 头像
- 昵称
- MetaID
- Following / Followers 数量
- 关注 / 取消关注按钮

## 数据来源

- 严格从 `Alpine.store` 读取与写入（`buzz/app/wallet/user`）。
- 不通过 props 传入业务数据。

## 依赖命令

- `@idf/commands/FetchProfileHeaderCommand.js`
- `@idf/commands/FollowUserCommand.js`
- `@idf/commands/UnfollowUserCommand.js`

## 行为说明

- 仅在路由为 `/profile/:metaid` 时渲染。
- 点击 `Following / Followers` 数量按钮，会派发 `id:user-list:switch` 事件打开关系面板。
- 关注：直接执行。
- 取消关注：二次确认后执行。
- 关注状态与计数先做本地即时更新，再异步刷新服务端状态校准。

## 用法

```html
<id-profile-header></id-profile-header>
```

通常与 `id-buzz-list` 一起组合在 profile 页面顶部。
