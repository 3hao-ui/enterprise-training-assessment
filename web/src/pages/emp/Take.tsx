import { useEffect, useRef, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Progress,
  Radio,
  Result,
  Space,
  Spin,
  Statistic,
  Tag,
  Typography,
  App as AntApp,
} from 'antd'
import { useNavigate, useParams } from 'react-router-dom'
import { request } from '../../api/client'
import type { AssessmentStart, Question, SubmitResult } from '../../api/types'

const TYPE_TEXT: Record<Question['type'], string> = {
  single: '单选题',
  multiple: '多选题',
  judge: '判断题',
}

export default function Take() {
  const { assessmentId = '' } = useParams()
  const { message } = AntApp.useApp()
  const navigate = useNavigate()

  const [phase, setPhase] = useState<'loading' | 'answering' | 'submitting' | 'result' | 'error'>('loading')
  const [start, setStart] = useState<AssessmentStart | null>(null)
  const [index, setIndex] = useState(0)
  const [selection, setSelection] = useState<string[]>([])
  const [revealed, setRevealed] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [result, setResult] = useState<SubmitResult | null>(null)

  const durations = useRef<Record<string, number>>({})
  const answersRef = useRef<Record<string, string[]>>({})
  const questionStart = useRef<number>(Date.now())

  useEffect(() => {
    let cancelled = false
    request<AssessmentStart>(`/assessments/${assessmentId}/start`, { method: 'POST' })
      .then((d) => {
        if (cancelled) return
        setStart(d)
        setPhase('answering')
        questionStart.current = Date.now()
      })
      .catch((e) => {
        if (cancelled) return
        setErrorMsg(e instanceof Error ? e.message : '开始考核失败')
        setPhase('error')
      })
    return () => {
      cancelled = true
    }
  }, [assessmentId])

  if (phase === 'loading' || phase === 'submitting') {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: 60 }}>
          <Spin size="large" />
          <Typography.Paragraph style={{ marginTop: 16 }}>
            {phase === 'loading' ? 'AI 正在基于培训资料出题，请稍候…' : '正在提交并生成复盘报告…'}
          </Typography.Paragraph>
        </div>
      </Card>
    )
  }

  if (phase === 'error') {
    return (
      <Result
        status="warning"
        title="无法开始考核"
        subTitle={errorMsg}
        extra={
          <Button type="primary" onClick={() => navigate('/emp/assessments')}>
            返回我的考核
          </Button>
        }
      />
    )
  }

  if (phase === 'result' && result && start) {
    return (
      <Card>
        <Result
          status={result.passed ? 'success' : 'warning'}
          title={result.passed ? '考核通过' : '未达及格线'}
          subTitle={`正确率 ${result.accuracy}%（及格线 ${start.pass_accuracy}%）`}
          extra={
            <Button type="primary" onClick={() => navigate('/emp/assessments')}>
              返回我的考核
            </Button>
          }
        >
          <div style={{ textAlign: 'left', maxWidth: 720, margin: '0 auto' }}>
            <Statistic title="正确率" value={result.accuracy} suffix="%" style={{ marginBottom: 24 }} />
            <Typography.Title level={5}>掌握较好</Typography.Title>
            <Space wrap>
              {result.report.mastered_points.map((p) => (
                <Tag color="green" key={p}>
                  {p}
                </Tag>
              ))}
            </Space>
            <Typography.Title level={5}>薄弱知识点</Typography.Title>
            <Space wrap>
              {result.report.weak_points.length === 0 ? (
                <Tag>无</Tag>
              ) : (
                result.report.weak_points.map((p) => (
                  <Tag color="red" key={p}>
                    {p}
                  </Tag>
                ))
              )}
            </Space>
            <Typography.Title level={5}>知识总结</Typography.Title>
            <ul>
              {result.report.three_line_summary.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
            <Typography.Title level={5}>后续建议</Typography.Title>
            <ul>
              {result.report.advice.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
            <Alert type="info" message={result.report.share_quote} />
          </div>
        </Result>
      </Card>
    )
  }

  if (!start) return null
  const question = start.questions[index]
  const isLast = index === start.questions.length - 1
  const correct =
    revealed && JSON.stringify([...selection].sort()) === JSON.stringify([...question.answer].sort())

  const onReveal = () => {
    durations.current[question.id] = Date.now() - questionStart.current
    answersRef.current[question.id] = selection
    setRevealed(true)
  }

  const onNext = async () => {
    if (!isLast) {
      setIndex(index + 1)
      setSelection([])
      setRevealed(false)
      questionStart.current = Date.now()
      return
    }
    setPhase('submitting')
    try {
      const answers = start.questions.map((q) => ({
        question_id: q.id,
        selected_answers: answersRef.current[q.id] ?? [],
        duration_ms: durations.current[q.id] ?? 0,
      }))
      const r = await request<SubmitResult>(`/assessments/${assessmentId}/submit`, {
        method: 'POST',
        data: { quiz_id: start.quiz_id, answers },
      })
      setResult(r)
      setPhase('result')
    } catch (e) {
      message.error(e instanceof Error ? e.message : '提交失败')
      setPhase('answering')
    }
  }

  return (
    <Card
      title={start.title}
      extra={
        <Progress
          type="circle"
          size={40}
          percent={Math.round(((index + (revealed ? 1 : 0)) / start.questions.length) * 100)}
        />
      }
    >
      <Typography.Paragraph type="secondary">
        第 {index + 1} / {start.questions.length} 题 · {TYPE_TEXT[question.type]} · 知识点：
        {question.knowledge_point}
      </Typography.Paragraph>
      <Typography.Title level={4}>{question.stem}</Typography.Title>

      {question.type === 'multiple' ? (
        <Checkbox.Group
          value={selection}
          disabled={revealed}
          onChange={(v) => setSelection(v as string[])}
          style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
        >
          {question.options.map((o) => (
            <Checkbox key={o.key} value={o.key}>
              {o.key}. {o.text}
            </Checkbox>
          ))}
        </Checkbox.Group>
      ) : (
        <Radio.Group
          value={selection[0]}
          disabled={revealed}
          onChange={(e) => setSelection([e.target.value])}
          style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
        >
          {question.options.map((o) => (
            <Radio key={o.key} value={o.key}>
              {o.key}. {o.text}
            </Radio>
          ))}
        </Radio.Group>
      )}

      {revealed && (
        <Alert
          style={{ marginTop: 16 }}
          type={correct ? 'success' : 'error'}
          showIcon
          message={correct ? '回答正确' : `回答错误，正确答案：${question.answer.join('、')}`}
          description={question.explanation}
        />
      )}

      <div style={{ marginTop: 24, textAlign: 'right' }}>
        <Space>
          {!revealed ? (
            <Button type="primary" disabled={selection.length === 0} onClick={onReveal}>
              提交答案
            </Button>
          ) : (
            <Button type="primary" onClick={onNext}>
              {isLast ? '查看结果' : '下一题'}
            </Button>
          )}
        </Space>
      </div>
    </Card>
  )
}
