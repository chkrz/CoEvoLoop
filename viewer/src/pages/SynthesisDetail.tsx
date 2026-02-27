import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  getSynthesisTask,
  previewSynthesisTask,
  downloadSynthesisTask,
  startSynthesisTask,
  cancelSynthesisTask,
} from "@/lib/synthesisApi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Download, Play, Square, RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import ScoreCard from "@/components/ScoreCard";

const statusColors = {
  PENDING: "bg-gray-500",
  RUNNING: "bg-blue-500",
  COMPLETED: "bg-green-500",
  FAILED: "bg-red-500",
  CANCELLED: "bg-amber-500",
};

const statusLabels = {
  PENDING: "待启动",
  RUNNING: "运行中",
  COMPLETED: "已完成",
  FAILED: "失败",
  CANCELLED: "已取消",
};

const typeLabels = {
  DIALOGUE: "对话合成",
  PORTRAIT: "用户画像抽取",
  EVALUATION: "质量评估",
};

const renderPortraitList = (items?: string[]) => {
  if (!items || items.length === 0) {
    return <p className="text-sm text-muted-foreground">暂无</p>;
  }
  return (
    <ul className="list-disc list-inside mt-2 space-y-1">
      {items.map((item, idx) => (
        <li key={idx} className="text-sm text-muted-foreground">{item}</li>
      ))}
    </ul>
  );
};

export default function SynthesisDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // 获取任务详情
  const { data: task, isLoading } = useQuery({
    queryKey: ['synthesis-task', id],
    queryFn: () => getSynthesisTask(id!),
    enabled: !!id,
    refetchInterval: (data) => {
      // 如果任务在运行中，每2秒刷新一次
      return data?.status === 'RUNNING' ? 2000 : false;
    },
  });

  // 获取预览数据
  const { data: previewData, isLoading: isLoadingPreview } = useQuery({
    queryKey: ['synthesis-task-preview', id],
    queryFn: () => previewSynthesisTask(id!, 10),
    enabled: !!id && task?.status === 'COMPLETED',
  });

  const sourceTaskId = task?.config?.source_type === 'task'
    ? (task.type === 'DIALOGUE'
      ? task.config.source_portrait_task_id
      : task.type === 'EVALUATION'
        ? task.config.source_dialogue_task_id
        : undefined)
    : undefined;

  const { data: sourceTask } = useQuery({
    queryKey: ['synthesis-task-source', sourceTaskId],
    queryFn: () => getSynthesisTask(sourceTaskId!),
    enabled: !!sourceTaskId,
  });

  const sourceTaskLabel = sourceTask
    ? `${sourceTask.name} (${sourceTask.id})`
    : sourceTaskId || undefined;

  const handleSourceTaskClick = () => {
    if (sourceTaskId) {
      navigate(`/synthesis/${sourceTaskId}`);
    }
  };

  // 启动任务
  const startMutation = useMutation({
    mutationFn: () => startSynthesisTask(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['synthesis-task', id] });
      toast({
        title: "启动成功",
        description: "任务已开始执行",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "启动失败",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // 取消任务
  const cancelMutation = useMutation({
    mutationFn: () => cancelSynthesisTask(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['synthesis-task', id] });
      toast({
        title: "取消成功",
        description: "任务已取消",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "取消失败",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // 下载结果
  const handleDownload = async () => {
    try {
      await downloadSynthesisTask(id!);
      toast({
        title: "下载成功",
        description: "文件已开始下载",
      });
    } catch (error: any) {
      toast({
        title: "下载失败",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-background p-6">
        <Skeleton className="h-8 w-64 mb-6" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="min-h-screen flex flex-col bg-background p-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">任务不存在</h2>
          <Button onClick={() => navigate('/synthesis')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回列表
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="flex-1 p-6">
        {/* 页面标题 */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate('/synthesis')}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回列表
          </Button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">{task.name}</h1>
              <p className="text-muted-foreground mt-1">
                任务 ID: {task.id}
              </p>
            </div>
            <div className="flex gap-2">
              {task.status === 'PENDING' && (
                <Button onClick={() => startMutation.mutate()}>
                  <Play className="w-4 h-4 mr-2" />
                  启动任务
                </Button>
              )}
              {task.status === 'RUNNING' && (
                <Button onClick={() => cancelMutation.mutate()} variant="outline">
                  <Square className="w-4 h-4 mr-2" />
                  取消任务
                </Button>
              )}
              {task.status === 'COMPLETED' && (
                <Button onClick={handleDownload}>
                  <Download className="w-4 h-4 mr-2" />
                  下载结果
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* 任务基本信息 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <Card>
            <CardHeader>
              <CardTitle>基本信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">类型：</span>
                <Badge variant={task.type === 'DIALOGUE' ? 'default' : 'secondary'}>
                  {typeLabels[task.type]}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">状态：</span>
                <Badge className={statusColors[task.status]}>
                  {statusLabels[task.status]}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">创建者：</span>
                <span>{task.created_by}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">创建时间：</span>
                <span className="text-sm">{formatDate(task.created_at)}</span>
              </div>
              {task.started_at && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">启动时间：</span>
                  <span className="text-sm">{formatDate(task.started_at)}</span>
                </div>
              )}
              {task.completed_at && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">完成时间：</span>
                  <span className="text-sm">{formatDate(task.completed_at)}</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>执行进度</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {task.status === 'RUNNING' || task.status === 'COMPLETED' ? (
                <>
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm text-muted-foreground">完成进度</span>
                      <span className="text-sm font-medium">
                        {task.progress.completed} / {task.progress.total}
                      </span>
                    </div>
                    <Progress 
                      value={task.progress.total > 0 ? (task.progress.completed / task.progress.total) * 100 : 0} 
                    />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">成功率：</span>
                    <span className="font-medium">
                      {task.progress.success_rate.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">失败数：</span>
                    <span className="font-medium">{task.progress.failed}</span>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">任务尚未开始执行</p>
              )}
              {task.error_message && (
                <div className="mt-4 p-3 bg-destructive/10 rounded-md">
                  <p className="text-sm text-destructive">{task.error_message}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 配置信息 */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>任务配置</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {task.config.source_type && (
                <div>
                  <span className="text-sm text-muted-foreground">数据源类型：</span>
                  <p className="font-medium">
                    {task.config.source_type === 'path'
                      ? '文件路径'
                      : task.config.source_type === 'task'
                        ? '任务'
                        : '上传文件'}
                  </p>
                </div>
              )}
              {task.config.source_type === 'task' && sourceTaskLabel && (
                <div>
                  <span className="text-sm text-muted-foreground">来源任务：</span>
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto p-0 text-left font-medium break-all"
                    onClick={handleSourceTaskClick}
                  >
                    {sourceTaskLabel}
                  </Button>
                </div>
              )}
              {task.config.source_file_path && (
                <div>
                  <span className="text-sm text-muted-foreground">源文件路径：</span>
                  <p className="font-mono text-sm break-all">{task.config.source_file_path}</p>
                </div>
              )}
              {task.config.user_simulator && (
                <div>
                  <span className="text-sm text-muted-foreground">User Simulator：</span>
                  <p className="font-medium">{task.config.user_simulator.model}</p>
                </div>
              )}
              {task.config.assistant_model && (
                <div>
                  <span className="text-sm text-muted-foreground">Assistant Model：</span>
                  <p className="font-medium">{task.config.assistant_model.model}</p>
                </div>
              )}
              {task.config.batch_size !== undefined && (
                <div>
                  <span className="text-sm text-muted-foreground">并发批次大小：</span>
                  <p className="font-medium">{task.config.batch_size}</p>
                </div>
              )}
              {task.config.temperature !== undefined && (
                <div>
                  <span className="text-sm text-muted-foreground">Temperature：</span>
                  <p className="font-medium">{task.config.temperature}</p>
                </div>
              )}
              {task.config.max_turns && (
                <div>
                  <span className="text-sm text-muted-foreground">最大轮次：</span>
                  <p className="font-medium">{task.config.max_turns}</p>
                </div>
              )}
              {task.config.with_rag !== undefined && (
                <div>
                  <span className="text-sm text-muted-foreground">启用 RAG：</span>
                  <p className="font-medium">{task.config.with_rag ? '是' : '否'}</p>
                </div>
              )}
              {task.config.with_sop !== undefined && (
                <div>
                  <span className="text-sm text-muted-foreground">启用 SOP：</span>
                  <p className="font-medium">{task.config.with_sop ? '是' : '否'}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 质量评估综合分数 */}
        {task.status === 'COMPLETED' && task.type === 'EVALUATION' && task.evaluation_stats && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>质量评估综合分数</CardTitle>
              <CardDescription>
                基于所有对话的质量评估结果计算综合通过率
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex flex-col">
                  <span className="text-sm text-muted-foreground mb-1">总对话数</span>
                  <span className="text-2xl font-bold">{task.evaluation_stats.total_evaluated}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-sm text-muted-foreground mb-1">优质数</span>
                  <span className="text-2xl font-bold text-green-600">{task.evaluation_stats.passed_count}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-sm text-muted-foreground mb-1">优质率</span>
                  <span className={`text-2xl font-bold ${task.evaluation_stats.pass_rate >= 80 ? 'text-green-600' : task.evaluation_stats.pass_rate >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                    {task.evaluation_stats.pass_rate.toFixed(1)}%
                  </span>
                </div>
              </div>
              <div className="mt-4 p-3 bg-muted rounded-md">
                <p className="text-xs text-muted-foreground">
                  评分规则：每个对话包含约20个维度的评分，只要有任意一个维度评分为0，该对话为0分，否则为1分（优质）。
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 预览数据 */}
        {task.status === 'COMPLETED' && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>
                    {task.type === 'PORTRAIT'
                      ? '画像预览'
                      : task.type === 'EVALUATION'
                        ? '评估预览'
                        : '对话预览'}
                  </CardTitle>
                  <CardDescription>
                    {task.type === 'PORTRAIT'
                      ? '显示前 10 条抽取的画像'
                      : task.type === 'EVALUATION'
                        ? '显示前 10 条评估结果'
                        : '显示前 10 条生成的对话'}
                    {task.config.source_type === 'task' && sourceTaskLabel && (
                      <div className="mt-1">
                        <Button
                          type="button"
                          variant="link"
                          className="h-auto p-0 text-xs text-muted-foreground"
                          onClick={handleSourceTaskClick}
                        >
                          来源任务：{sourceTaskLabel}
                        </Button>
                      </div>
                    )}
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => queryClient.invalidateQueries({ queryKey: ['synthesis-task-preview', id] })}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  刷新
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingPreview ? (
                <div className="space-y-4">
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                </div>
              ) : previewData && previewData.dialogues.length > 0 ? (
                <div className="max-h-[600px] overflow-y-auto pr-2">
                  <div className="space-y-4">
                    {previewData.dialogues.map((dialogue, idx) => (
                    <Card key={idx} className="border">
                      <CardHeader className="py-3">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{task.type === 'PORTRAIT' ? `画像 #${idx + 1}` : `对话 #${idx + 1}`}</Badge>
                          {dialogue.uuid && (
                            <span className="text-xs text-muted-foreground font-mono ml-auto">
                              {dialogue.uuid}
                            </span>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent>
                        {task.type === 'PORTRAIT' ? (
                          <div className="space-y-4">
                            {dialogue.success === false && (
                              <div className="p-3 bg-destructive/10 rounded-md">
                                <p className="text-sm text-destructive">{dialogue.error || '画像抽取失败'}</p>
                              </div>
                            )}
                            {dialogue.portrait ? (
                              <div className="space-y-4">
                                <div>
                                  <Label className="text-base">背景描述</Label>
                                  {renderPortraitList(dialogue.portrait?.背景描述)}
                                </div>
                                <div>
                                  <Label className="text-base">知识盲区</Label>
                                  {renderPortraitList(dialogue.portrait?.知识盲区)}
                                </div>
                                <div>
                                  <Label className="text-base">问题描述</Label>
                                  {renderPortraitList(dialogue.portrait?.问题描述)}
                                </div>
                                <div>
                                  <Label className="text-base">操作历史</Label>
                                  {dialogue.portrait?.操作历史 && dialogue.portrait.操作历史.length > 0 ? (
                                    <div className="mt-2 space-y-2">
                                      {dialogue.portrait.操作历史.map((op: any, opIdx: number) => (
                                        <div key={opIdx} className="text-sm border-l-2 pl-3">
                                          <div><strong>{op.action}</strong> → {op.target}</div>
                                          <div className="text-muted-foreground">{op.details}</div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-sm text-muted-foreground">暂无</p>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground">暂无画像结果</p>
                            )}
                          </div>
                        ) : task.type === 'EVALUATION' ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label className="text-base">对话预览</Label>
                              {dialogue.conversation && Array.isArray(dialogue.conversation) && dialogue.conversation.length > 0 ? (
                                <div className="space-y-2">
                                  {dialogue.conversation.map((msg: any, msgIdx: number) => (
                                    <div 
                                      key={msgIdx}
                                      className={`text-sm p-2 rounded ${
                                        msg.role === 'user' 
                                          ? 'bg-blue-50 text-blue-900 dark:bg-blue-950/20 dark:text-blue-200' 
                                          : 'bg-green-50 text-green-900 dark:bg-green-950/20 dark:text-green-200'
                                      }`}
                                    >
                                      <span className="font-medium">
                                        {msg.role === 'user' ? '👤 用户' : '🤖 客服'}:
                                      </span>
                                      <span className="ml-2">{msg.content}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-sm text-muted-foreground">暂无对话内容</div>
                              )}
                            </div>
                            <div className="space-y-2">
                              <Label className="text-base">评估结果</Label>
                              {dialogue.evaluation ? (
                                <ScoreCard jsonData={JSON.stringify(dialogue.evaluation)} />
                              ) : (
                                <div className="text-sm text-muted-foreground">暂无评估结果</div>
                              )}
                            </div>
                          </div>
                        ) : dialogue.conversation && Array.isArray(dialogue.conversation) && dialogue.conversation.length > 0 ? (
                          <div className="space-y-2">
                            {dialogue.conversation.map((msg: any, msgIdx: number) => (
                              <div 
                                key={msgIdx}
                                className={`text-sm p-2 rounded ${
                                  msg.role === 'user' 
                                    ? 'bg-blue-50 text-blue-900 dark:bg-blue-950/20 dark:text-blue-200' 
                                    : 'bg-green-50 text-green-900 dark:bg-green-950/20 dark:text-green-200'
                                }`}
                              >
                                <span className="font-medium">
                                  {msg.role === 'user' ? '👤 用户' : '🤖 客服'}:
                                </span>
                                <span className="ml-2">{msg.content}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground">暂无消息</div>
                        )}
                      </CardContent>
                    </Card>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">暂无预览数据</p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
