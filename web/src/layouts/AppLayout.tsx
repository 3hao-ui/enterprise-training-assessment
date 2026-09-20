import { Layout, Menu, Button, Typography } from 'antd'
import {
  BarChartOutlined,
  FileTextOutlined,
  LogoutOutlined,
  ProfileOutlined,
  SolutionOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'

const ADMIN_ITEMS = [
  { key: '/admin/employees', icon: <TeamOutlined />, label: '员工管理' },
  { key: '/admin/docs', icon: <FileTextOutlined />, label: '培训资料' },
  { key: '/admin/assessments', icon: <SolutionOutlined />, label: '考核任务' },
  { key: '/admin/records', icon: <BarChartOutlined />, label: '成绩报表' },
]

const EMP_ITEMS = [
  { key: '/emp/assessments', icon: <SolutionOutlined />, label: '我的考核' },
  { key: '/emp/records', icon: <ProfileOutlined />, label: '我的成绩' },
]

export default function AppLayout({ role }: { role: 'admin' | 'employee' }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const items = role === 'admin' ? ADMIN_ITEMS : EMP_ITEMS
  const selected = items.find((i) => location.pathname.startsWith(i.key))?.key ?? items[0].key

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Layout.Header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography.Text strong style={{ color: '#fff', fontSize: 16 }}>
          企业内部培训智能考核系统
        </Typography.Text>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Typography.Text style={{ color: '#fff' }}>
            {user?.nickname}
            {user?.department ? `（${user.department}）` : ''}
          </Typography.Text>
          <Button
            type="text"
            icon={<LogoutOutlined />}
            style={{ color: '#fff' }}
            onClick={() => {
              logout()
              navigate('/login', { replace: true })
            }}
          >
            退出
          </Button>
        </div>
      </Layout.Header>
      <Layout>
        <Layout.Sider width={200} theme="light">
          <Menu
            mode="inline"
            selectedKeys={[selected]}
            items={items}
            onClick={({ key }) => navigate(key)}
            style={{ height: '100%', borderRight: 0 }}
          />
        </Layout.Sider>
        <Layout.Content style={{ padding: 24, background: '#f5f5f5' }}>
          <Outlet />
        </Layout.Content>
      </Layout>
    </Layout>
  )
}
