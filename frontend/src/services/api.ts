import Taro from '@tarojs/taro'

const BASE_URL = 'http://localhost:8000/api/v1'

interface ApiResponse<T = any> {
  code: number
  message: string
  data: T
}

export async function request<T = any>(
  url: string,
  options: {
    method?: 'GET' | 'POST'
    data?: any
  } = {},
): Promise<T> {
  const { method = 'GET', data } = options

  const res = await Taro.request({
    url: `${BASE_URL}${url}`,
    method,
    data,
    header: {
      'Content-Type': 'application/json',
    },
  })

  const body = res.data as ApiResponse<T>

  if (body.code !== 0) {
    throw new Error(body.message || '请求失败')
  }

  return body.data
}

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
