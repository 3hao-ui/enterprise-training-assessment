import { useCallback, useEffect, useState } from 'react'
import { Button, Card, Select, Statistic, Row, Col, Space, Table, Tag, App as AntApp } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import { useSearchParams } from 'react-router-dom'
import { request } from '../../api/client'
import type { AssessmentItem, PageData, RecordItem } from '../../api/types'

export default function Records() {
  const { message } = AntApp.useApp()
  const [params, setParams] = useSearchParams()
  const assessmentId = params.get('assessment') ?? ''
  const [data, setData] = useState<PageData<RecordItem>>({ items: [], total: 0, page: 1, page_size: 10 })
  const [assessments, setAssessments] = useState<AssessmentItem[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async (page = 1, pageSize = 10, asmt = assessmentId) => {
    setLoading(true)
    try {
      const url = asmt ? `/admin/assessments/${asmt}/records` : '/admin/records'
      const d = await request<PageData<RecordItem>>(url, { params: { page, page_size: pageSize } })
      setData(d)
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [assessmentId, message])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    request<PageData<AssessmentItem>>('/admin/assessments', { params: { page: 1, page_size: 50 } })
      .then((d) => setAssessments(d.items))
      .catch(() => {})
  }, [])

  const passedCount = data.items.filter((i) => i.passed).length
  const avg = data.items.length
    ? Math.round(data.items.reduce((s, i) => s + i.accuracy, 0) / data.items.length)
    : 0

  return (
    <Card
      title="成绩报表"
      extra={
        <Space>
          <Select
            allowClear
            placeholder="按考核筛选"
            style={{ width: 260 }}
            value={assessmentId || undefined}
            options={assessments.map((a) => ({ label: a.title, value: a.assessment_id }))}
            onChange={(v) => {
              setParams(v ? { assessment: v } : {})
              load(1, data.page_size, v ?? '')
            }}
          />
          <Button icon={<ReloadOutlined />} onClick={() => load(data.page, data.page_size)}>
            刷新
          </Button>
        </Space>
      }
    >
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Statistic title="本页记录数" value={data.items.length} suffix={`/ ${data.total}`} />
        </Col>
        <Col span={8}>
          <Statistic title="本页通过数" value={passedCount} valueStyle={{ color: '#3f8600' }} />
        </Col>
        <Col span={8}>
          <Statistic title="本页平均正确率" value={avg} suffix="%" />
        </Col>
      </Row>
      <Table<RecordItem>
        rowKey="record_id"
        loading={loading}
        dataSource={data.items}
        pagination={{
          current: data.page,
          pageSize: data.page_size,
          total: data.total,
          onChange: (p, s) => load(p, s),
          showTotal: (t) => `共 ${t} 条成绩`,
        }}
        columns={[
          { title: '考核', dataIndex: 'assessment_title', ellipsis: true },
          { title: '员工', dataIndex: 'nickname' },
          { title: '用户名', dataIndex: 'username' },
          { title: '部门', dataIndex: 'department' },
          {
            title: '正确率',
            dataIndex: 'accuracy',
            width: 90,
            render: (v: number) => `${v}%`,
          },
          {
            title: '结果',
            dataIndex: 'passed',
            width: 80,
            render: (p: boolean) => (p ? <Tag color="green">通过</Tag> : <Tag color="red">未通过</Tag>),
          },
          {
            title: '用时',
            dataIndex: 'duration_seconds',
            width: 90,
            render: (s: number) => `${Math.floor(s / 60)}分${s % 60}秒`,
          },
          { title: '提交时间', dataIndex: 'created_at', width: 180 },
        ]}
      />
    </Card>
  )
}
