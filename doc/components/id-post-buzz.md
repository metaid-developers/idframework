# id-post-buzz

`id-post-buzz` 是发帖/引用转发共用的发布组件。

## 能力

- 纯发帖、纯转发、引用转发（`quote-pin`）。
- 本地图片上传与预览，最多 `9` 张。
- Emoji 面板与光标位置插入。
- 成功后抛出 `buzz-posted`，关闭时抛出 `close`。

## 数据与架构

- 组件内部只维护 UI 局部状态（输入内容、图片预览、面板开关）。
- 发帖动作统一走命令：`IDFramework.dispatch('postBuzz', { content, files, quotePin })`。
- 不实现 Encrypt 流程，保持通用组件职责单一。

## 用法

```html
<!-- 普通发帖 -->
<id-post-buzz></id-post-buzz>

<!-- 引用转发 -->
<id-post-buzz quote-pin="64hex...i0"></id-post-buzz>
```
