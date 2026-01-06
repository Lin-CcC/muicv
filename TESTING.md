# TESTING

## 环境要求

- Node.js >= 24
- pnpm（见根目录 `package.json` 的 `packageManager`）

## 安装依赖

在仓库根目录执行：

```bash
pnpm install
```

## 运行测试

目前测试主要来自：

- `packages/shared`：领域类型/工具的 smoke test
- `packages/app`：服务端内存存储（对话数据）相关单测

测试使用 Node 内置 test runner。

```bash
pnpm test
```

如果只跑某个包：

```bash
pnpm --filter @muicv/shared test
```

## 启动开发服务器

应用（对话 + 简历）：

```bash
pnpm dev:app
```

官网：

```bash
pnpm dev:website
```

## 说明

- 目前处于 M0 骨架阶段，尚未引入端到端测试；后续在对话/抽取闭环落地后补齐。
