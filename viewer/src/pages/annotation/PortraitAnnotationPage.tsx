import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Star, ChevronLeft, ChevronRight, User, ArrowLeft, Save, Loader2, Edit, Eye, EyeOff, CheckCircle, Square } from 'lucide-react';
import { annotationApiV2 } from '@/lib/annotationApiV2';
import PortraitDiffViewerOptimized from '@/components/annotation/PortraitDiffViewerOptimized';
import { useDiffCalculation } from '@/hooks/useDiffCalculation';

// 防抖工具函数
const debounce = <T extends (...args: any[]) => any>(
  func: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

// 列表展示组件
const ListDisplay = React.memo<{
  items: string[];
  label: string;
  onChange: (items: string[]) => void;
  isEditing: boolean;
}>(({ items, label, onChange, isEditing }) => {
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  const [localItems, setLocalItems] = useState<string[]>(items);

  // 使用防抖的更新函数
  const debouncedOnChange = useMemo(
    () => debounce(onChange, 300),
    [onChange]
  );

  // 同步外部items到本地状态
  useEffect(() => {
    setLocalItems(items);
  }, [items]);

  const toggleExpand = (index: number) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedItems(newExpanded);
  };

  const updateItem = useCallback((index: number, value: string) => {
    const newItems = [...localItems];
    newItems[index] = value;
    setLocalItems(newItems);
    debouncedOnChange(newItems);
  }, [localItems, debouncedOnChange]);

  const addItem = useCallback(() => {
    const newItems = [...localItems, ''];
    setLocalItems(newItems);
    debouncedOnChange(newItems);
  }, [localItems, debouncedOnChange]);

  const removeItem = useCallback((index: number) => {
    const newItems = localItems.filter((_, i) => i !== index);
    setLocalItems(newItems);
    debouncedOnChange(newItems);
  }, [localItems, debouncedOnChange]);

  if (!isEditing) {
    return (
      <div>
        <Label className="text-sm font-medium">{label}</Label>
        <div className="mt-2 space-y-2">
          {items && items.length > 0 ? (
            items.map((item, index) => (
              <div key={`${label}-${index}-${item.slice(0, 10)}`} className="border rounded-lg p-3 bg-white">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">
                      条目 {index + 1}
                    </div>
                    <div className={`text-sm text-gray-700 mt-1 ${
                      item.length > 100 ? 'line-clamp-2' : ''
                    }`}>
                      {item || <span className="text-gray-400">空内容</span>}
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-sm text-gray-400 py-4 text-center">
              暂无数据
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <Label className="text-sm font-medium">{label}</Label>
        <Button size="sm" variant="outline" onClick={addItem}>
          添加条目
        </Button>
      </div>
      <div className="space-y-2">
        {localItems.map((item, index) => (
          <div key={`${label}-edit-${index}-${item.slice(0, 10)}`} className="border rounded-lg p-3">
            <div className="flex items-start justify-between mb-2">
              <span className="text-sm font-medium">条目 {index + 1}</span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => removeItem(index)}
                className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
              >
                ×
              </Button>
            </div>
            <Textarea
              value={item}
              onChange={(e) => updateItem(index, e.target.value)}
              placeholder="输入内容..."
              className="text-sm min-h-[60px]"
              rows={3}
            />
          </div>
        ))}
        {localItems.length === 0 && (
          <div className="text-sm text-gray-400 py-4 text-center">
            暂无数据，点击"添加条目"开始添加
          </div>
        )}
      </div>
    </div>
  );
});
ListDisplay.displayName = 'ListDisplay';

// 可编辑的字段组件
const EditableField = React.memo<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  type?: 'text' | 'array';
  isEditing: boolean;
}>(({ label, value, onChange, multiline = false, type = 'text', isEditing }) => {
  const [localValue, setLocalValue] = useState(value);
  const debouncedOnChange = useMemo(
    () => debounce(onChange, 300),
    [onChange]
  );

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = useCallback((newValue: string) => {
    setLocalValue(newValue);
    debouncedOnChange(newValue);
  }, [debouncedOnChange]);

  if (!isEditing) {
    return (
      <div>
        <Label className="text-sm font-medium">{label}</Label>
        <div className="mt-1 p-2 bg-muted rounded text-sm">
          {value || <span className="text-muted-foreground">无</span>}
        </div>
      </div>
    );
  }

  if (multiline) {
    return (
      <div>
        <Label className="text-sm font-medium">{label}</Label>
        <Textarea
          value={localValue}
          onChange={(e) => handleChange(e.target.value)}
          className="mt-1 text-sm"
          rows={3}
        />
      </div>
    );
  }

  return (
    <div>
      <Label className="text-sm font-medium">{label}</Label>
      <Input
        value={localValue}
        onChange={(e) => handleChange(e.target.value)}
        className="mt-1 text-sm"
      />
    </div>
  );
});
EditableField.displayName = 'EditableField';

// 可编辑的操作历史组件
const EditableOperationHistory = React.memo<{
  operations: Array<{
    timestamp: string;
    action: string;
    target: string;
    result: string;
    details: string;
  }>;
  onChange: (operations: any[]) => void;
  isEditing: boolean;
}>(({ operations, onChange, isEditing }) => {
  const [localOperations, setLocalOperations] = useState(operations);
  const debouncedOnChange = useMemo(
    () => debounce(onChange, 300),
    [onChange]
  );

  useEffect(() => {
    setLocalOperations(operations);
  }, [operations]);

  const updateOperation = useCallback((index: number, field: string, value: string) => {
    const newOperations = [...localOperations];
    newOperations[index] = { ...newOperations[index], [field]: value };
    setLocalOperations(newOperations);
    debouncedOnChange(newOperations);
  }, [localOperations, debouncedOnChange]);

  const addOperation = useCallback(() => {
    const newOperations = [
      ...localOperations,
      { timestamp: '', action: '', target: '', result: '', details: '' }
    ];
    setLocalOperations(newOperations);
    debouncedOnChange(newOperations);
  }, [localOperations, debouncedOnChange]);

  const removeOperation = useCallback((index: number) => {
    const newOperations = localOperations.filter((_, i) => i !== index);
    setLocalOperations(newOperations);
    debouncedOnChange(newOperations);
  }, [localOperations, debouncedOnChange]);

  if (!isEditing) {
    return (
      <div>
        <h5 className="font-medium text-sm mb-1">操作历史:</h5>
        <div className="space-y-1">
          {localOperations.map((op, idx) => (
            <div key={`operation-${idx}-${op.timestamp}`} className="p-2 bg-gray-50 rounded text-sm">
              <div><strong>时间:</strong> {op.timestamp}</div>
              <div><strong>操作:</strong> {op.action}</div>
              <div><strong>目标:</strong> {op.target}</div>
              <div><strong>结果:</strong> {op.result}</div>
              <div><strong>详情:</strong> {op.details}</div>
            </div>
          )) || <div className="text-gray-400">无操作历史</div>}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h5 className="font-medium text-sm">操作历史:</h5>
        <Button size="sm" variant="outline" onClick={addOperation}>
          添加操作
        </Button>
      </div>
      <div className="space-y-3">
        {localOperations.map((op, idx) => (
          <Card key={`operation-edit-${idx}-${op.timestamp}`} className="p-3">
            <div className="grid grid-cols-2 gap-2 mb-2">
              {(['timestamp', 'action', 'target', 'result', 'details'] as const).map(field => (
                <div key={field}>
                  <Label className="text-xs">{field === 'timestamp' ? '时间' :
                                                field === 'action' ? '操作' :
                                                field === 'target' ? '目标' :
                                                field === 'result' ? '结果' : '详情'}</Label>
                  <Input
                    value={op[field]}
                    onChange={(e) => updateOperation(idx, field, e.target.value)}
                    className="text-xs h-8"
                  />
                </div>
              ))}
            </div>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => removeOperation(idx)}
              className="w-full"
            >
              删除此操作
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
});
EditableOperationHistory.displayName = 'EditableOperationHistory';

interface PortraitAnnotationPageProps {
  datasetId: string;
  onBack: () => void;
}

interface PortraitData {
  uid: string;
  category: string;
  user_info: {
    id: string;
  };
  raw: string;
  messages: Array<{
    content: string;
    role: string;
  }>;
  portrait_prompt: string;
  portrait: {
    背景描述: string[];
    知识盲区: string[];
    操作历史: Array<{
      timestamp: string;
      action: string;
      target: string;
      result: string;
      details: string;
    }>;
    问题描述: string[];
  };
}

const PortraitAnnotationPage: React.FC<PortraitAnnotationPageProps> = ({ datasetId, onBack }) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editedPortrait, setEditedPortrait] = useState<any>(null);
  const [showDiff, setShowDiff] = useState<boolean>(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isBatchMarking, setIsBatchMarking] = useState(false);

  const [annotationData, setAnnotationData] = useState({
    accuracy_score: undefined as number | undefined,
    completeness_score: undefined as number | undefined,
    relevance_score: undefined as number | undefined,
    category: undefined as string | undefined,
    issues: [] as string[],
    notes: '',
    verified_fields: [] as string[],
    field_annotations: {} as Record<string, any>,
  });

  const [showConversionDialog, setShowConversionDialog] = useState(false);
  const [conversionConfig, setConversionConfig] = useState({
    newDatasetName: '',
    newDatasetDescription: '',
    dataFilter: 'ALL' as 'ALL' | 'ANNOTATED'
  });
  const [isCreatingDataset, setIsCreatingDataset] = useState(false);

  // 获取用户画像列表
  const { data: portraitsData, isLoading: isLoadingPortraits } = useQuery({
    queryKey: ['portraits', datasetId, currentPage, pageSize],
    queryFn: () => annotationApiV2.getDatasetContent(datasetId, currentPage, pageSize),
    enabled: !!datasetId,
  });

  // 批量标记完成的mutation
  const batchMarkCompleteMutation = useMutation({
    mutationFn: (data: { dataset_id: string; item_ids?: string[]; mark_as_annotated: boolean }) =>
      annotationApiV2.batchMarkComplete(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portraits', datasetId, currentPage, pageSize] });
      setSelectedItems(new Set());
    },
  });

  // 单个标记完成的mutation
  const markCompleteMutation = useMutation({
    mutationFn: (data: { dataset_id: string; item_id: string; mark_as_annotated: boolean }) =>
      annotationApiV2.markComplete(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portraits', datasetId, currentPage, pageSize] });
    },
  });

  const portraits = portraitsData?.items || [];
  const pagination = portraitsData?.pagination || {
    page: 1,
    page_size: 20,
    total: 0,
    total_pages: 0,
    has_next: false,
    has_previous: false
  };

  const currentPortrait = portraits[selectedIndex];

  // 使用差异计算Hook
  const originalData = useMemo(() => {
    return currentPortrait?.original_content?.metadata?.original_content || 
           currentPortrait?.original_content || {};
  }, [currentPortrait]);

  const modifiedData = useMemo(() => {
    return editedPortrait || originalData;
  }, [editedPortrait, originalData]);

  const { diffs, stats, isCalculating, error: diffError } = useDiffCalculation(
    originalData,
    modifiedData,
    {
      debounceMs: 500,
      enableRealTime: true,
      onError: (error) => {
        console.error('差异计算错误:', error);
        toast({
          title: '差异计算错误',
          description: error.message,
          variant: 'destructive',
        });
      }
    }
  );

  useEffect(() => {
    if (currentPortrait) {
      // 添加调试日志
      console.log('Current portrait:', currentPortrait);
      console.log('Original content:', currentPortrait.original_content);
      console.log('Edited content:', currentPortrait.edited_content);

      // 重置编辑状态
      setIsEditing(false);

      // 初始化编辑数据，优先使用已编辑的数据
      const savedData = currentPortrait.edited_content ||
                       currentPortrait.original_content || {};
      setEditedPortrait(JSON.parse(JSON.stringify(savedData)));

      // 从annotation_data中读取标注信息
      const annotationInfo = currentPortrait.annotation_data || {};
      const customFields = annotationInfo.custom_fields || {};

      setAnnotationData({
        accuracy_score: annotationInfo.quality_rating || customFields.accuracy_score || currentPortrait?.accuracy_score,
        completeness_score: customFields.completeness_score || currentPortrait?.completeness_score,
        relevance_score: customFields.relevance_score || currentPortrait?.relevance_score,
        category: currentPortrait?.category || annotationInfo.intent?.portrait_purpose || savedData.category,
        issues: annotationInfo.tags || currentPortrait?.issues || [],
        notes: annotationInfo.notes || currentPortrait?.notes || '',
        verified_fields: customFields.verified_fields || currentPortrait?.verified_fields || [],
        field_annotations: customFields.field_annotations || currentPortrait?.field_annotations || {},
      });
    }
  }, [currentPortrait]);

  // 使用v2接口保存标注
  const saveAnnotationV2Mutation = useMutation({
    mutationFn: (data: any) => {
      const apiUrl = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'}/v2/annotations/save/`;
      console.log('API URL:', apiUrl);
      console.log('Saving annotation v2 with data:', data);
      return annotationApiV2.saveAnnotation(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portraits', datasetId] });
      toast({
        title: '保存成功',
        description: '标注数据已保存',
      });
    },
    onError: (error: any) => {
      console.error('Save annotation v2 failed:', error);
      console.error('Error response:', error?.response);

      let errorMessage = '保存失败';

      if (error.code === 'ERR_NETWORK' || error.message.includes('Network Error')) {
        errorMessage = '无法连接到服务器，请确保后端服务正在运行';
        toast({
          title: '网络错误',
          description: errorMessage,
          variant: 'destructive',
        });
      } else if (error.response?.status === 404) {
        errorMessage = 'API接口不存在，请检查URL配置';
        toast({
          title: '接口错误',
          description: errorMessage,
          variant: 'destructive',
        });
      } else {
        errorMessage = error?.response?.data?.error || error?.response?.data?.detail || error?.message || '保存失败';
        toast({
          title: '保存失败',
          description: errorMessage,
          variant: 'destructive',
        });
      }
    },
  });

  const handleSaveAnnotation = async () => {
    // 验证必填字段
    if (!currentPortrait) {
      toast({
        title: '保存失败',
        description: '没有选择要保存的用户画像',
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

    // 使用当前索引作为item_id（即line_number）
    const item_id = currentPortrait.id || `${datasetId}_${currentPortrait.sample_index || selectedIndex}`;

    setIsSaving(true);

    try {
      // 准备v2接口需要的数据
      const annotationDataV2 = {
        // 优先使用编辑后的数据，没有编辑则使用原始数据
        edited_content: editedPortrait || currentPortrait.original_content,
        tags: annotationData.issues,
        notes: annotationData.notes,
        quality_rating: annotationData.accuracy_score || annotationData.completeness_score || annotationData.relevance_score,
        intent: {
          portrait_purpose: annotationData.category,
          confidence_level: annotationData.accuracy_score >= 4 ? 'high' :
                             annotationData.accuracy_score >= 2 ? 'medium' : 'low'
        },
        roles: {
          data_quality: annotationData.accuracy_score >= 4 ? 'excellent' :
                         annotationData.accuracy_score >= 3 ? 'good' :
                         annotationData.accuracy_score >= 2 ? 'fair' : 'poor'
        },
        custom_fields: {
          diff_stats: stats // 仅保留差异统计信息，其他标注数据移到annotation_data根级别
        }
      };

      const saveData = {
        dataset_id: datasetId,
        item_id: item_id,
        annotation_data: annotationDataV2,
        auto_save: false
      };

      console.log('Saving with v2 API:', saveData);

      await saveAnnotationV2Mutation.mutateAsync(saveData);

      toast({
        title: '保存成功',
        description: `画像标注已保存`,
      });

      // 退出编辑模式
      setIsEditing(false);
    } catch (error: any) {
      console.error('Failed to save annotation v2:', error);

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

  const handlePageChange = async (newPage: number) => {
    // 检查是否有未保存的更改
    if (isEditing && editedPortrait) {
      const originalData = currentPortrait.original_content?.metadata?.original_content || currentPortrait.original_content || {};
      if (JSON.stringify(originalData) !== JSON.stringify(editedPortrait)) {
        const confirmLeave = window.confirm('您有未保存的更改，确定要离开吗？');
        if (!confirmLeave) return;
      }
    }

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
    if (selectedItems.size === portraits.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(portraits.map(p => p.id)));
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

  const renderStars = (rating: number | undefined, onRate: (rating: number) => void) => {
    return (
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
    );
  };

  const renderPortraitData = (rawData: any) => {
    // 使用编辑后的数据或原始数据
    const dataToRender = editedPortrait || currentPortrait?.original_content || {};
    
    // 如果没有数据，显示提示信息
    if (!dataToRender || Object.keys(dataToRender).length === 0) {
      return (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  用户画像详情
                </CardTitle>
                <div className="flex items-center space-x-2">
                  <Button
                    size="sm"
                    variant={isEditing ? "default" : "outline"}
                    onClick={() => setIsEditing(!isEditing)}
                  >
                    <Edit className="w-4 h-4 mr-1" />
                    {isEditing ? "完成编辑" : "编辑"}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <User className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">暂无用户画像数据</p>
                <p className="text-sm text-gray-400 mt-2">
                  {isLoadingPortraits ? '正在加载数据...' : '请等待数据加载或检查数据源'}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                用户画像详情
                {isEditing && (
                  <Badge variant="secondary" className="ml-2">
                    编辑模式
                  </Badge>
                )}
              </CardTitle>
              <div className="flex items-center space-x-2">
                <Button
                  size="sm"
                  variant={showDiff ? "default" : "outline"}
                  onClick={() => setShowDiff(!showDiff)}
                  className="flex items-center"
                >
                  {showDiff ? <EyeOff className="w-4 h-4 mr-1" /> : <Eye className="w-4 h-4 mr-1" />}
                  {showDiff ? "隐藏差异" : "显示差异"}
                  {stats.total > 0 && (
                    <Badge variant="secondary" className="ml-1">
                      {stats.total}
                    </Badge>
                  )}
                </Button>
                <Button
                  size="sm"
                  variant={isEditing ? "default" : "outline"}
                  onClick={() => setIsEditing(!isEditing)}
                >
                  <Edit className="w-4 h-4 mr-1" />
                  {isEditing ? "完成编辑" : "编辑"}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 差异展示区域 */}
            {showDiff && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-gray-900">修改差异</h4>
                  {isCalculating && (
                    <span className="text-sm text-gray-500">计算中...</span>
                  )}
                </div>
                <PortraitDiffViewerOptimized
                  originalData={originalData}
                  modifiedData={modifiedData}
                  showRealTime={true}
                  className="border rounded-lg p-4 bg-gray-50"
                />
              </div>
            )}

            <div>
              <h4 className="font-semibold mb-2">基本信息</h4>
              <div className="grid grid-cols-2 gap-4">
                <EditableField
                  label="用户ID"
                  value={dataToRender.user_info?.id || ''}
                  onChange={(value) => {
                    const newData = { ...dataToRender };
                    if (!newData.user_info) newData.user_info = {};
                    newData.user_info.id = value;
                    setEditedPortrait(newData);
                  }}
                  isEditing={isEditing}
                />
                <EditableField
                  label="UID"
                  value={dataToRender.uid || ''}
                  onChange={(value) => {
                    setEditedPortrait({ ...dataToRender, uid: value });
                  }}
                  isEditing={isEditing}
                />
                <EditableField
                  label="分类"
                  value={dataToRender.category || ''}
                  onChange={(value) => {
                    setEditedPortrait({ ...dataToRender, category: value });
                  }}
                  isEditing={isEditing}
                />
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-2">用户画像内容</h4>
              <div className="space-y-4">
                <ListDisplay
                  label="背景描述"
                  items={dataToRender.portrait?.背景描述 || []}
                  onChange={(items) => {
                    const newData = { ...dataToRender };
                    if (!newData.portrait) newData.portrait = {};
                    newData.portrait.背景描述 = items;
                    setEditedPortrait(newData);
                  }}
                  isEditing={isEditing}
                />
                <ListDisplay
                  label="知识盲区"
                  items={dataToRender.portrait?.知识盲区 || []}
                  onChange={(items) => {
                    const newData = { ...dataToRender };
                    if (!newData.portrait) newData.portrait = {};
                    newData.portrait.知识盲区 = items;
                    setEditedPortrait(newData);
                  }}
                  isEditing={isEditing}
                />
                <ListDisplay
                  label="问题描述"
                  items={dataToRender.portrait?.问题描述 || []}
                  onChange={(items) => {
                    const newData = { ...dataToRender };
                    if (!newData.portrait) newData.portrait = {};
                    newData.portrait.问题描述 = items;
                    setEditedPortrait(newData);
                  }}
                  isEditing={isEditing}
                />
                <EditableOperationHistory
                  operations={dataToRender.portrait?.操作历史 || []}
                  onChange={(operations) => {
                    const newData = { ...dataToRender };
                    if (!newData.portrait) newData.portrait = {};
                    newData.portrait.操作历史 = operations;
                    setEditedPortrait(newData);
                  }}
                  isEditing={isEditing}
                />
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-2">原始对话内容</h4>
              <div className="p-3 bg-gray-50 rounded-md text-sm max-h-40 overflow-y-auto">
                <pre className="whitespace-pre-wrap">{dataToRender.raw || 'N/A'}</pre>
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-2">对话消息</h4>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {dataToRender.messages?.map((message: any, idx: number) => (
                  <div key={idx} className={`p-2 rounded text-sm ${message.role === 'user' ? 'bg-blue-50' : 'bg-green-50'}`}>
                    <span className="font-medium">{message.role === 'user' ? '用户' : '客服'}:</span>
                    <span className="ml-2">{message.content}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  // 调试日志
  useEffect(() => {
    if (currentPortrait) {
      console.log('Current portrait data:', currentPortrait);
      console.log('Original content structure:', currentPortrait.original_content);
    }
  }, [currentPortrait]);

  if (isLoadingPortraits) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div>加载中...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      {/* 左侧用户列表 */}
      <div className="w-80 border-r bg-gray-50 flex flex-col">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold">用户画像列表</h2>
          <div className="flex gap-2">
            <Dialog open={showConversionDialog} onOpenChange={setShowConversionDialog}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowConversionDialog(true)}
              >
                <Save className="w-4 h-4 mr-1" />
                保存为数据集
              </Button>
            </Dialog>
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
              checked={selectedItems.size === portraits.length && portraits.length > 0}
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
              title={selectedItems.size > 0 ? `标记选中的 ${selectedItems.size} 条为已标注` : "请先选择用户画像"}
            >
              <CheckCircle className="w-3 h-3" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleBatchMarkComplete(false)}
              disabled={selectedItems.size === 0 || isBatchMarking}
              className="h-7 px-2 text-xs bg-orange-50 hover:bg-orange-100 text-orange-700 border-orange-200"
              title={selectedItems.size > 0 ? `标记选中的 ${selectedItems.size} 条为未标注` : "请先选择用户画像"}
            >
              <Square className="w-3 h-3" />
            </Button>
          </div>
        </div>
        <div className="px-3 py-1 bg-gray-50 text-xs text-gray-600">
          已选择 {selectedItems.size} 条 / 总 {portraits.length} 条
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-2">
            {portraits.map((portrait, index) => {
              const isAnnotated = portrait.is_annotated || 
                                portrait.accuracy_score || 
                                portrait.completeness_score || 
                                portrait.field_annotations ||
                                !!(portrait.annotation_metadata?.annotator_id);
              
              return (
                <div
                  key={`${portrait.dataset_id}_${portrait.sample_index}`}
                  className={`p-3 rounded-lg cursor-pointer transition-colors ${
                    selectedIndex === index
                      ? 'bg-purple-100 border-purple-300'
                      : 'bg-white hover:bg-gray-100'
                  }`}
                  onClick={() => {
                    // 检查是否有未保存的更改
                    if (isEditing && editedPortrait && selectedIndex === index) {
                      const originalData = currentPortrait.original_content?.metadata?.original_content || currentPortrait.original_content || {};
                      if (JSON.stringify(originalData) !== JSON.stringify(editedPortrait)) {
                        const confirmLeave = window.confirm('您有未保存的更改，确定要离开吗？');
                        if (!confirmLeave) return;
                      }
                    }
                    setSelectedIndex(index);
                  }}
                >
                  <div className="flex items-start gap-2">
                    <Checkbox
                      checked={selectedItems.has(portrait.id)}
                      onCheckedChange={(checked) => handleItemSelect(portrait.id, checked as boolean)}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {portrait.original_content?.metadata?.original_content?.uid ||
                         portrait.original_content?.metadata?.original_content?.user_info?.id ||
                         portrait.original_content?.uid ||
                         portrait.original_content?.user_info?.id ||
                         `用户 ${portrait.sample_index}`}
                      </p>
                      <p className="text-xs text-gray-600 truncate">
                        {portrait.original_content?.metadata?.original_content?.category ||
                         portrait.original_content?.category ||
                         '未分类'}
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
                        {portrait.preview && (
                          <p className="text-xs text-gray-400 truncate">
                            {portrait.preview}
                          </p>
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
                          handleMarkComplete(portrait.id, !isAnnotated);
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
              disabled={!pagination.has_previous || isLoadingPortraits}
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
              disabled={!pagination.has_next || isLoadingPortraits}
              className="flex items-center"
            >
              下一页
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </div>

      {/* 中间内容区域 */}
      <div className="flex-1 overflow-y-auto p-6">
        {currentPortrait ? (
          <div className="space-y-6">
            {renderPortraitData(currentPortrait.original_data)}
          </div>
        ) : (
          <div className="text-center text-gray-500">选择一个用户画像开始标注</div>
        )}
      </div>

      {/* 右侧标注面板 */}
      <div className="w-96 border-l bg-white overflow-y-auto">
        <div className="p-6 space-y-6">
          <h3 className="text-lg font-semibold">标注信息</h3>

          <div>
            <Label className="mb-2 block">准确性评分</Label>
            {renderStars(annotationData.accuracy_score, (rating) =>
              setAnnotationData({ ...annotationData, accuracy_score: rating })
            )}
          </div>

          <div>
            <Label className="mb-2 block">完整性评分</Label>
            {renderStars(annotationData.completeness_score, (rating) =>
              setAnnotationData({ ...annotationData, completeness_score: rating })
            )}
          </div>

          <div>
            <Label className="mb-2 block">相关性评分</Label>
            {renderStars(annotationData.relevance_score, (rating) =>
              setAnnotationData({ ...annotationData, relevance_score: rating })
            )}
          </div>

          <div>
            <Label className="mb-2 block">问题分类</Label>
            <Select
              value={annotationData.category}
              onValueChange={(value) =>
                setAnnotationData({ ...annotationData, category: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="选择分类" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="demographics">人口统计信息</SelectItem>
                <SelectItem value="preferences">偏好设置</SelectItem>
                <SelectItem value="financial">财务信息</SelectItem>
                <SelectItem value="metadata">元数据</SelectItem>
                <SelectItem value="other">其他</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="mb-2 block">发现的问题</Label>
            <Textarea
              value={annotationData.issues.join(',')}
              onChange={(e) =>
                setAnnotationData({ ...annotationData, issues: e.target.value.split(',').map(s => s.trim()) })
              }
              placeholder="输入发现的问题，用逗号分隔..."
              className="min-h-[80px]"
            />
          </div>

          <div>
            <Label className="mb-2 block">备注说明</Label>
            <Textarea
              value={annotationData.notes}
              onChange={(e) =>
                setAnnotationData({ ...annotationData, notes: e.target.value })
              }
              placeholder="添加备注说明..."
              className="min-h-[100px]"
            />
          </div>

          <Button
            onClick={handleSaveAnnotation}
            disabled={isSaving}
            className="w-full"
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

            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => setShowConversionDialog(false)}
                disabled={isCreatingDataset}
              >
                取消
              </Button>
              <Button
                onClick={handleCreateDataset}
                disabled={!conversionConfig.newDatasetName.trim() || isCreatingDataset}
              >
                {isCreatingDataset ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    创建中...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    创建数据集
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PortraitAnnotationPage;