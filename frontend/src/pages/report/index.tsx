import { useState, useEffect, useMemo } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { generateReport } from '../../services/api'
import type { QuizData, AnswerRecord, ReportData } from '../../services/api'
import './index.scss'

export default function ReportPage() {
  const router = useRouter()

  const { quizData, answerRecords } = useMemo(() => {
    try {
      const qd = router.params.quizData
        ? JSON.parse(decodeURIComponent(router.params.quizData))
        : null
      const ar = router.params.answerRecords
        ? JSON.parse(decodeURIComponent(router.params.answerRecords))
        : []
      return { quizData: qd as QuizData | null, answerRecords: ar as AnswerRecord[] }
    } catch {
      return { quizData: null, answerRecords: [] }
    }
  }, [router.params])

  const [report, setReport] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)

  // 本地计算基础统计
  const localAccuracy = useMemo(() => {
    if (answerRecords.length === 0) return 0
    const correct = answerRecords.filter((r) => r.is_correct).length
    return Math.round((correct / answerRecords.length) * 100)
  }, [answerRecords])

  useEffect(() => {
    if (!quizData) {
      setLoading(false)
      return
    }

    const fetchReport = async () => {
      try {
        const data = await generateReport({
          quiz_id: quizData.quiz_id,
          topic: quizData.title,
          questions: quizData.questions,
          answer_records: answerRecords,
        })
        setReport(data)
      } catch {
        // AI 报告生成失败时用本地兜底
        setReport(null)
      } finally {
        setLoading(false)
      }
    }

    fetchReport()
  }, [quizData, answerRecords])

  const accuracy = report?.accuracy ?? localAccuracy

  const handleGoHome = () => {
    Taro.switchTab({ url: '/pages/index/index' })
  }

  const handleGeneratePoster = () => {
    Taro.showToast({ title: '海报功能开发中', icon: 'none' })
  }

  return (
    <View className='report-page'>
      <View className='status-bar-space' />

      {/* 顶部栏 */}
      <View className='report-toolbar'>
        <Text className='toolbar-title'>{quizData?.title || '闯关报告'}</Text>
        <View className='xp-badge'>
          <Text className='xp-text'>+20 XP</Text>
        </View>
      </View>

      {/* 主标题 */}
      <Text className='report-heading'>你这局学得很稳</Text>
      <Text className='report-subtitle'>先看结果，再看错因，最后给你下一步建议。</Text>

      {/* 标签 */}
      <View className='tag-row'>
        <View className='tag tag-orange'>
          <Text>⭐ 掌握度 +1</Text>
        </View>
        <View className='tag tag-green'>
          <Text>📊 错题 -{answerRecords.filter((r) => !r.is_correct).length}</Text>
        </View>
      </View>

      {loading ? (
        <View className='loading-state'>
          <Text>AI 正在生成报告...</Text>
        </View>
      ) : (
        <>
          {/* 掌握度卡片 */}
          <View className='note-card'>
            <Text className='card-title'>🕐 掌握度</Text>
            <View className='mastery-row'>
              <View className='mastery-ring'>
                <View
                  className='ring-outer-large'
                  style={{
                    background: `conic-gradient(#ff7a2f 0 ${accuracy}%, #ece7de ${accuracy}% 100%)`,
                  }}
                >
                  <View className='ring-inner-large'>
                    <Text className='ring-value'>{accuracy}%</Text>
                  </View>
                </View>
              </View>
              <View className='mastery-detail'>
                <Text className='mastery-desc'>
                  {report?.three_line_summary?.[0] ||
                    `本次答对 ${answerRecords.filter((r) => r.is_correct).length} 题，正确率 ${accuracy}%`}
                </Text>
                <View className='mastery-bar'>
                  <View className='mastery-fill' style={{ width: `${accuracy}%` }} />
                </View>
              </View>
            </View>
          </View>

          {/* 薄弱知识点 */}
          {report?.weak_points && report.weak_points.length > 0 && (
            <View className='note-card'>
              <Text className='card-title'>⚠ 最该补的 {report.weak_points.length} 点</Text>
              <View className='weak-list'>
                {report.weak_points.map((point, i) => (
                  <Text key={i} className='weak-item'>
                    {i + 1}. {point}
                  </Text>
                ))}
              </View>
            </View>
          )}

          {/* 知识总结 */}
          {report?.three_line_summary && (
            <View className='note-card'>
              <Text className='card-title'>📝 知识总结</Text>
              <View className='summary-list'>
                {report.three_line_summary.map((line, i) => (
                  <Text key={i} className='summary-item'>
                    {line}
                  </Text>
                ))}
              </View>
            </View>
          )}

          {/* 建议 */}
          {report?.advice && report.advice.length > 0 && (
            <View className='note-card'>
              <Text className='card-title'>💡 建议</Text>
              <View className='advice-list'>
                {report.advice.map((item, i) => (
                  <Text key={i} className='advice-item'>
                    • {item}
                  </Text>
                ))}
              </View>
            </View>
          )}

          {/* 分享海报 */}
          <View className='sticker-card'>
            <Text className='card-title'>🔗 分享海报</Text>
            <View className='poster-preview'>
              <Text className='poster-quote'>
                {report?.share_quote || '今天我又闯过一个知识关卡！'}
              </Text>
              <View className='poster-qr' />
            </View>
          </View>
        </>
      )}

      {/* 底部按钮 */}
      <View className='bottom-actions'>
        <View className='btn-primary action-btn' onClick={handleGoHome}>
          <Text>再来一组</Text>
        </View>
        <View className='btn-secondary action-btn' onClick={handleGeneratePoster}>
          <Text>生成海报</Text>
        </View>
      </View>
    </View>
  )
}
