import { resolve } from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';

/**
 * electron-vite 多入口配置：
 * - main：Node.js 主进程
 * - preload：注入到渲染进程的桥接脚本
 * - renderer：React 渲染进程（HMR）
 */
export default defineConfig({
  main: {
    // workspace 包必须 exclude 掉，让 vite 把 .ts 源码编进 main bundle。
    // 否则 packaged app 会把 .ts 原样拷进 node_modules/，
    // Electron 内置 Node 拒绝 strip node_modules 下的 .ts 直接 crash。
    plugins: [externalizeDepsPlugin({ exclude: ['@muicv/shared'] })],
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/main/index.ts') },
      },
    },
    resolve: {
      alias: {
        '@main': resolve(__dirname, 'src/main'),
        '@skills': resolve(__dirname, '../../skills'),
      },
    },
    // 把 skill markdown 用 ?raw import 直接编进 main bundle，
    // 避免运行时找文件路径的麻烦
    assetsInclude: ['**/*.md'],
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/preload/index.ts') },
      },
    },
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    plugins: [react()],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src/renderer'),
        '@shared': resolve(__dirname, 'src/shared'),
      },
    },
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/renderer/index.html') },
      },
    },
  },
});
