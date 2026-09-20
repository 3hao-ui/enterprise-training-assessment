import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth'
import { RequireRole } from './components/RequireRole'
import AppLayout from './layouts/AppLayout'
import Login from './pages/Login'
import AdminEmployees from './pages/admin/Employees'
import AdminDocs from './pages/admin/Docs'
import AdminAssessments from './pages/admin/Assessments'
import AdminRecords from './pages/admin/Records'
import EmpAssessments from './pages/emp/MyAssessments'
import EmpTake from './pages/emp/Take'
import EmpRecords from './pages/emp/MyRecords'

function Home() {
  const { user, ready } = useAuth()
  if (!ready) return null
  if (!user) return <Navigate to="/login" replace />
  return <Navigate to={user.role === 'admin' ? '/admin/employees' : '/emp/assessments'} replace />
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/admin"
          element={
            <RequireRole role="admin">
              <AppLayout role="admin" />
            </RequireRole>
          }
        >
          <Route index element={<Navigate to="/admin/employees" replace />} />
          <Route path="employees" element={<AdminEmployees />} />
          <Route path="docs" element={<AdminDocs />} />
          <Route path="assessments" element={<AdminAssessments />} />
          <Route path="records" element={<AdminRecords />} />
        </Route>
        <Route
          path="/emp"
          element={
            <RequireRole role="employee">
              <AppLayout role="employee" />
            </RequireRole>
          }
        >
          <Route index element={<Navigate to="/emp/assessments" replace />} />
          <Route path="assessments" element={<EmpAssessments />} />
          <Route path="assessments/:assessmentId/take" element={<EmpTake />} />
          <Route path="records" element={<EmpRecords />} />
        </Route>
        <Route path="*" element={<Home />} />
      </Routes>
    </AuthProvider>
  )
}
