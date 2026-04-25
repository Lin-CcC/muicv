// 让 TypeScript 接受 vite 的 ?raw import（用来把 skill md 直接 inline 进 bundle）
declare module '*.md?raw' {
  const content: string;
  export default content;
}
