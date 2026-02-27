import React, { useState, useEffect } from 'react';
import { DialogueAnnotationBubble, DialogueMessage } from './DialogueAnnotationBubble';
import { SystemContextPanel, SystemMessage } from './SystemContextPanel';
import { ContextInlinePanel } from './ContextInlinePanel';
import { groupMessagesByAssociation, MessageGroup } from '@/lib/messageAssociation';
import { AnnotationItem } from '@/lib/annotationApiV2';

export interface ContextMessage extends DialogueMessage {
  isContext?: boolean;
  contextGroup?: string;
}

export interface DialogueAnnotationData {
  conversation: DialogueMessage[];
  systemContext: SystemMessage[];
  contextMessages: ContextMessage[];
  metadata?: Record<string, unknown>;
}

interface DialogueAnnotationViewProps {
  annotationItem: AnnotationItem;
  onContentChange: (updatedContent: Record<string, unknown>) => void;
  className?: string;
  showDiff?: boolean;
  onToggleDiff?: (show: boolean) => void;
}

export const DialogueAnnotationView: React.FC<DialogueAnnotationViewProps> = ({
  annotationItem,
  onContentChange,
  className,
  showDiff = false,
  onToggleDiff
}) => {
  const [dialogueData, setDialogueData] = useState<DialogueAnnotationData>({
    conversation: [],
    systemContext: [],
    contextMessages: [],
    metadata: {}
  });
  const [messageGroups, setMessageGroups] = useState<MessageGroup[]>([]);

  // 从annotationItem中提取对话数据
  useEffect(() => {
    const extractDialogueData = () => {
      const content = annotationItem.edited_content || annotationItem.original_content || {};
      
      if (!content) {
        setDialogueData({ conversation: [], systemContext: [], metadata: {} });
        setMessageGroups([]);
        return;
      }

      // 提取对话数据
      const conversationData = (content as any).conversations || 
                             (content as any).conversation || 
                             (content as any).messages || 
                             (content as any).dialogue || [];

      // 提取系统上下文数据
      const contextData = (content as any).context || 
                        (content as any).contexts || 
                        (content as any).context_data || 
                        (content as any).metadata?.context || [];

      // 转换对话数据格式
      const conversation: DialogueMessage[] = (conversationData as any[]).map((msg: any, index: number) => ({
        role: (msg.role || msg.from || 'user') as 'user' | 'assistant' | 'system',
        content: msg.content || msg.value || msg.text || '',
        timestamp: msg.timestamp || new Date().toISOString(),
        id: msg.id || `conv-${index}`,
        index
      }));

      // 转换系统上下文数据格式
      const systemContext: SystemMessage[] = (contextData as any[])
        .filter((ctx: any) => (ctx.role || ctx.from) === 'system')
        .map((ctx: any, index: number) => ({
          role: 'system',
          content: ctx.content || ctx.text || ctx.value || '',
          timestamp: ctx.timestamp || new Date().toISOString(),
          id: ctx.id || `sys-${index}`
        }));

      // 提取context中的user和assistant消息
      const contextMessages: ContextMessage[] = (contextData as any[])
        .filter((ctx: any) => {
          const role = ctx.role || ctx.from;
          return role === 'user' || role === 'assistant' || role === 'human';
        })
        .map((ctx: any, index: number) => ({
          role: (ctx.role || ctx.from || 'user') as 'user' | 'assistant',
          content: ctx.content || ctx.value || ctx.text || '',
          timestamp: ctx.timestamp || new Date().toISOString(),
          id: ctx.id || `ctx-${index}`,
          index,
          isContext: true,
          contextGroup: 'context'
        }));

      setDialogueData({
        conversation,
        systemContext,
        contextMessages,
        metadata: content.metadata || {}
      });

      // 使用消息关联算法创建消息分组
      const groups = groupMessagesByAssociation(conversation, contextMessages);
      setMessageGroups(groups);
    };

    extractDialogueData();
  }, [annotationItem]);

  // 处理对话消息编辑
  const handleConversationEdit = (index: number, newContent: string) => {
    const updatedConversation = [...dialogueData.conversation];
    updatedConversation[index] = {
      ...updatedConversation[index],
      content: newContent
    };

    const updatedData = {
      ...dialogueData,
      conversation: updatedConversation
    };

    setDialogueData(updatedData);
    
    // 更新原始数据结构 - 需要同时更新conversation和context中的对应消息
    const currentContent = annotationItem.edited_content || annotationItem.original_content || {};
    const conversationData = (currentContent as any).conversations || 
                           (currentContent as any).conversation || 
                           (currentContent as any).messages || [];
    const contextData = (currentContent as any).context || 
                      (currentContent as any).contexts || 
                      (currentContent as any).context_data || [];

    // 找到所有user/assistant/human角色的消息
    const allMessages = [
      ...(conversationData as any[]).filter((msg: any) => {
        const role = msg.role || msg.from || 'user';
        return role === 'user' || role === 'assistant' || role === 'human';
      }),
      ...(contextData as any[]).filter((ctx: any) => {
        const role = ctx.role || ctx.from;
        return role === 'user' || role === 'assistant' || role === 'human';
      })
    ];

    // 更新对应的消息
    if (index < allMessages.length) {
      const targetMessage = allMessages[index];
      
      // 更新conversation中的消息
      const updatedConversations = conversationData.map((msg: any) => 
        msg === targetMessage ? { ...msg, content: newContent } : msg
      );
      
      // 更新context中的消息
      const updatedContext = contextData.map((ctx: any) => 
        ctx === targetMessage ? { ...ctx, content: newContent } : ctx
      );

      const updatedContent = {
        ...currentContent,
        conversations: updatedConversations,
        context: updatedContext
      };

      onContentChange(updatedContent);
    }
  };

  // 处理系统上下文编辑
  const handleSystemContextEdit = (index: number, newContent: string) => {
    const updatedSystemContext = [...dialogueData.systemContext];
    updatedSystemContext[index] = {
      ...updatedSystemContext[index],
      content: newContent
    };

    const updatedData = {
      ...dialogueData,
      systemContext: updatedSystemContext
    };

    setDialogueData(updatedData);

    // 更新原始数据结构
    const currentContent = annotationItem.edited_content || annotationItem.original_content;
    
    // 重新提取系统上下文数据
    const contextData = currentContent?.context || 
                      currentContent?.contexts || 
                      currentContent?.context_data || [];
    
    const originalSystemContext = contextData
      .filter((ctx: any) => (ctx.role || ctx.from) === 'system')
      .map((ctx: any, index: number) => ({
        role: 'system',
        content: ctx.content || ctx.text || ctx.value || '',
        timestamp: ctx.timestamp || new Date().toISOString(),
        id: ctx.id || `sys-${index}`
      }));
    
    if (index < originalSystemContext.length) {
      const targetMessage = originalSystemContext[index];
      
      // 更新所有数据源中的对应系统消息
      const updateMessageInArray = (arr: any[]) => 
        arr.map((item: any) => 
          (item.content === targetMessage.content && 
           (item.role || item.from) === 'system') 
            ? { ...item, content: newContent } 
            : item
        );

      const updatedContent = {
        ...currentContent,
        context: updateMessageInArray((currentContent as any).context || []),
        contexts: updateMessageInArray((currentContent as any).contexts || []),
        context_data: updateMessageInArray((currentContent as any).context_data || []),
        conversations: updateMessageInArray((currentContent as any).conversations || []),
        conversation: updateMessageInArray((currentContent as any).conversation || []),
        messages: updateMessageInArray((currentContent as any).messages || [])
      };

      onContentChange(updatedContent);
    }
  };

  // 键盘快捷键支持
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key === 'C') {
        event.preventDefault();
        // 触发context面板的展开/折叠 - 这里可以通过ref或者事件总线实现
        const contextPanel = document.querySelector('[data-context-panel]');
        if (contextPanel) {
          const toggleButton = contextPanel.querySelector('button');
          if (toggleButton) {
            toggleButton.click();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // 处理context消息编辑
  const handleContextMessageEdit = (index: number, newContent: string) => {
    const updatedContextMessages = [...dialogueData.contextMessages];
    updatedContextMessages[index] = {
      ...updatedContextMessages[index],
      content: newContent
    };

    const updatedData = {
      ...dialogueData,
      contextMessages: updatedContextMessages
    };

    setDialogueData(updatedData);

    // 更新原始数据结构
    const currentContent = annotationItem.edited_content || annotationItem.original_content;
    
    // 找到对应的context消息
    const targetMessage = dialogueData.contextMessages[index];
    if (!targetMessage) return;

    // 更新所有数据源中的对应消息
    const updateMessageInArray = (arr: any[]) => 
      arr.map((item: any) => {
        const itemRole = item.role || item.from;
        const targetRole = targetMessage.role;
        const itemContent = item.content || item.text || item.value || '';
        
        // 匹配内容和角色
        if (itemContent === targetMessage.content && itemRole === targetRole) {
          return { ...item, content: newContent };
        }
        return item;
      });

    const updatedContent = {
      ...currentContent,
      context: updateMessageInArray((currentContent as any).context || []),
      contexts: updateMessageInArray((currentContent as any).contexts || []),
      context_data: updateMessageInArray((currentContent as any).context_data || []),
      conversations: updateMessageInArray((currentContent as any).conversations || []),
      conversation: updateMessageInArray((currentContent as any).conversation || []),
      messages: updateMessageInArray((currentContent as any).messages || [])
    };

    onContentChange(updatedContent);
  };

  // 处理消息分组的展开/收起状态
  const handleToggleGroup = (groupIndex: number) => {
    setMessageGroups(prevGroups =>
      prevGroups.map((group, index) =>
        index === groupIndex
          ? { ...group, isExpanded: !group.isExpanded }
          : group
      )
    );
  };

  // 获取原始内容
  const getOriginalContent = (messageId: string): string => {
    const originalContent = annotationItem.original_content || {};
    
    // 提取原始对话数据
    const conversationData = (originalContent as any).conversations || 
                           (originalContent as any).conversation || 
                           (originalContent as any).messages || 
                           (originalContent as any).dialogue || [];

    // 提取原始context数据
    const contextData = (originalContent as any).context || 
                      (originalContent as any).contexts || 
                      (originalContent as any).context_data || 
                      (originalContent as any).metadata?.context || [];

    // 合并所有消息
    const allMessages = [
      ...(conversationData as any[]),
      ...(contextData as any[])
    ];

    // 找到对应的消息
    const message = allMessages.find((msg: any, index: number) => 
      (msg.id === messageId) || 
      (`conv-${index}` === messageId) || 
      (`ctx-${index}` === messageId)
    );

    return message?.content || message?.value || message?.text || '';
  };

  // 处理内嵌context消息的编辑
  const handleInlineContextEdit = (groupIndex: number, contextIndex: number, newContent: string) => {
    const actualIndex = dialogueData.contextMessages.findIndex(
      msg => msg.id === messageGroups[groupIndex].contextMessages[contextIndex].id
    );
    
    if (actualIndex !== -1) {
      handleContextMessageEdit(actualIndex, newContent);
    }
  };

  return (
    <div className={className}>
      {/* 系统上下文面板 - 保持独立显示 */}
      {dialogueData.systemContext.length > 0 && (
        <SystemContextPanel
          systemMessages={dialogueData.systemContext}
          onEdit={handleSystemContextEdit}
          className="mb-4"
        />
      )}

      {/* 对话内容 - 内嵌模式 */}
      {messageGroups.length > 0 ? (
        <div className="space-y-4">
          {messageGroups.map((group, groupIndex) => (
            <div key={group.conversationMessage.id || groupIndex} className="space-y-2">
              {/* 对话消息 */}
              <DialogueAnnotationBubble
                message={group.conversationMessage}
                onEdit={(newContent) => handleConversationEdit(
                  dialogueData.conversation.findIndex(
                    msg => msg.id === group.conversationMessage.id
                  ),
                  newContent
                )}
                contextCount={group.contextMessages.length}
                originalContent={getOriginalContent(group.conversationMessage.id)}
                showDiff={showDiff}
                onToggleDiff={onToggleDiff}
              />
              
              {/* 关联的Context消息 */}
              {group.contextMessages.length > 0 && (
                <div className="ml-8">
                  <ContextInlinePanel
                    contextMessages={group.contextMessages}
                    isExpanded={group.isExpanded}
                    onToggle={() => handleToggleGroup(groupIndex)}
                    onEdit={(contextIndex, newContent) => 
                      handleInlineContextEdit(groupIndex, contextIndex, newContent)
                    }
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        /* 对话内容 - 传统模式 */
        <div className="space-y-4">
          {dialogueData.conversation.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <div className="text-lg mb-2">暂无对话数据</div>
              <div className="text-sm">请检查数据源或等待数据加载</div>
            </div>
          ) : (
            dialogueData.conversation.map((message, index) => (
              <DialogueAnnotationBubble
                key={message.id || index}
                message={message}
                onEdit={(newContent) => handleConversationEdit(index, newContent)}
                originalContent={getOriginalContent(message.id || `conv-${index}`)}
                showDiff={showDiff}
                onToggleDiff={onToggleDiff}
              />
            ))
          )}
        </div>
      )}

      {/* 元数据信息（可选） */}
      {dialogueData.metadata && Object.keys(dialogueData.metadata).length > 0 && (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h4 className="text-sm font-medium text-gray-700 mb-2">元数据</h4>
          <pre className="text-xs text-gray-600 overflow-auto">
            {JSON.stringify(dialogueData.metadata, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};