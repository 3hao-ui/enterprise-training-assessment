import { useCallback, useEffect, useState } from 'react'
import { Button, Card, Table, Tag, App as AntApp } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { request } from '../../api/client'
import type { MyAssessmentItem, PageData } from '../../api/types'

const STATUS: Record<MyAssessmentItem['my_status'], { color: string; text: string }> = {
  pending: { color: 'orange', text: '待完成' },
  done: { color: 'green', text: '已完成' },
  expired: { color: 'default', text: '已截止' },
}

export default function MyAssessments() {
  const { message } = AntApp.useApp()
  const navigate = useNavigate()
  const [data, setData] = useState<PageData<MyAssessmentItem>>({ items: [], total: 0, page: 1, page_size: 10 })
  const [loading, setLoading] = useState(false)

  const load = useCallback(async (page = 1, pageSize = 10) => {
    setLoading(true)
    try {
      const d = await request<PageData<MyAssessmentItem>>('/assessments/mine', {
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

  return (
    <Card
      title="我的考核"
      extra={
        <Button icon={<ReloadOutlined />} onClick={() => load(data.page, data.page_size)}>
          刷新
        </Button>
      }
    >
      <Table<MyAssessmentItem>
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
          { title: '题量', dataIndex: 'question_count', width: 70 },
          {
            title: '及格线',
            dataIndex: 'pass_accuracy',
            width: 90,
            render: (v: number) => `${v}%`,
          },
          { title: '截止时间', dataIndex: 'deadline', width: 170, render: (v: string | null) => v ?? '不限' },
          {
            title: '状态',
            dataIndex: 'my_status',
            width: 100,
            render: (s: MyAssessmentItem['my_status']) => (
              <Tag color={STATUS[s].color}>{STATUS[s].text}</Tag>
            ),
          },
          {
            title: '最佳成绩',
            dataIndex: 'best_accuracy',
            width: 100,
            render: (v: number | null) => (v === null ? '—' : `${v}%`),
          },
          { title: '已考次数', dataIndex: 'record_count', width: 90 },
          {
            title: '操作',
            width: 120,
            render: (_, row) =>
              row.my_status === 'expired' ? (
                <span style={{ color: '#999' }}>已截止</span>
              ) : (
                <Button
                  type="primary"
                  size="small"
                  onClick={() => navigate(`/emp/assessments/${row.assessment_id}/take`)}
                >
                  {row.record_count > 0 ? '再次考核' : '开始考核'}
                </Button>
              ),
          },
        ]}
      />
    </Card>
  )
}
