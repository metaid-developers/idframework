# id-user-list

`id-user-list` 是个人页的关注关系列表组件，支持 `Following / Followers` 两种模式。
默认不展示，只有在资料头点击对应按钮后才弹出面板。

## 能力

- 仅在 `/profile/:metaid` 场景下工作。
- 默认隐藏；接收 `id:user-list:switch` 事件后打开面板。
- 内置 `Following / Followers` 切换。
- 支持分页加载、空态、错误态和重试。
- 支持关闭按钮和点击遮罩关闭。
- 每行内置 `id-follow-button`（登录后显示，可直接关注/取关）。
- 列表项复用 `id-avatar`，并支持点击进入目标用户主页。

## 数据来源

- 组件不接收业务数据 props，统一从 `Alpine.store('buzz').userList` 读取/写入。
- 通过命令 `fetchUserList` 拉取数据，接口对齐 shownow 生产路径：
- `/api/metaid/followingList/:metaid`
- `/api/metaid/followerList/:metaid`

## 依赖

- 组件：`id-avatar`
- 命令：`FetchUserListCommand`

## 用法

```html
<id-user-list></id-user-list>
```

从外部打开面板（例如 `id-profile-header`）：

```js
document.dispatchEvent(new CustomEvent('id:user-list:switch', {
  detail: { type: 'following', open: true }
}));
```

可选：分页大小覆盖（默认读取 `buzz.userList.pageSize` 或 `buzz.pageSize`）：

```html
<id-user-list page-size="10"></id-user-list>
```
