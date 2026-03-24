# id-avatar

`id-avatar` 是一个可复用的基础头像组件，负责统一头像加载与回退显示。

## 能力

- 支持属性：`src`、`name`、`metaid`、`size`、`shape(circle|rounded|square)`。
- 图片加载失败时自动回退到首字母占位。
- 支持浅色/深色主题变量（`--id-avatar-*`）。

## 数据来源

- 仅负责展示，不直接请求业务数据。
- 业务组件（如 `id-buzz-list` / `id-profile-header`）从 `Alpine.store` 读取数据后传给它。

## 用法

```html
<id-avatar
  src="https://file.metaid.io/metafile-indexer/api/v1/users/avatar/accelerate/xxx"
  name="Alice"
  metaid="0123abcd..."
  size="40"
  shape="circle">
</id-avatar>
```
