import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { createSynthesisTask, type SynthesisTask, getPortraitTasks, getDialogueTasks } from "@/lib/synthesisApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save, Sparkles, Upload, FileText } from "lucide-react";
import ScoreCard from "@/components/ScoreCard";

type ChatMessage = { role: string; content: string };

function ChatTranscript({ messages }: { messages: ChatMessage[] }) {
  return (
    <div className="space-y-2">
      {messages.map((msg, i) => (
        <div
          key={i}
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
  );
}

export default function SynthesisForm() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [taskType, setTaskType] = useState<"DIALOGUE" | "PORTRAIT" | "EVALUATION">("DIALOGUE");
  
  const [formData, setFormData] = useState({
    name: "",
    type: "DIALOGUE" as "DIALOGUE",
    
    // 源数据配置
    source_type: "task" as "task" | "upload",  // 改为 task | upload
    source_portrait_task_id: "",  // 新增：选中的画像任务ID
    uploaded_portraits: "",  // JSON 文本
    
    // User Simulator 配置
    user_model: "dashscope/qwen3-235b-a22b" | "custom",
    user_model_custom: "",
    
    // Assistant Simulator 配置
    assistant_model: "dashscope/qwen3-235b-a22b" | "custom",
    assistant_model_custom: "",
    
    // 其他配置
    prompt_version: "v0",
    temperature: "0.8",
    max_turns: "8",
    batch_size: "10",
    with_sop: false,

    // 画像抽取配置
    portrait_uploaded_dialogues: "", // JSON / JSONL 文本
    portrait_batch_size: "5",
    portrait_model: "dashscope/qwen3-235b-a22b",

    // 质量评估配置
    evaluation_source_type: "task" as "task" | "upload",
    evaluation_source_dialogue_task_id: "",
    evaluation_uploaded_dialogues: "",
    evaluation_batch_size: "5",
    evaluation_messages_json: "",  // 保留用于演示模式
    evaluation_model: "dashscope/qwen3-235b-a22b",
  });
  
  const [fileData, setFileData] = useState<File | null>(null);
  const [portraitFileData, setPortraitFileData] = useState<File | null>(null);
  const [portraitPreviewMessages, setPortraitPreviewMessages] = useState<ChatMessage[]>([]);
  const [isPortraitDragOver, setIsPortraitDragOver] = useState(false);
  const [portraitLoadedCount, setPortraitLoadedCount] = useState<number | null>(null);
  const portraitFileInputRef = useRef<HTMLInputElement>(null);

  // 评估任务文件上传状态
  const [evaluationFileData, setEvaluationFileData] = useState<File | null>(null);
  const [evaluationPreviewMessages, setEvaluationPreviewMessages] = useState<ChatMessage[]>([]);
  const [isEvaluationDragOver, setIsEvaluationDragOver] = useState(false);
  const [evaluationLoadedCount, setEvaluationLoadedCount] = useState<number | null>(null);
  const evaluationFileInputRef = useRef<HTMLInputElement>(null);

  // 获取画像任务列表
  const { data: portraitTasksData } = useQuery({
    queryKey: ['portraitTasks'],
    queryFn: getPortraitTasks,
    enabled: taskType === 'DIALOGUE'  // 只在对话合成时查询
  });

  // 获取对话任务列表
  const { data: dialogueTasksData, isLoading: isDialogueTasksLoading, error: dialogueTasksError } = useQuery({
    queryKey: ['dialogueTasks'],
    queryFn: getDialogueTasks,
    enabled: taskType === 'EVALUATION'  // 只在质量评估时查询
  });

  // 调试：打印对话任务数据
  useEffect(() => {
    if (taskType === 'EVALUATION') {
      console.log('对话任务数据:', dialogueTasksData);
      console.log('加载中:', isDialogueTasksLoading);
      console.log('错误:', dialogueTasksError);
    }
  }, [taskType, dialogueTasksData, isDialogueTasksLoading, dialogueTasksError]);

  const parsePortraitPreview = (content: string): ChatMessage[] => {
    const parseMessagesFromPayload = (payload: any): ChatMessage[] | null => {
      if (Array.isArray(payload)) {
        if (payload.length > 0 && payload[0]?.role && payload[0]?.content) {
          return payload;
        }
        if (payload.length > 0 && payload[0]?.messages) {
          return payload[0]?.messages ?? null;
        }
        if (payload.length > 0 && payload[0]?.conversation) {
          return payload[0]?.conversation ?? null;
        }
      }
      // 优先使用 conversation 字段（质量评估用），否则使用 messages
      if (payload && payload.conversation) {
        return payload.conversation;
      }
      if (payload && payload.messages) {
        return payload.messages;
      }
      return null;
    };

    try {
      const payload = JSON.parse(content);
      return parseMessagesFromPayload(payload) || [];
    } catch (err) {
      const lines = content.split(/\r?\n/).filter((line) => line.trim());
      for (const line of lines) {
        try {
          const payload = JSON.parse(line);
          const messages = parseMessagesFromPayload(payload);
          if (messages && messages.length > 0) return messages;
        } catch (e) {
          continue;
        }
      }
    }
    return [];
  };

  const countPortraitItems = (content: string): number => {
    try {
      const payload = JSON.parse(content);
      if (Array.isArray(payload)) {
        if (payload.length > 0 && payload[0]?.role && payload[0]?.content) return 1;
        return payload.length;
      }
      // 单个对象：检查是否有 conversation 或 messages 字段
      if (payload?.conversation || payload?.messages) return 1;
    } catch (err) {
      const lines = content.split(/\r?\n/).filter((line) => line.trim());
      return lines.length;
    }
    return 0;
  };

  const validateJsonOrJsonl = (content: string) => {
    try {
      JSON.parse(content);
      return true;
    } catch (err) {
      // JSONL 校验
      const lines = content.split(/\r?\n/).filter((line) => line.trim());
      if (lines.length === 0) return false;
      for (const line of lines) {
        try {
          JSON.parse(line);
        } catch (e) {
          return false;
        }
      }
      return true;
    }
  };
  
  // 文件上传处理（对话合成-用户画像文件）
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setFileData(file);
    
    // 读取文件内容
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        // 验证 JSON / JSONL 格式
        if (!validateJsonOrJsonl(content)) {
          throw new Error("invalid_format");
        }
        setFormData(prev => ({ ...prev, uploaded_portraits: content }));
        toast({
          title: "文件上传成功",
          description: `已加载 ${file.name}`,
        });
      } catch (err) {
        toast({
          title: "文件格式错误",
          description: "请上传有效的 JSON 或 JSONL 文件",
          variant: "destructive",
        });
      }
    };
    reader.readAsText(file);
  };

  // 文件上传处理（画像抽取-对话文件）
  const handlePortraitFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPortraitFileData(file);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        if (!validateJsonOrJsonl(content)) {
          throw new Error("invalid_format");
        }
        setFormData(prev => ({ ...prev, portrait_uploaded_dialogues: content }));
        setPortraitPreviewMessages(parsePortraitPreview(content));
        setPortraitLoadedCount(countPortraitItems(content));
        toast({
          title: "文件上传成功",
          description: `已加载 ${file.name}`,
        });
      } catch (err) {
        toast({
          title: "文件格式错误",
          description: "请上传有效的 JSON 或 JSONL 文件",
          variant: "destructive",
        });
      }
    };
    reader.readAsText(file);
  };

  const handlePortraitDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsPortraitDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const input = { target: { files: [file] } } as unknown as React.ChangeEvent<HTMLInputElement>;
    handlePortraitFileUpload(input);
  };

  // 文件上传处理（质量评估-对话文件）
  const handleEvaluationFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setEvaluationFileData(file);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        if (!validateJsonOrJsonl(content)) {
          throw new Error("invalid_format");
        }
        setFormData(prev => ({ ...prev, evaluation_uploaded_dialogues: content }));
        setEvaluationPreviewMessages(parsePortraitPreview(content));
        setEvaluationLoadedCount(countPortraitItems(content));
        toast({
          title: "文件上传成功",
          description: `已加载 ${file.name}`,
        });
      } catch (err) {
        toast({
          title: "文件格式错误",
          description: "请上传有效的 JSON 或 JSONL 文件",
          variant: "destructive",
        });
      }
    };
    reader.readAsText(file);
  };

  const handleEvaluationDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsEvaluationDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const input = { target: { files: [file] } } as unknown as React.ChangeEvent<HTMLInputElement>;
    handleEvaluationFileUpload(input);
  };
  
  // 获取数据集列表（用于数据蒸馏选择源数据集）
  const mutation = useMutation({
    mutationFn: (data: Partial<SynthesisTask>) => {
      return createSynthesisTask(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['synthesis-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['synthesis-stats'] });
      toast({
        title: "创建成功",
        description: "合成任务已创建",
      });
      navigate('/synthesis');
    },
    onError: (error: Error) => {
      toast({
        title: "创建失败",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (taskType === "DIALOGUE") {
      // 验证必填字段
      if (!formData.name) {
        toast({
          title: "验证失败",
          description: "请填写任务名称",
          variant: "destructive",
        });
        return;
      }

      // 验证对话合成配置
      if (formData.source_type === 'task' && !formData.source_portrait_task_id) {
        toast({
          title: "验证失败",
          description: "请选择画像任务",
          variant: "destructive",
        });
        return;
      }
      
      if (formData.source_type === 'upload' && !formData.uploaded_portraits) {
        toast({
          title: "验证失败",
          description: "请上传用户画像文件",
          variant: "destructive",
        });
        return;
      }
    }

    if (taskType === "PORTRAIT") {
      if (!formData.name) {
        toast({
          title: "验证失败",
          description: "请填写任务名称",
          variant: "destructive",
        });
        return;
      }

      if (!formData.portrait_uploaded_dialogues) {
        toast({
          title: "验证失败",
          description: "请上传对话文件",
          variant: "destructive",
        });
        return;
      }
    }
    
    // 准备模型配置
    const getUserModel = () => {
      if (formData.user_model === 'custom') {
        return formData.user_model_custom;
      }
      return formData.user_model;
    };
    
    const getAssistantModel = () => {
      if (formData.assistant_model === 'custom') {
        return formData.assistant_model_custom;
      }
      return formData.assistant_model;
    };
    
    if (taskType === "DIALOGUE") {
      // 准备提交数据
      const submitData: Partial<SynthesisTask> = {
        name: formData.name,
        type: "DIALOGUE",
        config: {
          source_type: formData.source_type,
          source_portrait_task_id: formData.source_type === 'task' ? formData.source_portrait_task_id : undefined,
          uploaded_portraits: formData.source_type === 'upload' ? formData.uploaded_portraits : undefined,
          
          user_simulator: {
            model: getUserModel(),
          },
          
          assistant_model: {
            model: getAssistantModel(),
          },
          
          prompt_version: formData.prompt_version || "v0",
          temperature: parseFloat(formData.temperature) || 0.8,
          max_turns: parseInt(formData.max_turns) || 8,
          batch_size: parseInt(formData.batch_size) || 10,
          with_sop: formData.with_sop,
        },
      };
      
      mutation.mutate(submitData);
    } else if (taskType === "PORTRAIT") {
      const submitData: Partial<SynthesisTask> = {
        name: formData.name,
        type: "PORTRAIT",
        config: {
          source_type: "upload",
          uploaded_dialogues: formData.portrait_uploaded_dialogues,
          batch_size: parseInt(formData.portrait_batch_size) || 5,
          model: formData.portrait_model,
        },
      };

      mutation.mutate(submitData);
    } else if (taskType === "EVALUATION") {
      // 验证必填字段
      if (!formData.name) {
        toast({
          title: "验证失败",
          description: "请填写任务名称",
          variant: "destructive",
        });
        return;
      }

      if (formData.evaluation_source_type === 'task' && !formData.evaluation_source_dialogue_task_id) {
        toast({
          title: "验证失败",
          description: "请选择对话合成任务",
          variant: "destructive",
        });
        return;
      }

      if (formData.evaluation_source_type === 'upload' && !formData.evaluation_uploaded_dialogues) {
        toast({
          title: "验证失败",
          description: "请上传对话文件",
          variant: "destructive",
        });
        return;
      }

      const submitData: Partial<SynthesisTask> = {
        name: formData.name,
        type: "EVALUATION",
        config: {
          source_type: formData.evaluation_source_type,
          source_dialogue_task_id: formData.evaluation_source_type === 'task' ? formData.evaluation_source_dialogue_task_id : undefined,
          uploaded_dialogues: formData.evaluation_source_type === 'upload' ? formData.evaluation_uploaded_dialogues : undefined,
          batch_size: parseInt(formData.evaluation_batch_size) || 5,
          model: formData.evaluation_model,
        },
      };

      mutation.mutate(submitData);
    }
  };
  
  const handleChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const [isEvaluationLoading, setIsEvaluationLoading] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState<any>(null);
  const [evaluationRawResponse, setEvaluationRawResponse] = useState<string | null>(null);

  const handleDialogueEvaluate = async () => {
    setEvaluationResult(null);
    setEvaluationRawResponse(null);

    if (!formData.evaluation_messages_json.trim()) {
      toast({
        title: "验证失败",
        description: "请输入 messages JSON",
        variant: "destructive",
      });
      return;
    }

    let messages: Array<{ role: string; content: string }>;
    try {
      messages = JSON.parse(formData.evaluation_messages_json);
    } catch (err) {
      toast({
        title: "JSON 解析失败",
        description: "请检查 messages JSON 格式",
        variant: "destructive",
      });
      return;
    }

    setIsEvaluationLoading(true);
    try {
      const res = await fetch("/api/synthesis/evaluate-dialogue/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error?.error || "质量评估失败");
      }

      const data = await res.json();
      setEvaluationResult(data);
      setEvaluationRawResponse(JSON.stringify(data, null, 2));
      toast({
        title: "评估完成",
        description: "已返回质量评估结果",
      });
    } catch (error: any) {
      toast({
        title: "评估失败",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsEvaluationLoading(false);
    }
  };
  
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
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Sparkles className="w-8 h-8" />
            创建合成任务
          </h1>
          <p className="text-muted-foreground mt-1">
            选择任务类型并填写参数
          </p>
        </div>
        
        {/* 表单 */}
        <Card className="max-w-4xl">
          <CardHeader>
            <CardTitle>任务配置</CardTitle>
            <CardDescription>
              画像抽取、对话合成、质量评估
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-3">
                <Label>任务类型</Label>
                <Tabs value={taskType} onValueChange={(v) => setTaskType(v as "DIALOGUE" | "PORTRAIT" | "EVALUATION")}
                >
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="PORTRAIT">用户画像抽取</TabsTrigger>
                    <TabsTrigger value="DIALOGUE">对话合成</TabsTrigger>
                    <TabsTrigger value="EVALUATION">质量评估</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {/* 基本信息 */}
              {(taskType === "DIALOGUE" || taskType === "PORTRAIT") && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">
                      任务名称 <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => handleChange('name', e.target.value)}
                      placeholder="例: 对话合成v1"
                    />
                  </div>
                </div>
              )}
              
              {taskType === "DIALOGUE" && (
                <>
                  {/* 源数据配置 */}
                  <div className="space-y-4 pt-4 border-t">
                    <h3 className="text-lg font-semibold">用户画像数据源</h3>
                    
                    <Tabs value={formData.source_type} onValueChange={(v) => handleChange('source_type', v)}>
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="task">
                          <FileText className="w-4 h-4 mr-2" />
                          选择画像任务
                        </TabsTrigger>
                        <TabsTrigger value="upload">
                          <Upload className="w-4 h-4 mr-2" />
                          上传文件
                        </TabsTrigger>
                      </TabsList>
                      
                      <TabsContent value="task" className="space-y-2">
                        <Label htmlFor="source_portrait_task_id">
                          画像抽取结果 <span className="text-destructive">*</span>
                        </Label>
                        <Select
                          value={formData.source_portrait_task_id}
                          onValueChange={(value) => handleChange('source_portrait_task_id', value)}
                        >
                          <SelectTrigger id="source_portrait_task_id">
                            <SelectValue placeholder="选择已完成的画像任务" />
                          </SelectTrigger>
                          <SelectContent>
                            {portraitTasksData?.tasks.filter(task => task.id && task.id !== '').map((task) => (
                              <SelectItem key={task.id} value={task.id}>
                                {task.name} (总数: {task.progress.total}, 成功率: {task.progress.success_rate.toFixed(1)}%)
                              </SelectItem>
                            ))}
                            {(!portraitTasksData?.tasks || portraitTasksData.tasks.filter(t => t.id && t.id !== '').length === 0) && (
                              <SelectItem value="none" disabled>暂无可用的画像任务</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          选择已成功完成的画像抽取任务作为数据源
                        </p>
                      </TabsContent>
                      
                      <TabsContent value="upload" className="space-y-2">
                        <Label htmlFor="file_upload">
                          上传用户画像文件 <span className="text-destructive">*</span>
                        </Label>
                        <div className="flex items-center gap-4">
                          <Input
                            id="file_upload"
                            type="file"
                            accept=".json,.jsonl"
                            onChange={handleFileUpload}
                            className="flex-1"
                          />
                          {fileData && (
                            <span className="text-sm text-muted-foreground">
                              {fileData.name}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          支持 JSON 或 JSONL 格式，每行一个用户画像
                        </p>
                        
                        {formData.uploaded_portraits && (
                          <div className="mt-2">
                            <Label>预览</Label>
                            <Textarea
                              value={formData.uploaded_portraits}
                              onChange={(e) => handleChange('uploaded_portraits', e.target.value)}
                              className="font-mono text-xs h-32"
                              placeholder="JSON 内容将显示在这里"
                            />
                          </div>
                        )}
                      </TabsContent>
                    </Tabs>
                  </div>
                  
                  {/* User Simulator 配置 */}
                  <div className="space-y-4 pt-4 border-t">
                    <h3 className="text-lg font-semibold">User Simulator 模型</h3>
                    
                    <div className="space-y-2">
                      <Label htmlFor="user_model">模型选择</Label>
                      <Select
                        value={formData.user_model}
                        onValueChange={(value) => handleChange('user_model', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="dashscope/qwen3-235b-a22b">dashscope/qwen3-235b-a22b</SelectItem>
                          <SelectItem value="custom">自定义模型</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {formData.user_model === 'custom' && (
                      <div className="space-y-2">
                        <Label htmlFor="user_model_custom">自定义模型名称</Label>
                        <Input
                          id="user_model_custom"
                          value={formData.user_model_custom}
                          onChange={(e) => handleChange('user_model_custom', e.target.value)}
                          placeholder="例: openai/gpt-4o"
                        />
                      </div>
                    )}
                  </div>
                  
                  {/* Assistant Simulator 配置 */}
                  <div className="space-y-4 pt-4 border-t">
                    <h3 className="text-lg font-semibold">Assistant Simulator 模型</h3>
                    
                    <div className="space-y-2">
                      <Label htmlFor="assistant_model">模型选择</Label>
                      <Select
                        value={formData.assistant_model}
                        onValueChange={(value) => handleChange('assistant_model', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="dashscope/qwen3-235b-a22b">dashscope/qwen3-235b-a22b</SelectItem>
                          <SelectItem value="custom">自定义模型</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {formData.assistant_model === 'custom' && (
                      <div className="space-y-2">
                        <Label htmlFor="assistant_model_custom">自定义模型名称</Label>
                        <Input
                          id="assistant_model_custom"
                          value={formData.assistant_model_custom}
                          onChange={(e) => handleChange('assistant_model_custom', e.target.value)}
                          placeholder="例: openai/gpt-4o"
                        />
                      </div>
                    )}
                  </div>
                  
                  {/* 生成配置 */}
                  <div className="space-y-4 pt-4 border-t">
                    <h3 className="text-lg font-semibold">生成配置</h3>
                    <p className="text-sm text-muted-foreground">
                      对话数量将根据用户画像的个数自动确定
                    </p>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="prompt_version">Prompt 版本</Label>
                        <Input
                          id="prompt_version"
                          value={formData.prompt_version}
                          onChange={(e) => handleChange('prompt_version', e.target.value)}
                          placeholder="v0"
                        />
                        <p className="text-xs text-muted-foreground">
                          使用的 prompt 模板版本（如 v0, v1, v2）
                        </p>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="max_turns">最大轮次</Label>
                        <Input
                          id="max_turns"
                          type="number"
                          value={formData.max_turns}
                          onChange={(e) => handleChange('max_turns', e.target.value)}
                          placeholder="3"
                        />
                        <p className="text-xs text-muted-foreground">
                          每个对话的最大交互轮次
                        </p>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="temperature">Temperature</Label>
                        <Input
                          id="temperature"
                          type="number"
                          step="0.1"
                          min="0"
                          max="2"
                          value={formData.temperature}
                          onChange={(e) => handleChange('temperature', e.target.value)}
                          placeholder="0.8"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="batch_size">批次大小</Label>
                        <Input
                          id="batch_size"
                          type="number"
                          value={formData.batch_size}
                          onChange={(e) => handleChange('batch_size', e.target.value)}
                          placeholder="1"
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}

              {taskType === "PORTRAIT" && (
                <>
                  <div className="space-y-4 pt-4 border-t">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2 text-base">
                          <Upload className="w-4 h-4" />
                          上传对话数据
                        </CardTitle>
                        <CardDescription className="mt-1">
                          支持拖拽上传 JSON / JSONL 格式的对话文件
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          ref={portraitFileInputRef}
                          type="file"
                          accept=".json,.jsonl"
                          onChange={handlePortraitFileUpload}
                          className="hidden"
                        />
                        <Button
                          type="button"
                          onClick={() => portraitFileInputRef.current?.click()}
                          variant="outline"
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          选择文件
                        </Button>
                      </div>
                    </div>
                    {portraitFileData && (
                      <span className="text-sm text-muted-foreground">
                        {portraitFileData.name}
                      </span>
                    )}

                    <div
                      onDrop={handlePortraitDrop}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsPortraitDragOver(true);
                      }}
                      onDragLeave={() => setIsPortraitDragOver(false)}
                      className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                        isPortraitDragOver ? 'border-primary bg-primary/5' : 'border-border'
                      }`}
                    >
                      <FileText className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">拖拽 JSON/JSONL 文件到这里</p>
                      {portraitLoadedCount !== null && (
                        <Badge variant="secondary" className="mt-2">
                          已加载 {portraitLoadedCount} 条对话
                        </Badge>
                      )}
                    </div>
                    {formData.portrait_uploaded_dialogues && (
                      <div className="mt-2">
                        <Label>已加载文件</Label>
                        <p className="text-xs text-muted-foreground">
                          文件已解析，将在下方展示对话预览
                        </p>
                      </div>
                    )}
                  </div>

                  {portraitPreviewMessages.length > 0 && (
                    <div className="space-y-3 pt-4 border-t">
                      <h3 className="text-lg font-semibold">对话预览</h3>
                      <Card>
                        <CardContent className="pt-4">
                          <ScrollArea className="h-48">
                            <div className="pr-4">
                              <ChatTranscript messages={portraitPreviewMessages} />
                            </div>
                          </ScrollArea>
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  <div className="space-y-4 pt-4 border-t">
                    <div className="space-y-2">
                      <Label htmlFor="portrait_model">抽取模型</Label>
                      <Input
                        id="portrait_model"
                        value={formData.portrait_model}
                        onChange={(e) => handleChange('portrait_model', e.target.value)}
                        placeholder="dashscope/qwen3-235b-a22b"
                      />
                      <p className="text-xs text-muted-foreground">
                        用于画像抽取的模型名称
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="portrait_batch_size">并发批次大小</Label>
                      <Input
                        id="portrait_batch_size"
                        type="number"
                        min="1"
                        value={formData.portrait_batch_size}
                        onChange={(e) => handleChange('portrait_batch_size', e.target.value)}
                        placeholder="1"
                      />
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <div className="bg-muted p-4 rounded-lg text-sm">
                      <p className="font-medium mb-2">文件格式要求：</p>
                      <pre className="text-xs overflow-x-auto whitespace-pre-wrap">
{`{
  "messages": [
    {
      "role": "assistant",
      "content": "您好..."
    },
    {
      "role": "user",
      "content": "..."
    }
  ]
}`}
                      </pre>
                    </div>
                  </div>
                </>
              )}

              {taskType === "EVALUATION" && (
                <>
                  {/* 基本信息 */}
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="evaluation_name">
                        任务名称 <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="evaluation_name"
                        value={formData.name}
                        onChange={(e) => handleChange('name', e.target.value)}
                        placeholder="例: 对话质量评估v1"
                      />
                    </div>
                  </div>

                  {/* 数据源配置 */}
                  <div className="space-y-4 pt-4 border-t">
                    <h3 className="text-lg font-semibold">对话数据源</h3>
                    
                    <Tabs value={formData.evaluation_source_type} onValueChange={(v) => handleChange('evaluation_source_type', v)}>
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="task">
                          <FileText className="w-4 h-4 mr-2" />
                          选择对话任务
                        </TabsTrigger>
                        <TabsTrigger value="upload">
                          <Upload className="w-4 h-4 mr-2" />
                          上传文件
                        </TabsTrigger>
                      </TabsList>
                      
                      <TabsContent value="task" className="space-y-2">
                        <Label htmlFor="source_dialogue_task_id">
                          对话合成任务 <span className="text-destructive">*</span>
                        </Label>
                        <Select
                          value={formData.evaluation_source_dialogue_task_id}
                          onValueChange={(value) => handleChange('evaluation_source_dialogue_task_id', value)}
                        >
                          <SelectTrigger id="source_dialogue_task_id">
                            <SelectValue placeholder="选择已完成的对话合成任务" />
                          </SelectTrigger>
                          <SelectContent>
                            {dialogueTasksData?.tasks.filter(task => task.id && task.id !== '').map((task) => (
                              <SelectItem key={task.id} value={task.id}>
                                {task.name} (总数: {task.progress.total}, 成功率: {task.progress.success_rate.toFixed(1)}%)
                              </SelectItem>
                            ))}
                            {(!dialogueTasksData?.tasks || dialogueTasksData.tasks.filter(t => t.id && t.id !== '').length === 0) && (
                              <SelectItem value="none" disabled>暂无可用的对话合成任务</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          选择已成功完成的对话合成任务作为数据源
                        </p>
                      </TabsContent>
                      
                      <TabsContent value="upload" className="space-y-2">
                        <Label htmlFor="evaluation_file_upload">
                          上传对话文件 <span className="text-destructive">*</span>
                        </Label>
                        <div className="flex flex-col gap-2">
                          <div>
                            <input
                              ref={evaluationFileInputRef}
                              id="evaluation_file_upload"
                              type="file"
                              accept=".json,.jsonl"
                              onChange={handleEvaluationFileUpload}
                              className="hidden"
                            />
                            <Button
                              type="button"
                              onClick={() => evaluationFileInputRef.current?.click()}
                              variant="outline"
                            >
                              <Upload className="w-4 h-4 mr-2" />
                              选择文件
                            </Button>
                          </div>
                        </div>
                        {evaluationFileData && (
                          <span className="text-sm text-muted-foreground">
                            {evaluationFileData.name}
                          </span>
                        )}

                        <div
                          onDrop={handleEvaluationDrop}
                          onDragOver={(e) => {
                            e.preventDefault();
                            setIsEvaluationDragOver(true);
                          }}
                          onDragLeave={() => setIsEvaluationDragOver(false)}
                          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                            isEvaluationDragOver ? 'border-primary bg-primary/5' : 'border-border'
                          }`}
                        >
                          <FileText className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">拖拽 JSON/JSONL 文件到这里</p>
                          {evaluationLoadedCount !== null && (
                            <Badge variant="secondary" className="mt-2">
                              已加载 {evaluationLoadedCount} 条对话
                            </Badge>
                          )}
                        </div>
                        {formData.evaluation_uploaded_dialogues && (
                          <div className="mt-2">
                            <Label>已加载文件</Label>
                            <p className="text-xs text-muted-foreground">
                              文件已解析，将在下方展示对话预览
                            </p>
                          </div>
                        )}
                      </TabsContent>
                    </Tabs>
                  </div>

                  {evaluationPreviewMessages.length > 0 && (
                    <div className="space-y-3 pt-4 border-t">
                      <h3 className="text-lg font-semibold">对话预览</h3>
                      <Card>
                        <CardContent className="pt-4">
                          <ScrollArea className="h-48">
                            <div className="pr-4">
                              <ChatTranscript messages={evaluationPreviewMessages} />
                            </div>
                          </ScrollArea>
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  {/* 评估模型配置 */}
                  <div className="space-y-2 pt-4 border-t">
                    <Label htmlFor="evaluation_model">评估模型</Label>
                    <Input
                      id="evaluation_model"
                      value={formData.evaluation_model}
                      onChange={(e) => handleChange('evaluation_model', e.target.value)}
                      placeholder="dashscope/qwen3-235b-a22b"
                    />
                    <p className="text-xs text-muted-foreground">
                      用于质量评估的模型名称
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="evaluation_batch_size">并发批次大小</Label>
                    <Input
                      id="evaluation_batch_size"
                      type="number"
                      min="1"
                      value={formData.evaluation_batch_size}
                      onChange={(e) => handleChange('evaluation_batch_size', e.target.value)}
                      placeholder="1"
                    />
                  </div>
                </>
              )}
              
              {/* 提交按钮 */}
              <div className="flex justify-end gap-4 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/synthesis')}
                >
                  取消
                </Button>
                <Button
                  type="submit"
                  disabled={mutation.isPending}
                >
                  <Save className="w-4 h-4 mr-2" />
                  {mutation.isPending ? '创建中...' : '创建任务'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
