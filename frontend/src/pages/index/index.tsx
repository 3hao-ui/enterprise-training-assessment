import { useState, useEffect, useCallback } from 'react'
import { View, Text, Textarea, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { generateQuizAsync, pollQuizTask, getCachedUser, getQuizHistory, waitForLogin } from '../../services/api'
import type { UserBrief, QuizHistoryItem } from '../../services/api'
import './index.scss'

export default function IndexPage() {
  const [inputValue, setInputValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingText, setLoadingText] = useState('生成中...')
  const [user, setUser] = useState<UserBrief | null>(null)
  const [historyItems, setHistoryItems] = useState<QuizHistoryItem[]>([])

  const loadData = useCallback(async () => {
    await waitForLogin()
    const cached = getCachedUser()
    if (cached) setUser(cached)

    getQuizHistory(1, 4)
      .then((res) => setHistoryItems(res.items))
      .catch(() => {})
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // 每次页面显示时刷新（从其他页面返回后）
  useDidShow(() => {
    const cached = getCachedUser()
    if (cached) setUser(cached)
    // 刷新考核记录（从复盘页返回或新完成一场考核后）
    getQuizHistory(1, 4)
      .then((res) => setHistoryItems(res.items))
      .catch(() => {})
  })

  const handleGenerate = async () => {
    const trimmed = inputValue.trim()
    if (!trimmed) {
      Taro.showToast({ title: '请输入考核内容', icon: 'none' })
      return
    }

    setLoading(true)
    setLoadingText('正在创建任务...')
    try {
      // 1. 创建异步任务（秒级返回）
      const { task_id } = await generateQuizAsync(trimmed)

      setLoadingText('AI 正在生成题目...')

      // 2. 轮询等待任务完成
      const quizData = await pollQuizTask(task_id, (status) => {
        if (status === 'running') setLoadingText('AI 正在生成题目...')
      })

      // 3. 跳转答题页
      Taro.navigateTo({
        url: `/pages/quiz/index?quizData=${encodeURIComponent(JSON.stringify(quizData))}`,
      })
    } catch (err: any) {
      Taro.showToast({ title: err.message || '生成失败，请稍后重试', icon: 'none' })
    } finally {
      setLoading(false)
      setLoadingText('生成中...')
    }
  }

  return (
    <View className='index-page'>
      {/* 顶部工具栏 */}
      <View className='toolbar'>
        <View className='hello-user'>
          {user?.avatar_url ? (
            <Image className='hello-avatar-img' src={user.avatar_url} mode='aspectFill' />
          ) : (
            <View className='hello-avatar'>
              <Text>{user?.nickname?.[0] || '员'}</Text>
            </View>
          )}
          <Text className='hello-name'>你好，{user?.nickname || '同事'}</Text>
        </View>
        <View className='coin-badge'>
          <Text className='coin-text'>{user?.total_xp ?? 0}</Text>
          <Text className='coin-icon'>⭐</Text>
        </View>
      </View>

      {/* 标题 */}
      <Text className='page-title'>今天要做哪场考核？</Text>

      {/* 输入区域 */}
      <View className='quick-input'>
        <View className='input-head'>
          <View className='input-label'>输入本次考核主题</View>
          <View className='mini-mascot'>📋</View>
        </View>
        <Textarea
          className='input-area'
          placeholder={'例如：数据分级与导出审批要求\n我想确认自己掌握了合规红线。\n请根据培训资料出题考核我。'}
          value={inputValue}
          onInput={(e) => setInputValue(e.detail.value)}
          maxlength={500}
          autoHeight
        />
        <View className='input-actions'>
          <View
            className={`btn-primary generate-btn ${loading ? 'is-loading' : ''}`}
            onClick={!loading ? handleGenerate : undefined}
          >
            {loading ? (
              <Text>{loadingText}</Text>
            ) : (
              <>
                <Text className='btn-arrow'>→</Text>
                <Text>生成考核题目</Text>
              </>
            )}
          </View>
        </View>
      </View>

      {/* 我的考核记录 */}
      {historyItems.length > 0 && (
        <View className='cards-grid'>
          {historyItems.map((item) => (
            <View
              key={item.quiz_id}
              className='quiz-card'
              onClick={() => {
                Taro.navigateTo({
                  url: `/pages/report/index?quizId=${item.quiz_id}`,
                })
              }}
            >
              <View className='quiz-dot'>✓</View>
              <View className='quiz-body'>
                <Text className='quiz-name'>{item.title}</Text>
                <Text className='quiz-meta'>正确率：{Math.round(item.accuracy)}% · {item.question_count} 题</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* 备考提示 */}
      <Text className='section-title'>💡 备考提示</Text>
      <View className='tip-list'>
        <View className='tip-item'>
          <Text className='tip-icon'>🎯</Text>
          <Text className='tip-text'>每月至少完成一次培训考核</Text>
        </View>
        <View className='tip-item'>
          <Text className='tip-icon'>📝</Text>
          <Text className='tip-text'>考核后查看复盘报告，重点补强薄弱知识点</Text>
        </View>
        <View className='tip-item'>
          <Text className='tip-icon'>⭐</Text>
          <Text className='tip-text'>答对越多，考核积分越高</Text>
        </View>
      </View>
    </View>
  )
}
