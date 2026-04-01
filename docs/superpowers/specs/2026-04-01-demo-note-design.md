# Demo Note Design

## Goal

在 `idframework` 仓库内新增一个基于 IDFramework 的链上笔记 demo，目录为 `demo-note/`。该 demo 需要在功能、页面结构、链上协议路径和数据兼容性上复刻参考项目 `/Users/tusm/Downloads/working/2603/idnote-sample`，同时遵循 IDFramework 的 MVC + Command Pattern 约束，使新增能力尽量沉淀到 `idframework/` 目录，供后续应用复用。

## Confirmed Scope

- 完整复刻 `idnote-sample` 当前可用主流程。
- 保持单页应用形态，沿用 IDFramework 的 hash 路由约定。
- 真实兼容参考项目现有链上数据。
- 读写协议路径固定为 `/protocols/simplenote`。
- 兼容参考项目现有 note JSON 结构、附件引用格式和加密字段。
- 复用 IDFramework 现有可复用组件与 command，不在 `demo-note/` 内堆业务组件或命令。

## In Scope Features

- 公开笔记列表。
- 笔记详情页。
- 新建笔记。
- 编辑笔记。
- Markdown 编辑器。
- 附件上传、预览、删除、详情展示。
- 草稿箱与自动保存草稿。
- 我的笔记列表。
- 私密笔记的加密写入与解密查看。
- 作者资料展示和钱包连接流程。

## Out of Scope

- 为所有 demo 重写一套全新的通用路由框架。
- 脱离 `idnote-sample` 的功能扩展，例如协作编辑、评论、收藏、分享统计等。
- 笔记删除链路。参考项目该能力当前本身处于注释状态，因此本次不纳入复刻范围。
- 与笔记无关的全局框架重构。

## Architecture Direction

采用“框架沉淀能力，demo 负责装配”的方式落地：

- `demo-note/` 只负责入口 HTML、应用级样式、服务配置、i18n 文案、路由同步和组件注册。
- `idframework/components/` 新增笔记领域组件。
- `idframework/commands/` 新增笔记领域命令。
- `idframework/utils/` 新增笔记路由、数据适配、Markdown/附件辅助方法。
- `idframework/stores/` 或等价 util 层新增笔记草稿的 IndexedDB 封装。
- 现有通用能力继续复用：`id-connect-button`、`id-userinfo-float-panel`、`id-avatar`、`id-attachments`、`id-image-viewer`、`id-chain-fee-selector`、`GetPinListByPathCommand`、`GetPinDetailCommand`、`FetchUserInfoCommand`、`IDFramework.BuiltInCommands.createPin`。

该拆分保证 `demo-note` 与 `idframework` 解耦，同时把这次开发产生的组件和命令沉淀为可复用资产。

## Application Structure

### demo-note/

`demo-note/` 保持为薄装配层：

- `demo-note/index.html`
  - 单页入口。
  - 引入 `idframework/idframework.js`。
  - 引入 `demo-note/app.js` 与 `demo-note/app.css`。
  - 挂载 `<id-connect-button>`、`<id-userinfo-float-panel>`、`<id-note-shell>`。
- `demo-note/app.js`
  - 初始化 `note`、`draft`、`user` 等 store。
  - 注册笔记域 commands。
  - 注册 note i18n catalogs。
  - 监听 `hashchange` / `popstate` / `DOMContentLoaded`，同步 route 到 store。
  - 加载首屏必要组件。
- `demo-note/app.css`
  - 仅保留 demo-note 页面壳和主题变量。
  - 不承载可复用业务组件样式。

### idframework/

笔记域通用资产全部下沉到框架目录：

- `idframework/components/`
- `idframework/commands/`
- `idframework/utils/`
- `idframework/stores/`
- `idframework/vendors/` 中新增笔记编辑器所需的第三方静态资源

第三方编辑器与渲染依赖不得放到 `demo-note/` 下，以保证后续其他 demo 可直接复用。

## Routing Design

`demo-note` 使用 hash 路由，路径集合与 `idnote-sample` 对齐：

- `/`
- `/mynote`
- `/draft`
- `/note/new`
- `/note/:id`
- `/note/:id/edit`

新增 `idframework/utils/note-route.js`，提供以下能力：

- `normalizeNoteRoutePath(path)`
- `parseNoteRoute(locationLike)`
- `buildNoteRouteUrl(locationLike, nextPath)`
- `getCurrentNoteRouteUrl(locationLike)`
- `resolveNoteRouteMode(locationLike, globalObject)`

路由策略参考 `demo-buzz` 和 `idframework/utils/buzz-route.js` 的现有约定，而不是在 `demo-note/` 中复制一套私有 router。

路由同步后的 store 结构至少包含：

```js
app.route = {
  path: '/note/xxx',
  view: 'detail',
  params: { id: 'xxx' },
  query: {},
}
```

`id-note-shell` 根据 `app.route.view` 或 `note.route.view` 决定渲染哪个笔记视图。

## Store Design

沿用 `wallet`、`app`、`user` 这三个既有 store，并新增两个业务域 store。

### note store

```js
{
  route: { path: '/', view: 'list', params: {}, query: {} },
  publicList: { items: [], cursor: 0, hasMore: true, isLoading: false, error: '' },
  myList: { items: [], cursor: 0, hasMore: true, isLoading: false, error: '' },
  detail: { pinId: '', pin: null, noteData: null, author: null, isLoading: false, error: '' },
  editor: {
    mode: 'create',
    pinId: '',
    form: {
      title: '',
      subtitle: '',
      content: '',
      contentType: 'text/markdown',
      encryption: '0',
      coverImg: '',
      createTime: '',
      tags: [],
      attachments: [],
    },
    existingAttachments: [],
    pendingAttachments: [],
    currentDraftId: null,
    isLoading: false,
    isSaving: false,
    error: '',
  },
}
```

### draft store

```js
{
  items: [],
  currentDraftId: null,
  isLoading: false,
  error: '',
}
```

## Framework Enhancement

当前 `IDFramework.dispatch()` 和 `IDController.execute()` 自动透传的 store 名称是固定的，无法可靠覆盖 `note`、`draft` 这类新增业务域。为保证后续应用都能安全扩展 store，本次同步增强框架：

- `IDFramework.initModels()` 记录所有已注册的自定义 store 名称。
- `IDFramework.dispatch()` 自动收集这些已注册 store。
- `IDController.execute()` 在未显式传入 stores 时，也会把这些已注册 store 一并注入 command。

这样笔记域命令不需要在 `demo-note/app.js` 中手工拼装 stores。

## Note Commands

新增笔记领域命令，保持原子化，不做“大总管” command：

- `SyncNoteRouteCommand`
- `FetchNoteListCommand`
- `FetchMyNoteListCommand`
- `FetchNoteDetailCommand`
- `PrepareNoteEditorCommand`
- `CreateNoteCommand`
- `UpdateNoteCommand`
- `UploadNoteAttachmentCommand`
- `LoadDraftsCommand`
- `LoadDraftByIdCommand`
- `SaveDraftCommand`
- `DeleteDraftCommand`
- `ResolveNoteAuthorCommand`
- `DecryptNoteContentCommand`

复用现有 command：

- `GetPinListByPathCommand`
- `GetPinDetailCommand`
- `FetchUserInfoCommand`
- `CheckWebViewBridgeCommand`
- `CheckBtcAddressSameAsMvcCommand`

## Component Design

### Reused Components

- `id-connect-button`
- `id-userinfo-float-panel`
- `id-avatar`
- `id-attachments`
- `id-image-viewer`
- `id-chain-fee-selector`

### New Framework Components

- `id-note-shell.js`
  - 顶层页面骨架。
  - 根据 route 切换列表、详情、编辑、草稿箱、我的笔记视图。
- `id-note-nav.js`
  - Home / My Note / Draft / New Note 导航。
- `id-note-list.js`
  - 公开列表和我的笔记列表的通用容器。
- `id-note-card.js`
  - 标题、副标题、封面、摘要、作者、时间、标签、附件数量、加密标记。
- `id-note-detail.js`
  - 正文、作者信息、附件列表、编辑入口。
- `id-note-editor.js`
  - 新建与编辑视图总组件。
- `id-note-markdown-editor.js`
  - 封装 Vditor。
- `id-note-markdown-view.js`
  - Markdown 渲染和附件占位符替换。
- `id-note-attachment-picker.js`
  - 本地附件选择、预览、删除。
- `id-note-draft-list.js`
  - 草稿箱列表。
- `id-note-empty-state.js`
  - 统一空态和错误态。

视图组件只读 store、派发 command，不直接写业务逻辑。

## Data Compatibility

### Protocol Path

固定为：

```txt
/protocols/simplenote
```

### Note JSON Shape

创建和编辑时继续写入与参考项目兼容的 JSON：

```json
{
  "title": "",
  "subtitle": "",
  "content": "",
  "contentType": "text/markdown",
  "encryption": "0",
  "coverImg": "",
  "createTime": 0,
  "tags": [],
  "attachments": []
}
```

### Read Compatibility

- 列表兼容 `pin.contentSummary` 为 JSON 字符串或对象。
- 详情兼容通过 pin detail 返回完整 note 数据。
- `attachments` 兼容 `metafile://<pinId>` 与 `metafile://<pinId>.<ext>`。
- `coverImg` 兼容 `metafile://` 格式。

## API Contract Compatibility

为保证与 `idnote-sample` 的行为一致，笔记域读取接口按以下 contract 实现：

- 公开列表
  - `GET /pin/path/list`
  - 参数：`path=/protocols/simplenote`、`cursor`、`size`
- 详情
  - `GET /pin/:numberOrId`
- 我的笔记
  - `GET /address/pin/list/:address`
  - 参数：`path=/protocols/simplenote`、`cursor`、`size`
- 作者资料
  - `GET /info/address/:address`

如果现有通用 command 的 endpoint、返回结构或参数拼装方式与以上 contract 不一致，则以兼容 `idnote-sample` 为优先：

- 能安全复用的继续复用。
- 不能直接复用的新增 note-specific command 或对现有通用 command 做兼容增强。

implementation plan 不得假设 `/pin/:id` 与 `/api/pin/:id` 完全等价，必须在落地时按实际接口结果校验后决定是复用还是扩展。

## Create and Update Rules

### Create

使用 `IDFramework.BuiltInCommands.createPin`：

- `operation: 'create'`
- `path: '/protocols/simplenote'`
- `contentType: 'application/json'`
- `body: JSON.stringify(finalNoteData)`

### Update

使用 `IDFramework.BuiltInCommands.createPin`：

- `operation: 'modify'`
- `path: '@<pinId>'`
- `contentType: 'application/json'`
- `body: JSON.stringify(finalNoteData)`

## Attachment Strategy

附件处理保持与参考项目兼容，但实现抽取为通用框架能力。

### Final Attachment Format

链上最终写入：

```txt
metafile://<pinId>
metafile://<pinId>.<ext>
```

### Editor Temporary Attachment Format

编辑器内临时本地附件沿用：

```txt
metafile://<tempId>
```

保存时统一替换为真实链上 pinId。

### Upload Implementation

不在笔记域重写上传逻辑。复用并抽取 `PostBuzzCommand` 中已经存在的上传能力：

- 小文件直传
- 大文件分片上传
- uploader 异常时 fallback 到 `createPin`
- 自动生成 `metafile://pinId.ext`

本次会把这部分沉淀为可复用上传 helper 或基类，供 `PostBuzzCommand` 和 `UploadNoteAttachmentCommand` 共同使用。

### Existing + New Attachments Merge Rule

编辑已有笔记时，最终 `attachments` 数组必须由以下两部分合并而成：

- 用户保留的旧附件
- 本次新上传的附件

不能覆盖掉未删除的旧附件。

## Markdown Editor and Viewer

### Editor

- 使用 Vditor 作为编辑器。
- 封装在 `id-note-markdown-editor.js` 中。
- 不允许把 Vditor 的初始化、事件绑定、上传 handler 直接写在 `demo-note/app.js`。

### Viewer

- 详情页正文使用独立的 Markdown 渲染组件。
- 需要支持将正文中的 `metafile://<temp or pinId>` 占位符替换为可访问的附件 URL。
- 该替换逻辑必须抽成 util，避免分散在多个组件中。

## Encryption Strategy

### Write Behavior

默认私密笔记写入采用 `window.metaidwallet.eciesEncrypt`，并写入：

- `encryption = '1'`

### Read Compatibility

兼容两类历史数据：

- `encryption = '1'`：通过 `eciesDecrypt` 解密
- `encryption = 'aes'`：通过签名密钥 + GCM 解密

### Ownership Rule

- 只有笔记作者本人尝试解密正文。
- 非作者查看加密笔记时显示“此笔记内容已加密”或同等提示，不把失败当成页面级错误。
- 编辑加密笔记时，若解密失败，则阻止进入可编辑状态并返回列表页或提示不可编辑。

## Draft Strategy

草稿箱使用原生 IndexedDB 封装，不引入 Dexie 作为运行时依赖。

### Draft Data

草稿至少保存：

- `title`
- `subtitle`
- `coverImg`
- `content`
- `tags`
- `pinId`
- `updatedAt`
- `createdAt`

### Draft Media Data

对本地待上传附件单独建表，保存：

- `draftId`
- `blobUrl`
- `file`
- `type`
- `name`
- `mediaId`
- `pinId`
- `createdAt`

### Draft Behavior

- 编辑器每隔固定时间自动保存。
- 新建页优先恢复最近一个未关联 pinId 的草稿。
- 编辑页优先恢复与当前 pinId 绑定的草稿。
- 草稿箱支持按 `draftId` 打开特定草稿。
- 发布成功后删除对应草稿。

## Error Handling

### User Facing

- 列表、详情、我的笔记、草稿箱提供统一空态、错误态和重试入口。
- 编辑页区分以下失败场景：
  - 编辑器初始化失败
  - 附件上传失败
  - 笔记保存失败
  - 加密或解密失败
- 离开编辑页时，如果存在未保存修改，优先自动保存草稿或提示确认。

### Developer Facing

- 组件只做展示和事件派发。
- command 负责设置 store 中的 `error` 字段，并输出带上下文的日志。
- JSON 解析、附件 URL 处理、加密分支判断、占位符替换等逻辑收敛到 utils，不散落在 DOM 组件中。

## UI Direction

页面结构尽量贴近 `idnote-sample`：

- 顶部导航保留 Home / My Note / Draft / New Note。
- 主体内容居中，桌面宽度接近参考项目的阅读宽度。
- 列表卡片优先展示标题、副标题、封面、摘要、作者、时间和标签。
- 移动端保持单列，不引入复杂多栏布局。

视觉上允许适度贴合 IDFramework 现有组件的主题变量与 Web Component 风格，但不能偏离参考项目的信息结构和核心交互。

## i18n

新组件沿用 `IDFramework.I18n`。

- 至少提供 `zh` 和 `en` catalogs。
- 文案语义对齐 `idnote-sample` 的中文体验。
- demo-note 页面标题、按钮、空态、错误态均由 i18n 输出，不写死在业务组件中。

## Testing Strategy

沿用仓库当前 `node:test` 风格，新增测试覆盖三层。

### Framework

- `IDFramework.dispatch` 能自动透传 `note`、`draft` 等新 store。
- `IDController.execute` 在未显式传 stores 时，也能拿到这些 store。

### Utils and Commands

- `note-route.js` 路由解析与 URL 构造。
- note 列表解析。
- note 详情解析。
- 创建与更新命令写入正确协议路径。
- 附件上传命令返回正确 `metafile://pinId.ext`。
- 解密命令兼容 `1` 和 `aes`。
- 草稿保存、覆盖、删除、恢复。

### Components

- `id-note-card` 渲染主要元信息。
- `id-note-list` 的空态、加载态、分页态。
- `id-note-detail` 的 Markdown 与附件渲染。
- `id-note-shell` 的 route-to-view 选择。
- `id-note-attachment-picker` 的本地预览与删除。

## Deliverables

本次设计对应的最终交付包括：

- 新增 `demo-note/` 单页笔记 demo。
- 新增一套位于 `idframework/` 的笔记领域可复用组件。
- 新增一套位于 `idframework/` 的笔记领域 commands。
- 新增 note route util、note data adapter、draft IndexedDB 封装。
- 对 IDFramework 做自定义 store 自动透传增强。
- 对现有上传能力做提取，使笔记和 buzz 复用同一套文件上传逻辑。
- 对应的测试用例。

## Implementation Constraints

- 严格遵循 IDFramework 的 View / Command / Store 分层。
- 业务逻辑不进入 Web Component 视图层。
- 新增可复用组件和 commands 必须放在 `idframework/` 对应目录。
- `demo-note/` 不持有仅自己可用的业务组件和命令实现。
- 不为本次任务引入与需求无关的框架级重构。

## Planning Readiness

该设计面向单一实现计划，范围聚焦在一个新 demo 和其配套的框架级笔记能力，不拆成多个独立子项目。后续 implementation plan 应按以下顺序展开：

1. 框架基础增强与 route/store 基建。
2. 通用上传与草稿能力沉淀。
3. note commands 与 utils。
4. note components。
5. demo-note 装配。
6. 测试与回归验证。
