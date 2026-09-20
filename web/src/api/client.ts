import axios from 'axios'
import type { ApiResponse } from './types'

export const TOKEN_KEY = 'token'
export const USER_KEY = 'user'

export const client = axios.create({
  baseURL: '/api/v1',
  timeout: 180000,
})

client.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

client.interceptors.response.use(
  (resp) => resp,
  (error) => {
    const status = error.response?.status
    if (status === 401 && !window.location.pathname.startsWith('/login')) {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
      window.location.href = '/login'
    }
    return Promise.reject(error)
  },
)

/** 统一解包 ApiResponse：code 非 0 抛 Error(message) */
export async function request<T>(
  url: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
    params?: Record<string, any>
    data?: any
  } = {},
): Promise<T> {
  const { method = 'GET', params, data } = options
  const resp = await client.request<ApiResponse<T>>({ url, method, params, data })
  const body = resp.data
  if (body.code !== 0) {
    throw new Error(body.message || '请求失败')
  }
  return body.data
}
