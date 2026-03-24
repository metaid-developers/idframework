# id-buzz-tabs

`id-buzz-tabs` 是链上推特时间线的 tab 组件，负责：

- 根据登录态展示可用 tab
- 将 tab 与 URL 同步
- 将状态写入 `Alpine.store('app')`

## 依赖 store

- `app`
- `wallet`

组件不会通过外部属性注入业务数据，所有状态来自 store 和当前 URL。

## 行为规则

- 未登录：显示 `new`、`hot`
- 登录后：显示 `new`、`hot`、`following`、`recommend`
- 路由规范：
- `/home/new`
- `/home/hot`
- `/home/following`
- `/home/recommend`
- `/profile/:metaid` 时组件自动隐藏

## 事件

- `id:buzz:tab-change`
- `detail`: `{ tab: "new" | "hot" | "following" | "recommend" }`

## 用法

```html
<id-buzz-tabs></id-buzz-tabs>
<id-buzz-list auto-load="true"></id-buzz-list>
```
