import type { UserConfigExport } from '@tarojs/cli'

export default {
  defineConstants: {
    // 本地演示走 dev.ts 的 localhost:8000；此地址需等域名备案方案（docs/小程序端品牌统一方案.md §5）定下后才可用
    API_BASE_URL: '"http://exam.3hao-ui.cn:8080/api/v1"',
  },
  mini: {},
  h5: {},
} satisfies UserConfigExport<'webpack5'>
