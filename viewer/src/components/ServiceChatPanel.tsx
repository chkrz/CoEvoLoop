import { useEffect, useRef, useState, KeyboardEvent } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, User, Bot, RefreshCw, Trash2, ChevronDown, ChevronRight, Brain, Star, Activity, Send, Settings } from "lucide-react";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { ServiceType, ServiceConfig, DialogueMode, ModelConfig } from "./DialogueBSLayout";
import { Message } from "@/lib/api";
import ScoreCard from "@/components/ScoreCard";
import { MessageAnnotationButton } from "./MessageAnnotationButton";
import { DetailAnnotationButton } from "./DetailAnnotationButton";
import { Annotation } from "./AnnotationPanel";
import { AnnotationStatusIndicator, AnnotationStats } from "./AnnotationStatusIndicator";

interface ServiceConversationState {
  conversationId: string | null;
  messages: Message[];
  isStreaming: boolean;
  error: string | null;
}

interface ServiceChatPanelProps {
  serviceId: ServiceType;
  serviceConfig: ServiceConfig;
  conversationState: ServiceConversationState;
  turnDetails?: {
    [key: string]: {  // key: `${conversationId}-${turn}`
      plannerRecord?: {
        data: any;
        isExpanded: boolean;
        isLoading: boolean;
      };
      scoreDetail?: {
        data: any;
        isExpanded: boolean;
        isLoading: boolean;
      };
    }
  };
  generatingUserInputs?: Set<ServiceType>;
  isAutoCompleted?: boolean;
  onSendMessage: (content: string) => void;
  onClearConversation: () => void;
  onToggleTurnDetail?: (detailKey: string, section: 'planner' | 'score') => void;
  chatPanelRef?: (el: HTMLDivElement) => void;
  serviceConfigs?: ServiceConfig[];
  onServiceChange?: (serviceId: ServiceType) => void;
  useIndependentInput?: boolean;
  independentInputValue?: string;
  onIndependentInputChange?: (value: string) => void;
  dialogueMode?: DialogueMode;
  modelConfig?: ModelConfig;
  onModelConfigChange?: (config: ModelConfig) => void;
}

export function ServiceChatPanel({
  serviceId,
  serviceConfig,
  conversationState,
  turnDetails = {},
  generatingUserInputs = new Set(),
  isAutoCompleted = false,
  onSendMessage,
  onClearConversation,
  onToggleTurnDetail,
  chatPanelRef,
  serviceConfigs,
  onServiceChange,
  useIndependentInput = false,
  independentInputValue = "",
  onIndependentInputChange,
  dialogueMode = 'normal',
  modelConfig,
  onModelConfigChange
}: ServiceChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isServiceDropdownOpen, setIsServiceDropdownOpen] = useState(false);
  const [annotations, setAnnotations] = useState<Record<string, Annotation>>({});
  const [showModelConfig, setShowModelConfig] = useState(false);

  // 自动滚动到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [conversationState.messages]);

  // 从localStorage加载标注数据
  useEffect(() => {
    if (conversationState.conversationId) {
      const savedAnnotations = localStorage.getItem(`annotations-${conversationState.conversationId}`);
      if (savedAnnotations) {
        try {
          setAnnotations(JSON.parse(savedAnnotations));
        } catch (error) {
          console.error('Failed to load annotations:', error);
        }
      }
    }
  }, [conversationState.conversationId]);

  // 保存标注数据到localStorage
  useEffect(() => {
    if (conversationState.conversationId && Object.keys(annotations).length > 0) {
      localStorage.setItem(`annotations-${conversationState.conversationId}`, JSON.stringify(annotations));
    }
  }, [annotations, conversationState.conversationId]);

  // 格式化时间戳
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-CN', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  // 导出标注数据
  const exportAnnotations = () => {
    if (Object.keys(annotations).length === 0) return;
    
    const exportData = {
      conversationId: conversationState.conversationId,
      serviceId,
      serviceName: serviceConfig.name,
      exportTime: new Date().toISOString(),
      annotations: Object.values(annotations)
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `annotations-${serviceConfig.name}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 获取消息数量统计
  const getMessageStats = () => {
    const userMessages = conversationState.messages.filter(m => m.role === 'user').length;
    const aiMessages = conversationState.messages.filter(m => m.role === 'assistant').length;
    const annotatedMessages = Object.keys(annotations).length;
    return { userMessages, aiMessages, annotatedMessages };
  };

  const stats = getMessageStats();

  return (
    <Card className="h-full flex flex-col">
      {/* 服务头部 */}
      <CardHeader className="pb-3 border-b space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">对话 {serviceId}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowModelConfig(!showModelConfig)}
              className="h-7 px-2"
            >
              <Settings className="w-4 h-4 mr-1" />
              {showModelConfig ? '隐藏' : '配置'}模型
            </Button>
          </div>
          
          <div className="flex items-center gap-2">
            {isAutoCompleted ? (
              <Badge variant="secondary" className="text-xs bg-green-50 text-green-700 border-green-200">
                <span className="inline-block w-1.5 h-1.5 bg-green-500 rounded-full mr-1"></span>
                自动对话完成
              </Badge>
            ) : conversationState.isStreaming ? (
              <Badge variant="secondary" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                <span className="inline-block w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse mr-1"></span>
                响应中...
              </Badge>
            ) : null}
            <div className={`
              w-2 h-2 rounded-full
              ${conversationState.isStreaming ? 'bg-blue-500 animate-pulse' :
                conversationState.error ? 'bg-red-500' :
                isAutoCompleted ? 'bg-green-500' :
                'bg-gray-500'}
            `} />
          </div>
        </div>

        {/* 模型配置区域 */}
        {showModelConfig && modelConfig && onModelConfigChange && (
          <div className="space-y-2 pt-2 border-t">
            <div className="space-y-1.5">
              <Label htmlFor="assistant-model" className="text-xs">Assistant 模型</Label>
              <Input
                id="assistant-model"
                value={modelConfig.assistantModel}
                onChange={(e) => onModelConfigChange({ ...modelConfig, assistantModel: e.target.value })}
                placeholder="dashscope/qwen3-235b-a22b"
                className="h-8 text-xs"
              />
            </div>
            
            {dialogueMode === 'auto' && (
              <div className="space-y-1.5">
                <Label htmlFor="user-simulator-model" className="text-xs">用户模拟器模型</Label>
                <Input
                  id="user-simulator-model"
                  value={modelConfig.userSimulatorModel || ''}
                  onChange={(e) => onModelConfigChange({ ...modelConfig, userSimulatorModel: e.target.value })}
                  placeholder="dashscope/qwen3-235b-a22b"
                  className="h-8 text-xs"
                />
              </div>
            )}
            
            <div className="space-y-1.5">
              <Label htmlFor="score-model" className="text-xs">打分器模型</Label>
              <Input
                id="score-model"
                value={modelConfig.scoreModel || ''}
                onChange={(e) => onModelConfigChange({ ...modelConfig, scoreModel: e.target.value })}
                placeholder="dashscope/qwen3-235b-a22b"
                className="h-8 text-xs"
              />
            </div>
          </div>
        )}
      </CardHeader>

      {/* 消息区域 */}
      <CardContent className="flex-1 p-0">
        <ScrollArea 
          className="h-full" 
          ref={(el) => {
            if (el) {
              scrollRef.current = el;
              if (chatPanelRef) chatPanelRef(el);
            }
          }}
        >
          <div className="p-4 space-y-3">
            {/* 错误状态 */}
            {conversationState.error && (
              <div className="flex flex-col items-center justify-center h-32 text-center">
                <div className="text-red-500 mb-2">⚠️</div>
                <p className="text-sm text-red-600 mb-2">{conversationState.error}</p>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={(e) => {
                    e.stopPropagation();
                    onClearConversation();
                  }}
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  重试
                </Button>
              </div>
            )}

            {/* 空状态 - 在Auto模式下生成用户输入时不显示默认背景 */}
            {!conversationState.error && conversationState.messages.length === 0 && !generatingUserInputs.has(serviceId) && (
              <div className="flex flex-col items-center justify-center h-32 text-center">
                <div className="text-2xl mb-2">{serviceConfig.icon}</div>
                <p className="text-sm text-muted-foreground">
                  {serviceConfig.name} 已就绪
                </p>
                <p className="text-xs text-muted-foreground">
                  等待消息...
                </p>
              </div>
            )}

            {/* 消息列表 */}
            {!conversationState.error && conversationState.messages.map((message, index) => (
              <div key={message.id}>
                <div
                className={`flex gap-2 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {message.role === 'assistant' && (
                  <div className="flex-shrink-0">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                      <Bot className="w-3 h-3 text-primary" />
                    </div>
                  </div>
                )}

                  <div className={`max-w-[85%] ${message.role === 'user' ? 'order-1' : ''}`}>
                    <div className={`
                      p-2.5 rounded-lg text-sm
                      ${message.role === 'user' 
                        ? 'bg-primary text-primary-foreground ml-auto' 
                        : 'bg-muted'
                      }
                    `}>
                      {message.role === 'assistant' ? (
                        <div>
                          {message.content ? (
                            <MarkdownRenderer
                              content={message.content}
                              className="text-sm [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
                            />
                          ) : (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <span className="inline-block w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></span>
                              <span className="text-xs">正在思考...</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="whitespace-pre-wrap break-words">
                          {message.content}
                        </div>
                      )}
                    </div>

                    <div className={`
                      flex items-center gap-2 mt-2
                      ${message.role === 'user' ? 'justify-end' : 'justify-start'}
                    `}>
                      <span className="text-xs text-muted-foreground">
                        {formatTimestamp(message.timestamp)}
                      </span>
                      
                      {message.role === 'assistant' && (
                        <>
                          <AnnotationStatusIndicator
                            annotations={annotations}
                            messageId={message.id}
                          />
                          
                          <MessageAnnotationButton
                            messageId={message.id}
                            content={message.content}
                            onSaveAnnotation={(annotation) => {
                              setAnnotations(prev => ({
                                ...prev,
                                [message.id]: annotation
                              }));
                            }}
                            annotations={annotations}
                          />
                        </>
                      )}
                    </div>
                  </div>

                  {message.role === 'user' && (
                    <div className="flex-shrink-0 order-1">
                      <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center">
                        <User className="w-3 h-3 text-secondary-foreground" />
                      </div>
                    </div>
                  )}
                </div>

                {/* 轮次详情 - 显示当前轮次的详情 */}
                {message.role === 'assistant' &&
                 conversationState.conversationId &&
                 turnDetails &&
                 onToggleTurnDetail &&
                 message.content && // 确保AI消息有内容
                 !message.content.startsWith('❌') && ( // 排除错误消息
                  <TurnDetailDisplay
                    conversationId={conversationState.conversationId}
                    turn={conversationState.messages.filter((m, i) => i <= index && m.role === 'user').length - 1} // 准确计算当前轮次
                    turnDetails={turnDetails}
                    onToggleTurnDetail={onToggleTurnDetail}
                    annotations={annotations}
                    onSaveAnnotation={(annotation) => {
                      setAnnotations(prev => ({
                        ...prev,
                        [annotation.messageId]: annotation
                      }));
                    }}
                  />
                )}
              </div>
            ))}

            {/* 用户输入生成指示器 - 只有在机器人不思考且自动对话未完成时才显示 */}
            {generatingUserInputs.has(serviceId) && !conversationState.isStreaming && !isAutoCompleted && (
              <div className="flex gap-2 justify-end">
                <div className="max-w-[85%]">
                  <div className={`
                    p-2.5 rounded-lg text-sm bg-primary text-primary-foreground ml-auto
                  `}>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <span className="inline-block w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></span>
                      <span className="text-xs">正在输入中...</span>
                    </div>
                  </div>
                </div>

                <div className="flex-shrink-0">
                  <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center">
                    <User className="w-3 h-3 text-secondary-foreground" />
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>

      {/* 底部状态栏 */}
      <div className="px-4 py-2 border-t bg-muted/20">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">{stats.userMessages} 用户消息</span>
                <span className="text-muted-foreground">{stats.aiMessages} AI回复</span>
              </div>
              
              <AnnotationStats 
                annotations={annotations} 
                messages={conversationState.messages} 
              />
            </div>
            
            <div className="flex items-center gap-2">
              {stats.annotatedMessages > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-3 text-xs hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300"
                  onClick={(e) => {
                    e.stopPropagation();
                    exportAnnotations();
                  }}
                  title="导出标注数据"
                >
                  <span className="mr-1">📊</span>
                  导出标注
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs hover:bg-red-50 hover:text-red-700"
                onClick={(e) => {
                  e.stopPropagation();
                  onClearConversation();
                }}
                title="重新创建对话"
              >
                <RefreshCw className="w-3 h-3" />
              </Button>
            </div>
          </div>
      </div>

      {/* 独立输入区域 - 当启用独立输入且不是自动模式时显示 */}
      {useIndependentInput && dialogueMode !== 'auto' && (
        <div className="flex-shrink-0 border-t p-4">
          <div className="flex gap-2">
            <Textarea
              placeholder={`输入消息给 ${serviceConfig.name}... (Shift+Enter 换行，Enter 发送)`}
              value={independentInputValue}
              onChange={(e) => onIndependentInputChange?.(e.target.value)}
              onKeyPress={(e: KeyboardEvent<HTMLTextAreaElement>) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (independentInputValue?.trim()) {
                    onSendMessage(independentInputValue.trim());
                    onIndependentInputChange?.("");
                  }
                }
              }}
              className="flex-1 min-h-[60px] max-h-[120px] resize-none"
              disabled={conversationState.isStreaming}
            />
            <Button
              onClick={() => {
                if (independentInputValue?.trim()) {
                  onSendMessage(independentInputValue.trim());
                  onIndependentInputChange?.("");
                }
              }}
              disabled={!independentInputValue?.trim() || conversationState.isStreaming}
              size="lg"
              className="self-end"
            >
              {conversationState.isStreaming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

// 轮次详情展示组件
interface TurnDetailDisplayProps {
  conversationId: string;
  turn: number;
  turnDetails: {
    [key: string]: {  // key: `${conversationId}-${turn}`
      plannerRecord?: {
        data: any;
        isExpanded: boolean;
        isLoading: boolean;
      };
      scoreDetail?: {
        data: any;
        isExpanded: boolean;
        isLoading: boolean;
      };
    }
  };
  onToggleTurnDetail?: (detailKey: string, section: 'planner' | 'score') => void;
  annotations: Record<string, Annotation>;
  onSaveAnnotation: (annotation: Annotation) => void;
}

// 规划器记录展示组件
const PlannerRecordDisplay = ({
  conversationId,
  turn,
  plannerRecord,
  onToggle,
  detailKey,
  annotations,
  onSaveAnnotation
}: {
  conversationId: string;
  turn: number;
  plannerRecord?: { data: any; isExpanded: boolean; isLoading: boolean };
  onToggle: (detailKey: string, section: 'planner' | 'score') => void;
  detailKey: string;
  annotations: Record<string, Annotation>;
  onSaveAnnotation: (annotation: Annotation) => void;
}) => {
  if (!plannerRecord) return null;

  const { data, isExpanded, isLoading } = plannerRecord;

  if (isLoading) {
    return (
      <div className="ml-6 mt-2 p-2 bg-muted/50 rounded text-xs text-muted-foreground flex items-center gap-2 max-w-md">
        <Loader2 className="w-3 h-3 animate-spin" />
        <span>获取规划器记录中...</span>
      </div>
    );
  }

  if (!data) return null;

  // 构建完整的思考过程内容
  const getFullContent = () => {
    const parts = [];
    if (data.thought) parts.push(`思考过程：\n${typeof data.thought === 'string' ? data.thought : JSON.stringify(data.thought, null, 2)}`);
    if (data.action) parts.push(`Action：\n${data.action}`);
    if (data.selected_executor) parts.push(`选择的执行器：\n${data.selected_executor}`);
    if (data.agent_result) parts.push(`Agent结果：\n${JSON.stringify(data.agent_result, null, 2)}`);
    if (data.tool_result) parts.push(`Tool结果：\n${JSON.stringify(data.tool_result, null, 2)}`);
    if (data.plan) parts.push(`规划：\n${typeof data.plan === 'string' ? data.plan : JSON.stringify(data.plan, null, 2)}`);
    if (data.strategy) parts.push(`服务策略：\n${typeof data.strategy === 'string' ? data.strategy : JSON.stringify(data.strategy, null, 2)}`);
    if (data.user_goal) parts.push(`用户目标：\n${typeof data.user_goal === 'string' ? data.user_goal : JSON.stringify(data.user_goal, null, 2)}`);
    
    return parts.join('\n\n');
  };

  // 决定显示的标题
  const displayTitle = data.user_goal ? (
    <>
      <strong className="text-blue-600">用户目标</strong>：{typeof data.user_goal === 'string' ? data.user_goal : JSON.stringify(data.user_goal)}
    </>
  ) : <strong className="text-blue-600">规划记录</strong>;

  return (
    <div className="ml-6 mt-2 max-w-lg">
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          className="p-1 h-6 text-xs text-muted-foreground hover:text-foreground w-full justify-start"
          onClick={() => onToggle(detailKey, 'planner')}
        >
          <div className="flex items-center gap-1 w-full">
            {isExpanded ? (
              <ChevronDown className="w-3 h-3 flex-shrink-0" />
            ) : (
              <ChevronRight className="w-3 h-3 flex-shrink-0" />
            )}
            <span className="truncate text-left">{displayTitle}</span>
          </div>
        </Button>
        
        <DetailAnnotationButton
          contentId={`${detailKey}-planner`}
          content={getFullContent()}
          title="规划记录"
          type="planner"
          onSaveAnnotation={onSaveAnnotation}
          annotations={annotations}
          className="ml-2"
        />
      </div>

      {isExpanded && (
        <div className="mt-2 p-3 bg-card/50 border rounded-lg text-xs shadow-sm">
          <div className="space-y-3">

            {/* 思考过程 */}
            {data.thought && (
              <div>
                <h4 className="font-medium mb-2 text-green-700 flex items-center gap-1">
                  <Brain className="w-3 h-3" />
                  思考过程
                </h4>
                <div className="whitespace-pre-wrap text-muted-foreground bg-green-50/50 p-3 rounded border text-xs leading-relaxed">
                  {typeof data.thought === 'string'
                    ? data.thought
                    : JSON.stringify(data.thought, null, 2)}
                </div>
              </div>
            )}

            {/* Action */}
            {data.action && (
              <div>
                <h4 className="font-medium mb-2 text-blue-700 flex items-center gap-1">
                  <Activity className="w-3 h-3" />
                  Action
                </h4>
                <div className="text-muted-foreground bg-blue-50/50 p-3 rounded border text-xs">
                  {data.action}
                </div>
              </div>
            )}

            {/* 执行器信息 */}
            {data.selected_executor && (
              <div>
                <h4 className="font-medium mb-2 text-purple-700 flex items-center gap-1">
                  🔧 选择的执行器
                </h4>
                <div className="text-muted-foreground bg-purple-50/50 p-3 rounded border text-xs">
                  {data.selected_executor}
                </div>
              </div>
            )}

            {/* Agent结果 */}
            {data.agent_result && (
              <div>
                <h4 className="font-medium mb-2 text-teal-700 flex items-center gap-1">
                  🤖 Agent结果
                </h4>
                <div className="whitespace-pre-wrap text-muted-foreground bg-teal-50/50 p-3 rounded border text-xs leading-relaxed">
                  {JSON.stringify(data.agent_result, null, 2)}
                </div>
              </div>
            )}

            {/* Tool结果 */}
            {data.tool_result && (
              <div>
                <h4 className="font-medium mb-2 text-cyan-700 flex items-center gap-1">
                  🛠️ Tool结果
                </h4>
                <div className="whitespace-pre-wrap text-muted-foreground bg-cyan-50/50 p-3 rounded border text-xs leading-relaxed">
                  {JSON.stringify(data.tool_result, null, 2)}
                </div>
              </div>
            )}

            {/* 规划信息 */}
            {data.plan && (
              <div>
                <h4 className="font-medium mb-2 text-orange-700 flex items-center gap-1">
                  📋 规划
                </h4>
                <div className="whitespace-pre-wrap text-muted-foreground bg-orange-50/50 p-3 rounded border text-xs leading-relaxed">
                  {typeof data.plan === 'string' 
                    ? data.plan 
                    : JSON.stringify(data.plan, null, 2)}
                </div>
              </div>
            )}

            {/* 服务策略 */}
            {data.strategy && (
              <div>
                <h4 className="font-medium mb-2 text-indigo-700 flex items-center gap-1">
                  🎯 服务策略
                </h4>
                <div className="whitespace-pre-wrap text-muted-foreground bg-indigo-50/50 p-3 rounded border text-xs leading-relaxed">
                  {typeof data.strategy === 'string' 
                    ? data.strategy 
                    : JSON.stringify(data.strategy, null, 2)}
                </div>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
};

// 评分详情展示组件
const ScoreDetailDisplay = ({
  conversationId,
  turn,
  scoreDetail,
  onToggle,
  detailKey,
  onSaveAnnotation,
  annotations
}: {
  conversationId: string;
  turn: number;
  scoreDetail?: { data: any; isExpanded: boolean; isLoading: boolean };
  onToggle: (detailKey: string, section: 'planner' | 'score') => void;
  detailKey: string;
  onSaveAnnotation: (annotation: Annotation) => void;
  annotations: Record<string, Annotation>;
}) => {
  if (!scoreDetail) return null;

  const { data, isExpanded, isLoading } = scoreDetail;

  if (isLoading) {
    return (
      <div className="ml-6 mt-2 p-2 bg-muted/50 rounded text-xs text-muted-foreground flex items-center gap-2 max-w-md">
        <Loader2 className="w-3 h-3 animate-spin" />
        <span>获取打分器结果中...</span>
      </div>
    );
  }

  if (!data) return null;

  const getFullContent = () => {
    return JSON.stringify(data, null, 2);
  };

  return (
    <div className="ml-6 mt-2 max-w-lg">
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          className="p-1 h-6 text-xs text-muted-foreground hover:text-foreground w-full justify-start"
          onClick={() => onToggle(detailKey, 'score')}
        >
          <div className="flex items-center gap-1 w-full">
            {isExpanded ? (
              <ChevronDown className="w-3 h-3 flex-shrink-0" />
            ) : (
              <ChevronRight className="w-3 h-3 flex-shrink-0" />
            )}
            <span className="truncate text-left"><strong className="text-purple-600">打分器结果</strong></span>
          </div>
        </Button>
        
        <DetailAnnotationButton
          contentId={`${detailKey}-score`}
          content={getFullContent()}
          title="打分器结果"
          type="score"
          onSaveAnnotation={onSaveAnnotation}
          annotations={annotations}
          className="ml-2"
        />
      </div>

      {isExpanded && (
        <div className="mt-2 p-3 bg-card/50 border rounded-lg text-xs shadow-sm">
          <div className="space-y-3">
            {/* 评分详情 */}
            {data.score_detail && (
              <div>
                <h4 className="font-medium mb-2 text-pink-600 flex items-center gap-1">
                  <Star className="w-3 h-3" />
                  评分详情
                </h4>
                <div className="bg-purple-50/50 p-3 rounded border">
                  <ScoreCard jsonData={JSON.stringify(data)} />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const TurnDetailDisplay = ({
  conversationId,
  turn,
  turnDetails,
  onToggleTurnDetail,
  annotations,
  onSaveAnnotation
}: TurnDetailDisplayProps & {
  annotations: Record<string, Annotation>;
  onSaveAnnotation: (annotation: Annotation) => void;
}) => {
  const detailKey = `${conversationId}-${turn}`;
  const detail = turnDetails[detailKey];

  if (!detail) return null;

  return (
    <div>
      {/* 规划器记录部分 */}
      {detail.plannerRecord && (
        <PlannerRecordDisplay
          conversationId={conversationId}
          turn={turn}
          plannerRecord={detail.plannerRecord}
          onToggle={onToggleTurnDetail!}
          detailKey={detailKey}
          annotations={annotations}
          onSaveAnnotation={onSaveAnnotation}
        />
      )}

      {/* 评分详情部分 */}
      {detail.scoreDetail && (
        <ScoreDetailDisplay
          conversationId={conversationId}
          turn={turn}
          scoreDetail={detail.scoreDetail}
          onToggle={onToggleTurnDetail!}
          detailKey={detailKey}
          onSaveAnnotation={onSaveAnnotation}
          annotations={annotations}
        />
      )}
    </div>
  );
};