import { View, Text } from '@tarojs/components'
import './index.scss'

export default function ProfilePage() {
  return (
    <View className='profile-page'>
      <View className='status-bar-space' />
      <View className='nav-bar'>
        <Text className='nav-title'>我的</Text>
      </View>

      <View className='profile-content'>
        <View className='avatar-section'>
          <View className='avatar-placeholder'>
            <Text className='avatar-emoji'>🎓</Text>
          </View>
          <Text className='nickname'>学习者</Text>
          <Text className='slogan'>每天闯关一点点，进步看得见</Text>
        </View>

        <View className='stats-row'>
          <View className='stat-item'>
            <Text className='stat-num'>0</Text>
            <Text className='stat-label'>闯关次数</Text>
          </View>
          <View className='stat-item'>
            <Text className='stat-num'>0</Text>
            <Text className='stat-label'>答对题数</Text>
          </View>
          <View className='stat-item'>
            <Text className='stat-num'>0%</Text>
            <Text className='stat-label'>平均正确率</Text>
          </View>
        </View>

        <View className='tip-card'>
          <Text className='tip-title'>💡 提示</Text>
          <Text className='tip-text'>MVP 版本暂未接入用户系统，完成闯关后可查看当次学习报告。登录、历史记录等功能后续版本上线。</Text>
        </View>
      </View>
    </View>
  )
}
