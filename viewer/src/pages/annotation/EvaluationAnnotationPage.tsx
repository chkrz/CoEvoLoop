import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { 
  Star, 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle, 
  XCircle, 
  ArrowLeft, 
  Save, 
  Loader2,
  Eye,
  Edit3,
  RotateCcw,
  AlertTriangle,
  Check,
  Square
} from 'lucide-react';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { annotationApiV2 } from '@/lib/annotationApiV2';
import { normalizeEvaluationData, validateEvaluationData, createChangeSummary } from '@/lib/evaluationDataUtils';
import EvaluationDiffViewer from '@/components/annotation/EvaluationDiffViewer';
import EvaluationSummaryChart from '@/components/annotation/EvaluationSummaryChart';
import { AnnotationStatisticsPanel } from '@/components/annotation/AnnotationStatisticsPanel';
import '@/styles/evaluation-diff.css';

interface EvaluationAnnotationPageProps {
  datasetId: string;
  onBack: () => void;
}

interface EvaluationData {
  id: string;
  conversations: Array<{
    role: string;
    content: string;
  }>;
  metadata: {
    dataset_id: string;
    line_number: number;
    source_file: string;
    uuid: string;
    original_data: {
      index: number;
      evaluation_id: string;
      evaluation: {
        [key: string]: any; // 动态评估指标
      };
      success: boolean;
    };
  };
}

interface EvaluationDisplayInfo {
  hasChanges: boolean;
  changedFieldsCount: number;
  dataSource: 'original' | 'edited';
  validation: {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  };
}

const EvaluationAnnotationPage: React.FC<EvaluationAnnotationPageProps> = ({ datasetId, onBack }) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isBatchMarking, setIsBatchMarking] = useState(false);

  const [annotationData, setAnnotationData] = useState({
    overall_score: undefined as number | undefined,
    accuracy_score: undefined as number | undefined,
    relevance_score: undefined as number | undefined,
    coherence_score: undefined as number | undefined,
    completeness_score: undefined as number | undefined,
    fluency_score: undefined as number | undefined,
    pass_status: undefined as 'pass' | 'fail' | undefined,
    issues: [] as string[],
    suggestions: '',
    notes: '',
    field_annotations: {} as Record<string, any>,
  });

  const [showConversionDialog, setShowConversionDialog] = useState(false);
  const [conversionConfig, setConversionConfig] = useState({
    newDatasetName: '',
    newDatasetDescription: '',
    dataFilter: 'ALL' as 'ALL' | 'ANNOTATED'
  });
  const [isCreatingDataset, setIsCreatingDataset] = useState(false);

  // Diff展示相关状态
  const [showEvaluationDiff, setShowEvaluationDiff] = useState(true);
  const [originalEvaluation, setOriginalEvaluation] = useState<Record<string, any>>({});
  const [editedEvaluation, setEditedEvaluation] = useState<Record<string, any>>({});
  const [activeEditField, setActiveEditField] = useState<string | null>(null);
  const [isEditingMode, setIsEditingMode] = useState(true);
  const [showOriginalData, setShowOriginalData] = useState(false);
  
  // 对话编辑相关状态 - 改为内联编辑
  const [editingConversationIndex, setEditingConversationIndex] = useState<number | null>(null);
  const [editingConversationContent, setEditingConversationContent] = useState('');
  const [editingConversationRole, setEditingConversationRole] = useState('');

  // 获取评估数据列表 - 使用V2接口
  const { data: evaluationsData, isLoading: isLoadingEvaluations } = useQuery({
    queryKey: ['evaluations', datasetId, currentPage, pageSize],
    queryFn: () => annotationApiV2.getDatasetContent(datasetId, currentPage, pageSize),
    enabled: !!datasetId,
  });

  // 批量标记完成的mutation
  const batchMarkCompleteMutation = useMutation({
    mutationFn: (data: { dataset_id: string; item_ids?: string[]; mark_as_annotated: boolean }) =>
      annotationApiV2.batchMarkComplete(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evaluations', datasetId, currentPage, pageSize] });
      setSelectedItems(new Set());
    },
  });

  // 单个标记完成的mutation
  const markCompleteMutation = useMutation({
    mutationFn: (data: { dataset_id: string; item_id: string; mark_as_annotated: boolean }) =>
      annotationApiV2.markComplete(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evaluations', datasetId, currentPage, pageSize] });
    },
  });

  const evaluations = evaluationsData?.items || [];
  const pagination = evaluationsData?.pagination || {
    page: 1,
    page_size: 20,
    total: 0,
    total_pages: 0,
    has_next: false,
    has_previous: false
  };

  const currentEvaluation = evaluations[selectedIndex];

  // 使用标准化数据处理
  const normalizedEvaluation = useMemo(() => {
    if (!currentEvaluation) return null;
    return normalizeEvaluationData(currentEvaluation);
  }, [currentEvaluation]);

  // 计算展示信息
  const displayInfo = useMemo((): EvaluationDisplayInfo => {
    if (!normalizedEvaluation) {
      return {
        hasChanges: false,
        changedFieldsCount: 0,
        dataSource: 'original',
        validation: { isValid: true, errors: [], warnings: [] }
      };
    }

    const validation = validateEvaluationData(normalizedEvaluation);
    const changeSummary = createChangeSummary(
      normalizedEvaluation.original_evaluation,
      normalizedEvaluation.edited_evaluation
    );

    return {
      hasChanges: changeSummary.changedFields > 0,
      changedFieldsCount: changeSummary.changedFields,
      dataSource: normalizedEvaluation.has_edited_content ? 'edited' : 'original',
      validation
    };
  }, [normalizedEvaluation]);

  useEffect(() => {
    if (normalizedEvaluation) {
      const customFields = (currentEvaluation as any).annotation_data?.custom_fields || {};
      
      setAnnotationData({
        overall_score: customFields.overall_score ?? undefined,
        accuracy_score: customFields.accuracy_score ?? undefined,
        relevance_score: customFields.relevance_score ?? undefined,
        coherence_score: customFields.coherence_score ?? undefined,
        completeness_score: customFields.completeness_score ?? undefined,
        fluency_score: customFields.fluency_score ?? undefined,
        pass_status: customFields.pass_status ?? undefined,
        issues: customFields.issues || [],
        suggestions: customFields.suggestions || '',
        notes: currentEvaluation.notes || '',
        field_annotations: customFields.field_annotations || {},
      });

      // 使用标准化后的评估数据
      setOriginalEvaluation(normalizedEvaluation.original_evaluation);
      setEditedEvaluation(JSON.parse(JSON.stringify(normalizedEvaluation.display_evaluation)));
    }
  }, [normalizedEvaluation, currentEvaluation]);

  const saveAnnotationV2Mutation = useMutation({
    mutationFn: (data: any) => annotationApiV2.saveAnnotation(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evaluations', datasetId, currentPage, pageSize] });
      queryClient.invalidateQueries({ queryKey: ['annotation-statistics', datasetId] });
    },
  });

  const handleEvaluationFieldChange = (fieldName: string, newValue: string | number) => {
    setEditedEvaluation(prev => ({
      ...prev,
      [fieldName]: newValue
    }));
  };

  const handleResetAllEvaluation = () => {
    setEditedEvaluation(JSON.parse(JSON.stringify(originalEvaluation)));
    toast({
      title: '重置成功',
      description: '所有评估数据已重置为原始值',
    });
  };

  const handleToggleDataSource = () => {
    setShowOriginalData(!showOriginalData);
  };

  const handleApplyOriginalData = () => {
    setEditedEvaluation(JSON.parse(JSON.stringify(originalEvaluation)));
    setShowOriginalData(false);
    toast({
      title: '应用成功',
      description: '已应用原始数据作为当前编辑值',
    });
  };

  const handleApplyEditedData = () => {
    if (normalizedEvaluation?.has_edited_content) {
      setEditedEvaluation(JSON.parse(JSON.stringify(normalizedEvaluation.edited_evaluation)));
      setShowOriginalData(false);
      toast({
        title: '应用成功',
        description: '已应用编辑后的数据作为当前编辑值',
      });
    }
  };

  const handleEditConversation = (index: number, message: { role: string; content: string }) => {
    setEditingConversationIndex(index);
    setEditingConversationRole(message.role);
    setEditingConversationContent(message.content);
  };

  const handleSaveConversationEdit = () => {
    if (editingConversationIndex === null || !normalizedEvaluation) return;

    // 创建新的对话数组
    const updatedConversations = [...(editedEvaluation.conversations || normalizedEvaluation.conversations)];
    updatedConversations[editingConversationIndex] = {
      role: editingConversationRole,
      content: editingConversationContent
    };

    // 更新编辑后的评估数据
    setEditedEvaluation(prev => ({
      ...prev,
      conversations: updatedConversations
    }));

    // 重置编辑状态
    setEditingConversationIndex(null);
    setEditingConversationContent('');
    setEditingConversationRole('');

    toast({
      title: '编辑成功',
      description: '对话内容已更新',
    });
  };

  const handleCancelConversationEdit = () => {
    setEditingConversationIndex(null);
    setEditingConversationContent('');
    setEditingConversationRole('');
  };

  const handleSaveAnnotation = async () => {
    // 验证必填字段
    if (!currentEvaluation) {
      toast({
        title: '保存失败',
        description: '没有选择要保存的评估数据',
        variant: 'destructive',
      });
      return;
    }

    if (!currentEvaluation.id) {
      toast({
        title: '保存失败',
        description: '评估数据ID不能为空',
        variant: 'destructive',
      });
      return;
    }

    if (!datasetId) {
      toast({
        title: '保存失败',
        description: '数据集ID不能为空',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);

    try {
      // 计算评估数据的变更
      const evaluationChanges = Object.keys(originalEvaluation).reduce((acc, key) => {
        if (originalEvaluation[key] !== editedEvaluation[key]) {
          acc[key] = {
            original: originalEvaluation[key],
            edited: editedEvaluation[key]
          };
        }
        return acc;
      }, {} as Record<string, { original: any; edited: any }>);

      // 检查是否有对话内容的变更
      const hasConversationChanges = editedEvaluation.conversations && 
        JSON.stringify(editedEvaluation.conversations) !== JSON.stringify(originalEvaluation.conversations);

      const saveData = {
        dataset_id: datasetId,
        item_id: currentEvaluation.id,
        annotation_data: {
          edited_content: {
            ...currentEvaluation.original_content,
            evaluation: editedEvaluation,
            // 如果有对话变更，也保存对话内容
            conversations: hasConversationChanges ? editedEvaluation.conversations : currentEvaluation.original_content?.conversations
          },
          tags: [],
          notes: annotationData.notes || '',
          quality_rating: annotationData.overall_score,
          intent: {
            evaluation_purpose: '质量评估',
            improvement_suggestion: annotationData.suggestions
          },
          roles: {
            evaluation_fairness: '待评估',
            scoring_accuracy: '待评估',
            feedback_quality: '待评估'
          },
          custom_fields: {
            original_evaluation: originalEvaluation,
            evaluation_changes: evaluationChanges,
            diff_enabled: showEvaluationDiff,
            field_level_annotations: annotationData.field_annotations,
            annotated_by: 'current_user',
            is_annotated: true,
            annotation_time: new Date().toISOString(),
            data_type: 'EVALUATION',
            // 记录对话变更
            conversation_changes: hasConversationChanges ? {
              original: originalEvaluation.conversations,
              edited: editedEvaluation.conversations
            } : null
          }
        },
        auto_save: false
      };

      await saveAnnotationV2Mutation.mutateAsync(saveData);

      toast({
        title: '保存成功',
        description: `评估标注已保存`,
      });
    } catch (error: any) {
      console.error('Failed to save annotation:', error);

      const errorMessage = error?.response?.data?.error ||
                          error?.response?.data?.detail ||
                          error?.message ||
                          '保存标注失败，请稍后重试';

      toast({
        title: '保存失败',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateDataset = async () => {
    if (!conversionConfig.newDatasetName.trim()) {
      toast({
        title: '创建失败',
        description: '请输入数据集名称',
        variant: 'destructive',
      });
      return;
    }

    setIsCreatingDataset(true);
    try {
      const response = await fetch('/api/v2/datasets/export/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source_dataset_id: datasetId,
          new_dataset_name: conversionConfig.newDatasetName,
          new_dataset_description: conversionConfig.newDatasetDescription,
          data_filter: conversionConfig.dataFilter
        }),
      });

      const result = await response.json();
      
      if (response.ok) {
        toast({
          title: '创建成功',
          description: `新数据集 "${result.name}" 已创建，包含 ${result.item_count} 条数据`,
        });
        setShowConversionDialog(false);
        
        // 重置配置
        setConversionConfig({
          newDatasetName: '',
          newDatasetDescription: '',
          dataFilter: 'ALL'
        });
      } else {
        throw new Error(result.error || '创建数据集失败');
      }
    } catch (error: any) {
      toast({
        title: '创建失败',
        description: error.message || '创建数据集时发生错误',
        variant: 'destructive',
      });
    } finally {
      setIsCreatingDataset(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.total_pages) {
      setCurrentPage(newPage);
      setSelectedIndex(0);
      setSelectedItems(new Set());
    }
  };

  const handleItemSelect = (itemId: string, checked: boolean) => {
    const newSelected = new Set(selectedItems);
    if (checked) {
      newSelected.add(itemId);
    } else {
      newSelected.delete(itemId);
    }
    setSelectedItems(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedItems.size === evaluations.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(evaluations.map(e => e.id)));
    }
  };

  const handleMarkComplete = async (itemId: string, markAsAnnotated: boolean) => {
    if (!datasetId) return;
    
    try {
      await markCompleteMutation.mutateAsync({
        dataset_id: datasetId,
        item_id: itemId,
        mark_as_annotated: markAsAnnotated,
      });
      
      toast({
        title: markAsAnnotated ? '已标记为已标注' : '已标记为未标注',
        description: '状态已更新',
      });
    } catch (error) {
      toast({
        title: '操作失败',
        description: '请稍后重试',
        variant: 'destructive',
      });
    }
  };

  const handleBatchMarkComplete = async (markAsAnnotated: boolean) => {
    if (!datasetId || selectedItems.size === 0) return;
    
    setIsBatchMarking(true);
    try {
      await batchMarkCompleteMutation.mutateAsync({
        dataset_id: datasetId,
        item_ids: Array.from(selectedItems),
        mark_as_annotated: markAsAnnotated,
      });
      
      toast({
        title: `已批量标记${selectedItems.size}条为${markAsAnnotated ? '已标注' : '未标注'}`,
        description: '批量操作完成',
      });
    } catch (error) {
      toast({
        title: '批量操作失败',
        description: '请稍后重试',
        variant: 'destructive',
      });
    } finally {
      setIsBatchMarking(false);
    }
  };

  const renderStars = (rating: number | undefined, onRate: (rating: number) => void, label: string) => {
    return (
      <div className="space-y-2">
        <Label className="text-sm">{label}</Label>
        <div className="flex space-x-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <Star
              key={star}
              className={`w-5 h-5 cursor-pointer ${
                star <= (rating || 0) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'
              }`}
              onClick={() => onRate(star)}
            />
          ))}
        </div>
      </div>
    );
  };

  const renderEvaluationData = () => {
    if (!normalizedEvaluation) {
      return (
        <div className="text-center text-gray-500 py-8">
          请选择一个评估数据开始标注
        </div>
      );
    }

    const { validation } = displayInfo;

    return (
      <div className="space-y-6">
        {/* 数据状态提示 */}
        {validation.warnings.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start">
              <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 mr-2" />
              <div>
                <h4 className="text-sm font-medium text-yellow-800">数据验证提示</h4>
                <ul className="mt-1 text-sm text-yellow-700 space-y-1">
                  {validation.warnings.map((warning, idx) => (
                    <li key={idx}>• {warning}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="text-lg">评估详情</CardTitle>

            </div>
          </CardHeader>
          <CardContent className="space-y-6">
        {/* 对话内容和评分详情并排展示 */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* 左侧：对话内容 */}
              <div>
                <h4 className="font-semibold mb-3 flex items-center">
                  对话内容
                  <Badge variant="outline" className="ml-2 text-xs">
                    {normalizedEvaluation.conversations.length} 条消息
                  </Badge>
                </h4>
                <div className="space-y-2 max-h-[400px] overflow-y-auto border rounded-lg p-3 bg-gray-50">
                  {(editedEvaluation.conversations || normalizedEvaluation.conversations).length > 0 ? (
                    (editedEvaluation.conversations || normalizedEvaluation.conversations).map((message, idx) => {
                      const isModified = editedEvaluation.conversations && 
                        JSON.stringify(editedEvaluation.conversations[idx]) !== JSON.stringify(normalizedEvaluation.conversations[idx]);
                      const isEditing = editingConversationIndex === idx;
                      
                      return (
                        <div key={idx} className={`relative p-3 rounded text-sm ${message.role === 'user' ? 'bg-blue-50 border-l-4 border-l-blue-400' : 'bg-green-50 border-l-4 border-l-green-400'} ${isModified ? 'border-yellow-400 bg-yellow-50' : ''} ${isEditing ? 'ring-2 ring-blue-400' : ''}`}>
                          {!isEditing ? (
                            <>
                              <button
                                className="absolute top-2 right-2 p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-100 rounded transition-colors"
                                title="编辑对话内容"
                                onClick={() => handleEditConversation(idx, message)}
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              {isModified && (
                                <Badge variant="outline" className="absolute top-2 left-2 text-xs bg-yellow-100 text-yellow-800">
                                  已修改
                                </Badge>
                              )}
                              <div className="pr-8">
                                <span className="font-medium capitalize">{message.role}:</span>
                                <span className="ml-2">{message.content}</span>
                              </div>
                            </>
                          ) : (
                            <div className="space-y-3">
                              <div className="flex justify-between items-center">
                                <Select
                                  value={editingConversationRole}
                                  onValueChange={setEditingConversationRole}
                                >
                                  <SelectTrigger className="h-8 text-sm w-24">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="user">用户</SelectItem>
                                    <SelectItem value="assistant">助手</SelectItem>
                                    <SelectItem value="system">系统</SelectItem>
                                  </SelectContent>
                                </Select>
                                <div className="flex space-x-1">
                                  <button
                                    className="p-1 text-green-600 hover:bg-green-100 rounded transition-colors"
                                    title="保存"
                                    onClick={handleSaveConversationEdit}
                                  >
                                    <Check className="w-4 h-4" />
                                  </button>
                                  <button
                                    className="p-1 text-red-600 hover:bg-red-100 rounded transition-colors"
                                    title="取消"
                                    onClick={handleCancelConversationEdit}
                                  >
                                    <XCircle className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                              <Textarea
                                value={editingConversationContent}
                                onChange={(e) => setEditingConversationContent(e.target.value)}
                                className="w-full min-h-[60px] text-sm font-mono"
                                autoFocus
                              />
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-sm text-gray-500 p-2 text-center">暂无对话内容</div>
                  )}
                </div>
              </div>

              <div>
                        {/* 评估概要图 */}
                  <EvaluationSummaryChart
                    evaluationData={normalizedEvaluation.display_evaluation}
                    className="mb-4"
                  />
              </div>
            </div>

            {/* 评分标注区域 - 独占一行 */}
            <div className="border-t pt-6">
              <h4 className="font-semibold mb-3 flex items-center justify-between">
                <span>评分标注</span>
              </h4>
              
              {showEvaluationDiff ? (
                <EvaluationDiffViewer
                  originalData={normalizedEvaluation.original_evaluation}
                  editedData={normalizedEvaluation.edited_evaluation}
                  onDataChange={handleEvaluationFieldChange}
                  onResetAll={handleResetAllEvaluation}
                />
              ) : (
                <div className="space-y-2">
                  {(showOriginalData ? normalizedEvaluation.original_evaluation : normalizedEvaluation.display_evaluation) &&
                    Object.entries(showOriginalData ? normalizedEvaluation.original_evaluation : normalizedEvaluation.display_evaluation).map(([key, value]) => {
                      const isModified = normalizedEvaluation.changed_fields.includes(key);
                      const isScoreField = typeof value === 'number' && key.toLowerCase().includes('score');
                      const isFromOriginal = showOriginalData;
                      
                      return (
                        <div 
                          key={key} 
                          className={`border rounded-lg p-3 transition-all ${
                            isModified && !isFromOriginal
                              ? 'border-yellow-400 bg-yellow-50 shadow-sm' 
                              : isFromOriginal
                              ? 'border-blue-200 bg-blue-50'
                              : 'border-gray-200 hover:shadow-sm'
                          }`}
                        >
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-medium capitalize">{key.replace(/_/g, ' ')}</span>
                            <div className="flex items-center space-x-2">
                              {isFromOriginal && (
                                <Badge variant="outline" className="text-xs bg-blue-100 text-blue-800">
                                  原始值
                                </Badge>
                              )}
                              {isModified && !isFromOriginal && (
                                <Badge variant="outline" className="text-xs bg-yellow-100 text-yellow-800">
                                  已修改
                                </Badge>
                              )}
                              {isScoreField && (
                                <Badge 
                                  variant={value >= 0.8 ? "default" : value >= 0.6 ? "secondary" : "destructive"}
                                  className="text-xs"
                                >
                                  {(value * 100).toFixed(0)}%
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="text-sm text-gray-700">
                            {typeof value === 'string' ? (
                              <span>{value}</span>
                            ) : typeof value === 'number' && !isScoreField ? (
                              <span>{value}</span>
                            ) : typeof value === 'boolean' ? (
                              <span className={value ? 'text-green-600' : 'text-red-600'}>
                                {value ? '是' : '否'}
                              </span>
                            ) : (
                              <pre className="text-xs bg-gray-50 p-2 rounded overflow-x-auto">
                                {JSON.stringify(value, null, 2)}
                              </pre>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
              
              {/* 数据切换操作按钮 */}
              <div className="flex justify-end space-x-2 mt-4">
                {showOriginalData && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleApplyOriginalData}
                  >
                    <Check className="w-4 h-4 mr-1" />
                    应用原始数据
                  </Button>
                )}
                {!showOriginalData && normalizedEvaluation.has_edited_content && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleApplyEditedData}
                  >
                    <Check className="w-4 h-4 mr-1" />
                    应用编辑数据
                  </Button>
                )}
              </div>
            </div>

            {/* 元数据信息 */}
            <div>
              <h4 className="font-semibold mb-3">元数据信息</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center">
                  <span className="text-gray-600">数据集ID:</span>
                  <span className="ml-2 font-mono text-xs">{normalizedEvaluation.metadata.dataset_id || 'N/A'}</span>
                </div>
                <div className="flex items-center">
                  <span className="text-gray-600">数据类型:</span>
                  <span className="ml-2">
                    <Badge variant="outline" className="text-xs">
                      {currentEvaluation?.data_type || 'EVALUATION'}
                    </Badge>
                  </span>
                </div>
                <div className="flex items-center">
                  <span className="text-gray-600">行号:</span>
                  <span className="ml-2">{normalizedEvaluation.metadata.line_number || 'N/A'}</span>
                </div>
                <div className="flex items-center">
                  <span className="text-gray-600">UUID:</span>
                  <span className="ml-2 font-mono text-xs">{normalizedEvaluation.metadata.uuid || 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* 功能按钮区域 */}
            <div className="border-t pt-4">
              <div className="flex justify-end space-x-2">
                <Button
                  onClick={handleSaveAnnotation}
                  disabled={isSaving}
                  className="min-w-[120px]"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      保存中...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      保存标注
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  if (isLoadingEvaluations) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div>加载中...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      {/* 左侧评估列表 */}
      <div className="w-80 border-r bg-gray-50 flex flex-col">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold">质量评估列表</h2>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowConversionDialog(true)}
            >
              <Save className="w-4 h-4 mr-1" />
              保存为数据集
            </Button>
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="w-4 h-4 mr-1" />
              返回
            </Button>
          </div>
        </div>
        
        {/* 批量操作区域 */}
        <div className="p-3 border-b bg-white flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={selectedItems.size === evaluations.length && evaluations.length > 0}
              onCheckedChange={handleSelectAll}
              className="mr-1"
            />
            <span className="text-xs">全选</span>
          </div>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleBatchMarkComplete(true)}
              disabled={selectedItems.size === 0 || isBatchMarking}
              className="h-7 px-2 text-xs bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
              title={selectedItems.size > 0 ? `标记选中的 ${selectedItems.size} 条为已标注` : "请先选择评估"}
            >
              <CheckCircle className="w-3 h-3" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleBatchMarkComplete(false)}
              disabled={selectedItems.size === 0 || isBatchMarking}
              className="h-7 px-2 text-xs bg-orange-50 hover:bg-orange-100 text-orange-700 border-orange-200"
              title={selectedItems.size > 0 ? `标记选中的 ${selectedItems.size} 条为未标注` : "请先选择评估"}
            >
              <Square className="w-3 h-3" />
            </Button>
          </div>
        </div>
        <div className="px-3 py-1 bg-gray-50 text-xs text-gray-600">
          已选择 {selectedItems.size} 条 / 总 {evaluations.length} 条
        </div>
        
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-2">
            {evaluations.map((evaluation, index) => {
              const isAnnotated = !!(evaluation.annotation_metadata?.annotator_id) || 
                                !!(evaluation.is_annotated);
              const hasEvaluation = !!(evaluation.original_content?.evaluation);
              
              return (
                <div
                  key={evaluation.id}
                  className={`p-3 rounded-lg cursor-pointer transition-colors ${
                    selectedIndex === index
                      ? 'bg-green-100 border-green-300'
                      : 'bg-white hover:bg-gray-100'
                  }`}
                  onClick={() => setSelectedIndex(index)}
                >
                  <div className="flex items-start gap-2">
                    <Checkbox
                      checked={selectedItems.has(evaluation.id)}
                      onCheckedChange={(checked) => handleItemSelect(evaluation.id, checked as boolean)}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        评估 #{evaluation.line_number || index + 1}
                      </p>
                      <div className="flex items-center mt-1 space-x-2">
                        {isAnnotated ? (
                          <Badge variant="outline" className="text-xs bg-green-100 text-green-800 border-green-300">
                            ✓ 已标注
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs bg-orange-100 text-orange-800 border-orange-300">
                            ○ 未标注
                          </Badge>
                        )}
                        {hasEvaluation && (
                          <Badge variant="outline" className="text-xs">
                            已评估
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <Button
                        variant={isAnnotated ? "ghost" : "outline"}
                        size="sm"
                        className={`h-6 px-2 text-xs ${
                          isAnnotated
                            ? 'text-orange-600 hover:text-orange-700 hover:bg-orange-50'
                            : 'text-green-600 hover:text-green-700 bg-green-50'
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarkComplete(evaluation.id, !isAnnotated);
                        }}
                        title={isAnnotated ? "标记为未标注" : "标记为已标注"}
                      >
                        {isAnnotated ? (
                          <>
                            <Square className="w-3 h-3 mr-1" />
                            撤销
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-3 h-3 mr-1" />
                            完成
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 分页控制 */}
        <div className="p-4 border-t bg-white">
          <div className="flex items-center justify-between mb-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={!pagination.has_previous || isLoadingEvaluations}
              className="flex items-center"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              上一页
            </Button>
            
            <span className="text-sm text-gray-600">
              {currentPage} / {pagination.total_pages}
            </span>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={!pagination.has_next || isLoadingEvaluations}
              className="flex items-center"
            >
              下一页
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </div>

      {/* 中间内容区域 */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6">
          <AnnotationStatisticsPanel 
            datasetId={datasetId} 
            onRefresh={() => {
              // 保存后刷新统计数据
              queryClient.invalidateQueries({ queryKey: ['annotation-statistics', datasetId] });
            }}
          />
          
          {currentEvaluation ? (
            <div className="space-y-6">
              {renderEvaluationData()}
            </div>
          ) : (
            <div className="text-center text-gray-500">选择一个评估开始标注</div>
          )}
        </div>
      </div>

      {/* 右侧标注面板 - 已移除，只保留功能按钮 */}

      {/* 创建数据集对话框 */}
      <Dialog open={showConversionDialog} onOpenChange={setShowConversionDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>创建新数据集</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="dataset-name">数据集名称 *</Label>
              <Input
                id="dataset-name"
                value={conversionConfig.newDatasetName}
                onChange={(e) => setConversionConfig({...conversionConfig, newDatasetName: e.target.value})}
                placeholder="请输入新数据集的名称"
              />
            </div>
            
            <div>
              <Label htmlFor="dataset-description">描述</Label>
              <Input
                id="dataset-description"
                value={conversionConfig.newDatasetDescription}
                onChange={(e) => setConversionConfig({...conversionConfig, newDatasetDescription: e.target.value})}
                placeholder="可选的数据集描述"
              />
            </div>

            <div>
              <Label>数据筛选</Label>
              <Select
                value={conversionConfig.dataFilter}
                onValueChange={(value) => setConversionConfig({...conversionConfig, dataFilter: value as any})}
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
          </div>
          
          <DialogFooter className="mt-6">
            <Button
              variant="outline"
              onClick={() => setShowConversionDialog(false)}
              disabled={isCreatingDataset}
            >
              取消
            </Button>
            <Button
              onClick={handleCreateDataset}
              disabled={isCreatingDataset || !conversionConfig.newDatasetName.trim()}
            >
              {isCreatingDataset ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  创建中...
                </>
              ) : (
                '创建数据集'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default EvaluationAnnotationPage;