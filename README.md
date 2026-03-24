# IDFramework - MetaWeb 微框架

> 一个专为 MetaID 协议设计的轻量级、去中心化 SPA 框架  
> 基于 Alpine.js 响应式系统和 Command Pattern 数据驱动架构

## 📋 目录

- [概述](#概述)
- [核心设计哲学](#核心设计哲学)
- [架构说明](#架构说明)
- [快速开始](#快速开始)
- [API 文档](#api-文档)
- [组件开发规范](#组件开发规范)
- [命令开发规范](#命令开发规范)
- [项目结构](#项目结构)
- [最佳实践](#最佳实践)

---

## 概述

**IDFramework** 是一个专为 MetaWeb（基于 MetaID 协议的全链互联网）应用设计的微框架。它遵循 Cairngorm MVC 架构思想，采用 Command Pattern 实现业务逻辑的原子化，通过 Alpine.js 实现响应式数据绑定。

### 核心特性

- ✅ **No-Build 架构**：纯原生 ES 模块，无需编译步骤
- ✅ **单数据源（Single Source of Truth）**：所有应用状态集中在 Model 层
- ✅ **响应式系统**：基于 Alpine.js 的自动数据绑定
- ✅ **命令模式**：业务逻辑原子化，易于复用和测试
- ✅ **组件化**：基于 Web Components 的视图层
- ✅ **主题系统**：CSS Variables 实现结构与皮肤分离
- ✅ **链上存储**：所有文件最终可存储在区块链上

### 技术栈

- **响应式系统**：Alpine.js (CDN)
- **样式系统**：UnoCSS Runtime (CDN)
- **组件系统**：Native Web Components (Custom Elements)
- **架构模式**：Command Pattern + MVC

---

## 核心设计哲学

### 1. Single Source of Truth（单一数据源）

整个应用的状态都存储在全局单例 Model 层中，View 直接绑定到 Model 的属性。当 Model 变化时，View 自动更新，消除了组件间传递数据的复杂性。

```javascript
// Model 层定义
Alpine.store('buzz', {
  list: [],
  isLoading: false,
  error: null,
});

// View 层绑定
<div x-show="$store.buzz.isLoading">Loading...</div>
```

### 2. View 是"愚蠢"的

View 层只负责：
- **展示数据**：从 Model 绑定数据并渲染
- **派发事件**：用户交互时派发事件，不处理业务逻辑

业务逻辑全部放在 Command 中，View 不包含复杂的业务判断。

### 3. 关注点分离（Separation of Concerns）

- **View 层**：界面展示和用户交互
- **Model 层**：应用状态管理
- **Command 层**：业务逻辑原子化
- **Delegate 层**：服务通信抽象

### 4. 事件驱动架构

组件之间不直接通信，而是通过事件来触发系统行为：

```
View -> Event -> IDController -> Command -> Delegate -> Model -> View (Binding)
```

### 5. 逻辑原子化

每个业务操作（如登录、创建 PIN）都是一个独立的 Command，易于：
- **复用**：同一 Command 可在多处使用
- **测试**：独立测试业务逻辑
- **维护**：修改不影响其他逻辑

---

## 架构说明

### 数据流向

```
┌─────────┐      ┌──────────────┐      ┌──────────┐      ┌─────────────┐      ┌────────┐      ┌─────────┐
│  View   │─────>│  IDController │─────>│ Command  │─────>│ Business    │─────>│ Model  │─────>│  View   │
│ (组件)  │事件  │   (控制器)    │      │ (命令)   │      │ Delegate    │      │ (状态) │绑定  │ (更新)  │
└─────────┘      └──────────────┘      └──────────┘      └─────────────┘      └────────┘      └─────────┘
```

### 架构层次

#### 1. Model 层（数据层）

**位置**：`app.js` 或通过 `IDFramework.initModels()` 初始化

**内置 Models**：
- `wallet`：钱包连接状态和用户信息
  ```javascript
  {
    isConnected: false,
    address: null,
    metaid: null,
    publicKey: null,
    network: null, // 'mainnet' | 'testnet'
  }
  ```

- `app`：应用级全局状态
  ```javascript
  {
    isLogin: false,
    userAddress: null,
  }
  ```

**自定义 Models**：应用可以在初始化时注册自定义 Model

```javascript
IDFramework.init({
  buzz: { list: [], isLoading: false },
  user: { name: '', email: '' },
});
```

#### 2. Controller 层（控制层）

**位置**：`idframework/idframework.js` - `IDFramework.IDController`

**职责**：
- 映射事件到 Command
- 支持异步懒加载 Command 文件
- 管理内置 Command 和文件 Command

**内置 Commands**：
- `connectWallet`：连接 Metalet 钱包
- `createPIN`：创建并广播 PIN 到链上（当前为 Mock 实现）

#### 3. Command 层（业务逻辑层）

**位置**：`/idframework/commands/` 目录

**职责**：
- 执行具体的业务逻辑
- 调用 BusinessDelegate 获取数据
- 使用 DataAdapter 转换数据格式
- 更新 Model 层

**Command 结构**：
```javascript
export default class MyCommand {
  async execute({ payload, stores, delegate }) {
    // 1. 业务逻辑处理
    // 2. 调用 delegate 获取数据
    // 3. 使用 dataAdapter 转换数据
    // 4. 更新 stores
  }
  
  dataAdapter(rawData) {
    // 将原始数据转换为 Model 格式
  }
}
```

#### 4. Delegate 层（服务代理层）

**位置**：`idframework/idframework.js` - `IDFramework.Delegate`

**职责**：
- 抽象远程服务通信的复杂性
- 处理 HTTP 请求和响应
- 错误处理
- 返回原始 JSON 数据给 Command

#### 5. View 层（视图层）

**位置**：`/idframework/components/` 目录

**职责**：
- 展示数据（从 Model 绑定）
- 派发事件（用户交互）
- 不包含业务逻辑

**组件规范**：
- 命名：以 `id-` 开头（如 `id-buzz-card.js`）
- 使用 Shadow DOM
- 使用 CSS Variables 进行主题化
- 添加 `part` 属性支持外部样式覆盖

---

## 快速开始

### 1. 项目结构

```
your-metaid-app/
├── index.html          # 应用入口页面
├── app.js              # 应用配置和初始化
├── app.css             # 全局样式和主题变量
└── idframework/         # 框架目录（可整体复用）
    ├── idframework.js   # 框架核心（必须）
    ├── components/      # 视图组件目录
    │   ├── id-buzz-card.js
    │   ├── id-buzz-tabs.js
    │   ├── id-connect-button.js
    │   └── ...
    ├── commands/        # 业务命令目录
    │   ├── FetchBuzzCommand.js
    │   ├── PostBuzzCommand.js
    │   └── ...
    ├── stores/          # 可复用 store（按需）
    ├── utils/           # 通用工具（按需）
    └── vendors/         # 三方依赖（按需）
```

### 2. 基础设置

#### index.html

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>My MetaID App</title>
  
  <!-- Alpine.js -->
  <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>
  
  <!-- UnoCSS Runtime -->
  <script>
    window.__unocss = { theme: {}, shortcuts: {}, rules: [] };
  </script>
  <script type="module" src="https://cdn.jsdelivr.net/npm/@unocss/runtime"></script>

  <!-- 推荐：使用 importmap 为框架做别名 -->
  <script type="importmap">
    {
      "imports": {
        "@idf/": "./idframework/"
      }
    }
  </script>
  
  <!-- 应用样式 -->
  <link rel="stylesheet" href="app.css">
</head>
<body>
  <!-- 你的应用内容 -->
  <div x-data>
    <!-- 使用组件 -->
    <id-buzz-card content="Hello" author="user123" txid="abc123"></id-buzz-card>
  </div>

  <!-- 框架核心 -->
  <script type="module" src="./idframework/idframework.js"></script>
  
  <!-- 应用配置 -->
  <script type="module" src="app.js"></script>
</body>
</html>
```

#### app.js

```javascript
// ServiceLocator - 定义服务端点
window.ServiceLocator = {
  metaid_man: 'https://manapi.metaid.io',
};

// 自定义 Model
const MyModel = {
  data: [],
  isLoading: false,
};

// 初始化框架
window.addEventListener('alpine:init', () => {
  IDFramework.init({
    myModel: MyModel,
  });
});

// 注册命令
window.addEventListener('DOMContentLoaded', async () => {
  IDFramework.IDController.register('fetchData', '@idf/commands/FetchDataCommand.js');
  
  // 启动任务
  await IDFramework.dispatch('fetchData');
});
```

#### app.css

```css
:root {
  /* 主题变量 */
  --id-color-primary: #3b82f6;
  --id-bg-card: #ffffff;
  --id-text-main: #1f2937;
  /* ... */
}

@media (prefers-color-scheme: dark) {
  :root {
    /* 深色模式变量 */
  }
}
```

### 3. 创建组件

在 `/idframework/components/` 目录下创建组件文件：

```javascript
// idframework/components/id-my-component.js
class IdMyComponent extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  static get observedAttributes() {
    return ['content', 'author'];
  }

  connectedCallback() {
    this.render();
  }

  render() {
    const content = this.getAttribute('content') || '';
    
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }
        .card {
          background-color: var(--id-bg-card, #fff);
          padding: var(--id-spacing-md, 1rem);
        }
      </style>
      <div part="card-container" class="card">
        ${this.escapeHtml(content)}
      </div>
    `;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

customElements.define('id-my-component', IdMyComponent);
```

### 4. 创建命令

在 `/idframework/commands/` 目录下创建命令文件：

```javascript
// idframework/commands/FetchDataCommand.js
export default class FetchDataCommand {
  async execute({ payload = {}, stores, delegate }) {
    const store = stores.myModel;
    
    store.isLoading = true;
    
    try {
      // 使用 BusinessDelegate 获取数据
      const rawData = await delegate('metaid_man', '/api/endpoint');
      
      // 使用 DataAdapter 转换数据
      const parsedData = this.dataAdapter(rawData);
      
      // 更新 Model
      store.data = parsedData;
      store.isLoading = false;
    } catch (error) {
      store.error = error.message;
      store.isLoading = false;
    }
  }

  dataAdapter(rawData) {
    // 转换原始数据为 Model 格式
    return rawData.map(item => ({
      id: item.id,
      content: item.content,
    }));
  }
}
```

---

## 路由系统（Routing System）

### Hash-based 路由策略

IDFramework 使用 **Hash-based Routing**（基于哈希的路由）来实现单页应用（SPA）的页面导航。

#### 为什么使用 Hash Routing？

1. **部署无关性**：Hash routing 不需要服务器配置，可以在任何静态文件服务器上运行
2. **子目录支持**：应用可以部署在 `https://example.com/my-app/#/home` 这样的子目录中
3. **简单可靠**：不依赖 HTML5 History API，兼容性更好

#### 路由格式

- **基础路由**：`#/home`、`#/profile`、`#/buzz`
- **参数路由**：`#/profile/:id`、`#/buzz/:txid`
- **查询参数**：`#/search?q=keyword`

#### 路由状态管理

路由状态存储在 `Alpine.store('app')` 中：

```javascript
{
  currentView: 'home',        // 当前视图名称
  routeParams: { id: '123' }, // 路由参数
  routeHistory: []            // 路由历史（可选）
}
```

#### 导航方式

**1. 程序化导航（推荐）**

```javascript
// 使用框架的路由器
await IDFramework.router.push('/home');
await IDFramework.router.push('/profile/123');
```

**2. 直接修改 Hash**

```javascript
// 直接设置 hash，会触发 ROUTE_CHANGE 事件
window.location.hash = '#/home';
```

#### 路由命令处理

所有路由变化都由路由 Command（如 `MapsCommand` 或 `RouteCommand`）处理：

```javascript
// idframework/commands/MapsCommand.js
export default class MapsCommand {
  async execute({ payload, stores, delegate }) {
    const route = payload.route || '/home';
    const routeMap = {
      '/home': 'id-home-page',
      '/profile': 'id-profile-page',
      '/buzz': 'id-buzz-feed',
    };
    
    const componentName = routeMap[route];
    if (componentName) {
      // 动态加载组件
      await IDFramework.loadComponent(`@idf/components/${componentName}.js`);
      
      // 更新当前视图
      stores.app.currentView = componentName.replace('id-', '').replace('-page', '');
    }
  }
}
```

#### 视图切换模式

在 `index.html` 中使用 Alpine.js 的 `x-if` 指令根据 `currentView` 切换视图：

```html
<template x-if="$store.app.currentView === 'home'">
  <id-home-page></id-home-page>
</template>

<template x-if="$store.app.currentView === 'profile'">
  <id-profile-page></id-profile-page>
</template>

<template x-if="$store.app.currentView === 'buzz-feed'">
  <id-buzz-feed></id-buzz-feed>
</template>
```

#### 创建新页面步骤

**步骤 1：创建页面组件**

在 `./idframework/components/` 目录下创建组件文件，例如 `id-new-page.js`：

```javascript
class IdNewPage extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        .page { padding: 1rem; }
      </style>
      <div class="page">
        <h1>New Page</h1>
        <p>This is a new page component.</p>
      </div>
    `;
  }
}

customElements.define('id-new-page', IdNewPage);
```

**步骤 2：在 app.js 中注册路由**

```javascript
// app.js
const routeMap = {
  '/home': 'id-home-page',
  '/new-page': 'id-new-page',  // 新增路由
};

// 注册路由命令
IDFramework.IDController.register('routeChange', '@idf/commands/MapsCommand.js');
```

**步骤 3：在路由命令中添加组件加载逻辑**

```javascript
// idframework/commands/MapsCommand.js
async execute({ payload, stores, delegate }) {
  const route = payload.route;
  const componentName = routeMap[route];
  
  if (componentName) {
    // 动态加载组件
    await IDFramework.loadComponent(`@idf/components/${componentName}.js`);
    
    // 更新视图状态
    stores.app.currentView = componentName.replace('id-', '').replace('-page', '');
  }
}
```

**步骤 4：在 index.html 中添加模板**

```html
<template x-if="$store.app.currentView === 'new-page'">
  <id-new-page></id-new-page>
</template>
```

**步骤 5：导航到新页面**

```javascript
// 在组件或命令中
await IDFramework.router.push('/new-page');
```

---

## API 文档

### IDFramework 核心 API

#### `IDFramework.init(customModels)`

初始化框架，注册内置 Models 和自定义 Models。

**参数**：
- `customModels` {Object} - 自定义 Model 对象，键为 Model 名称，值为初始状态

**示例**：
```javascript
IDFramework.init({
  user: { name: '', email: '' },
  settings: { theme: 'light' },
});
```

#### `IDFramework.initModels(customModels)`

仅初始化 Model 层（通常由 `init()` 内部调用）。

#### `IDFramework.Delegate.BusinessDelegate(serviceKey, endpoint, options)`

业务代理方法，用于与远程服务通信。

**参数**：
- `serviceKey` {string} - ServiceLocator 中的服务键
- `endpoint` {string} - API 端点路径
- `options` {Object} - Fetch 选项（method, headers, body 等）

**返回**：`Promise<Object>` - 原始 JSON 响应

**示例**：
```javascript
const data = await IDFramework.Delegate.BusinessDelegate('metaid_man', '/pin/path/list', {
  method: 'GET',
});
```

#### `IDFramework.Delegate.UserDelegate(serviceKey, endpoint, options)`

用户相关 API 通信方法，用于获取用户头像、个人信息等。

**参数**：
- `serviceKey` {string} - ServiceLocator 中的服务键
- `endpoint` {string} - API 端点路径
- `options` {Object} - Fetch 选项（method, headers, body 等）

**返回**：`Promise<Object>` - 原始 JSON 响应

**示例**：
```javascript
const avatarData = await IDFramework.Delegate.UserDelegate('metaid_man', '/user/avatar', {
  method: 'GET',
});
```

**注意**：此方法当前未实现，待后续完善。

#### `IDFramework.IDController.register(eventName, commandPathOrFunction)`

注册事件到 Command 的映射。

**参数**：
- `eventName` {string} - 事件名称
- `commandPathOrFunction` {string|Function} - Command 文件路径或内置函数

**示例**：
```javascript
// 注册文件 Command
IDFramework.IDController.register('fetchBuzz', '@idf/commands/FetchBuzzCommand.js');

// 注册内置 Command
IDFramework.IDController.registerBuiltIn('customCommand', myFunction);
```

#### `IDFramework.IDController.execute(eventName, payload, stores)`

执行指定事件的 Command。

**参数**：
- `eventName` {string} - 事件名称
- `payload` {Object} - 事件载荷数据
- `stores` {Object} - Alpine stores 对象（可选，会自动解析）

**返回**：`Promise<void>`

#### `IDFramework.dispatch(eventName, payload, storeName)`

派发事件的便捷方法（供 View 使用）。

**参数**：
- `eventName` {string} - 事件名称
- `payload` {Object} - 事件载荷
- `storeName` {string} - 可选的特定 store 名称

**示例**：
```javascript
// 在组件中
await IDFramework.dispatch('fetchBuzz', { cursor: 0, size: 30 });
```

### 内置 Commands

#### `connectWallet`

连接 Metalet 钱包。

**使用**：
```javascript
await IDFramework.dispatch('connectWallet');
```

**更新 Stores**：
- `wallet.isConnected = true`
- `wallet.address = <用户地址>`
- `app.isLogin = true`
- `app.userAddress = <用户地址>`

#### `createPIN`

创建并广播 PIN 到区块链（当前为 Mock 实现）。

**参数**：
```javascript
{
  content: string,      // PIN 内容
  path: string,        // PIN 路径（默认：'/protocols/simplebuzz'）
  contentType: string, // 内容类型（默认：'application/json;utf-8'）
}
```

**使用**：
```javascript
const pinResult = await IDFramework.BuiltInCommands.createPIN({
  payload: {
    content: 'Hello MetaID',
    path: '/protocols/simplebuzz',
  },
  stores: {
    wallet: Alpine.store('wallet'),
    app: Alpine.store('app'),
  },
});
```

---

## 组件开发规范

### 组件命名规范

- 所有组件文件名必须以 `id-` 开头
- 使用 kebab-case 命名（如 `id-buzz-card.js`）
- 对应的自定义元素标签名与文件名一致（如 `<id-buzz-card>`）

### 组件结构

```javascript
class IdMyComponent extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  static get observedAttributes() {
    return ['prop1', 'prop2']; // 需要观察的属性
  }

  connectedCallback() {
    this.render();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue) {
      this.render();
    }
  }

  render() {
    // 使用 CSS Variables 进行主题化
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }
        .container {
          background-color: var(--id-bg-card, #fff);
          padding: var(--id-spacing-md, 1rem);
        }
      </style>
      <div part="container" class="container">
        <!-- 组件内容 -->
      </div>
    `;
  }
}

customElements.define('id-my-component', IdMyComponent);
```

### 组件输入输出规范

#### 输入（Props）

通过 HTML 属性传递：

```html
<id-buzz-card 
  content="Hello World" 
  author="user123" 
  txid="abc123"
></id-buzz-card>
```

#### 输出（Events）

通过自定义事件派发：

```javascript
// 在组件内部
this.dispatchEvent(new CustomEvent('buzz-clicked', {
  detail: { txid: 'abc123' },
  bubbles: true
}));
```

#### 与框架交互

组件可以直接调用框架方法：

```javascript
// 在组件方法中
async handleAction() {
  await window.IDFramework.dispatch('myCommand', { data: 'value' });
}
```

### 主题化要求

1. **使用 CSS Variables**：所有样式值使用 `var(--id-*, fallback)` 格式
2. **提供回退值**：确保组件在没有 `app.css` 时也能正常显示
3. **添加 part 属性**：允许外部通过 `::part()` 选择器覆盖样式

```javascript
<div part="card-container" class="card">
  <!-- 内容 -->
</div>
```

外部样式覆盖：
```css
id-buzz-card::part(card-container) {
  border: 2px solid red;
}
```

---

## 命令开发规范

### Command 文件结构

```javascript
/**
 * MyCommand - 业务逻辑描述
 * 
 * Command Pattern implementation following IDFramework architecture.
 * 
 * @class MyCommand
 */
export default class MyCommand {
  /**
   * Execute the command
   * 
   * @param {Object} params - Command parameters
   * @param {Object} params.payload - Event payload
   * @param {Object} params.stores - Alpine stores object
   *   - wallet: {Object} - Wallet store
   *   - app: {Object} - App store
   *   - [customStore]: {Object} - Custom stores
   * @param {Function} params.delegate - BusinessDelegate function
   * @returns {Promise<void>}
   */
  async execute({ payload = {}, stores, delegate }) {
    // 1. 业务逻辑处理
    // 2. 调用 delegate 获取数据
    const rawData = await delegate('serviceKey', '/endpoint');
    
    // 3. 使用 DataAdapter 转换数据
    const parsedData = this.dataAdapter(rawData);
    
    // 4. 更新 Model
    stores.myModel.data = parsedData;
  }

  /**
   * DataAdapter - 转换原始数据为 Model 格式
   * 
   * @param {Object} rawData - BusinessDelegate 返回的原始数据
   * @returns {Object|Array} Model 格式的数据
   */
  dataAdapter(rawData) {
    // 数据转换逻辑
    return transformedData;
  }
}
```

### Command 执行流程

1. **接收参数**：从 `payload` 获取事件数据
2. **调用 Delegate**：使用 `delegate()` 获取远程数据
3. **数据转换**：使用 `dataAdapter()` 转换数据格式
4. **更新 Model**：直接修改 `stores` 中的 Model 状态

### 错误处理

```javascript
async execute({ payload, stores, delegate }) {
  const store = stores.myModel;
  store.isLoading = true;
  store.error = null;

  try {
    // 业务逻辑
  } catch (error) {
    store.error = error.message || '操作失败';
    console.error('Command error:', error);
  } finally {
    store.isLoading = false;
  }
}
```

---

## 项目结构

### 标准目录结构

```
metaid-app/
├── index.html              # 应用入口页面
├── app.js                  # 应用配置、ServiceLocator、Model 定义、命令注册
├── app.css                 # 全局样式、CSS Variables 主题系统
└── idframework/
    ├── idframework.js      # 框架核心（必须）
    ├── components/         # 视图组件目录
    │   ├── id-buzz-card.js
    │   ├── id-buzz-tabs.js
    │   ├── id-connect-button.js
    │   ├── id-post-buzz-panel.js
    │   └── ...             # 更多组件
    ├── commands/           # 业务命令目录
    │   ├── FetchBuzzCommand.js
    │   ├── PostBuzzCommand.js
    │   └── ...             # 更多命令
    ├── stores/
    ├── utils/
    └── vendors/
```

### 文件职责说明

| 文件 | 职责 |
|------|------|
| `index.html` | 应用入口，引入依赖，定义页面结构 |
| `app.js` | 应用配置、ServiceLocator、Model 定义、命令注册、启动逻辑 |
| `app.css` | 全局样式、CSS Variables 主题系统、深色模式支持 |
| `idframework/idframework.js` | 框架核心：Model 层、Controller 层、BusinessDelegate 层、内置 Commands |
| `idframework/components/*.js` | 视图组件：展示数据、派发事件 |
| `idframework/commands/*.js` | 业务命令：业务逻辑、数据转换、Model 更新 |

---

## 最佳实践

### 1. Model 设计

- **单一职责**：每个 Model 只管理一个业务域的数据
- **扁平结构**：避免过深的嵌套
- **初始状态**：明确定义所有属性的初始值

```javascript
const UserModel = {
  profile: {
    name: '',
    email: '',
  },
  preferences: {
    theme: 'light',
    language: 'zh-CN',
  },
};
```

### 2. Command 设计

- **原子化**：一个 Command 只做一件事
- **可复用**：不依赖特定的 View
- **数据转换**：使用 DataAdapter 分离数据格式转换逻辑

### 3. 组件设计

- **纯展示**：组件只负责展示，不包含业务逻辑
- **事件派发**：用户交互时派发事件，不直接调用 Command
- **属性验证**：在 `attributeChangedCallback` 中验证属性值

### 4. 样式设计

- **CSS Variables**：所有主题相关的值使用变量
- **回退值**：始终提供回退值
- **Part 属性**：为需要外部覆盖的元素添加 `part` 属性

### 5. 错误处理

- **Model 中存储错误**：错误信息存储在 Model 的 `error` 属性中
- **View 显示错误**：View 绑定到 `$store.xxx.error` 显示错误
- **Command 中捕获**：在 Command 的 try-catch 中处理错误

---

## 开发工作流

### 1. 创建新功能

1. **定义 Model**（如需要）：在 `app.js` 中添加新的 Model
2. **创建 Command**：在 `/idframework/commands/` 中创建业务逻辑
3. **注册 Command**：在 `app.js` 中注册命令
4. **创建组件**：在 `/idframework/components/` 中创建视图组件
5. **在页面中使用**：在 `index.html` 中使用组件

### 2. 创建新页面（带路由）

1. **创建页面组件**：在 `/idframework/components/` 中创建页面组件（如 `id-new-page.js`）
2. **注册路由**：在 `app.js` 的 `routeMap` 中添加路由映射（如 `'/new-page': 'id-new-page'`）
3. **更新路由命令**：在路由 Command（如 `MapsCommand`）中添加组件加载逻辑，使用 `IDFramework.loadComponent()` 动态加载组件
4. **添加模板**：在 `index.html` 中添加 `<template x-if="$store.app.currentView === 'new-page'"><id-new-page></id-new-page></template>`
5. **测试导航**：使用 `IDFramework.router.push('/new-page')` 或 `window.location.hash = '#/new-page'` 测试导航

### 2. 调试技巧

- **查看 Model 状态**：在浏览器控制台使用 `Alpine.store('modelName')`
- **查看事件**：在组件中添加 `console.log` 查看事件派发
- **查看 Command 执行**：在 Command 的 `execute` 方法中添加日志

### 3. 性能优化

- **懒加载**：Command 文件支持懒加载，减少初始加载时间
- **按需更新**：只更新 Model 中变化的部分
- **事件防抖**：对于频繁触发的事件，使用防抖处理

---

## 示例：完整应用流程

### 场景：用户发布一条 Buzz

1. **用户操作**：在 `<id-post-buzz-panel>` 中输入内容，点击 "Post"

2. **组件派发事件**：
   ```javascript
   // id-post-buzz-panel.js
   await IDFramework.dispatch('postBuzz', { content: 'Hello' });
   ```

3. **Controller 路由**：
   ```javascript
   // idframework/idframework.js - IDController
   IDController.execute('postBuzz', { content: 'Hello' });
   ```

4. **Command 执行**：
   ```javascript
   // idframework/commands/PostBuzzCommand.js
   async execute({ payload, stores, delegate }) {
     // 使用内置 createPIN
     const pin = await IDFramework.BuiltInCommands.createPIN({...});
     // 更新 Model
     stores.buzz.list = [newBuzz, ...stores.buzz.list];
   }
   ```

5. **Model 更新**：
   ```javascript
   // Alpine store 自动更新
   Alpine.store('buzz').list = [newBuzz, ...oldList];
   ```

6. **View 自动更新**：
   ```html
   <!-- index.html -->
   <template x-for="buzz in $store.buzz.list">
     <id-buzz-card :content="buzz.content"></id-buzz-card>
   </template>
   ```

---

## 常见问题

### Q: 如何添加新的 Model？

A: 在 `app.js` 的 `IDFramework.init()` 调用中添加：

```javascript
IDFramework.init({
  myNewModel: { data: [], isLoading: false },
});
```

### Q: 如何在组件中访问 Model？

A: 在 Alpine.js 模板中使用 `$store.modelName`：

```html
<div x-text="$store.buzz.list.length"></div>
```

### Q: 如何创建自定义 Command？

A: 在 `/idframework/commands/` 目录创建文件，实现 `execute` 方法，然后在 `app.js` 中注册。

### Q: 组件如何与框架通信？

A: 组件可以直接调用 `IDFramework.dispatch()` 派发事件。

---

## 贡献指南

IDFramework 是一个开放的微框架，欢迎贡献：

1. **组件贡献**：将通用组件提交到组件库
2. **命令贡献**：将通用业务逻辑封装为 Command
3. **文档改进**：完善文档和示例

---

## 许可证

MIT License

---

## 相关资源

- [MetaID Protocol](https://metaid.io)
- [Alpine.js 文档](https://alpinejs.dev)
- [UnoCSS 文档](https://unocss.dev)
- [Web Components 规范](https://developer.mozilla.org/en-US/docs/Web/Web_Components)

---

**IDFramework** - 让 MetaWeb 应用开发更简单 🚀
