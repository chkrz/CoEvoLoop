import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  getSynthesisTasks, 
  deleteSynthesisTask, 
  getSynthesisTaskStats,
  startSynthesisTask,
  cancelSynthesisTask,
  downloadSynthesisTask,
  type SynthesisTask 
} from "@/lib/synthesisApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Eye, Play, Square, Trash2, Sparkles, Download } from "lucide-react";

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

export default function SynthesisList() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<SynthesisTask | null>(null);
  
  // 获取任务列表
  const { data: tasksData, isLoading } = useQuery({
    queryKey: ['synthesis-tasks', typeFilter, statusFilter, search],
    queryFn: () => getSynthesisTasks({
      type: typeFilter !== 'all' ? typeFilter : undefined,
      status: statusFilter !== 'all' ? statusFilter : undefined,
      search: search || undefined,
    }),
    refetchInterval: 5000, // 每5秒刷新一次
  });
  
  // 获取统计信息
  const { data: stats } = useQuery({
    queryKey: ['synthesis-stats'],
    queryFn: getSynthesisTaskStats,
    refetchInterval: 5000,
  });
  
  // 启动任务
  const startMutation = useMutation({
    mutationFn: startSynthesisTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['synthesis-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['synthesis-stats'] });
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
    mutationFn: cancelSynthesisTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['synthesis-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['synthesis-stats'] });
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
  
  // 删除任务
  const deleteMutation = useMutation({
    mutationFn: deleteSynthesisTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['synthesis-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['synthesis-stats'] });
      toast({
        title: "删除成功",
        description: "任务已删除",
      });
      setDeleteDialogOpen(false);
      setTaskToDelete(null);
    },
    onError: (error: Error) => {
      toast({
        title: "删除失败",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const handleDelete = (task: SynthesisTask) => {
    setTaskToDelete(task);
    setDeleteDialogOpen(true);
  };
  
  const confirmDelete = () => {
    if (taskToDelete) {
      deleteMutation.mutate(taskToDelete.id);
    }
  };

  const handleDownload = async (task: SynthesisTask) => {
    try {
      await downloadSynthesisTask(task.id);
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
  
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };
  
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="flex-1 p-6">
        {/* 页面标题 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Sparkles className="w-8 h-8" />
              数据合成与评测
            </h1>
            <p className="text-muted-foreground mt-1">自动化用户画像抽取、对话生成和质量评测</p>
          </div>
          <Button onClick={() => navigate('/synthesis/new')} size="lg">
            <Plus className="w-4 h-4 mr-2" />
            创建任务
          </Button>
        </div>
        
        {/* 统计卡片 */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  总任务
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  运行中
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{stats.by_status.RUNNING}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  已完成
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{stats.by_status.COMPLETED}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  对话合成
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.by_type.DIALOGUE}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  用户画像抽取
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.by_type.PORTRAIT}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  质量评估
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.by_type.EVALUATION || 0}</div>
              </CardContent>
            </Card>
          </div>
        )}
        
        {/* 筛选栏 */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="搜索任务名称..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部类型</SelectItem>
                  <SelectItem value="DIALOGUE">对话合成</SelectItem>
                  <SelectItem value="PORTRAIT">用户画像抽取</SelectItem>
                  <SelectItem value="EVALUATION">质量评估</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="PENDING">待启动</SelectItem>
                  <SelectItem value="RUNNING">运行中</SelectItem>
                  <SelectItem value="COMPLETED">已完成</SelectItem>
                  <SelectItem value="FAILED">失败</SelectItem>
                  <SelectItem value="CANCELLED">已取消</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
        
        {/* 任务表格 */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">
                加载中...
              </div>
            ) : tasksData && tasksData.tasks.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>名称</TableHead>
                    <TableHead>类型</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>进度</TableHead>
                    <TableHead>创建时间</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tasksData.tasks.map((task) => (
                    <TableRow key={task.id}>
                      <TableCell className="font-medium">
                        {task.name}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {typeLabels[task.type]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[task.status]}>
                          {statusLabels[task.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="w-[200px]">
                        {task.status === 'RUNNING' && (
                          <div className="space-y-1">
                            <Progress 
                              value={task.progress.total > 0 ? (task.progress.completed / task.progress.total) * 100 : 0} 
                            />
                            <p className="text-xs text-muted-foreground">
                              {task.progress.completed} / {task.progress.total}
                            </p>
                          </div>
                        )}
                        {task.status === 'COMPLETED' && (
                          <span className="text-sm text-muted-foreground">
                            {task.progress.completed} / {task.progress.total}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(task.created_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/synthesis/${task.id}`)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          {task.status === 'COMPLETED' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDownload(task)}
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                          )}
                          {task.status === 'PENDING' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => startMutation.mutate(task.id)}
                            >
                              <Play className="w-4 h-4 text-green-600" />
                            </Button>
                          )}
                          {task.status === 'RUNNING' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => cancelMutation.mutate(task.id)}
                            >
                              <Square className="w-4 h-4 text-amber-600" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(task)}
                            disabled={task.status === 'RUNNING'}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="p-8 text-center">
                <p className="text-muted-foreground mb-4">暂无合成任务</p>
                <Button onClick={() => navigate('/synthesis/new')}>
                  <Plus className="w-4 h-4 mr-2" />
                  创建第一个任务
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* 删除确认对话框 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除任务 <strong>{taskToDelete?.name}</strong> 吗？
              此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
