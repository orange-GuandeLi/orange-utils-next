# orange-utils - 开发者工具箱

一套实用的开发者工具集合，基于 Next.js 构建。

## 功能工具

- **HTML 选择器** - 可视化选择 HTML 元素
- **API 请求** - 发送 HTTP 请求，支持模板变量
- **代码对比** - 对比两份代码，高亮差异
- **正则测试** - 实时测试正则表达式
- **资源管理** - 统一管理所有工具保存的数据

## 开发

```bash
# 安装依赖
bun install

# 启动开发服务器
bun run dev

# 构建
bun run build
```

## 部署

### 使用 PM2

```bash
# 构建项目
bun run build

# 启动 PM2
bun run pm2:start

# 常用命令
bun run pm2:stop      # 停止
bun run pm2:restart   # 重启
bun run pm2:logs      # 查看日志
bun run pm2:status    # 查看状态
```

### 手动启动

```bash
# 构建
bun run build

# 启动生产服务器
bun run start
```

## 技术栈

- Next.js 16 (App Router)
- React 19
- TypeScript
- HeroUI v3
- Tailwind CSS v4
- CodeMirror 6

## 项目结构

```
src/
├── app/                    # Next.js App Router
│   ├── layout.tsx         # 主布局
│   ├── page.tsx           # 首页（重定向）
│   └── tools/             # 工具页面
├── components/            # 共享组件
├── tools/                 # 工具组件
│   ├── html-selector/
│   ├── api-request/
│   ├── code-compare/
│   ├── regex-tester/
│   └── resource-manager/
└── utils/                 # 工具函数
```

## 环境变量

无需配置环境变量，所有数据存储在浏览器 IndexedDB 中。

## 许可证

MIT
