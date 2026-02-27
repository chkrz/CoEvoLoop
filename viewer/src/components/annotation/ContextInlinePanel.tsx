import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, MessageSquare, Edit3, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { ContextMessage } from './DialogueAnnotationView';
import '@/styles/annotation-animations.css';

interface ContextInlinePanelProps {
  contextMessages: ContextMessage[];
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: (index: number, content: string) => void;
  className?: string;
}

interface EditingState {
  index: number;
  content: string;
}

export const ContextInlinePanel: React.FC<ContextInlinePanelProps> = ({
  contextMessages,
  isExpanded,
  onToggle,
  onEdit,
  className
}) => {
  const [editingState, setEditingState] = useState<EditingState | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const totalMessages = contextMessages.length;
  const userMessages = contextMessages.filter(msg => msg.role === 'user');
  const assistantMessages = contextMessages.filter(msg => msg.role === 'assistant');

  const handleEditStart = (index: number, content: string) => {
    setEditingState({ index, content });
  };

  const handleEditSave = () => {
    if (editingState) {
      onEdit(editingState.index, editingState.content);
      setEditingState(null);
    }
  };

  const handleEditCancel = () => {
    setEditingState(null);
  };

  const handleEditChange = (content: string) => {
    if (editingState) {
      setEditingState({ ...editingState, content });
    }
  };

  if (totalMessages === 0) {
    return null;
  }

  return (
    <div className={cn('mt-2', className)}>
      {/* 展开/收起按钮 */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          className={cn(
            "flex items-center space-x-1 sm:space-x-2 text-xs",
            "hover:bg-gray-100 transition-colors",
            "px-2 py-1 h-auto rounded-md"
          )}
        >
          {isExpanded ? (
            <ChevronUp className="w-3 h-3 flex-shrink-0" />
          ) : (
            <ChevronDown className="w-3 h-3 flex-shrink-0" />
          )}
          <span className="hidden sm:inline">
            {isExpanded ? '收起Context' : `查看Context (${totalMessages}条)`}
          </span>
          <span className="sm:hidden">
            {isExpanded ? '收起' : `${totalMessages}条`}
          </span>
          <div className="hidden md:flex items-center space-x-1">
            {userMessages.length > 0 && (
              <span className="text-blue-600 text-xs">
                {userMessages.length}用户
              </span>
            )}
            {assistantMessages.length > 0 && (
              <span className="text-green-600 text-xs">
                {assistantMessages.length}AI
              </span>
            )}
          </div>
        </Button>
      </div>

      {/* 展开内容 */}
      {isExpanded && (
        <div className={cn(
          "mt-2 space-y-2 context-panel-enter-active",
          "bg-gray-50 border-l-4 border-blue-400 rounded-r-lg p-3",
          "shadow-sm hover:shadow-md transition-shadow duration-200"
        )}>
          {contextMessages.map((message, index) => (
            <div
              key={message.id || `context-${index}`}
              className={cn(
                "relative group",
                "transition-all duration-200",
                "p-2 rounded-lg",
                hoveredIndex === index && "bg-white/60 shadow-sm"
              )}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              {/* 消息头部 */}
              <div className="flex items-center justify-between mb-1 flex-wrap gap-1">
                <div className="flex items-center space-x-1 sm:space-x-2">
                  <div
                    className={cn(
                      "w-2 h-2 rounded-full flex-shrink-0",
                      message.role === 'user' ? "bg-blue-500" : "bg-green-500"
                    )}
                  />
                  <span className={cn(
                    "text-xs font-medium",
                    message.role === 'user' ? "text-blue-700" : "text-green-700"
                  )}>
                    {message.role === 'user' ? '用户' : 'AI助手'}
                  </span>
                  {message.timestamp && (
                    <span className="text-xs text-gray-500">
                      {new Date(message.timestamp).toLocaleString('zh-CN', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  )}
                </div>

                {/* 编辑按钮 */}
                <div className={cn(
                  "transition-opacity duration-200",
                  hoveredIndex === index && !editingState ? "opacity-100" : "opacity-0"
                )}>
                  <button
                    onClick={() => handleEditStart(index, message.content)}
                    className="p-1 rounded hover:bg-gray-200"
                    title="编辑消息"
                  >
                    <Edit3 className="w-3 h-3 text-gray-600" />
                  </button>
                </div>
              </div>

              {/* 消息内容 */}
              <div className="ml-0 sm:ml-4">
                {editingState && editingState.index === index ? (
                  <div className="space-y-2">
                    <Textarea
                      value={editingState.content}
                      onChange={(e) => handleEditChange(e.target.value)}
                      className="min-h-[60px] text-sm resize-none bg-white"
                      autoFocus
                    />
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleEditCancel}
                        className="h-6 px-2 text-xs"
                      >
                        <X className="w-3 h-3 mr-1" />
                        取消
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleEditSave}
                        className="h-6 px-2 text-xs"
                      >
                        <Check className="w-3 h-3 mr-1" />
                        保存
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap break-words text-sm text-gray-700 leading-relaxed">
                    {message.content}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* 空状态 */}
          {contextMessages.length === 0 && (
            <div className="text-center py-4 text-gray-500">
              <MessageSquare className="w-6 h-6 mx-auto mb-2 opacity-50" />
              <p className="text-sm">暂无相关Context消息</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};