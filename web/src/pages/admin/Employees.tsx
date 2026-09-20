import { useCallback, useEffect, useState } from 'react'
import {
  Button,
  Card,
  Form,
  Input,
  Modal,
  Popconfirm,
  Space,
  Table,
  Tag,
  App as AntApp,
} from 'antd'
import { PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import { request } from '../../api/client'
import type { EmployeeItem, PageData } from '../../api/types'

export default function Employees() {
  const { message } = AntApp.useApp()
  const [data, setData] = useState<PageData<EmployeeItem>>({ items: [], total: 0, page: 1, page_size: 10 })
  const [loading, setLoading] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [resetTarget, setResetTarget] = useState<EmployeeItem | null>(null)
  const [createForm] = Form.useForm()
  const [resetForm] = Form.useForm()

  const load = useCallback(async (page = 1, pageSize = 10, kw = keyword) => {
    setLoading(true)
    try {
      const d = await request<PageData<EmployeeItem>>('/admin/employees', {
        params: { page, page_size: pageSize, keyword: kw },
      })
      setData(d)
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [keyword, message])

  useEffect(() => {
    load()
  }, [load])

  const onCreate = async () => {
    const values = await createForm.validateFields()
    try {
      await request('/admin/employees', { method: 'POST', data: values })
      message.success('员工账号已创建')
      setCreateOpen(false)
      createForm.resetFields()
      load(1, data.page_size)
    } catch (e) {
      message.error(e instanceof Error ? e.message : '创建失败')
    }
  }

  const onToggleStatus = async (row: EmployeeItem) => {
    try {
      await request(`/admin/employees/${row.id}`, {
        method: 'PUT',
        data: { status: row.status === 1 ? 0 : 1 },
      })
      message.success(row.status === 1 ? '已停用' : '已启用')
      load(data.page, data.page_size)
    } catch (e) {
      message.error(e instanceof Error ? e.message : '操作失败')
    }
  }

  const onReset = async () => {
    const values = await resetForm.validateFields()
    if (!resetTarget) return
    try {
      await request(`/admin/employees/${resetTarget.id}/reset-password`, {
        method: 'POST',
        data: values,
      })
      message.success('密码已重置')
      setResetTarget(null)
      resetForm.resetFields()
    } catch (e) {
      message.error(e instanceof Error ? e.message : '重置失败')
    }
  }

  return (
    <Card
      title="员工管理"
      extra={
        <Space>
          <Input
            placeholder="搜索用户名/姓名/部门"
            prefix={<SearchOutlined />}
            allowClear
            style={{ width: 220 }}
            onPressEnter={(e) => {
              const kw = (e.target as HTMLInputElement).value
              setKeyword(kw)
              load(1, data.page_size, kw)
            }}
          />
          <Button icon={<ReloadOutlined />} onClick={() => load(data.page, data.page_size)}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
            新建员工
          </Button>
        </Space>
      }
    >
      <Table<EmployeeItem>
        rowKey="id"
        loading={loading}
        dataSource={data.items}
        pagination={{
          current: data.page,
          pageSize: data.page_size,
          total: data.total,
          onChange: (p, s) => load(p, s),
          showTotal: (t) => `共 ${t} 人`,
        }}
        columns={[
          { title: '用户名', dataIndex: 'username' },
          { title: '姓名', dataIndex: 'nickname' },
          { title: '部门', dataIndex: 'department' },
          {
            title: '角色',
            dataIndex: 'role',
            render: (r: string) => (r === 'admin' ? <Tag color="gold">管理员</Tag> : <Tag>员工</Tag>),
          },
          {
            title: '状态',
            dataIndex: 'status',
            render: (s: number) => (s === 1 ? <Tag color="green">启用</Tag> : <Tag color="red">停用</Tag>),
          },
          { title: '创建时间', dataIndex: 'created_at' },
          {
            title: '操作',
            render: (_, row) =>
              row.role === 'admin' ? (
                <span style={{ color: '#999' }}>—</span>
              ) : (
                <Space>
                  <Button size="small" onClick={() => setResetTarget(row)}>
                    重置密码
                  </Button>
                  <Popconfirm
                    title={row.status === 1 ? '停用后该员工将无法登录' : '确认启用该员工？'}
                    onConfirm={() => onToggleStatus(row)}
                  >
                    <Button size="small" danger={row.status === 1}>
                      {row.status === 1 ? '停用' : '启用'}
                    </Button>
                  </Popconfirm>
                </Space>
              ),
          },
        ]}
      />

      <Modal
        title="新建员工账号"
        open={createOpen}
        onOk={onCreate}
        onCancel={() => setCreateOpen(false)}
        okText="创建"
        cancelText="取消"
      >
        <Form form={createForm} layout="vertical">
          <Form.Item
            name="username"
            label="用户名"
            rules={[
              { required: true, message: '请输入用户名' },
              { pattern: /^[a-zA-Z0-9_]+$/, message: '仅允许字母、数字、下划线' },
            ]}
          >
            <Input placeholder="如 zhangsan" />
          </Form.Item>
          <Form.Item
            name="password"
            label="初始密码"
            rules={[{ required: true, min: 6, message: '至少 6 位' }]}
          >
            <Input.Password />
          </Form.Item>
          <Form.Item name="nickname" label="姓名" rules={[{ required: true, message: '请输入姓名' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="department" label="部门">
            <Input placeholder="如 研发部" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`重置密码：${resetTarget?.nickname ?? ''}`}
        open={resetTarget !== null}
        onOk={onReset}
        onCancel={() => setResetTarget(null)}
        okText="重置"
        cancelText="取消"
      >
        <Form form={resetForm} layout="vertical">
          <Form.Item name="password" label="新密码" rules={[{ required: true, min: 6, message: '至少 6 位' }]}>
            <Input.Password />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}
