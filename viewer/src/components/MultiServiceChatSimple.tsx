import { useState, useEffect, forwardRef, useImperativeHandle, useRef } from "react";
import { ServiceChatPanel } from "./ServiceChatPanel";
import { SharedMessageInput } from "./SharedMessageInput";
import { ServiceType, ServiceConfig, DialogueMode, ModelConfig, DEFAULT_MODEL_CONFIG } from "./DialogueBSLayout";
import { apiService, Message, UserData } from "@/lib/api";

interface MultiServiceChatProps {
  serviceConfigs: ServiceConfig[];
  userId: string;
  dialogueMode: DialogueMode;
  dialogueCount: 1 | 2 | 3;
  maxAutoTurns: number;
  currentUserData: UserData | null;
  isAutoRunning: boolean;
  onAutoRunningChange: (running: boolean) => void;

  onClearAllConversations?: () => void;
}

export const MultiServiceChatSimple = forwardRef<{
  clearAllConversations: () => void;
}, MultiServiceChatProps>(({
  serviceConfigs,
  userId,
  dialogueMode,
  dialogueCount,
  maxAutoTurns,
  currentUserData,
  isAutoRunning,
  onAutoRunningChange,
  onClearAllConversations
}, ref) => {
  // 对话框的会话状态（key 为 serviceId，即对话框标识）
  const [serviceConversations, setServiceConversations] = useState<{
    [serviceId: string]: {
      conversationId: string | null;
      messages: Message[];
      isStreaming: boolean;
      error: string | null;
    }
  }>({});

  // 轮次详情状态 - 按服务独立管理
  const [serviceTurnDetails, setServiceTurnDetails] = useState<{
    [serviceId: string]: {
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
    }
  }>({});

  const [inputMessage, setInputMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  
  // 每个对话的独立输入状态
  const [independentInputs, setIndependentInputs] = useState<{ [serviceId: string]: string }>({});
  const [independentSending, setIndependentSending] = useState<{ [serviceId: string]: boolean }>({});
  // const [isAutoRunning, setIsAutoRunning] = useState(false);

  // 轮次计数器 - 按服务类型分别计数
  const [turnCounters, setTurnCounters] = useState<{
    [key in ServiceType]?: number
  }>({});

  // 使用传入的maxAutoTurns而不是硬编码值

  // 跟踪哪些服务还在Auto模式下运行
  const [activeAutoServices, setActiveAutoServices] = useState<Set<ServiceType>>(new Set());

  // 跟踪哪些服务正在生成用户输入
  const [generatingUserInputs, setGeneratingUserInputs] = useState<Set<ServiceType>>(new Set());

  // 跟踪哪些服务的自动对话已经完成
  const [completedAutoServices, setCompletedAutoServices] = useState<Set<ServiceType>>(new Set());
  
  // 跟踪每个服务每轮的生成状态，防止重复调用
  const [generatedTurns, setGeneratedTurns] = useState<{
    [serviceId: string]: Set<number>
  }>({});

  // 每个对话框的模型配置
  const [dialogueModelConfigs, setDialogueModelConfigs] = useState<{ [dialogueIndex: number]: ModelConfig }>({});

  // 每个对话框独立的服务选择
  const [dialogueServices, setDialogueServices] = useState<{ [dialogueIndex: number]: ServiceType }>({});

  // 服务选择变化时创建对话
  const handleServiceChange = (dialogueIndex: number, serviceId: ServiceType) => {
    setDialogueServices(prev => ({
      ...prev,
      [dialogueIndex]: serviceId
    }));
    
    // 立即为新服务创建对话
    console.log(`🔄 服务切换: 对话框 ${dialogueIndex} -> ${serviceId}`);
    createConversation(serviceId);
  };

  // 模型配置变化
  const handleModelConfigChange = (dialogueIndex: number, modelConfig: ModelConfig) => {
    setDialogueModelConfigs(prev => ({
      ...prev,
      [dialogueIndex]: modelConfig
    }));
  };

  // 初始化对话框，使用 dialogue-{index} 作为 ID
  useEffect(() => {
    const newDialogueServices = { ...dialogueServices };
    const newDialogueModelConfigs = { ...dialogueModelConfigs };
    for (let i = 0; i < dialogueCount; i++) {
      if (!newDialogueServices[i]) {
        const dialogueId = `dialogue-${i}`;
        newDialogueServices[i] = dialogueId;
        newDialogueModelConfigs[i] = { ...DEFAULT_MODEL_CONFIG };
        console.log(`🆕 初始化对话框 ${i}，ID: ${dialogueId}`);
        createConversation(dialogueId);
      }
    }
    // 移除多余的对话框
    Object.keys(newDialogueServices).forEach(key => {
      const index = parseInt(key);
      if (index >= dialogueCount) {
        delete newDialogueServices[key];
        delete newDialogueModelConfigs[key];
      }
    });
    setDialogueServices(newDialogueServices);
    setDialogueModelConfigs(newDialogueModelConfigs);
  }, [dialogueCount]);

  // 获取服务配置
  const getServiceConfig = (serviceId: ServiceType): ServiceConfig => {
    return serviceConfigs.find(config => config.id === serviceId) || {
      id: serviceId,
      name: serviceId,
      description: '服务',
      color: 'bg-gray-500',
      icon: '🤖',
      size: '',
      date: ''
    };
  };

  // 创建对话
  const createConversation = async (dialogueId: ServiceType) => {
    try {
      console.log(`🚀 开始创建对话 for dialogue: ${dialogueId}`);
      
      const newConversation = await apiService.createConversation(userId, {
        title: `对话 ${dialogueId}`
      });
      
      console.log(`✅ 成功创建对话: ${newConversation.id} for dialogue: ${dialogueId}`);

      setServiceConversations(prev => ({
        ...prev,
        [dialogueId]: {
          conversationId: newConversation.id,
          messages: [],
          isStreaming: false,
          error: null
        }
      }));

      // 初始化轮次计数器
      setTurnCounters(prev => ({
        ...prev,
        [dialogueId]: 0
      }));

      // 注意：不再清除turnDetails，保留历史数据

    } catch (error) {
      console.error(`创建对话失败 ${dialogueId}:`, error);
      setServiceConversations(prev => ({
        ...prev,
        [dialogueId]: {
          conversationId: null,
          messages: [],
          isStreaming: false,
          error: error instanceof Error ? error.message : '创建对话失败'
        }
      }));
    }
  };


  // 初始化对话 - 立即创建，响应所有变化
  useEffect(() => {
    console.log('📋 触发条件变化:', { dialogueCount, dialogueServices });

    // 为所有对话框中的服务创建对话
    Object.values(dialogueServices).forEach(serviceId => {
      if (serviceId && !serviceConversations[serviceId]) {
        console.log(`🔍 创建对话 for 对话框服务: ${serviceId}`);
        createConversation(serviceId);
      }
    });
  }, [dialogueCount, dialogueServices, serviceConversations]);

  // Auto模式逻辑 - 初始化并开始对话 - 修复会话隔离问题
  useEffect(() => {
    if (dialogueMode === 'auto' && isAutoRunning && Object.keys(dialogueServices).length > 0) {
      // 清除之前完成的auto服务状态，但只清除当前对话框的服务
      const currentDialogueServiceIds = new Set(Object.values(dialogueServices));
      setCompletedAutoServices(prev => {
        const newSet = new Set(prev);
        // 只保留不属于当前对话框的已完成服务
        Array.from(newSet).forEach(serviceId => {
          if (currentDialogueServiceIds.has(serviceId)) {
            newSet.delete(serviceId);
          }
        });
        return newSet;
      });
      
      // 初始化活跃的auto服务，只包含当前对话框的服务
      const services = Object.values(dialogueServices);
      setActiveAutoServices(new Set(services));
      
      // 开始Auto对话：为每个服务生成初始用户输入并发送
      const startAutoDialogue = async () => {
        console.log('当前用户数据:', currentUserData);
        console.log('用户问题描述:', currentUserData?.portrait?.问题描述);
        console.log('当前对话框服务:', services);
        
        // 设置正在生成用户输入状态，显示"正在输入中"的loading提示
        const servicesToGenerate = services.filter(serviceId => {
          const serviceState = serviceConversations[serviceId];
          const isCurrentService = Object.values(dialogueServices).includes(serviceId);
          return serviceState?.conversationId && isCurrentService;
        });
        
        // 为所有需要生成初始消息的服务设置loading状态
        setGeneratingUserInputs(prev => new Set([...prev, ...servicesToGenerate]));
        
        setIsSending(true);
        try {
          // 为每个服务生成初始用户输入
          const generatePromises = services.map(async (serviceId) => {
            const serviceState = serviceConversations[serviceId];
            if (!serviceState?.conversationId) {
              console.warn(`⚠️ 服务 ${serviceId} 没有对话ID，跳过生成初始消息`);
              return null;
            }

            const conversationId = serviceState.conversationId;
            console.log(`🔄 为服务 ${serviceId} 生成第 0 轮用户输入`);

            try {
              const userInputResult = await apiService.generateUserInput(userId, conversationId, currentUserData, 0);
              console.log(`🔄 服务 ${serviceId} - 生成初始用户输入: end=${userInputResult.end}, input="${userInputResult.user_input}"`);
              
              return {
                serviceId,
                initialMessage: userInputResult.user_input || "你好"
              };
            } catch (error) {
              console.error(`服务 ${serviceId} 生成初始用户输入失败:`, error);
              return {
                serviceId,
                initialMessage: "你好" // 失败时回退到默认消息
              };
            } finally {
              // 清除该服务的生成状态
              setGeneratingUserInputs(prev => {
                const newSet = new Set(prev);
                newSet.delete(serviceId);
                return newSet;
              });
            }
          });

          const results = await Promise.allSettled(generatePromises);
          
          // 过滤成功的结果并发送消息
          const sendPromises = results
            .filter((result): result is PromiseFulfilledResult<{serviceId: ServiceType, initialMessage: string}> => 
              result.status === 'fulfilled' && result.value !== null
            )
            .map(result => {
              const modelConfig = getModelConfigForService(result.value.serviceId);
              return sendMessageToService(result.value.serviceId, result.value.initialMessage, modelConfig);
            });
          
          await Promise.allSettled(sendPromises);
        } finally {
          setIsSending(false);
          // 确保清除所有生成状态
          setGeneratingUserInputs(prev => {
            const newSet = new Set(prev);
            servicesToGenerate.forEach(serviceId => newSet.delete(serviceId));
            return newSet;
          });
        }
      };

      startAutoDialogue();
    } else if (!isAutoRunning) {
      // 停止Auto时，清空活跃服务列表
      setActiveAutoServices(new Set());
    }
  }, [dialogueMode, isAutoRunning, dialogueServices, currentUserData]);

  // 当切换到输入模式时，清除自动对话完成状态
  useEffect(() => {
    if (dialogueMode === 'normal') {
      setCompletedAutoServices(new Set());
      setActiveAutoServices(new Set());
      setGeneratingUserInputs(new Set());
    }
  }, [dialogueMode]);

  // 监听assistant消息完成，为每个服务独立生成用户回复 - 修复会话隔离问题
  useEffect(() => {
    if (dialogueMode === 'auto' && isAutoRunning && activeAutoServices.size > 0) {
      const autoReply = async () => {
        // 获取当前对话框中使用的服务
        const currentDialogueServices = new Set(Object.values(dialogueServices).filter(Boolean) as ServiceType[]);
        
        // 只处理当前对话框中的服务，并验证会话ID匹配
        const relevantServices = Array.from(activeAutoServices).filter(serviceId => {
          const isInCurrentDialogue = currentDialogueServices.has(serviceId);
          if (!isInCurrentDialogue) {
            console.log(`🚫 服务 ${serviceId} 不在当前对话框中，跳过处理`);
            return false;
          }
          return true;
        });

        const completedServices: ServiceType[] = [];

        for (const serviceId of relevantServices) {
          const state = serviceConversations[serviceId];
          if (!state) {
            console.log(`❌ 服务 ${serviceId} 状态不存在`);
            continue;
          }

          const messages = state.messages;
          if (messages.length === 0) {
            console.log(`📭 服务 ${serviceId} 没有消息`);
            continue;
          }

          // 严格检查流式响应状态 - 确保AI回复完全完成
          if (state.isStreaming) {
            console.log(`⏳ 服务 ${serviceId} 还在流式响应中，跳过`);
            continue;
          }
          
          // 额外检查：确保最后一条消息不是空内容（可能还在接收中）
          const lastMsg = messages[messages.length - 1];
          if (lastMsg.role === 'assistant' && (!lastMsg.content || lastMsg.content.trim() === '')) {
            console.log(`⏳ 服务 ${serviceId} AI回复内容为空，可能还在接收中，跳过`);
            continue;
          }
          
          // 检查是否有正在进行的流式响应标记
          if (state.isStreaming || generatingUserInputs.has(serviceId)) {
            console.log(`⏳ 服务 ${serviceId} 有活跃操作，跳过`);
            continue;
          }

          // 获取最后两条消息来确认状态
          const lastMessage = messages[messages.length - 1];
          const secondLastMessage = messages.length >= 2 ? messages[messages.length - 2] : null;

          // 严格的消息完成检查
          const hasUserMessage = messages.some(msg => msg.role === 'user');
          const hasAssistantMessage = messages.some(msg => msg.role === 'assistant');
          
          // 确保最后一条消息是assistant回复，且前面有user消息
          const isProperTurn = lastMsg.role === 'assistant' && 
                              !lastMsg.content.includes('❌') &&
                              secondLastMessage?.role === 'user' &&
                              lastMsg.content && 
                              lastMsg.content.trim() !== '';

          // 检查是否正在生成用户输入
          if (generatingUserInputs.has(serviceId)) {
            console.log(`⏳ 服务 ${serviceId} 正在生成用户输入中`);
            continue;
          }

          // 检查轮次是否匹配
          const expectedUserMessages = messages.filter(msg => msg.role === 'user').length;
          const expectedAssistantMessages = messages.filter(msg => msg.role === 'assistant').length;
          const isBalancedTurn = expectedUserMessages === expectedAssistantMessages;

          // 获取当前轮次
          const currentTurn = expectedUserMessages;

          // 检查该轮次是否已经生成过
          const serviceGeneratedTurns = generatedTurns[serviceId] || new Set();
          if (serviceGeneratedTurns.has(currentTurn)) {
            console.log(`⚠️ 服务 ${serviceId} 第 ${currentTurn} 轮已经生成过，跳过 - 已生成轮次:`, Array.from(serviceGeneratedTurns));
            continue;
          }

          console.log(`🔍 服务 ${serviceId} 状态检查:`, {
            hasUserMessage,
            hasAssistantMessage,
            isProperTurn,
            isBalancedTurn,
            currentTurn,
            alreadyGenerated: serviceGeneratedTurns.has(currentTurn),
            userCount: expectedUserMessages,
            assistantCount: expectedAssistantMessages,
            lastRole: lastMessage.role
          });

          if (isProperTurn && isBalancedTurn) {
            completedServices.push(serviceId);
          }
        }

        console.log(`🔍 Auto模式检查 - 已完成服务: ${completedServices.length}, 相关服务: ${relevantServices.length}`);

        // 为每个已完成的服务生成下一轮用户输入 - 修复重复触发问题（终极方案）
        for (const serviceId of completedServices) {
          const conversationId = serviceConversations[serviceId]?.conversationId;
          if (!conversationId) {
            console.log(`❌ 没有找到对话ID for service: ${serviceId}`);
            continue;
          }

          // 获取准确的当前轮次
          const messages = serviceConversations[serviceId]?.messages || [];
          const actualUserMessages = messages.filter(msg => msg.role === 'user').length;
          const currentTurn = actualUserMessages;

          // 生成唯一标识符：对话ID + 轮次 + 最后消息ID
          const lastMessage = messages[messages.length - 1];
          const messageComboKey = `${conversationId}-${currentTurn}-${lastMessage?.id || 'none'}`;
          
          // 检查时间间隔（至少3秒间隔）
          const now = Date.now();
          const lastTrigger = lastTriggerTimestampRef.current[serviceId] || 0;
          if (now - lastTrigger < 3000) {
            console.log(`⏰ 服务 ${serviceId} 触发间隔太短(${now - lastTrigger}ms)，跳过`);
            continue;
          }

          // 五重检查防止重复触发
          // 1. 基于消息组合的检查（最严格）
          if (!processedMessageCombosRef.current[serviceId]) {
            processedMessageCombosRef.current[serviceId] = new Set();
          }
          if (processedMessageCombosRef.current[serviceId].has(messageComboKey)) {
            console.log(`🔒 服务 ${serviceId} 消息组合已处理: ${messageComboKey}`);
            continue;
          }

          // 2. 检查ref中的处理状态
          if (processingTurnsRef.current[serviceId]?.has(currentTurn)) {
            console.log(`🔄 服务 ${serviceId} 第 ${currentTurn} 轮正在处理中`);
            continue;
          }

          // 3. 检查最后处理的轮次
          if (lastProcessedTurnRef.current[serviceId] === currentTurn) {
            console.log(`✅ 服务 ${serviceId} 第 ${currentTurn} 轮已处理过`);
            continue;
          }

          // 4. 检查状态中的标记
          const serviceGeneratedTurns = generatedTurns[serviceId] || new Set();
          if (serviceGeneratedTurns.has(currentTurn)) {
            console.log(`⚠️ 服务 ${serviceId} 第 ${currentTurn} 轮已标记完成`);
            continue;
          }

          // 5. 验证服务归属
          const currentDialogueServiceIds = new Set(Object.values(dialogueServices));
          if (!currentDialogueServiceIds.has(serviceId)) {
            console.log(`🚫 服务 ${serviceId} 不属于当前对话框`);
            continue;
          }

          // 原子化标记：立即标记所有状态
          const markAsProcessing = () => {
            if (!processingTurnsRef.current[serviceId]) {
              processingTurnsRef.current[serviceId] = new Set();
            }
            processingTurnsRef.current[serviceId].add(currentTurn);
            
            lastProcessedTurnRef.current[serviceId] = currentTurn;
            lastTriggerTimestampRef.current[serviceId] = now;
            processedMessageCombosRef.current[serviceId].add(messageComboKey);
            
            setGeneratedTurns(prev => ({
              ...prev,
              [serviceId]: new Set([...(prev[serviceId] || []), currentTurn])
            }));
          };

          // 立即原子化标记
          markAsProcessing();

          console.log(`🚀 为服务 ${serviceId} (对话ID: ${conversationId}) 生成第 ${currentTurn} 轮用户输入 - 状态检查通过，开始调用接口`);

          // 再次确认状态，防止竞态条件
          const currentState = serviceConversations[serviceId];
          if (!currentState || currentState.isStreaming) {
            console.log(`⚠️ 服务 ${serviceId} 状态已变化，跳过`);
            // 清理正在生成状态，避免显示
            setGeneratingUserInputs(prev => {
              const newSet = new Set(prev);
              newSet.delete(serviceId);
              return newSet;
            });
            continue;
          }

          try {
            // 设置正在生成用户输入状态
            setGeneratingUserInputs(prev => new Set([...prev, serviceId]));

            const userInputResult = await apiService.generateUserInput(userId, conversationId, currentUserData, currentTurn);
            console.log(`🔄 服务 ${serviceId} - 生成用户输入: turn=${currentTurn}, end=${userInputResult.end}, input="${userInputResult.user_input}"`);

          // 清理处理状态（但保留已处理标记）
          if (processingTurnsRef.current[serviceId]) {
            processingTurnsRef.current[serviceId].delete(currentTurn);
          }

          // 再次检查状态，确保AI回复已完成
          const finalState = serviceConversations[serviceId];
          if (!finalState || finalState.isStreaming) {
            console.log(`⚠️ 服务 ${serviceId} 在生成用户输入后状态变化，跳过发送`);
            setGeneratingUserInputs(prev => {
              const newSet = new Set(prev);
              newSet.delete(serviceId);
              return newSet;
            });
            continue;
          }

            // 检查是否结束该服务的对话
            if (userInputResult.end || currentTurn >= maxAutoTurns) {
              console.log(`🏁 服务 ${serviceId} 结束对话: turn=${currentTurn}, end_flag=${userInputResult.end}, max_turns=${maxAutoTurns}`);
              
              // 如果是因为end=true结束，且有用户输入，则先发送最终用户消息
              if (userInputResult.end && userInputResult.user_input) {
                const finalUserReply = userInputResult.user_input;
                console.log(`📤 发送最终用户输入到服务 ${serviceId}: "${finalUserReply}"`);
                const modelConfig = getModelConfigForService(serviceId);
                await sendMessageToService(serviceId, finalUserReply, modelConfig);
              }
              
              setActiveAutoServices(prev => {
                const newSet = new Set(prev);
                newSet.delete(serviceId);
                return newSet;
              });
              
              setGeneratingUserInputs(prev => {
                const newSet = new Set(prev);
                newSet.delete(serviceId);
                return newSet;
              });
              
              // 标记该服务为已完成
              setCompletedAutoServices(prev => {
                const newSet = new Set(prev);
                newSet.add(serviceId);
                return newSet;
              });
              continue;
            }

            const userReply = userInputResult.user_input;
            console.log(`📤 向服务 ${serviceId} 发送用户输入: "${userReply}"`);
            
            // 发送消息并等待完成
            const modelConfig = getModelConfigForService(serviceId);
            await sendMessageToService(serviceId, userReply, modelConfig);
            
            // 清理生成状态
            setGeneratedTurns(prev => ({
              ...prev,
              [serviceId]: new Set([...(prev[serviceId] || []), currentTurn])
            }));

          } catch (error) {
            console.error(`服务 ${serviceId} 生成用户输入失败:`, error);
            // 清理处理状态，但保留已处理标记防止重复
            if (processingTurnsRef.current[serviceId]) {
              processingTurnsRef.current[serviceId].delete(currentTurn);
            }
            // 清除正在生成用户输入状态
            setGeneratingUserInputs(prev => {
              const newSet = new Set(prev);
              newSet.delete(serviceId);
              return newSet;
            });
            // 如果API调用失败，从活跃服务中移除该服务，并标记为已完成
            setActiveAutoServices(prev => {
              const newSet = new Set(prev);
              newSet.delete(serviceId);
              return newSet;
            });
            setCompletedAutoServices(prev => {
              const newSet = new Set(prev);
              newSet.add(serviceId);
              return newSet;
            });
          } finally {
            // 确保清理正在生成状态和处理状态（保留已处理标记）
            setGeneratingUserInputs(prev => {
              const newSet = new Set(prev);
              newSet.delete(serviceId);
              return newSet;
            });
            if (processingTurnsRef.current[serviceId]) {
              processingTurnsRef.current[serviceId].delete(currentTurn);
            }
          }
        }

        // 检查是否所有相关服务都结束了 - 只检查当前对话框的服务
        const remainingServices = Array.from(activeAutoServices).filter(serviceId => 
          currentDialogueServices.has(serviceId)
        );
        
        if (remainingServices.length === 0) {
          console.log(`🏁 当前对话框的所有服务都已结束Auto模式`);
          // 只标记当前对话框的服务为已完成
          setCompletedAutoServices(prev => {
            const newSet = new Set(prev);
            currentDialogueServices.forEach(serviceId => newSet.add(serviceId));
            return newSet;
          });
          onAutoRunningChange(false);
        }
      };

                    // 使用更强的防抖机制防止重复触发（5秒防抖）
        const timeoutId = setTimeout(autoReply, 5000);
        return () => clearTimeout(timeoutId);
    }
  }, [serviceConversations, dialogueMode, isAutoRunning, activeAutoServices, userId, turnCounters, onAutoRunningChange, dialogueServices, generatingUserInputs, generatedTurns, maxAutoTurns]);

  // 使用useRef跟踪每个服务的触发状态，分别跟踪规划器记录和评分详情
  const plannerTriggerStatesRef = useRef<{[serviceId in ServiceType]?: {lastTurn?: number}}>({});
  const scoreTriggerStatesRef = useRef<{[serviceId in ServiceType]?: {lastTurn?: number}}>({});
  
  // 使用useRef跟踪正在处理的轮次，防止重复触发
  const processingTurnsRef = useRef<{[serviceId in ServiceType]?: Set<number>}>({});
  const lastProcessedTurnRef = useRef<{[serviceId in ServiceType]?: number}>({});
  
  // 使用useRef跟踪已处理的消息组合，防止基于消息内容的重复触发
  const processedMessageCombosRef = useRef<{[serviceId in ServiceType]?: Set<string>}>({});
  const lastTriggerTimestampRef = useRef<{[serviceId in ServiceType]?: number}>({});

  // 监听消息变化，自动调用规划器记录接口 - 添加会话隔离检查
  useEffect(() => {
    const currentDialogueServiceIds = new Set(Object.values(dialogueServices).filter(Boolean) as ServiceType[]);
    Object.entries(serviceConversations).forEach(([serviceId, serviceState]) => {
      // 只处理当前对话框中的服务
      if (!currentDialogueServiceIds.has(serviceId as ServiceType)) return;
      if (!serviceState?.conversationId || serviceState.isStreaming) return;

      const messages = serviceState.messages;
      if (messages.length === 0) return;

      const lastMessage = messages[messages.length - 1];
      
      // 只有当是assistant回复且不是错误消息时才触发
      if (lastMessage.role === 'assistant' && !lastMessage.content.includes('❌')) {
        const userMessages = messages.filter(msg => msg.role === 'user').length;
        const assistantMessages = messages.filter(msg => msg.role === 'assistant').length;
        
        // 确保是完整的对话轮次（用户消息和助手消息数量匹配）
        if (userMessages === assistantMessages) {
          const turn = userMessages - 1;

          if (turn >= 0) {
            const detailKey = `${serviceState.conversationId}-${turn}`;

            // 检查是否已经触发过这个轮次的规划器记录
            const lastTrigger = plannerTriggerStatesRef.current[serviceId as ServiceType];
            const shouldTrigger = !lastTrigger || lastTrigger.lastTurn !== turn;

            if (shouldTrigger) {
              console.log(`🔄 触发服务 ${serviceId} 的规划器记录: conversationId=${serviceState.conversationId}, turn=${turn}`);

              // 更新规划器记录的触发状态
              plannerTriggerStatesRef.current[serviceId as ServiceType] = {
                lastTurn: turn
              };

              // 设置加载状态
              setServiceTurnDetails(prevDetails => ({
                ...prevDetails,
                [serviceId]: {
                  ...(prevDetails[serviceId as ServiceType] || {}),
                  [detailKey]: {
                    ...(prevDetails[serviceId as ServiceType]?.[detailKey] || {}),
                    plannerRecord: {
                      data: null,
                      isExpanded: prevDetails[serviceId as ServiceType]?.[detailKey]?.plannerRecord?.isExpanded || false,
                      isLoading: true
                    }
                  }
                }
              }));

              setTimeout(() => {
                apiService.getPlannerRecord(serviceState.conversationId!, userId, turn).then(plannerData => {
                  setServiceTurnDetails(prevDetails => ({
                    ...prevDetails,
                    [serviceId]: {
                      ...(prevDetails[serviceId as ServiceType] || {}),
                      [detailKey]: {
                        ...(prevDetails[serviceId as ServiceType]?.[detailKey] || {}),
                        plannerRecord: {
                          data: plannerData,
                          isExpanded: prevDetails[serviceId as ServiceType]?.[detailKey]?.plannerRecord?.isExpanded || false,
                          isLoading: false
                        }
                      }
                    }
                  }));
                }).catch(error => {
                  console.error(`获取规划器记录失败 ${serviceId}:`, error);
                  setServiceTurnDetails(prevDetails => ({
                    ...prevDetails,
                    [serviceId]: {
                      ...(prevDetails[serviceId as ServiceType] || {}),
                      [detailKey]: {
                        ...(prevDetails[serviceId as ServiceType]?.[detailKey] || {}),
                        plannerRecord: {
                          data: null,
                          isExpanded: false,
                          isLoading: false
                        }
                      }
                    }
                  }));
                });
              }, 200);
            }
          }
        }
      }
    });
  }, [serviceConversations, userId]);

  // 监听消息变化，自动调用评分详情接口 - 添加会话隔离检查
  useEffect(() => {
    const currentDialogueServiceIds = new Set(Object.values(dialogueServices).filter(Boolean) as ServiceType[]);
    Object.entries(serviceConversations).forEach(([serviceId, serviceState]) => {
      // 只处理当前对话框中的服务
      if (!currentDialogueServiceIds.has(serviceId as ServiceType)) return;
      if (!serviceState?.conversationId || serviceState.isStreaming) return;

      const messages = serviceState.messages;
      if (messages.length === 0) return;

      const lastMessage = messages[messages.length - 1];
      
      // 只有当是assistant回复且不是错误消息时才触发
      if (lastMessage.role === 'assistant' && !lastMessage.content.includes('❌')) {
        const userMessages = messages.filter(msg => msg.role === 'user').length;
        const assistantMessages = messages.filter(msg => msg.role === 'assistant').length;
        
        // 确保是完整的对话轮次（用户消息和助手消息数量匹配）
        if (userMessages === assistantMessages) {
          const turn = userMessages - 1;

          if (turn >= 0) {
            const detailKey = `${serviceState.conversationId}-${turn}`;

            // 检查是否已经触发过这个轮次的评分详情
            const lastTrigger = scoreTriggerStatesRef.current[serviceId as ServiceType];
            const shouldTrigger = !lastTrigger || lastTrigger.lastTurn !== turn;

            if (shouldTrigger) {
              console.log(`🔄 触发服务 ${serviceId} 的评分详情: conversationId=${serviceState.conversationId}, turn=${turn}`);

              // 更新评分详情的触发状态
              scoreTriggerStatesRef.current[serviceId as ServiceType] = {
                lastTurn: turn
              };

              // 设置加载状态
              setServiceTurnDetails(prevDetails => ({
                ...prevDetails,
                [serviceId]: {
                  ...(prevDetails[serviceId as ServiceType] || {}),
                  [detailKey]: {
                    ...(prevDetails[serviceId as ServiceType]?.[detailKey] || {}),
                    scoreDetail: {
                      data: null,
                      isExpanded: prevDetails[serviceId as ServiceType]?.[detailKey]?.scoreDetail?.isExpanded || false,
                      isLoading: true
                    }
                  }
                }
              }));

              setTimeout(() => {
                apiService.getScoreDetail(serviceState.conversationId!, userId, turn, currentUserData?.user_info).then(scoreData => {
                  setServiceTurnDetails(prevDetails => ({
                    ...prevDetails,
                    [serviceId]: {
                      ...(prevDetails[serviceId as ServiceType] || {}),
                      [detailKey]: {
                        ...(prevDetails[serviceId as ServiceType]?.[detailKey] || {}),
                        scoreDetail: {
                          data: scoreData,
                          isExpanded: prevDetails[serviceId as ServiceType]?.[detailKey]?.scoreDetail?.isExpanded || false,
                          isLoading: false
                        }
                      }
                    }
                  }));
                }).catch(error => {
                  console.error(`获取评分详情失败 ${serviceId}:`, error);
                  setServiceTurnDetails(prevDetails => ({
                    ...prevDetails,
                    [serviceId]: {
                      ...(prevDetails[serviceId as ServiceType] || {}),
                      [detailKey]: {
                        ...(prevDetails[serviceId as ServiceType]?.[detailKey] || {}),
                        scoreDetail: {
                          data: null,
                          isExpanded: false,
                          isLoading: false
                        }
                      }
                    }
                  }));
                });
              }, 1000); // 评分详情延迟1秒请求
            }
          }
        }
      }
    });
  }, [serviceConversations, userId, currentUserData]);

  // 获取服务的模型配置
  const getModelConfigForService = (serviceId: ServiceType): ModelConfig => {
    // 找到该服务对应的对话框索引
    const dialogueIndex = Object.entries(dialogueServices).find(([_, sid]) => sid === serviceId)?.[0];
    if (dialogueIndex !== undefined) {
      return dialogueModelConfigs[parseInt(dialogueIndex)] || DEFAULT_MODEL_CONFIG;
    }
    return DEFAULT_MODEL_CONFIG;
  };

  // 获取轮次详情 - 现在由自动调用机制处理

  // 发送消息到指定服务 - 优化版，无转圈loading
  const sendMessageToService = async (serviceId: ServiceType, content: string, modelConfig?: ModelConfig) => {
    const serviceState = serviceConversations[serviceId];
    if (!serviceState?.conversationId) {
      console.warn(`⚠️ 服务 ${serviceId} 没有对话ID，跳过发送`);
      return;
    }

    const conversationId = serviceState.conversationId;
    console.log(`📤 发送消息到服务 ${serviceId} (对话ID: ${conversationId})`);
    
    // 获取当前轮次并更新计数器
    const currentTurn = turnCounters[serviceId] || 0;
    const newTurn = currentTurn + 1;
    setTurnCounters(prev => ({
      ...prev,
      [serviceId]: newTurn
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
        messages: [...prev[serviceId]!.messages, userMessage],
        isStreaming: false,
        error: null
      }
    }));

    try {
      // 直接添加AI消息占位，开始流式响应
      const aiMessageId = `${Date.now() + 1}-${serviceId}`;
      const aiMessage: Message = {
        id: aiMessageId,
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString()
      };

      setServiceConversations(prev => ({
        ...prev,
        [serviceId]: {
          ...prev[serviceId]!,
          messages: [...prev[serviceId]!.messages, aiMessage],
          isStreaming: true,
          error: null
        }
      }));

      let aiMessageContent = '';

      // 使用模型配置中的 assistantModel，如果没有则使用 serviceId
      const assistantModel = modelConfig?.assistantModel || serviceId;
      const scoreModel = modelConfig?.scoreModel;
      
      await apiService.sendMessageStream(
        conversationId,
        userId,
        {
          content,
          turn: currentTurn,
          service: assistantModel,
          score_model: scoreModel,
          outer_user_goal: dialogueMode === 'auto' && currentUserData ? currentUserData.portrait.问题描述[0] || '' : ''
        },
        // onMessageStart
        () => {},
        // onChunk - 实时更新内容
        (chunk: string) => {
          aiMessageContent += chunk;
          setServiceConversations(prev => {
            const currentMessages = prev[serviceId]?.messages || [];
            const updatedMessages = currentMessages.map(msg => 
              msg.id === aiMessageId 
                ? { ...msg, content: aiMessageContent }
                : msg
            );
            return {
              ...prev,
              [serviceId]: {
                ...prev[serviceId]!,
                messages: updatedMessages,
                isStreaming: true
              }
            };
          });
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

          // turn_detail现在由自动调用机制处理
        },
        // onError
        (error: string) => {
          console.error(`发送消息失败 ${serviceId}:`, error);
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
        () => {}
      );

    } catch (error) {
      console.error(`发送消息失败 ${serviceId}:`, error);
      // 添加错误消息
      const errorMessage: Message = {
        id: `${Date.now() + 2}-${serviceId}`,
        role: 'assistant',
        content: `❌ 发送失败: ${error instanceof Error ? error.message : '未知错误'}`,
        timestamp: new Date().toISOString()
      };
      
      setServiceConversations(prev => ({
        ...prev,
        [serviceId]: {
          ...prev[serviceId]!,
          messages: [...prev[serviceId]!.messages, errorMessage],
          isStreaming: false,
          error: error instanceof Error ? error.message : '未知错误'
        }
      }));
    }
  };

  // 发送消息到所有对话框中的服务（共享模式）
  const handleSendMessage = async (content: string) => {
    if (!content.trim() || isSending) return;

    setIsSending(true);

    try {
      // 发送到所有对话框中的服务
      console.log('📤 发送消息到所有对话框服务:', Object.values(dialogueServices));
      const sendPromises = Object.values(dialogueServices)
        .filter((serviceId): serviceId is ServiceType => Boolean(serviceId))
        .map(serviceId => {
          const modelConfig = getModelConfigForService(serviceId);
          return sendMessageToService(serviceId, content, modelConfig);
        });
      await Promise.allSettled(sendPromises);
    } finally {
      setIsSending(false);
      setInputMessage("");
    }
  };

  // 处理独立输入框的消息发送
  const handleIndependentSendMessage = async (serviceId: ServiceType, message: string) => {
    if (!message.trim() || independentSending[serviceId]) return;

    setIndependentSending(prev => ({ ...prev, [serviceId]: true }));
    
    try {
      const modelConfig = getModelConfigForService(serviceId);
      await sendMessageToService(serviceId, message, modelConfig);
      
      // 清空该服务的独立输入框
      setIndependentInputs(prev => ({ ...prev, [serviceId]: "" }));
      
    } catch (error) {
      console.error(`Failed to send message to ${serviceId}:`, error);
    } finally {
      setIndependentSending(prev => ({ ...prev, [serviceId]: false }));
    }
  };

  // 处理独立输入框的输入变化
  const handleIndependentInputChange = (serviceId: ServiceType, value: string) => {
    setIndependentInputs(prev => ({ ...prev, [serviceId]: value }));
  };

  // 创建对话框数组（1-3个）
  const dialogueBoxes = Array.from({ length: dialogueCount }, (_, index) => index);

  // 手动触发创建对话
  const forceCreateConversations = () => {
    console.log('🔄 手动触发创建对话');
    Object.values(dialogueServices).forEach(serviceId => {
      if (serviceId) {
        createConversation(serviceId);
      }
    });
  };

  // 清空所有对话框的对话
  const clearAllConversations = () => {
    console.log('🧹 清空所有对话框的对话');
    // 清除所有生成状态
    setGeneratedTurns({});
    setGeneratingUserInputs(new Set());
    setCompletedAutoServices(new Set());
    setActiveAutoServices(new Set());
    
    Object.values(dialogueServices).forEach(serviceId => {
      if (serviceId) {
        createConversation(serviceId);
      }
    });
  };

  // 暴露方法给父组件
  useImperativeHandle(ref, () => ({
    clearAllConversations
  }));

  return (
    <div className="flex flex-col h-[calc(100vh-200px)]">

      {/* 对话框网格 */}
      <div className="flex-1 grid gap-4" style={{
        gridTemplateColumns: `repeat(${Math.min(dialogueCount, 3)}, 1fr)`
      }}>
        {dialogueBoxes.map(boxIndex => {
          const assignedService = dialogueServices[boxIndex];

          return (
            <div key={boxIndex} className="flex flex-col h-full border rounded-lg bg-card">
              {/* 聊天面板 */}
              <div className="flex-1">
                {assignedService ? (
                  (() => {
                    const config = getServiceConfig(assignedService);
                    const serviceState = serviceConversations[assignedService] || {
                      conversationId: null,
                      messages: [],
                      isStreaming: false,
                      error: null
                    };

                    return (
                      <ServiceChatPanel
                        key={`${assignedService}-${boxIndex}`}
                        serviceId={assignedService}
                        serviceConfig={config}
                        conversationState={serviceState}
                        turnDetails={serviceTurnDetails[assignedService] || {}}
                        generatingUserInputs={generatingUserInputs}
                        isAutoCompleted={completedAutoServices.has(assignedService)}
                        onSendMessage={(content) => handleIndependentSendMessage(assignedService, content)}
                        onClearConversation={() => createConversation(assignedService)}
                        serviceConfigs={serviceConfigs}
                        onServiceChange={(serviceId: ServiceType) => handleServiceChange(boxIndex, serviceId)}
                        onToggleTurnDetail={(detailKey, section) => {
                          setServiceTurnDetails((prev: any) => ({
                            ...prev,
                            [assignedService]: {
                              ...(prev[assignedService] || {}),
                              [detailKey]: {
                                ...(prev[assignedService]?.[detailKey] || {}),
                                [section === 'planner' ? 'plannerRecord' : 'scoreDetail']: {
                                  ...prev[assignedService]?.[detailKey]?.[section === 'planner' ? 'plannerRecord' : 'scoreDetail'],
                                  isExpanded: !prev[assignedService]?.[detailKey]?.[section === 'planner' ? 'plannerRecord' : 'scoreDetail']?.isExpanded
                                }
                              }
                            }
                          }));
                        }}
                        useIndependentInput={true}
                        independentInputValue={independentInputs[assignedService] || ""}
                        onIndependentInputChange={(value) => handleIndependentInputChange(assignedService, value)}
                        dialogueMode={dialogueMode}
                        modelConfig={dialogueModelConfigs[boxIndex] || DEFAULT_MODEL_CONFIG}
                        onModelConfigChange={(config) => handleModelConfigChange(boxIndex, config)}
                      />
                    );
                  })()
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <div className="text-center">
                      <div className="text-4xl mb-2">🤖</div>
                      <p className="text-sm">请在上方选择服务</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 共享用户消息输入框 - 仅在正常对话模式且对话框数量大于1时显示 */}
      {dialogueMode === 'normal' && dialogueCount > 1 && (
        <div className="mt-4 p-4 bg-muted/10 rounded-lg border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-muted-foreground">
              共享消息输入框
            </span>
            <span className="text-xs text-muted-foreground">
              将同时发送到 {dialogueCount} 个对话框
            </span>
          </div>
          <SharedMessageInput
            value={inputMessage}
            onChange={setInputMessage}
            onSend={handleSendMessage}
            isSending={isSending}
            disabled={Object.keys(dialogueServices).length === 0}
            placeholder={`向 ${dialogueCount} 个对话框发送消息...`}
            serviceCount={dialogueCount}
            readyServices={Object.keys(dialogueServices).length}
            totalServices={dialogueCount}
          />
        </div>
      )}
    </div>
  );
});

MultiServiceChatSimple.displayName = 'MultiServiceChatSimple';