import { useCallback, useEffect, useRef, useState } from 'react'
import { Button, Card, Popconfirm, Space, Table, Tag, Upload, App as AntApp } from 'antd'
import { DeleteOutlined, InboxOutlined, ReloadOutlined } from '@ant-design/icons'
import type { UploadProps } from 'antd'
import { request, TOKEN_KEY } from '../../api/client'
import type { DocItem } from '../../api/types'

const STATUS_TAG: Record<DocItem['status'], { color: string; text: string }> = {
  processing: { color: 'blue', text: '解析中' },
  ready: { color: 'green', text: '已就绪' },
  failed: { color: 'red', text: '失败' },
}

export default function Docs() {
  const { message } = AntApp.useApp()
  const [items, setItems] = useState<DocItem[]>([])
  const [loading, setLoading] = useState(false)
  const timer = useRef<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const d = await request<{ items: DocItem[] }>('/knowledge/documents')
      setItems(d.items)
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [message])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const hasProcessing = items.some((i) => i.status === 'processing')
    if (hasProcessing && timer.current === null) {
      timer.current = window.setInterval(load, 3000)
    }
    if (!hasProcessing && timer.current !== null) {
      window.clearInterval(timer.current)
      timer.current = null
    }
    return () => {
      if (timer.current !== null) {
        window.clearInterval(timer.current)
        timer.current = null
      }
    }
  }, [items, load])

  const uploadProps: UploadProps = {
    name: 'file',
    multiple: false,
    action: '/api/v1/knowledge/documents',
    headers: { Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY) ?? ''}` },
    showUploadList: false,
    onChange(info) {
      if (info.file.status === 'uploading') return
      if (info.file.status === 'done') {
        const code = info.file.response?.code
        if (code === 0) {
          message.success(`${info.file.name} 上传成功，正在解析`)
          load()
        } else {
          message.error(info.file.response?.message ?? '上传失败')
        }
      } else if (info.file.status === 'error') {
        message.error(`${info.file.name} 上传失败`)
      }
    },
  }

  const onDelete = async (doc: DocItem) => {
    try {
      await request(`/knowledge/documents/${doc.doc_id}`, { method: 'DELETE' })
      message.success('已删除')
      load()
    } catch (e) {
      message.error(e instanceof Error ? e.message : '删除失败')
    }
  }

  return (
    <Card
      title="培训资料"
      extra={
        <Button icon={<ReloadOutlined />} onClick={load}>
          刷新
        </Button>
      }
    >
      <Upload.Dragger {...uploadProps} style={{ marginBottom: 16 }}>
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">点击或拖拽文件到此处上传培训资料</p>
        <p className="ant-upload-hint">支持 PDF / Word / Markdown / 纯文本，单文件不超过 10MB</p>
      </Upload.Dragger>
      <Table<DocItem>
        rowKey="doc_id"
        loading={loading}
        dataSource={items}
        pagination={false}
        columns={[
          { title: '文件名', dataIndex: 'file_name' },
          { title: '类型', dataIndex: 'file_type', width: 80 },
          {
            title: '大小',
            dataIndex: 'file_size',
            width: 100,
            render: (s: number) => `${(s / 1024).toFixed(1)} KB`,
          },
          {
            title: '状态',
            dataIndex: 'status',
            width: 100,
            render: (s: DocItem['status']) => (
              <Tag color={STATUS_TAG[s].color}>{STATUS_TAG[s].text}</Tag>
            ),
          },
          { title: '分块数', dataIndex: 'chunk_count', width: 90 },
          {
            title: '错误',
            dataIndex: 'error_message',
            render: (e: string | null) => e ?? '—',
          },
          { title: '上传时间', dataIndex: 'created_at', width: 180 },
          {
            title: '操作',
            width: 90,
            render: (_, row) => (
              <Space>
                <Popconfirm title="删除后基于该资料的考核将无法出题" onConfirm={() => onDelete(row)}>
                  <Button size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />
    </Card>
  )
}
