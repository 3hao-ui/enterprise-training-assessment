import { useCallback, useEffect, useState } from 'react'
import {
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  App as AntApp,
} from 'antd'
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { request } from '../../api/client'
import type { AssessmentItem, DocItem, PageData } from '../../api/types'

const DIFFICULTY_TEXT: Record<string, string> = {
  easy: '简单',
  medium: '中等',
  hard: '困难',
  mixed: '混合',
}

export default function Assessments() {
  const { message } = AntApp.useApp()
  const navigate = useNavigate()
  const [data, setData] = useState<PageData<AssessmentItem>>({ items: [], total: 0, page: 1, page_size: 10 })
  const [loading, setLoading] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [docs, setDocs] = useState<DocItem[]>([])
  const [form] = Form.useForm()

  const load = useCallback(async (page = 1, pageSize = 10) => {
    setLoading(true)
    try {
      const d = await request<PageData<AssessmentItem>>('/admin/assessments', {
        params: { page, page_size: pageSize },
      })
      setData(d)
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [message])

  useEffect(() => {
    load()
  }, [load])

  const openCreate = async () => {
    setCreateOpen(true)
    try {
      const d = await request<{ items: DocItem[] }>('/knowledge/documents')
      setDocs(d.items.filter((i) => i.status === 'ready'))
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载资料失败')
    }
  }

  const onCreate = async () => {
    const values = await form.validateFields()
    const payload = {
      title: values.title,
      doc_id: values.doc_id,
      question_count: values.question_count,
      difficulty: values.difficulty,
      pass_accuracy: values.pass_accuracy,
      deadline: values.deadline ? values.deadline.format('YYYY-MM-DDTHH:mm:ss') : null,
    }
    try {
      await request('/admin/assessments', { method: 'POST', data: payload })
      message.success('考核任务已发布')
      setCreateOpen(false)
      form.resetFields()
      load(1, data.page_size)
    } catch (e) {
      message.error(e instanceof Error ? e.message : '发布失败')
    }
  }

  const onToggle = async (row: AssessmentItem) => {
    try {
      await request(`/admin/assessments/${row.assessment_id}`, {
        method: 'PUT',
        data: { status: row.status === 'open' ? 'closed' : 'open' },
      })
      message.success(row.status === 'open' ? '已关闭' : '已重新开放')
      load(data.page, data.page_size)
    } catch (e) {
      message.error(e instanceof Error ? e.message : '操作失败')
    }
  }

  return (
    <Card
      title="考核任务"
      extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => load(data.page, data.page_size)}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            发布考核
          </Button>
        </Space>
      }
    >
      <Table<AssessmentItem>
        rowKey="assessment_id"
        loading={loading}
        dataSource={data.items}
        pagination={{
          current: data.page,
          pageSize: data.page_size,
          total: data.total,
          onChange: (p, s) => load(p, s),
          showTotal: (t) => `共 ${t} 个考核`,
        }}
        columns={[
          { title: '考核名称', dataIndex: 'title' },
          { title: '培训资料', dataIndex: 'doc_file_name', ellipsis: true },
          { title: '题量', dataIndex: 'question_count', width: 70 },
          {
            title: '难度',
            dataIndex: 'difficulty',
            width: 80,
            render: (d: string) => DIFFICULTY_TEXT[d] ?? d,
          },
          {
            title: '及格线',
            dataIndex: 'pass_accuracy',
            width: 90,
            render: (v: number) => `${v}%`,
          },
          { title: '截止时间', dataIndex: 'deadline', width: 170, render: (v: string | null) => v ?? '不限' },
          {
            title: '状态',
            dataIndex: 'status',
            width: 90,
            render: (s: string) => (s === 'open' ? <Tag color="green">进行中</Tag> : <Tag>已关闭</Tag>),
          },
          {
            title: '操作',
            width: 170,
            render: (_, row) => (
              <Space>
                <Button size="small" onClick={() => navigate(`/admin/records?assessment=${row.assessment_id}`)}>
                  成绩
                </Button>
                <Popconfirm
                  title={row.status === 'open' ? '关闭后员工将无法开始答题' : '确认重新开放？'}
                  onConfirm={() => onToggle(row)}
                >
                  <Button size="small" danger={row.status === 'open'}>
                    {row.status === 'open' ? '关闭' : '开放'}
                  </Button>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />

      <Modal
        title="发布考核任务"
        open={createOpen}
        onOk={onCreate}
        onCancel={() => setCreateOpen(false)}
        okText="发布"
        cancelText="取消"
        width={520}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ question_count: 5, difficulty: 'mixed', pass_accuracy: 60 }}
        >
          <Form.Item name="title" label="考核名称" rules={[{ required: true, message: '请输入考核名称' }]}>
            <Input placeholder="如 2026 Q3 安全生产培训考核" />
          </Form.Item>
          <Form.Item name="doc_id" label="培训资料" rules={[{ required: true, message: '请选择已就绪的培训资料' }]}>
            <Select
              placeholder="仅显示解析完成的资料"
              options={docs.map((d) => ({ label: d.file_name, value: d.doc_id }))}
            />
          </Form.Item>
          <Space size={16} style={{ display: 'flex' }}>
            <Form.Item name="question_count" label="题量" rules={[{ required: true }]}>
              <InputNumber min={3} max={10} />
            </Form.Item>
            <Form.Item name="difficulty" label="难度" rules={[{ required: true }]}>
              <Select
                style={{ width: 120 }}
                options={[
                  { label: '简单', value: 'easy' },
                  { label: '中等', value: 'medium' },
                  { label: '困难', value: 'hard' },
                  { label: '混合', value: 'mixed' },
                ]}
              />
            </Form.Item>
            <Form.Item name="pass_accuracy" label="及格线(%)" rules={[{ required: true }]}>
              <InputNumber min={0} max={100} />
            </Form.Item>
          </Space>
          <Form.Item name="deadline" label="截止时间（不填表示不限）">
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}
