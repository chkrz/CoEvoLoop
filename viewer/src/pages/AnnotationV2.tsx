import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/typography/Text';
import {
  Save,
  Download,
  ArrowLeft,
  ArrowRight,
  FileText,
  Tag,
  Star,
  Target,
  Users,
  BarChart3,
  Eye,
  Edit,
  Plus,
  X
} from 'lucide-react';
import { annotationApiV2, AnnotationItem, DatasetContent, AnnotationProgress, AnnotatedDatasetInfo } from '@/lib/annotationApiV2';
import { useToast } from '@/hooks/use-toast';

// 标签输入组件
const TagInput: React.FC<{
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  suggestions: string[];
  placeholder?: string;
}> = ({ tags, onTagsChange, suggestions, placeholder = '添加标签' }) => {
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  const addTag = (tag: string) => {
    if (tag && !tags.includes(tag)) {
      onTagsChange([...tags, tag]);
    }
    setInputValue('');
    setShowSuggestions(false);
  };

  const removeTag = (tagToRemove: string) => {
    onTagsChange(tags.filter(tag => tag !== tagToRemove));
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <Badge key={tag} variant="secondary" className="flex items-center gap-1">
            {tag}
            <X
              className="h-3 w-3 cursor-pointer"
              onClick={() => removeTag(tag)}
            />
          </Badge>
        ))}
      </div>
      <div className="relative">
        <Input
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setShowSuggestions(e.target.value.length > 0);
          }}
          onFocus={() => setShowSuggestions(inputValue.length > 0)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          placeholder={placeholder}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addTag(inputValue.trim());
            }
          }}
        />
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-background border rounded-md shadow-md">
            {suggestions.filter(s =>
              s.toLowerCase().includes(inputValue.toLowerCase()) &&
              !tags.includes(s)
            ).map((suggestion) => (
              <div
                key={suggestion}
                className="px-3 py-2 cursor-pointer hover:bg-accent"
                onClick={() => addTag(suggestion)}
              >
                {suggestion}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// 角色标注组件
const RoleAnnotation: React.FC<{
  roles: { [key: string]: string | null };
  onRolesChange: (roles: { [key: string]: string | null }) => void;
  dataType: string;
}> = ({ roles, onRolesChange, dataType }) => {
  const roleOptions = annotationApiV2.getRoleOptions(dataType);

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium flex items-center gap-2">
        <Users className="h-5 w-5" />
        角色标注
      </h3>
      {roleOptions.map((role) => (
        <div key={role.role} className="space-y-2">
          <Label className="text-sm font-medium">
            {role.role === 'background_quality' && '背景质量'}
            {role.role === 'knowledge_gap_clarity' && '知识盲区清晰度'}
            {role.role === 'operation_history_completeness' && '操作历史完整性'}
            {role.role === 'user_behavior' && '用户行为'}
            {role.role === 'assistant_performance' && '助手表现'}
            {role.role === 'dialogue_flow' && '对话流程'}
            {role.role === 'evaluation_fairness' && '评价公平性'}
            {role.role === 'scoring_accuracy' && '评分准确性'}
            {role.role === 'feedback_quality' && '反馈质量'}
            {role.role === 'collaboration_quality' && '协作质量'}
            {role.role === 'coordination_effectiveness' && '协调效果'}
            {role.role === 'handover_smoothness' && '交接顺畅度'}
          </Label>
          <Select
            value={roles[role.role] || ''}
            onValueChange={(value) => onRolesChange({ ...roles, [role.role]: value || null })}
          >
            <SelectTrigger>
              <SelectValue placeholder="请选择" />
            </SelectTrigger>
            <SelectContent>
              {role.options.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ))}
    </div>
  );
};

// 意图标注组件
const IntentAnnotation: React.FC<{
  intent: { [key: string]: string | null };
  onIntentChange: (intent: { [key: string]: string | null }) => void;
  dataType: string;
}> = ({ intent, onIntentChange, dataType }) => {
  const intentOptions = annotationApiV2.getIntentOptions(dataType);

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium flex items-center gap-2">
        <Target className="h-5 w-5" />
        意图标注
      </h3>
      {intentOptions.map((field) => (
        <div key={field.field} className="space-y-2">
          <Label className="text-sm font-medium">
            {field.field === 'profile_purpose' && '画像目的'}
            {field.field === 'confidence_level' && '置信度'}
            {field.field === 'conversation_purpose' && '对话目的'}
            {field.field === 'resolution_status' && '解决状态'}
            {field.field === 'evaluation_purpose' && '评价目的'}
            {field.field === 'improvement_suggestion' && '改进建议'}
            {field.field === 'collaboration_purpose' && '协作目的'}
            {field.field === 'success_criterion' && '成功标准'}
          </Label>
          <Select
            value={intent[field.field] || ''}
            onValueChange={(value) => onIntentChange({ ...intent, [field.field]: value || null })}
          >
            <SelectTrigger>
              <SelectValue placeholder="请选择" />
            </SelectTrigger>
            <SelectContent>
              {field.options.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ))}
    </div>
  );
};

// 数据渲染组件
const DataRenderer: React.FC<{
  data: any;
  dataType: string;
  isEditing?: boolean;
  onEdit?: (data: any) => void;
}> = ({ data, dataType, isEditing = false, onEdit }) => {
  const renderJSON = (obj: any, level = 0) => {
    if (obj === null || obj === undefined) return 'null';
    if (typeof obj === 'string') return obj;
    if (typeof obj !== 'object') return String(obj);

    return (
      <div className={`${level > 0 ? 'ml-4' : ''}`}>
        {Array.isArray(obj) ? (
          obj.map((item, index) => (
            <div key={index} className="mb-2">
              <span className="text-muted-foreground">[{index}]: </span>
              {renderJSON(item, level + 1)}
            </div>
          ))
        ) : (
          Object.entries(obj).map(([key, value]) => (
            <div key={key} className="mb-2">
              <span className="text-muted-foreground font-medium">{key}: </span>
              {renderJSON(value, level + 1)}
            </div>
          ))
        )}
      </div>
    );
  };

  switch (dataType) {
    case 'PORTRAIT':
      return (
        <div className="space-y-4">
          {data.背景描述 && (
            <div>
              <Label className="text-base font-medium">背景描述</Label>
              <div className="mt-2 p-4 bg-muted rounded-lg">
                {Array.isArray(data.背景描述)
                  ? data.背景描述.map((desc: string, i: number) => (
                      <p key={i} className="mb-1 last:mb-0">{desc}</p>
                    ))
                  : renderJSON(data.背景描述)
                }
              </div>
            </div>
          )}
          {data.知识盲区 && (
            <div>
              <Label className="text-base font-medium">知识盲区</Label>
              <div className="mt-2 p-4 bg-muted rounded-lg">
                {Array.isArray(data.知识盲区)
                  ? data.知识盲区.map((gap: string, i: number) => (
                      <p key={i} className="mb-1 last:mb-0">{gap}</p>
                    ))
                  : renderJSON(data.知识盲区)
                }
              </div>
            </div>
          )}
          {data.操作历史 && (
            <div>
              <Label className="text-base font-medium">操作历史</Label>
              <div className="mt-2 p-4 bg-muted rounded-lg">
                {Array.isArray(data.操作历史)
                  ? data.操作历史.map((hist: string, i: number) => (
                      <p key={i} className="mb-1 last:mb-0">{hist}</p>
                    ))
                  : renderJSON(data.操作历史)
                }
              </div>
            </div>
          )}
          {data.问题描述 && (
            <div>
              <Label className="text-base font-medium">问题描述</Label>
              <div className="mt-2 p-4 bg-muted rounded-lg">
                {Array.isArray(data.问题描述)
                  ? data.问题描述.map((desc: string, i: number) => (
                      <p key={i} className="mb-1 last:mb-0">{desc}</p>
                    ))
                  : renderJSON(data.问题描述)
                }
              </div>
            </div>
          )}
          {(!data.背景描述 && !data.知识盲区 && !data.操作历史 && !data.问题描述) && (
            <div className="p-4 bg-muted rounded-lg">
              {renderJSON(data)}
            </div>
          )}
        </div>
      );

    case 'DIALOGUE':
      return (
        <div className="space-y-4">
          {data.conversations && Array.isArray(data.conversations) ? (
            data.conversations.map((conv: any, index: number) => (
              <div key={index} className={`p-4 rounded-lg ${
                conv.role === 'user' || conv.from === 'user'
                  ? 'bg-blue-50 border-l-4 border-blue-500'
                  : 'bg-green-50 border-l-4 border-green-500'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`font-medium ${
                    conv.role === 'user' || conv.from === 'user'
                      ? 'text-blue-700'
                      : 'text-green-700'
                  }`}>
                    {conv.role === 'user' || conv.from === 'user' ? '用户' :
                     conv.role === 'assistant' || conv.from === 'assistant' ? '客服' :
                     conv.role || conv.from || '未知'}
                  </span>
                </div>
                <div>{conv.content || conv.value || conv.text || conv}</div>
              </div>
            ))
          ) : (
            <div className="p-4 bg-muted rounded-lg">
              {renderJSON(data)}
            </div>
          )}
        </div>
      );

    case 'EVALUATION':
      return (
        <div className="space-y-4">
          {data.evaluation && (
            <div className="p-4 bg-muted rounded-lg">
              <Label className="text-base font-medium mb-2 block">评估结果</Label>
              {renderJSON(data.evaluation)}
            </div>
          )}
          {data.scores && (
            <div className="p-4 bg-muted rounded-lg">
              <Label className="text-base font-medium mb-2 block">评分明细</Label>
              {renderJSON(data.scores)}
            </div>
          )}
          {(!data.evaluation && !data.scores) && (
            <div className="p-4 bg-muted rounded-lg">
              {renderJSON(data)}
            </div>
          )}
        </div>
      );

    case 'HUMAN_HUMAN_DIALOGUE':
      return (
        <div className="space-y-4">
          {data.dialogue && Array.isArray(data.dialogue) ? (
            data.dialogue.map((msg: any, index: number) => (
              <div key={index} className={`p-4 rounded-lg ${
                msg.agent === '客服_A' ? 'bg-purple-50 border-l-4 border-purple-500' :
                msg.agent === '客服_B' ? 'bg-orange-50 border-l-4 border-orange-500' :
                'bg-gray-50 border-l-4 border-gray-500'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`font-medium ${
                    msg.agent === '客服_A' ? 'text-purple-700' :
                    msg.agent === '客服_B' ? 'text-orange-700' :
                    'text-gray-700'
                  }`}>
                    {msg.agent || '说话者'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {msg.timestamp}
                  </span>
                </div>
                <div>{msg.message || msg.content || msg}</div>
              </div>
            ))
          ) : (
            <div className="p-4 bg-muted rounded-lg">
              {renderJSON(data)}
            </div>
          )}
        </div>
      );

    default:
      return (
        <div className="p-4 bg-muted rounded-lg">
          {renderJSON(data)}
        </div>
      );
  }
};

const AnnotationV2: React.FC = () => {
  const { datasetId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [datasetContent, setDatasetContent] = useState<DatasetContent | null>(null);
  const [progress, setProgress] = useState<AnnotationProgress | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [autoSave, setAutoSave] = useState(true);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [currentTime, setCurrentTime] = useState({ start: 0, end: 5 });

  // 已标注数据集相关状态
  const [annotatedDatasets, setAnnotatedDatasets] = useState<AnnotatedDatasetInfo[]>([]);
  const [showDatasetSelector, setShowDatasetSelector] = useState(false);
  const [isLoadingAnnotated, setIsLoadingAnnotated] = useState(false);

  // 当前标注项
  const currentItem = datasetContent?.items[currentIndex];

  // 标注数据
  const [currentAnnotation, setCurrentAnnotation] = useState<{
    edited_content?: any;
    tags: string[];
    notes: string;
    quality_rating?: number;
    intent?: object;
    roles?: object;
    custom_fields?: object;
  }>({
    edited_content: null,
    tags: [],
    notes: '',
    quality_rating: undefined,
    intent: {},
    roles: {},
    custom_fields: {}
  });

  // 加载数据集内容
  const loadDatasetContent = useCallback(async () => {
    if (!datasetId) return;

    setIsLoading(true);
    try {
      // 并行加载数据集内容和进度
      const [contentData, progressData] = await Promise.all([
        annotationApiV2.getDatasetContent(datasetId, 1, 20),
        annotationApiV2.getAnnotationProgress(datasetId)
      ]);

      setDatasetContent(contentData);
      setProgress(progressData);
    } catch (error) {
      toast({
        title: "加载失败",
        description: error instanceof Error ? error.message : "未知错误",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }, [datasetId, toast]);

  // 加载已标注数据集列表
  const loadAnnotatedDatasets = useCallback(async () => {
    setIsLoadingAnnotated(true);
    try {
      const data = await annotationApiV2.getAnnotatedDatasets();
      setAnnotatedDatasets(data.datasets || []);
    } catch (error) {
      console.error('Failed to load annotated datasets:', error);
    } finally {
      setIsLoadingAnnotated(false);
    }
  }, [toast]);

  // 初始加载
  useEffect(() => {
    loadDatasetContent();
  }, [loadDatasetContent]);

  // 加载已标注数据集列表
  useEffect(() => {
    loadAnnotatedDatasets();
  }, [loadAnnotatedDatasets]);

  // 加载选中的已标注数据集
  const handleSelectAnnotatedDataset = useCallback(async (datasetId: string) => {
    // 更新 URL
    navigate(`/annotation/v2/${datasetId}`);
    setShowDatasetSelector(false);

    // 重新加载数据
    loadDatasetContent();
  }, [navigate, loadDatasetContent]);

  // 切换项目时重置标注数据
  useEffect(() => {
    if (currentItem) {
      setCurrentAnnotation({
        edited_content: currentItem.edited_content,
        tags: currentItem.tags || [],
        notes: currentItem.notes || '',
        quality_rating: currentItem.quality_rating,
        intent: currentItem.intent,
        roles: currentItem.roles,
        custom_fields: currentItem.custom_fields
      });
    }
  }, [currentItem]);

  // 自动保存
  useEffect(() => {
    if (!autoSave || !currentItem || !datasetId) return;

    const timer = setTimeout(() => {
      saveAnnotation(true);
    }, 2000);

    return () => clearTimeout(timer);
  }, [currentAnnotation, autoSave, currentItem, datasetId]);

  // 保存标注
  const saveAnnotation = async (isAutoSave = false) => {
    if (!currentItem || !datasetId) return;

    try {
      setIsSaving(true);
      await annotationApiV2.saveAnnotation({
        dataset_id: datasetId,
        item_id: currentItem.id,
        annotation_data: currentAnnotation,
        auto_save: isAutoSave
      });

      if (!isAutoSave) {
        toast({
          title: "保存成功",
          description: "标注已保存"
        });
      }

      // 刷新进度
      const progressData = await annotationApiV2.getAnnotationProgress(datasetId);
      setProgress(progressData);
    } catch (error) {
      toast({
        title: "保存失败",
        description: error instanceof Error ? error.message : "未知错误",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  // 导出数据集
  const handleExport = async (exportData: any) => {
    if (!datasetId) return;

    try {
      const exportedDataset = await annotationApiV2.exportAnnotatedDataset({
        source_dataset_id: datasetId,
        new_dataset_name: exportData.name,
        new_dataset_description: exportData.description,
        data_filter: exportData.dataFilter || 'ALL'  // 使用简化后的数据筛选参数
      });

      toast({
        title: "导出成功",
        description: `已成功导出数据集: ${exportedDataset.name}`
      });

      setShowExportDialog(false);
    } catch (error) {
      toast({
        title: "导出失败",
        description: error instanceof Error ? error.message : "未知错误",
        variant: "destructive"
      });
    }
  };

  // 导航
  const goToNext = () => {
    if (datasetContent && currentIndex < datasetContent.items.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const goToPrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  // 快捷键
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 's') {
          e.preventDefault();
          saveAnnotation();
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          goToPrevious();
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          goToNext();
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentIndex, currentAnnotation]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p>加载中...</p>
        </div>
      </div>
    );
  }

  if (!datasetContent || !currentItem) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-red-500">数据加载失败</p>
          <Button onClick={loadDatasetContent} className="mt-4">
            重新加载
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* 顶部导航栏 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => navigate('/datasets')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            返回
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{datasetContent.dataset.name}</h1>
            <p className="text-sm text-muted-foreground">{datasetContent.dataset.data_type}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {progress && (
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="text-sm">
                标注进度: {progress.annotated_items}/{progress.total_items} ({progress.progress}%)
              </span>
              <Progress value={progress.progress} className="w-24" />
            </div>
          )}

          <Switch
            checked={autoSave}
            onCheckedChange={setAutoSave}
          />
          <span className="text-sm">自动保存</span>

          <Dialog open={showDatasetSelector} onOpenChange={setShowDatasetSelector}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <FileText className="h-4 w-4 mr-2" />
                已标注数据集
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>选择已标注数据集</DialogTitle>
                <DialogDescription>
                  选择一个已标注的数据集继续标注
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {isLoadingAnnotated ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : annotatedDatasets.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>暂无已标注的数据集</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {annotatedDatasets.map((dataset) => (
                      <Card
                        key={dataset.dataset_id}
                        className="cursor-pointer hover:bg-accent/50 transition-colors"
                        onClick={() => handleSelectAnnotatedDataset(dataset.dataset_id)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <h4 className="font-medium">{dataset.dataset_name}</h4>
                              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Tag className="h-3 w-3" />
                                  {dataset.data_type}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Eye className="h-3 w-3" />
                                  {dataset.annotated_items}/{dataset.item_count}
                                </span>
                                {dataset.last_updated && (
                                  <span>
                                    更新于 {new Date(dataset.last_updated).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <div className="text-sm font-medium">
                                {dataset.progress.toFixed(1)}%
                              </div>
                              <Progress value={dataset.progress} className="w-24" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Download className="h-4 w-4 mr-2" />
                导出数据集
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>导出标注数据集</DialogTitle>
                <DialogDescription>
                  将标注结果导出为新的数据集
                </DialogDescription>
              </DialogHeader>
              <ExportForm onSubmit={handleExport} dataset={datasetContent.dataset} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* 主要内容区 */}
      <div className="grid grid-cols-12 gap-6">
        {/* 左侧：数据展示 */}
        <div className="col-span-5 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                原始数据
              </CardTitle>
              <CardDescription>
                第 {currentIndex + 1} / {datasetContent.items.length} 条
                {currentItem.line_number && ` (行号: ${currentItem.line_number})`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[600px] overflow-y-auto">
                <DataRenderer
                  data={currentItem.original_content}
                  dataType={currentItem.data_type}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 右侧：标注编辑器 */}
        <div className="col-span-7 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>标注编辑器</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="basic" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="basic">基础标注</TabsTrigger>
                  <TabsTrigger value="role">角色标注</TabsTrigger>
                  <TabsTrigger value="intent">意图标注</TabsTrigger>
                  <TabsTrigger value="edit">内容编辑</TabsTrigger>
                </TabsList>

                {/* 基础标注 */}
                <TabsContent value="basic" className="space-y-6">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">质量评分</Label>
                    <div className="flex items-center gap-2">
                      {[1, 2, 3, 4, 5].map((rating) => (
                        <Star
                          key={rating}
                          className={`h-6 w-6 cursor-pointer transition-colors ${
                            currentAnnotation.quality_rating &&
                            currentAnnotation.quality_rating >= rating
                              ? 'fill-yellow-400 text-yellow-400'
                              : 'text-gray-300 hover:text-yellow-300'
                          }`}
                          onClick={() => setCurrentAnnotation({
                            ...currentAnnotation,
                            quality_rating: rating
                          })}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">标签</Label>
                    <TagInput
                      tags={currentAnnotation.tags}
                      onTagsChange={(tags) => setCurrentAnnotation({
                        ...currentAnnotation,
                        tags
                      })}
                      suggestions={annotationApiV2.getSuggestedTags(currentItem.data_type)}
                      placeholder="添加标注标签"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">备注</Label>
                    <Textarea
                      value={currentAnnotation.notes}
                      onChange={(e) => setCurrentAnnotation({
                        ...currentAnnotation,
                        notes: e.target.value
                      })}
                      placeholder="添加标注备注..."
                      rows={4}
                    />
                  </div>
                </TabsContent>

                {/* 角色标注 */}
                <TabsContent value="role">
                  <RoleAnnotation
                    roles={currentAnnotation.roles || {}}
                    onRolesChange={(roles) => setCurrentAnnotation({
                      ...currentAnnotation,
                      roles
                    })}
                    dataType={currentItem.data_type}
                  />
                </TabsContent>

                {/* 意图标注 */}
                <TabsContent value="intent">
                  <IntentAnnotation
                    intent={currentAnnotation.intent || {}}
                    onIntentChange={(intent) => setCurrentAnnotation({
                      ...currentAnnotation,
                      intent
                    })}
                    dataType={currentItem.data_type}
                  />
                </TabsContent>

                {/* 内容编辑 */}
                <TabsContent value="edit" className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">编辑内容</Label>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setCurrentAnnotation({
                          ...currentAnnotation,
                          edited_content: JSON.parse(JSON.stringify(currentItem.original_content))
                        });
                      }}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      复制原始内容
                    </Button>
                  </div>

                  {currentAnnotation.edited_content ? (
                    <div className="border rounded-lg p-4">
                      <div className="h-[400px] overflow-y-auto">
                        <DataRenderer
                          data={currentAnnotation.edited_content}
                          dataType={currentItem.data_type}
                          isEditing={true}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                      <p>点击上方按钮复制原始内容进行编辑</p>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* 底部工具栏 */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    快捷键: Ctrl+S 保存, Ctrl+← Ctrl+→ 切换
                  </span>
                </div>

                <div className="flex items-center gap-4">
                  <Button
                    variant="outline"
                    onClick={goToPrevious}
                    disabled={currentIndex === 0}
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    上一条
                  </Button>

                  <Button
                    onClick={() => saveAnnotation()}
                    disabled={isSaving}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {isSaving ? '保存中...' : '保存'}
                  </Button>

                  <Button
                    variant="outline"
                    onClick={goToNext}
                    disabled={currentIndex >= datasetContent.items.length - 1}
                  >
                    下一条
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

// 导出表单组件
const ExportForm: React.FC<{
  onSubmit: (data: any) => void;
  dataset: any;
}> = ({ onSubmit, dataset }) => {
  const [formData, setFormData] = useState({
    name: `${dataset.name}_annotated`,
    description: dataset.description,
    dataFilter: 'ALL' as 'ALL' | 'ANNOTATED'
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">数据集名称</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">数据集描述</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label>数据筛选</Label>
        <Select
          value={formData.dataFilter}
          onValueChange={(value: 'ALL' | 'ANNOTATED') => setFormData({ ...formData, dataFilter: value })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">所有数据</SelectItem>
            <SelectItem value="ANNOTATED">仅已标注数据</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DialogFooter>
        <Button type="submit">
          <Download className="h-4 w-4 mr-2" />
          导出
        </Button>
      </DialogFooter>
    </form>
  );
};

export default AnnotationV2;