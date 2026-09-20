import { useCallback, useEffect, useState } from 'react'
import { Button, Card, Table, Tag, App as AntApp } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import { request } from '../../api/client'
import type { PageData, RecordItem } from '../../api/types'

export default function MyRecords() {
  const { message } = AntApp.useApp()
  const [data, setData] = useState<PageData<RecordItem>>({ items: [], total: 0, page: 1, page_size: 10 })
  const [loading, setLoading] = useState(false)

  const load = useCallback(async (page = 1, pageSize = 10) => {
    setLoading(true)
    try {
      const d = await request<PageData<RecordItem>>('/assessments/records/mine', {
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
      title="我的成绩"
      extra={
        <Button icon={<ReloadOutlined />} onClick={() => load(data.page, data.page_size)}>
          刷新
        </Button>
      }
    >
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
          {
            title: '正确率',
            dataIndex: 'accuracy',
            width: 90,
            render: (v: number) => `${v}%`,
          },
          {
            title: '结果',
            dataIndex: 'passed',
            width: 90,
            render: (p: boolean) => (p ? <Tag color="green">通过</Tag> : <Tag color="red">未通过</Tag>),
          },
          {
            title: '用时',
            dataIndex: 'duration_seconds',
            width: 100,
            render: (s: number) => `${Math.floor(s / 60)}分${s % 60}秒`,
          },
          { title: '提交时间', dataIndex: 'created_at', width: 180 },
        ]}
      />
    </Card>
  )
}
