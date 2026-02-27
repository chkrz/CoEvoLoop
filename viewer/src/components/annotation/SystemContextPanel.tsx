import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface SystemMessage {
  role: 'system';
  content: string;
  timestamp?: string;
  id?: string;
}

interface SystemContextPanelProps {
  systemMessages: SystemMessage[];
  onEdit: (index: number, content: string) => void;
  className?: string;
  defaultExpanded?: boolean;
}

export const SystemContextPanel: React.FC<SystemContextPanelProps> = ({
  systemMessages,
  onEdit,
  className,
  defaultExpanded = false
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');

  const handleEdit = (index: number) => {
    setEditContent(systemMessages[index].content);
    setEditingIndex(index);
  };

  const handleSave = (index: number) => {
    onEdit(index, editContent);
    setEditingIndex(null);
  };

  const handleCancel = () => {
    setEditingIndex(null);
    setEditContent('');
  };

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
  };

  if (!systemMessages || systemMessages.length === 0) {
    return null;
  }

  return (
    <div className={cn('border rounded-lg bg-amber-50', className)}>
      {/* 面板头部 */}
      <div 
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-amber-100 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-amber-100 text-amber-800">
            系统提示
          </Badge>
          <span className="text-sm text-amber-700">
            {systemMessages.length} 条系统消息
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-amber-600" />
          ) : (
            <ChevronDown className="w-4 h-4 text-amber-600" />
          )}
        </div>
      </div>

      {/* 折叠内容 */}
      <div className={cn(
        'overflow-hidden transition-all duration-300',
        isExpanded ? 'max-h-[500px]' : 'max-h-0'
      )}>
        <div className="p-3 pt-0 space-y-3">
          {systemMessages.map((message, index) => (
            <div key={message.id || index} className="bg-white rounded-md p-3 border border-amber-200">
              {/* 消息头部 */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-amber-700">
                  系统消息 #{index + 1}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-amber-600 hover:text-amber-800"
                    onClick={() => handleCopy(message.content)}
                    title="复制内容"
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                  {editingIndex !== index && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-amber-600 hover:text-amber-800"
                      onClick={() => handleEdit(index)}
                      title="编辑内容"
                    >
                      编辑
                    </Button>
                  )}
                </div>
              </div>

              {/* 消息内容 */}
              {editingIndex === index ? (
                <div className="space-y-2">
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full min-h-[80px] p-2 text-sm border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-amber-400"
                    autoFocus
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleCancel}
                      className="h-7 px-2 text-xs"
                    >
                      取消
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleSave(index)}
                      className="h-7 px-2 text-xs bg-amber-500 hover:bg-amber-600"
                    >
                      保存
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="whitespace-pre-wrap text-sm text-gray-700">
                  {message.content}
                </div>
              )}

              {/* 时间戳 */}
              {message.timestamp && (
                <div className="text-xs text-gray-500 mt-2">
                  {new Date(message.timestamp).toLocaleString('zh-CN')}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};