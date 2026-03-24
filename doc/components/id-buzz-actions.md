# id-buzz-actions

`id-buzz-actions` 是时间线的互动组件，负责：

- 点赞（`likeBuzz`）
- 评论（弹窗 + 文本评论提交 `postComment`）
- 纯转发（`postBuzz` + `quotePin` + 空内容）
- 引用转发（弹窗复用 `id-post-buzz`）

## 数据来源

- 严格从 `Alpine.store` 读取（`buzz/app/wallet/user`）。
- 组件仅接收 `pin-id` 作为上下文定位，不通过 props 传入业务数据。

## 依赖命令

- `@idf/commands/LikeBuzzCommand.js`
- `@idf/commands/PostCommentCommand.js`
- `@idf/commands/FetchBuzzCommentsCommand.js`
- `@idf/commands/PostBuzzCommand.js`

## 用法

```html
<id-buzz-actions pin-id="{pinId}"></id-buzz-actions>
```

通常由 `id-buzz-list` 在每条 buzz 卡片中组合渲染。
