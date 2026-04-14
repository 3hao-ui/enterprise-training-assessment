import Taro from '@tarojs/taro'

const BASE_URL = 'http://localhost:8000/api/v1'

const TOKEN_KEY = 'token'
const USER_KEY = 'userInfo'

/* ---- 登录就绪机制：确保页面在登录完成后再请求需要鉴权的接口 ---- */
let _loginResolve: () => void
const _loginReady = new Promise<void>((resolve) => { _loginResolve = resolve })

/** 等待登录流程完成（无论成功或失败） */
export function waitForLogin(): Promise<void> { return _loginReady }

/** 标记登录流程已结束 */
export function resolveLogin() { _loginResolve() }

interface ApiResponse<T = any> {
  code: number
  message: string
  data: T
}

/** 获取本地存储的 token */
export function getToken(): string {
  return Taro.getStorageSync(TOKEN_KEY) || ''
}

/** 保存 token */
export function setToken(token: string) {
  Taro.setStorageSync(TOKEN_KEY, token)
}

/** 清除 token */
export function clearToken() {
  Taro.removeStorageSync(TOKEN_KEY)
  Taro.removeStorageSync(USER_KEY)
}

/** 获取本地缓存的用户信息 */
export function getCachedUser(): UserBrief | null {
  const raw = Taro.getStorageSync(USER_KEY)
  return raw || null
}

/** 缓存用户信息 */
export function setCachedUser(user: UserBrief) {
  Taro.setStorageSync(USER_KEY, user)
}

export async function request<T = any>(
  url: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT'
    data?: any
  } = {},
): Promise<T> {
  const { method = 'GET', data } = options

  const header: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  const token = getToken()
  if (token) {
    header['Authorization'] = `Bearer ${token}`
  }

  const res = await Taro.request({
    url: `${BASE_URL}${url}`,
    method,
    data,
    header,
  })

  const body = res.data as ApiResponse<T>

  // 401 未认证 — 清除本地凭证
  if (body.code === 4010) {
    clearToken()
    throw new Error('登录已过期，请重新进入小程序')
  }

  if (body.code !== 0) {
    throw new Error(body.message || '请求失败')
  }

  return body.data
}

/* ---- 核心业务 API ---- */

/** 生成题库 */
export function generateQuiz(userInput: string, questionCount = 5) {
  return request<QuizData>('/quiz/generate', {
    method: 'POST',
    data: {
      user_input: userInput,
      question_count: questionCount,
      difficulty: 'mixed',
    },
  })
}

/** 生成复盘报告 */
export function generateReport(params: {
  quiz_id: string
  topic: string
  questions: Question[]
  answer_records: AnswerRecord[]
}) {
  return request<ReportData>('/report/generate', {
    method: 'POST',
    data: params,
  })
}

/* ---- 用户 API ---- */

/** 微信登录 */
export function loginByCode(code: string) {
  return request<LoginResponse>('/user/login', {
    method: 'POST',
    data: { code },
  })
}

/** 获取用户资料（含统计） */
export function getUserProfile() {
  return request<UserProfile>('/user/profile')
}

/** 更新用户资料 */
export function updateUserProfile(data: { nickname?: string; avatar_url?: string }) {
  return request<null>('/user/profile', {
    method: 'PUT',
    data,
  })
}

/** 获取闯关历史（分页） */
export function getQuizHistory(page = 1, pageSize = 10) {
  return request<QuizHistoryList>(`/user/quizzes?page=${page}&page_size=${pageSize}`)
}

/** 获取闯关详情 */
export function getQuizDetail(quizId: string) {
  return request<QuizDetailResponse>(`/user/quizzes/${quizId}`)
}

/* ---- 类型定义 ---- */

export interface QuestionOption {
  key: string
  text: string
}

export interface Question {
  id: string
  type: 'single' | 'multiple' | 'judge'
  stem: string
  options: QuestionOption[]
  answer: string[]
  explanation: string
  knowledge_point: string
  difficulty: 'easy' | 'medium' | 'hard'
}

export interface QuizData {
  quiz_id: string
  title: string
  summary: string
  questions: Question[]
}

export interface AnswerRecord {
  question_id: string
  selected_answers: string[]
  is_correct: boolean
  duration_ms: number
}

export interface ReportData {
  accuracy: number
  mastered_points: string[]
  weak_points: string[]
  three_line_summary: string[]
  advice: string[]
  share_quote: string
}

export interface UserBrief {
  id: number
  nickname: string
  avatar_url: string
  total_xp: number
}

export interface LoginResponse {
  token: string
  user: UserBrief
}

export interface UserProfile {
  id: number
  nickname: string
  avatar_url: string
  total_xp: number
  quiz_count: number
  correct_count: number
  average_accuracy: number
}

export interface QuizHistoryItem {
  quiz_id: string
  title: string
  accuracy: number
  question_count: number
  created_at: string
}

export interface QuizHistoryList {
  items: QuizHistoryItem[]
  total: number
  page: number
  page_size: number
}

export interface QuizDetailResponse {
  quiz_id: string
  title: string
  summary: string
  user_input?: string
  questions: Question[]
  answer_records?: AnswerRecord[]
  report?: ReportData
  created_at: string
}
