import { useState, useCallback } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { getUserProfile, getQuizHistory } from '../../services/api'
import type { UserProfile, QuizHistoryItem } from '../../services/api'
import './index.scss'

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [historyItems, setHistoryItems] = useState<QuizHistoryItem[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  const loadProfile = useCallback(() => {
    getUserProfile()
      .then((data) => setProfile(data))
      .catch(() => {})
  }, [])

  const loadHistory = useCallback((p: number, reset = false) => {
    setLoadingMore(true)
    getQuizHistory(p, 10)
      .then((data) => {
        setHistoryItems((prev) => (reset ? data.items : [...prev, ...data.items]))
        setPage(p)
        setHasMore(data.items.length >= 10 && p * 10 < data.total)
      })
      .catch(() => {})
      .finally(() => setLoadingMore(false))
  }, [])

  // 每次 tab 显示时刷新
  useDidShow(() => {
    loadProfile()
    loadHistory(1, true)
  })

  const handleLoadMore = () => {
    if (!hasMore || loadingMore) return
    loadHistory(page + 1)
  }

  const handleViewDetail = (quizId: string) => {
    Taro.navigateTo({
      url: `/pages/report/index?quizId=${quizId}`,
    })
  }

  return (
    <View className='profile-page'>
      <View className='status-bar-space' />
      <View className='nav-bar'>
        <Text className='nav-title'>我的</Text>
      </View>

      <View className='profile-content'>
        <View className='avatar-section'>
          <View className='avatar-placeholder'>
            <Text className='avatar-emoji'>{profile?.nickname?.[0] || '🎓'}</Text>
          </View>
          <Text className='nickname'>{profile?.nickname || '学习者'}</Text>
          <Text className='slogan'>每天闯关一点点，进步看得见</Text>
        </View>

        <View className='stats-row'>
          <View className='stat-item'>
            <Text className='stat-num'>{profile?.quiz_count ?? 0}</Text>
            <Text className='stat-label'>闯关次数</Text>
          </View>
          <View className='stat-item'>
            <Text className='stat-num'>{profile?.correct_count ?? 0}</Text>
            <Text className='stat-label'>答对题数</Text>
          </View>
          <View className='stat-item'>
            <Text className='stat-num'>{profile?.average_accuracy ?? 0}%</Text>
            <Text className='stat-label'>平均正确率</Text>
          </View>
        </View>

        <View className='xp-row'>
          <Text className='xp-label'>经验值</Text>
          <View className='xp-value-badge'>
            <Text className='xp-value'>{profile?.total_xp ?? 0}</Text>
            <Text className='xp-star'>⭐</Text>
          </View>
        </View>

        {/* 闯关历史 */}
        <Text className='section-title'>闯关记录</Text>
        {historyItems.length === 0 ? (
          <View className='empty-history'>
            <Text className='empty-text'>暂无闯关记录，去首页开始学习吧</Text>
          </View>
        ) : (
          <View className='history-list'>
            {historyItems.map((item) => (
              <View
                key={item.quiz_id}
                className='history-item'
                onClick={() => handleViewDetail(item.quiz_id)}
              >
                <View className='history-left'>
                  <Text className='history-title'>{item.title}</Text>
                  <Text className='history-meta'>
                    {item.question_count} 题 · 正确率 {Math.round(item.accuracy * 100)}%
                  </Text>
                </View>
                <Text className='history-arrow'>›</Text>
              </View>
            ))}
            {hasMore && (
              <View className='load-more' onClick={handleLoadMore}>
                <Text className='load-more-text'>{loadingMore ? '加载中...' : '加载更多'}</Text>
              </View>
            )}
          </View>
        )}
      </View>
    </View>
  )
}
