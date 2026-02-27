import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronDown, ChevronUp, MessageSquare, Edit3, Check, X, Copy, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { ContextMessage } from './DialogueAnnotationView';
import { useToast } from '@/components/ui/use-toast';
import '@/styles/enhanced-context-animations.css';

interface EnhancedContextInlinePanelProps {
  contextMessages: ContextMessage[];
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: (index: number, content: string) => void;
  className?: string;
}

interface EditingState {
  index: number;
  content: string;
  originalContent: string;
}

interface MessageStats {
  total: number;
  user: number;
  assistant: number;
  totalTokens: number;
}

export const EnhancedContextInlinePanel: React.FC<EnhancedContextInlinePanelProps> = ({
  contextMessages,
  isExpanded,
  onToggle,
  onEdit,
  className
}) => {
  const [editingState, setEditingState] = useState<EditingState | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  const [messageStats, setMessageStats] = useState<MessageStats>({
    total: 0,
    user: 0,
    assistant: 0,
    totalTokens: 0
  });
  
  const { toast } = useToast();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editContainerRef = useRef<HTMLDivElement>(null);

  // 计算消息统计
  useEffect(() => {
    const stats = {
      total: contextMessages.length,
      user: contextMessages.filter(msg => msg.role === 'user').length,
      assistant: contextMessages.filter(msg => msg.role === 'assistant').length,
      totalTokens: contextMessages.reduce((acc, msg) => acc + Math.ceil(msg.content.length / 4), 0)
    };
    setMessageStats(stats);
  }, [contextMessages]);

  // 双击编辑功能
  const handleDoubleClickEdit = useCallback((index: number, content: string) => {
    if (editingState && editingState.index !== index) {
      // 如果有其他正在编辑的内容，先取消
      handleEditCancel();
    }
    setEditingState({ index, content, originalContent: content });
  }, [editingState]);

  // 键盘快捷键处理
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!editingState) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      handleEditCancel();
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleEditSave();
    }
  }, [editingState]);

  // 注册键盘事件
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // 自动聚焦到编辑框
  useEffect(() => {
    if (editingState && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [editingState]);

  // 点击外部取消编辑
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (editContainerRef.current && !editContainerRef.current.contains(event.target as Node)) {
        if (editingState && editingState.content !== editingState.originalContent) {
          setShowUnsavedWarning(true);
        } else {
          handleEditCancel();
        }
      }
    };

    if (editingState) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [editingState]);

  const handleEditStart = (index: number, content: string) => {
    if (editingState && editingState.index !== index) {
      handleEditCancel();
    }
    setEditingState({ index, content, originalContent: content });
  };

  const handleEditSave = useCallback(() => {
    if (editingState) {
      onEdit(editingState.index, editingState.content);
      setEditingState(null);
      setShowUnsavedWarning(false);
      toast({
        title: "编辑已保存",
        description: "消息内容已成功更新",
        duration: 2000,
      });
    }
  }, [editingState, onEdit, toast]);

  const handleEditCancel = useCallback(() => {
    setEditingState(null);
    setShowUnsavedWarning(false);
  }, []);

  const handleEditChange = (content: string) => {
    if (editingState) {
      setEditingState({ ...editingState, content });
    }
  };

  const handleCopyMessage = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      toast({
        title: "已复制",
        description: "消息内容已复制到剪贴板",
        duration: 2000,
      });
    } catch (error) {
      toast({
        title: "复制失败",
        description: "无法复制到剪贴板",
        variant: "destructive",
        duration: 2000,
      });
    }
  };

  const handleContinueEdit = () => {
    setShowUnsavedWarning(false);
  };

  const handleDiscardChanges = () => {
    setEditingState(null);
    setShowUnsavedWarning(false);
  };

  if (messageStats.total === 0) {
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
            "hover:bg-gray-100 transition-all duration-200",
            "px-2 py-1 h-auto rounded-md",
            "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
          )}
        >
          {isExpanded ? (
            <ChevronUp className="w-3 h-3 flex-shrink-0 transition-transform duration-200" />
          ) : (
            <ChevronDown className="w-3 h-3 flex-shrink-0 transition-transform duration-200" />
          )}
          <span className="hidden sm:inline">
            {isExpanded ? '收起Context' : `查看Context (${messageStats.total}条)`}
          </span>
          <span className="sm:hidden">
            {isExpanded ? '收起' : `${messageStats.total}条`}
          </span>
          <div className="hidden md:flex items-center space-x-1">
            {messageStats.user > 0 && (
              <span className="text-blue-600 text-xs font-medium">
                {messageStats.user}用户
              </span>
            )}
            {messageStats.assistant > 0 && (
              <span className="text-green-600 text-xs font-medium">
                {messageStats.assistant}AI
              </span>
            )}
            <span className="text-gray-500 text-xs">
              ~{messageStats.totalTokens}tokens
            </span>
          </div>
        </Button>
      </div>

      {/* 展开内容 */}
      {isExpanded && (
        <div className={cn(
          "mt-2 space-y-2 context-panel-enter-active",
          "bg-gradient-to-br from-gray-50 to-blue-50/30",
          "border-l-4 border-blue-400 rounded-r-lg p-3",
          "shadow-sm hover:shadow-md transition-all duration-300"
        )}>
          {contextMessages.map((message, index) => (
            <div
              key={message.id || `context-${index}`}
              className={cn(
                "relative group",
                "transition-all duration-300 ease-in-out",
                "p-3 rounded-lg border",
                "hover:shadow-lg hover:border-gray-300",
                hoveredIndex === index && "bg-white/80 shadow-md",
                selectedIndex === index && "ring-2 ring-blue-400 ring-offset-1",
                editingState?.index === index && "ring-2 ring-blue-500 shadow-xl bg-white"
              )}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
              onClick={() => setSelectedIndex(index)}
              onDoubleClick={() => handleDoubleClickEdit(index, message.content)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleEditStart(index, message.content);
                }
              }}
              role="article"
              aria-label={`${message.role}消息，双击或按Enter键编辑`}
              tabIndex={0}
              aria-selected={selectedIndex === index}
              aria-expanded={editingState?.index === index}
            >
              {/* 消息头部 */}
              <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                <div className="flex items-center space-x-2">
                  <div
                    className={cn(
                      "w-2.5 h-2.5 rounded-full flex-shrink-0",
                      "ring-2 ring-offset-1",
                      message.role === 'user' 
                        ? "bg-blue-500 ring-blue-200" 
                        : "bg-green-500 ring-green-200"
                    )}
                    aria-hidden="true"
                  />
                  <span className={cn(
                    "text-xs font-semibold uppercase tracking-wide",
                    message.role === 'user' ? "text-blue-700" : "text-green-700"
                  )}>
                    {message.role === 'user' ? '用户' : 'AI助手'}
                  </span>
                  {message.timestamp && (
                    <span className="text-xs text-gray-500 font-mono">
                      {new Date(message.timestamp).toLocaleString('zh-CN', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  )}
                </div>

                {/* 操作按钮组 */}
                <div className={cn(
                  "flex items-center space-x-1 transition-all duration-200",
                  hoveredIndex === index && !editingState ? "opacity-100" : "opacity-0"
                )}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopyMessage(message.content);
                    }}
                    className="p-1.5 rounded hover:bg-gray-100 transition-colors"
                    title="复制消息"
                    aria-label="复制消息内容"
                  >
                    <Copy className="w-3.5 h-3.5 text-gray-600" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditStart(index, message.content);
                    }}
                    className="p-1.5 rounded hover:bg-gray-100 transition-colors"
                    title="编辑消息"
                    aria-label="编辑消息内容"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-gray-600" />
                  </button>
                </div>
              </div>

              {/* 消息内容 */}
              <div className="ml-0 sm:ml-4">
                {editingState && editingState.index === index ? (
                  <div ref={editContainerRef} className="space-y-3">
                    <div className="relative">
                      <Textarea
                        ref={textareaRef}
                        value={editingState.content}
                        onChange={(e) => handleEditChange(e.target.value)}
                        className={cn(
                          "min-h-[80px] text-sm resize-none",
                          "bg-white border-2 border-blue-400",
                          "focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
                          "transition-all duration-200"
                        )}
                        aria-label="编辑消息内容"
                      />
                      <div className="absolute bottom-2 right-2 text-xs text-gray-500 bg-white/90 px-2 py-1 rounded">
                        {editingState.content.length} 字符
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleEditCancel}
                        className="h-7 px-3 text-xs hover:bg-gray-100"
                      >
                        <X className="w-3.5 h-3.5 mr-1" />
                        取消 (Esc)
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleEditSave}
                        className="h-7 px-3 text-xs bg-blue-500 hover:bg-blue-600"
                      >
                        <Check className="w-3.5 h-3.5 mr-1" />
                        保存 (Ctrl+Enter)
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div 
                    className={cn(
                      "whitespace-pre-wrap break-words text-sm",
                      "text-gray-700 leading-relaxed",
                      "cursor-text select-text",
                      "transition-all duration-200"
                    )}
                    role="text"
                  >
                    {message.content}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* 空状态 */}
          {contextMessages.length === 0 && (
            <div className="text-center py-6 text-gray-500">
              <MessageSquare className="w-8 h-8 mx-auto mb-3 opacity-50" />
              <p className="text-sm font-medium">暂无相关Context消息</p>
              <p className="text-xs text-gray-400 mt-1">双击空白区域可添加新消息</p>
            </div>
          )}
        </div>
      )}

      {/* 未保存更改警告 */}
      {showUnsavedWarning && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm mx-4 shadow-xl">
            <div className="flex items-center mb-4">
              <AlertCircle className="w-5 h-5 text-yellow-500 mr-2" />
              <h3 className="text-lg font-semibold">未保存的更改</h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              您有未保存的更改。是否要继续编辑并保存，还是放弃更改？
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDiscardChanges}
              >
                放弃更改
              </Button>
              <Button
                size="sm"
                onClick={handleContinueEdit}
              >
                继续编辑
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};