import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: { target: 'es2022' },
  // 5173이 이미 점유돼 있으면 조용히 다른 포트로 옮겨가지 않고 즉시 실패한다.
  // 좀비 vite가 5173을 잡고 있는데 사용자는 계속 5173(=좀비)을 열어보느라
  // "dev 서버가 안 열린다"고 며칠 헤맨 적이 있다. 포트를 못 잡으면
  // 시끄럽게 죽는 편이 낫다.
  //
  // host / hmr 은 건드리지 않는다. Vite 5가 localhost를 [::1]로만 바인딩하는 건
  // 기본 동작이고 그대로 정상 작동한다 — IPv6-only 는 그때 원인이 아니었다.
  server: { strictPort: true },
});
