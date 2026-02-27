import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ThumbsUp, ThumbsDown, Edit3, MessageSquare, Download, Eye } from 'lucide-react';
import { Annotation } from './AnnotationPanel';

interface AnnotationOverviewProps {
  annotations: Record<string, Annotation>;
  messages: Array<{ id: string; role: string; content: string; timestamp: string }>;
  onExport: () => void;
  onViewAnnotation: (messageId: string) => void;
}

export function AnnotationOverview({ 
  annotations, 
  messages, 
  onExport, 
  onViewAnnotation 
}: AnnotationOverviewProps) {
  const aiMessages = messages.filter(m => m.role === 'assistant');
  const annotatedMessages = Object.keys(annotations).filter(id => 
    aiMessages.some(m => m.id === id)
  );

  const stats = {
    total: annotatedMessages.length,
    positive: Object.values(annotations).filter(a => a.type === 'positive').length,
    negative: Object.values(annotations).filter(a => a.type === 'negative').length,
    improvement: Object.values(annotations).filter(a => a.type === 'improvement').length,
    neutral: Object.values(annotations).filter(a => a.type === 'neutral').length,
    modified: Object.values(annotations).filter(a => a.modifiedContent).length
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'positive': return <ThumbsUp className="w-4 h-4" />;
      case 'negative': return <ThumbsDown className="w-4 h-4" />;
      case 'improvement': return <Edit3 className="w-4 h-4" />;
      default: return <MessageSquare className="w-4 h-4" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'positive': return 'text-green-600 bg-green-50 border-green-200';
      case 'negative': return 'text-red-600 bg-red-50 border-red-200';
      case 'improvement': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'positive': return '好评';
      case 'negative': return '差评';
      case 'improvement': return '改进';
      default: return '备注';
    }
  };

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const truncateContent = (content: string, maxLength: number = 100) => {
    return content.length > maxLength ? content.substring(0, maxLength) + '...' : content;
  };

  if (stats.total === 0) {
    return (
      <Card className="w-full">
        <CardContent className="p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
            <MessageSquare className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">暂无标注数据</h3>
          <p className="text-sm text-gray-500">开始为AI回复添加标注，收集反馈数据</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* 统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">总标注数</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                <MessageSquare className="w-4 h-4 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">好评</p>
                <p className="text-2xl font-bold text-green-600">{stats.positive}</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                <ThumbsUp className="w-4 h-4 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">差评</p>
                <p className="text-2xl font-bold text-red-600">{stats.negative}</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                <ThumbsDown className="w-4 h-4 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">改进建议</p>
                <p className="text-2xl font-bold text-blue-600">{stats.improvement}</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                <Edit3 className="w-4 h-4 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 标注列表 */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">标注详情</CardTitle>
            <Button
              size="sm"
              variant="outline"
              onClick={onExport}
              className="flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              导出数据
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-96">
            <div className="divide-y divide-gray-200">
              {annotatedMessages.map(messageId => {
                const annotation = annotations[messageId];
                const message = messages.find(m => m.id === messageId);
                if (!message || !annotation) return null;

                return (
                  <div key={messageId} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge className={`text-xs ${getTypeColor(annotation.type)}`}>
                          {getTypeIcon(annotation.type)}
                          <span className="ml-1">{getTypeLabel(annotation.type)}</span>
                        </Badge>
                        {annotation.modifiedContent && (
                          <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-700">
                            已修改
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-gray-500">
                        {formatDate(annotation.timestamp)}
                      </span>
                    </div>
                    
                    <div className="mb-2">
                      <p className="text-sm text-gray-800 line-clamp-2">
                        {truncateContent(message.content)}
                      </p>
                    </div>
                    
                    {annotation.annotation && (
                      <div className="mb-2">
                        <p className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                          {annotation.annotation}
                        </p>
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">
                        {formatDate(message.timestamp)}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 text-xs"
                        onClick={() => onViewAnnotation(messageId)}
                      >
                        <Eye className="w-3 h-3 mr-1" />
                        查看详情
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}