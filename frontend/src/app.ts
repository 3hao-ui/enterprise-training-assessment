import { PropsWithChildren, useEffect } from 'react'
import Taro from '@tarojs/taro'
import { getToken, setToken, setCachedUser, loginByCode } from './services/api'
import './app.scss'

function App({ children }: PropsWithChildren) {
  useEffect(() => {
    // 静默登录：无 token 时自动获取
    if (!getToken()) {
      Taro.login({
        success: async (res) => {
          if (!res.code) return
          try {
            const data = await loginByCode(res.code)
            setToken(data.token)
            setCachedUser(data.user)
          } catch {
            // 登录失败不阻断核心功能
          }
        },
      })
    }
  }, [])

  return children
}

export default App
