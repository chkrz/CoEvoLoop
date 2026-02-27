import React from 'react';
import { Badge } from '@/components/ui/badge';
import { ThumbsUp, ThumbsDown, Edit3, MessageSquare, CheckCircle } from 'lucide-react';
import { Annotation } from './AnnotationPanel';

interface AnnotationStatusIndicatorProps {
  annotations: Record<string, Annotation>;
  messageId: string;
  className?: string;
}

export function AnnotationStatusIndicator({ 
  annotations, 
  messageId, 
  className 
}: AnnotationStatusIndicatorProps) {
  const annotation = annotations[messageId];
  
  if (!annotation) return null;

  const getStatusInfo = () => {
    switch (annotation.type) {
      case 'positive':
        return {
          icon: <ThumbsUp className="w-3 h-3" />,
          label: '已好评',
          color: 'bg-green-100 text-green-700 border-green-200',
          bgColor: 'bg-green-50'
        };
      case 'negative':
        return {
          icon: <ThumbsDown className="w-3 h-3" />,
          label: '已差评',
          color: 'bg-red-100 text-red-700 border-red-200',
          bgColor: 'bg-red-50'
        };
      case 'improvement':
        return {
          icon: <Edit3 className="w-3 h-3" />,
          label: '已改进',
          color: 'bg-blue-100 text-blue-700 border-blue-200',
          bgColor: 'bg-blue-50'
        };
      default:
        return {
          icon: <MessageSquare className="w-3 h-3" />,
          label: '已备注',
          color: 'bg-gray-100 text-gray-700 border-gray-200',
          bgColor: 'bg-gray-50'
        };
    }
  };

  const status = getStatusInfo();

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <Badge 
        variant="outline" 
        className={`text-xs px-2 py-0.5 ${status.color} ${status.bgColor}`}
      >
        <div className="flex items-center gap-1">
          {status.icon}
          <span>{status.label}</span>
        </div>
      </Badge>
      
      {annotation.modifiedContent && (
        <Badge 
          variant="secondary" 
          className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 border-purple-200"
        >
          <div className="flex items-center gap-1">
            <CheckCircle className="w-3 h-3" />
            <span>已修改</span>
          </div>
        </Badge>
      )}
    </div>
  );
}

// 标注统计组件
interface AnnotationStatsProps {
  annotations: Record<string, Annotation>;
  messages: Array<{ id: string; role: string }>;
}

export function AnnotationStats({ annotations, messages }: AnnotationStatsProps) {
  const aiMessages = messages.filter(m => m.role === 'assistant');
  const annotatedMessages = Object.keys(annotations).filter(id => 
    aiMessages.some(m => m.id === id)
  );
  
  const stats = {
    total: annotatedMessages.length,
    positive: Object.values(annotations).filter(a => a.type === 'positive').length,
    negative: Object.values(annotations).filter(a => a.type === 'negative').length,
    improvement: Object.values(annotations).filter(a => a.type === 'improvement').length,
    modified: Object.values(annotations).filter(a => a.modifiedContent).length
  };

  if (stats.total === 0) return null;

  return (
    <div className="flex items-center gap-4 text-sm">
      <span className="text-gray-600 font-medium">标注统计:</span>
      
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-xs bg-green-50 text-green-700">
          好评 {stats.positive}
        </Badge>
        <Badge variant="outline" className="text-xs bg-red-50 text-red-700">
          差评 {stats.negative}
        </Badge>
        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
          改进 {stats.improvement}
        </Badge>
        {stats.modified > 0 && (
          <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700">
            修改 {stats.modified}
          </Badge>
        )}
      </div>
      
      <span className="text-gray-500 text-xs">
        共 {stats.total}/{aiMessages.length} 条消息已标注
      </span>
    </div>
  );
}