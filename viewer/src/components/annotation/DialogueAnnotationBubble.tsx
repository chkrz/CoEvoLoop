import React, { useState, useMemo } from 'react';
import { AutoResizeTextarea } from '@/components/ui/auto-resize-textarea';
import { Button } from '@/components/ui/button';
import { Check, X, Edit3, ChevronDown, ChevronUp, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DiffHighlight } from './DiffHighlight';

export interface DialogueMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
  id?: string;
  index?: number;
}

interface DialogueAnnotationBubbleProps {
  message: DialogueMessage & { isContext?: boolean };
  onEdit: (content: string) => void;
  className?: string;
  contextCount?: number; // 关联的context消息数量
  onToggleContext?: () => void; // 展开/收起context的回调
  isContextExpanded?: boolean; // context是否已展开
  originalContent?: string; // 原始内容，用于差异显示
  showDiff?: boolean; // 是否显示差异
  onToggleDiff?: (show: boolean) => void; // 切换差异显示的回调
}

export const DialogueAnnotationBubble: React.FC<DialogueAnnotationBubbleProps> = ({
  message,
  onEdit,
  className,
  contextCount = 0,
  onToggleContext,
  isContextExpanded = false,
  originalContent,
  showDiff = false,
  onToggleDiff
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [localShowDiff, setLocalShowDiff] = useState(showDiff);

  const hasDiff = useMemo(() => {
    return originalContent !== undefined && originalContent !== message.content;
  }, [originalContent, message.content]);

  const handleSave = () => {
    onEdit(editContent);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditContent(message.content);
    setIsEditing(false);
  };

  const handleToggleDiff = () => {
    const newValue = !localShowDiff;
    setLocalShowDiff(newValue);
    onToggleDiff?.(newValue);
  };

  React.useEffect(() => {
    setLocalShowDiff(showDiff);
  }, [showDiff]);

  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  const isSystem = message.role === 'system';
  const isContext = message.isContext || false;

  return (
    <div className={cn(
      'group relative',
      isUser && 'flex justify-end',
      isAssistant && 'flex justify-start',
      isSystem && 'flex justify-center',
      className
    )}>
      <div className={cn(
        'max-w-[85%] rounded-lg px-4 py-3 transition-all duration-200 relative',
        isUser && !isContext && 'bg-blue-500 text-white',
        isAssistant && !isContext && 'bg-gray-100 text-gray-900',
        isSystem && 'bg-amber-50 text-amber-900 border border-amber-200',
        isUser && isContext && 'bg-blue-100 text-blue-900 border border-blue-200',
        isAssistant && isContext && 'bg-green-50 text-green-900 border border-green-200',
        isEditing && 'ring-2 ring-blue-400 ring-offset-2'
      )}>
        {/* 消息头部 */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <span className={cn(
              'text-xs font-medium',
              isUser && !isContext && 'text-blue-100',
              isAssistant && !isContext && 'text-gray-600',
              isSystem && 'text-amber-700',
              isUser && isContext && 'text-blue-700',
              isAssistant && isContext && 'text-green-700'
            )}>
              {message.role === 'user' ? '用户' : 
               message.role === 'assistant' ? 'AI助手' : '系统'}
            </span>
            {isContext && (
              <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
                Context
              </span>
            )}
            {/* Context计数显示 */}
            {contextCount > 0 && !isContext && (
              <button
                onClick={onToggleContext}
                className={cn(
                  'text-xs px-2 py-0.5 rounded-full transition-colors',
                  'hover:bg-gray-200',
                  isUser && 'bg-blue-100 text-blue-700',
                  isAssistant && 'bg-gray-200 text-gray-700'
                )}
                title={`查看 ${contextCount} 条相关Context消息`}
              >
                {contextCount} Context
              </button>
            )}
          </div>
          
          {!isEditing && (
           <div className="flex items-center space-x-1">
              {/* 差异显示切换按钮 */}
              {hasDiff && (
                <button
                  onClick={handleToggleDiff}
                  className={cn(
                    'opacity-0 group-hover:opacity-100 transition-opacity',
                    'p-1 rounded',
                    isUser && !isContext && 'hover:bg-white/20',
                    isAssistant && !isContext && 'hover:bg-gray-200',
                    isSystem && 'hover:bg-amber-100',
                    isUser && isContext && 'hover:bg-blue-200',
                    isAssistant && isContext && 'hover:bg-green-200'
                  )}
                  title={localShowDiff ? '隐藏差异' : '显示差异'}
                >
                  {localShowDiff ? (
                    <EyeOff className="w-3 h-3" />
                  ) : (
                    <Eye className="w-3 h-3" />
                  )}
                </button>
              )}
              
              {/* Context展开/收起按钮 */}
              {contextCount > 0 && onToggleContext && (
                <button
                  onClick={onToggleContext}
                  className={cn(
                    'opacity-0 group-hover:opacity-100 transition-opacity',
                    'p-1 rounded',
                    isUser && !isContext && 'hover:bg-white/20',
                    isAssistant && !isContext && 'hover:bg-gray-200',
                    isSystem && 'hover:bg-amber-100',
                    isUser && isContext && 'hover:bg-blue-200',
                    isAssistant && isContext && 'hover:bg-green-200'
                  )}
                  title={isContextExpanded ? '收起Context' : '展开Context'}
                >
                  {isContextExpanded ? (
                    <ChevronUp className="w-3 h-3" />
                  ) : (
                    <ChevronDown className="w-3 h-3" />
                  )}
                </button>
              )}
              
              <button
                onClick={() => setIsEditing(true)}
                className={cn(
                  'opacity-0 group-hover:opacity-100 transition-opacity',
                  'p-1 rounded',
                  isUser && !isContext && 'hover:bg-white/20',
                  isAssistant && !isContext && 'hover:bg-gray-200',
                  isSystem && 'hover:bg-amber-100',
                  isUser && isContext && 'hover:bg-blue-200',
                  isAssistant && isContext && 'hover:bg-green-200'
                )}
                title="编辑消息"
              >
                <Edit3 className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {/* 消息内容 */}
        {isEditing ? (
          <div className="space-y-2">
            <AutoResizeTextarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="text-sm"
              autoFocus
              onSave={handleSave}
              onCancel={handleCancel}
            />
            <div className="flex justify-end gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCancel}
                className="h-7 px-2 text-xs"
              >
                <X className="w-3 h-3 mr-1" />
                取消
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                className="h-7 px-2 text-xs"
              >
                <Check className="w-3 h-3 mr-1" />
                保存
              </Button>
            </div>
          </div>
        ) : (
          <div className="whitespace-pre-wrap break-words text-sm">
            {hasDiff && localShowDiff && originalContent ? (
              <DiffHighlight
                original={originalContent}
                modified={message.content}
                showDiff={true}
                compact={true}
              />
            ) : (
              message.content
            )}
          </div>
        )}

        {/* 时间戳 */}
        {message.timestamp && !isEditing && (
          <div className={cn(
            'text-xs mt-2',
            isUser && !isContext && 'text-blue-200 text-right',
            isAssistant && !isContext && 'text-gray-500',
            isSystem && 'text-amber-600 text-center',
            isUser && isContext && 'text-blue-600 text-right',
            isAssistant && isContext && 'text-green-600'
          )}>
            {new Date(message.timestamp).toLocaleString('zh-CN')}
          </div>
        )}
      </div>
    </div>
  );
};