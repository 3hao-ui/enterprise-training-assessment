import { Navigate, useLocation } from 'react-router-dom'
import { Spin } from 'antd'
import { useAuth } from '../auth'

export function RequireRole({ role, children }: { role: 'admin' | 'employee'; children: React.ReactNode }) {
  const { user, ready } = useAuth()
  const location = useLocation()

  if (!ready) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" />
      </div>
    )
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  if (user.role !== role) {
    return <Navigate to={user.role === 'admin' ? '/admin/employees' : '/emp/assessments'} replace />
  }
  return <>{children}</>
}
