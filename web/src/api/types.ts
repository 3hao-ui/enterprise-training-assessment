export interface ApiResponse<T = any> {
  code: number
  message: string
  data: T
}

export interface WebUser {
  id: number
  username: string
  nickname: string
  role: 'admin' | 'employee'
  department: string
}

export interface EmployeeItem {
  id: number
  username: string
  nickname: string
  department: string
  role: string
  status: number
  total_xp: number
  created_at: string
}

export interface PageData<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

export interface DocItem {
  doc_id: string
  file_name: string
  file_type: string
  file_size: number
  status: 'processing' | 'ready' | 'failed'
  chunk_count: number
  error_message: string | null
  created_at: string
}

export interface AssessmentItem {
  assessment_id: string
  title: string
  doc_id: string
  doc_file_name: string
  question_count: number
  difficulty: string
  pass_accuracy: number
  deadline: string | null
  status: 'open' | 'closed'
  created_at: string
}

export interface MyAssessmentItem extends AssessmentItem {
  my_status: 'pending' | 'done' | 'expired'
  record_count: number
  best_accuracy: number | null
}

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
  difficulty: string
}

export interface AssessmentStart {
  assessment_id: string
  quiz_id: string
  title: string
  summary: string
  questions: Question[]
  pass_accuracy: number
  deadline: string | null
}

export interface ReportData {
  accuracy: number
  mastered_points: string[]
  weak_points: string[]
  three_line_summary: string[]
  advice: string[]
  share_quote: string
}

export interface SubmitResult {
  accuracy: number
  passed: boolean
  report: ReportData
}

export interface RecordItem {
  record_id: number
  assessment_id: string
  assessment_title: string
  user_id: number
  username: string
  nickname: string
  department: string
  quiz_id: string
  accuracy: number
  passed: boolean
  duration_seconds: number
  created_at: string
}
