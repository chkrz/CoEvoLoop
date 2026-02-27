import { useState, useEffect, useRef } from "react";
import { ServiceSelector } from "./ServiceSelector";
import { MultiServiceChatSimple } from "./MultiServiceChatSimple";
import { UserSelectionDialog } from "@/components/UserSelectionDialog";
import { useUser } from "@/contexts/UserContext";
import { useIsInIframe } from "@/hooks/useIsInIframe";
import { apiService, UserData } from "@/lib/api";
import {User, Users, Play, Square, Columns2, Columns3, RefreshCw, FileText} from "lucide-react";
import { AnnotationSummary } from "./AnnotationSummary";

// 服务类型定义 - 改为字符串类型以支持自定义模型
export type ServiceType = string;

// 模型配置接口
export interface ModelConfig {
  assistantModel: string;  // Assistant 模型
  userSimulatorModel?: string;  // 用户模拟器模型（仅 auto 模式）
  scoreModel?: string;  // 打分器模型
}

export interface ServiceConfig {
  id: ServiceType;
  name: string;
  description: string;
  color: string;
  icon: string;
  size: string;
  date: string;
  modelConfig?: ModelConfig;
}

// 服务类型映射到API参数
export const SERVICE_TYPE_MAP = {
  'dashscope/qwen3-235b-a22b': 'dashscope/qwen3-235b-a22b'
} as const;

// 默认模型配置
export const DEFAULT_MODEL_CONFIG: ModelConfig = {
  assistantModel: 'dashscope/qwen3-235b-a22b',
  userSimulatorModel: 'dashscope/qwen3-235b-a22b',
  scoreModel: 'dashscope/qwen3-235b-a22b'
};

// 服务配置
export const SERVICES: ServiceConfig[] = [
    {
    id: 'dashscope/qwen3-235b-a22b',
    name: 'dashscope/qwen3-235b-a22b',
    description: '',
    color: 'bg-purple-500',
    icon: '🎯',
    size: '235B',
    date: '',
    modelConfig: DEFAULT_MODEL_CONFIG
  },
];

export type DialogueMode = 'normal' | 'auto';

interface DialogueBSLayoutProps {
  onClearAllConversations?: () => void;
}

export function DialogueBSLayout({ onClearAllConversations }: DialogueBSLayoutProps) {
  const { userId, userName } = useUser();
  const isInIframe = useIsInIframe();
  const [dialogueMode, setDialogueMode] = useState<DialogueMode>('normal');
  const [dialogueCount, setDialogueCount] = useState<1 | 2 | 3>(1);
  const [maxAutoTurns, setMaxAutoTurns] = useState(5);
  const [userSelectionDialogOpen, setUserSelectionDialogOpen] = useState(false);
  const [currentUserData, setCurrentUserData] = useState<UserData | null>(null);
  const [isAutoRunning, setIsAutoRunning] = useState(false);
  const [showAnnotationSummary, setShowAnnotationSummary] = useState(false);
  const chatRef = useRef<{ clearAllConversations: () => void } | null>(null);

  // 处理用户选择
  const handleUserSelect = (user: UserData) => {
    setCurrentUserData(user);
    console.log('Selected user:', user);
  };

  // 当对话模式改变时重置状态
  const handleDialogueModeChange = (mode: DialogueMode) => {
    setDialogueMode(mode);
    setIsAutoRunning(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="p-6">{/* 对话模式和数量选择小框 */}
        <div className="mb-6 p-4 bg-muted/20 rounded-lg border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium">对话模式：</span>
              <div className="flex gap-2">
                <button
                  onClick={() => handleDialogueModeChange('normal')}
                  className={`px-3 py-1 text-sm rounded transition-colors ${
                    dialogueMode === 'normal'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary hover:bg-secondary/80'
                  }`}
                >
                  输入模式
                </button>
                <button
                  onClick={() => handleDialogueModeChange('auto')}
                  className={`px-3 py-1 text-sm rounded transition-colors ${
                    dialogueMode === 'auto'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary hover:bg-secondary/80'
                  }`}
                >
                  Auto模式
                </button>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Auto模式下的最大轮数选择器 */}
              {dialogueMode === 'auto' && (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">最大轮数：</span>
                  <div className="flex items-center border rounded bg-background">
                    <button
                      onClick={() => setMaxAutoTurns(Math.max(1, maxAutoTurns - 1))}
                      className="px-2 py-1 text-sm hover:bg-gray-100 border-r"
                      disabled={maxAutoTurns <= 1}
                    >
                      -
                    </button>
                    <input
                      type="number"
                      value={maxAutoTurns}
                      onChange={(e) => {
                        const value = parseInt(e.target.value);
                        if (!isNaN(value) && value >= 1 && value <= 99) {
                          setMaxAutoTurns(value);
                        }
                      }}
                      onBlur={(e) => {
                        const value = parseInt(e.target.value);
                        if (isNaN(value) || value < 1) {
                          setMaxAutoTurns(1);
                        } else if (value > 99) {
                          setMaxAutoTurns(99);
                        }
                      }}
                      min="1"
                      max="99"
                      className="w-16 px-2 py-1 text-sm text-center border-0 focus:outline-none focus:ring-0"
                    />
                    <button
                      onClick={() => setMaxAutoTurns(Math.min(99, maxAutoTurns + 1))}
                      className="px-2 py-1 text-sm hover:bg-gray-100 border-l"
                      disabled={maxAutoTurns >= 99}
                    >
                      +
                    </button>
                  </div>
                  <span className="text-xs text-muted-foreground">轮</span>
                </div>
              )}

              {/* 刷新按钮 */}
              <button
                onClick={() => chatRef.current?.clearAllConversations()}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-secondary hover:bg-secondary/80 rounded transition-colors"
                title="清空所有对话"
              >
                <RefreshCw className="w-4 h-4" />
                <span>清空所有对话</span>
              </button>

              {/* 标注概览按钮 */}
              <button
                onClick={() => setShowAnnotationSummary(true)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-secondary hover:bg-secondary/80 rounded transition-colors"
                title="查看标注概览"
              >
                <FileText className="w-4 h-4" />
                <span>标注概览</span>
              </button>

              <span className="text-sm font-medium">多屏显示</span>
              {/* 使用图标的选择器 */}
              <div className="flex items-center gap-1 rounded-lg bg-white p-1 border border-gray-200 shadow-sm">
                {[1, 2, 3].map((count) => {
                  // 图标组件映射
                  const iconComponents = {
                    1: Square,
                    2: Columns2,
                    3: Columns3,
                  };
                  const IconComponent = iconComponents[count as 1 | 2 | 3];

                  return (
                    <button
                      key={count}
                      onClick={() => setDialogueCount(count as 1 | 2 | 3)}
                      className={`rounded-md p-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                        dialogueCount === count
                          ? 'bg-gray-100 text-gray-800 shadow-inner-sm' // 选中状态：浅灰色背景
                          : 'text-gray-500 hover:bg-gray-100' // 未选中状态
                      }`}
                      title={`${count}个对话${count === 3 ? '对比' : '跑'}`}
                    >
                      {/* 使用图标组件，可以调整大小和描边宽度 */}
                      <IconComponent size={18} strokeWidth={1.5} />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* 用户信息栏 */}
        <div className="mb-6 p-4 bg-muted/20 rounded-lg border-b bg-muted/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* 头像容器：添加 onClick 和可点击样式 */}
              <div
                className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center cursor-pointer hover:bg-primary/20 transition-colors"
                onClick={() => setUserSelectionDialogOpen(true)}
              >
                <User className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">
                  <p className="font-medium">
                    <span className="text-sm text-muted-foreground">万里汇用户</span>
                  </p>
                </p>
                {currentUserData && dialogueMode === 'auto' && (
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium text-blue-600">用户问题：</span>{currentUserData.portrait.问题描述[0] || '暂无问题描述'}
                  </p>
                )}
              </div>
            </div>

            {/* Auto模式开始对话按钮 */}
            {dialogueMode === 'auto' && (currentUserData || isInIframe) && (
              <div className="flex items-center gap-3">
                <button
                  className={`
                    relative overflow-hidden px-6 py-3 rounded-full font-semibold text-sm
                    bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500
                    text-white shadow-lg hover:shadow-xl
                    transform hover:scale-105 active:scale-95
                    transition-all duration-300 ease-in-out
                    border border-white/20 backdrop-blur-sm
                    hover:from-blue-600 hover:via-purple-600 hover:to-pink-600
                  `}
                  onClick={() => setIsAutoRunning(true)}
                >
                  {/* 背景动画效果 */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-pulse" />

                  <div className="relative flex items-center gap-2">
                    <Play className="w-4 h-4 fill-current" />
                    <span>开始对话</span>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 多服务聊天界面 */}
        <MultiServiceChatSimple
          ref={chatRef}
          serviceConfigs={SERVICES}
          userId={userId}
          dialogueMode={dialogueMode}
          dialogueCount={dialogueCount}
          maxAutoTurns={maxAutoTurns}
          isAutoRunning={isAutoRunning}
          onAutoRunningChange={setIsAutoRunning}
          currentUserData={currentUserData}
        />
      </div>

      {/* 用户选择弹窗 */}
      <UserSelectionDialog
        open={userSelectionDialogOpen}
        onOpenChange={setUserSelectionDialogOpen}
        onUserSelect={handleUserSelect}
        currentUserId={currentUserData?.uuid}
      />

      {/* 标注概览弹窗 */}
      {showAnnotationSummary && (
        <AnnotationSummary
          conversationId="dialogue-bs-summary"
          messages={[]}
          onClose={() => setShowAnnotationSummary(false)}
        />
      )}
    </div>
  );
}