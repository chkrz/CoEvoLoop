import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { ServiceChatPanel } from "./ServiceChatPanel";
import { SharedMessageInput } from "./SharedMessageInput";
import { ServiceType, ServiceConfig } from "./DialogueBSLayout";
import { apiService, Conversation, ConversationDetail, Message } from "@/lib/api";
import { Loader2 } from "lucide-react";

// 服务对话状态管理
interface ServiceConversationState {
  conversationId: string | null;
  messages: Message[];
  isLoading: boolean;
  isStreaming: boolean;
  error: string | null;
}

interface MultiServiceChatProps {
  selectedServices: ServiceType[];
  serviceConfigs: ServiceConfig[];
  userId: string;
}

export function MultiServiceChat({ selectedServices, serviceConfigs, userId }: MultiServiceChatProps) {
  // 为每个服务维护独立的对话状态
  const [serviceConversations, setServiceConversations] = useState<{
    [key in ServiceType]?: ServiceConversationState
  }>({});
  
  const [inputMessage, setInputMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  
  // 引用各个服务的聊天面板
  const chatPanelRefs = useRef<{ [key in ServiceType]?: HTMLDivElement }>({});

  // 初始化服务对话状态
  useEffect(() => {
    selectedServices.forEach(serviceId => {
      if (!serviceConversations[serviceId]) {
        createServiceConversation(serviceId);
      }
    });

      // 清理未选中的服务状态 - 使用函数式更新避免闭包问题
    const servicesToRemove = Object.keys(serviceConversations).filter(
      serviceId => !selectedServices.includes(serviceId as ServiceType)
    );
    
    if (servicesToRemove.length > 0) {
      setServiceConversations(prev => {
        const newState = { ...prev };
        servicesToRemove.forEach(serviceId => {
          delete newState[serviceId as ServiceType];
        });
        return newState;
      });
    }
  }, [selectedServices]);

  // 为特定服务创建对话
  const createServiceConversation = async (serviceId: ServiceType) => {
    try {
      console.log(`Creating conversation for service: ${serviceId}`);
      
      setServiceConversations(prev => ({
        ...prev,
        [serviceId]: {
          conversationId: null,
          messages: [],
          isLoading: true,
          isStreaming: false,
          error: null
        }
      }));

      // 创建新对话，包含服务类型标识
      const config = getServiceConfigSafe(serviceId);
      const newConversation = await apiService.createConversation(userId, {
        title: `${config.name} - 多服务对话`,
        metadata: {
          serviceType: serviceId,
          isMultiService: true
        }
      });

      // 获取对话详情
      const conversationDetail = await apiService.getConversationDetail(newConversation.id, userId);

      setServiceConversations(prev => ({
        ...prev,
        [serviceId]: {
          conversationId: newConversation.id,
          messages: conversationDetail.messages || [],
          isLoading: false,
          isStreaming: false,
          error: null
        }
      }));
      
      console.log(`Successfully created conversation for ${serviceId}:`, newConversation.id);

    } catch (error) {
      console.error(`Failed to create conversation for ${serviceId}:`, error);
      setServiceConversations(prev => ({
        ...prev,
        [serviceId]: {
          conversationId: null,
          messages: [],
          isLoading: false,
          isStreaming: false,
          error: error instanceof Error ? error.message : '创建对话失败'
        }
      }));
    }
  };

  // 发送消息到指定服务
  const sendMessageToService = async (serviceId: ServiceType, content: string) => {
    const serviceState = serviceConversations[serviceId];
    if (!serviceState || !serviceState.conversationId) return;

    const conversationId = serviceState.conversationId;

    try {
      // 更新状态为发送中
      setServiceConversations(prev => ({
        ...prev,
        [serviceId]: {
          ...prev[serviceId]!,
          isStreaming: true,
          error: null
        }
      }));

      // 添加用户消息到界面
      const userMessage: Message = {
        id: `${Date.now()}-${serviceId}`,
        role: 'user',
        content,
        timestamp: new Date().toISOString()
      };

      setServiceConversations(prev => ({
        ...prev,
        [serviceId]: {
          ...prev[serviceId]!,
          messages: [...prev[serviceId]!.messages, userMessage]
        }
      }));

      // 使用流式API发送消息
      let aiMessageContent = '';
      const aiMessageId = `${Date.now() + 1}-${serviceId}`;

      await apiService.sendMessageStream(
        conversationId,
        userId,
        { content },
        // onMessageStart
        () => {
          // 准备接收AI消息
        },
        // onChunk
        (chunk: string) => {
          aiMessageContent += chunk;
          
          // 更新或添加AI消息
          setServiceConversations(prev => {
            const currentMessages = prev[serviceId]?.messages || [];
            const lastMessage = currentMessages[currentMessages.length - 1];
            
            if (lastMessage && lastMessage.role === 'assistant' && lastMessage.id === aiMessageId) {
              // 更新现有消息
              return {
                ...prev,
                [serviceId]: {
                  ...prev[serviceId]!,
                  messages: currentMessages.map(msg => 
                    msg.id === aiMessageId 
                      ? { ...msg, content: aiMessageContent }
                      : msg
                  )
                }
              };
            } else {
              // 添加新消息
              const aiMessage: Message = {
                id: aiMessageId,
                role: 'assistant',
                content: aiMessageContent,
                timestamp: new Date().toISOString()
              };
              
              return {
                ...prev,
                [serviceId]: {
                  ...prev[serviceId]!,
                  messages: [...currentMessages, aiMessage]
                }
              };
            }
          });

          // 滚动到最新消息
          setTimeout(() => {
            const panelRef = chatPanelRefs.current[serviceId];
            if (panelRef) {
              panelRef.scrollTop = panelRef.scrollHeight;
            }
          }, 50);
        },
        // onMessageEnd
        () => {
          setServiceConversations(prev => ({
            ...prev,
            [serviceId]: {
              ...prev[serviceId]!,
              isStreaming: false
            }
          }));
        },
        // onError
        (error: string) => {
          console.error(`Error sending message to ${serviceId}:`, error);
          setServiceConversations(prev => ({
            ...prev,
            [serviceId]: {
              ...prev[serviceId]!,
              isStreaming: false,
              error: error
            }
          }));
        },
        // onDone
        () => {
          // 完成处理
        }
      );

    } catch (error) {
      console.error(`Failed to send message to ${serviceId}:`, error);
      setServiceConversations(prev => ({
        ...prev,
        [serviceId]: {
          ...prev[serviceId]!,
          isStreaming: false,
          error: error instanceof Error ? error.message : '发送消息失败'
        }
      }));
    }
  };

  // 发送消息到所有选中的服务
  const handleSendMessage = async (content: string) => {
    if (!content.trim() || isSending) return;

    setIsSending(true);

    try {
      // 并发发送消息到所有服务
      const sendPromises = selectedServices.map(serviceId => 
        sendMessageToService(serviceId, content)
      );

      await Promise.allSettled(sendPromises);
    } finally {
      setIsSending(false);
    }
  };

  // 获取服务配置 - 安全版本
  const getServiceConfigSafe = (serviceId: ServiceType) => {
    return serviceConfigs.find(config => config.id === serviceId) || {
      id: serviceId,
      name: '未知服务',
      description: '未知服务类型',
      color: 'bg-gray-500',
      icon: '❓'
    };
  };

  // 清空特定服务的对话
  const clearServiceConversation = async (serviceId: ServiceType) => {
    const serviceState = serviceConversations[serviceId];
    if (serviceState?.conversationId) {
      try {
        await apiService.deleteConversation(serviceState.conversationId, userId);
      } catch (error) {
        console.error(`Failed to delete conversation for ${serviceId}:`, error);
      }
    }
    
    // 重新创建对话
    createServiceConversation(serviceId);
  };

  // 清空所有服务的对话
  const handleClearAll = async () => {
    const clearPromises = selectedServices.map(serviceId => 
      clearServiceConversation(serviceId)
    );
    
    await Promise.allSettled(clearPromises);
  };

  // 检查是否有错误
  const hasErrors = selectedServices.some(id => serviceConversations[id]?.error);
  const allLoading = selectedServices.every(id => serviceConversations[id]?.isLoading);
  
  if (allLoading && selectedServices.length > 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-lg font-medium">正在初始化对话...</p>
          <p className="text-sm text-muted-foreground">请稍候</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-200px)]">
      {/* 操作栏 */}
      <div className="flex items-center justify-between mb-4 p-4 bg-muted/20 rounded-lg">
        <div className="flex items-center gap-4">
          <h3 className="font-semibold">WorldFirst多服务并行对话</h3>
          <div className="flex gap-2">
            {selectedServices.map(serviceId => {
              const config = getServiceConfigSafe(serviceId);
              const serviceState = serviceConversations[serviceId];
              return (
                <span
                  key={serviceId}
                  className={`px-2 py-1 rounded text-xs text-white ${config.color}`}
                >
                  {config.icon} {config.name}
                  {serviceState?.isLoading && ' (加载中)'}
                  {serviceState?.isStreaming && ' (响应中)'}
                </span>
              );
            })}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {selectedServices.some(id => serviceConversations[id]?.isStreaming) && (
            <span className="text-sm text-muted-foreground">
              正在响应...
            </span>
          )}
          <button
            onClick={handleClearAll}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            清空所有
          </button>
        </div>
      </div>

      {/* 聊天面板区域 */}
      <div className="flex-1 grid gap-4" style={{ 
        gridTemplateColumns: selectedServices.length > 0 ? `repeat(${Math.min(selectedServices.length, 3)}, 1fr)` : '1fr',
        minHeight: '400px'
      }}>
        {selectedServices.map(serviceId => {
          const config = getServiceConfig(serviceId);
          const serviceState = serviceConversations[serviceId];
          
          if (!config) return null;

          return (
            <ServiceChatPanel
              key={serviceId}
              serviceId={serviceId}
              serviceConfig={config}
              conversationState={serviceState}
              onSendMessage={(content) => sendMessageToService(serviceId, content)}
              onClearConversation={() => clearServiceConversation(serviceId)}
              chatPanelRef={(el) => {
                if (el) chatPanelRefs.current[serviceId] = el;
              }}
            />
          );
        })}
      </div>

      {/* 共享消息输入框 */}
      <div className="mt-4">
        <SharedMessageInput
          value={inputMessage}
          onChange={setInputMessage}
          onSend={handleSendMessage}
          isSending={isSending}
          disabled={selectedServices.length === 0}
          placeholder={`向 ${selectedServices.length} 个服务发送消息...`}
          serviceCount={selectedServices.length}
          readyServices={selectedServices.filter(id => serviceConversations[id]?.conversationId).length}
          totalServices={selectedServices.length}
        />
      </div>
    </div>
  );
}