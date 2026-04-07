import { useState } from 'react'
import { View, Text, Textarea, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { generateQuiz } from '../../services/api'
import './index.scss'

export default function IndexPage() {
  const [inputValue, setInputValue] = useState('')
  const [loading, setLoading] = useState(false)

  const handleGenerate = async () => {
    const trimmed = inputValue.trim()
    if (!trimmed) {
      Taro.showToast({ title: '请输入学习内容', icon: 'none' })
      return
    }

    setLoading(true)
    try {
      const quizData = await generateQuiz(trimmed)
      // 将题库数据传到闯关页
      Taro.navigateTo({
        url: `/pages/quiz/index?quizData=${encodeURIComponent(JSON.stringify(quizData))}`,
      })
    } catch (err: any) {
      Taro.showToast({ title: err.message || '生成失败，请稍后重试', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <View className='index-page'>
      {/* 状态栏占位 */}
      <View className='status-bar-space' />

      {/* 顶部工具栏 */}
      <View className='toolbar'>
        <View className='hello-user'>
          <View className='hello-avatar'>
            <Text>鱼</Text>
          </View>
          <Text className='hello-name'>你好，小皮</Text>
        </View>
        <View className='coin-badge'>
          <Text className='coin-text'>602</Text>
          <Text className='coin-icon'>⭐</Text>
        </View>
      </View>

      {/* 标题 */}
      <Text className='page-title'>今天想闯哪一关？</Text>

      {/* 输入区域 */}
      <View className='quick-input'>
        <View className='input-head'>
          <View className='input-label'>输入你想学的内容</View>
          <View className='mini-mascot'>🐟</View>
        </View>
        <Textarea
          className='input-area'
          placeholder={'例如：RAG 和传统搜索有什么区别？\n我想搞懂向量数据库是怎么配合工作的。\n最好通过闯关题帮我记住重点。'}
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
              <Text>生成中...</Text>
            ) : (
              <>
                <Text className='btn-arrow'>→</Text>
                <Text>开始生成题目</Text>
              </>
            )}
          </View>
        </View>
      </View>

      {/* 已完成关卡 */}
      <View className='cards-grid'>
        <View className='quiz-card'>
          <View className='quiz-dot'>✓</View>
          <View className='quiz-body'>
            <Text className='quiz-name'>RAG 基础概念</Text>
            <Text className='quiz-meta'>关键词：检索 / 向量库 / 生成</Text>
          </View>
        </View>
        <View className='quiz-card'>
          <View className='quiz-dot'>✓</View>
          <View className='quiz-body'>
            <Text className='quiz-name'>提示词工程</Text>
            <Text className='quiz-meta'>关键词：角色 / 约束 / 输出格式</Text>
          </View>
        </View>
      </View>

      {/* 未完成关卡 */}
      <Text className='section-title'>未完成关卡</Text>
      <View className='quest-item'>
        <View className='quest-avatar' style={{ background: '#f0e4ff' }}>
          <Text style={{ fontSize: '36px' }}>📐</Text>
        </View>
        <View className='quest-info'>
          <Text className='quest-name'>数学闯关</Text>
          <Text className='quest-desc'>20 题</Text>
        </View>
        <View className='ring-progress'>
          <View className='ring-outer' style={{ background: `conic-gradient(#ff7a2f 0 60%, #ece7de 60% 100%)` }}>
            <View className='ring-inner'>
              <Text className='ring-text'>60%</Text>
            </View>
          </View>
        </View>
      </View>
      <View className='quest-item'>
        <View className='quest-avatar' style={{ background: '#e4f0ff' }}>
          <Text style={{ fontSize: '36px' }}>🔬</Text>
        </View>
        <View className='quest-info'>
          <Text className='quest-name'>科学闯关</Text>
          <Text className='quest-desc'>20 题</Text>
        </View>
        <View className='ring-progress'>
          <View className='ring-outer' style={{ background: `conic-gradient(#47a4ff 0 40%, #ece7de 40% 100%)` }}>
            <View className='ring-inner'>
              <Text className='ring-text' style={{ color: '#47a4ff' }}>40%</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  )
}
