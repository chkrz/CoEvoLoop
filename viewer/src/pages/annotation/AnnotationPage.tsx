import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

import { Star, ChevronLeft, ChevronRight, Save, ArrowLeft, Copy, Loader2, Eye, EyeOff, Download, Settings, CheckCircle, CheckSquare, Square, HelpCircle } from 'lucide-react';
import { annotationApi, ConversationListItem, ConversationAnnotation } from '@/lib/annotationApi';
import { annotationApiV2, DatasetContent, AnnotationItem } from '@/lib/annotationApiV2';
import { DialogueAnnotationView } from '@/components/annotation/DialogueAnnotationView';

interface AnnotationPageProps {
  datasetId: string;
  onBack?: () => void;
}

const AnnotationPage: React.FC<AnnotationPageProps> = ({ datasetId, onBack }) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);
  const [currentConversation, setCurrentConversation] = useState<AnnotationItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showOriginalView, setShowOriginalView] = useState(false); // 切换视图模式
  const [showDiff, setShowDiff] = useState(false); // 显示差异
  const [showConversionDialog, setShowConversionDialog] = useState(false);
  const [conversionConfig, setConversionConfig] = useState({
    newDatasetName: '',
    newDatasetDescription: '',
    dataFilter: 'ALL' as 'ALL' | 'ANNOTATED'
  });
  const [isCreatingDataset, setIsCreatingDataset] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isBatchMarking, setIsBatchMarking] = useState(false);

  const [annotationData, setAnnotationData] = useState({
    quality_score: undefined as number | undefined,
    accuracy: undefined as 'correct' | 'partial' | 'incorrect' | undefined,
    category: undefined as string | undefined,
    tags: [] as string[],
    notes: '',
  });

  // 获取数据集内容（支持分页）- 使用V2 API
  const { data: datasetContent, isLoading: isLoadingConversations } = useQuery({
    queryKey: ['dataset-content', datasetId, currentPage, pageSize],
    queryFn: () => annotationApiV2.getDatasetContent(datasetId, currentPage, pageSize),
    enabled: !!datasetId,
  });

  const conversations = datasetContent?.items || [];
  const pagination = datasetContent?.pagination || {
    page: 1,
    page_size: 20,
    total: 0,
    total_pages: 0,
    has_next: false,
    has_previous: false
  };

  // 保存标注的mutation - 使用V2 API
  const saveAnnotationMutation = useMutation({
    mutationFn: (data: any) => annotationApiV2.saveAnnotation(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dataset-content', datasetId, currentPage, pageSize] });
    },
  });

  // 批量标记完成的mutation
  const batchMarkCompleteMutation = useMutation({
    mutationFn: (data: { dataset_id: string; item_ids?: string[]; mark_as_annotated: boolean }) =>
      annotationApiV2.batchMarkComplete(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dataset-content', datasetId, currentPage, pageSize] });
      setSelectedItems(new Set()); // 清空选择
    },
  });

  // 单个标记完成的mutation
  const markCompleteMutation = useMutation({
    mutationFn: (data: { dataset_id: string; item_id: string; mark_as_annotated: boolean }) =>
      annotationApiV2.markComplete(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dataset-content', datasetId, currentPage, pageSize] });
    },
  });

  useEffect(() => {
    if (conversations.length > 0 && selectedIndex < conversations.length) {
      setCurrentConversation(conversations[selectedIndex]);
    }
  }, [conversations, selectedIndex]);

  useEffect(() => {
    if (currentConversation) {
      setAnnotationData({
        quality_score: currentConversation.quality_rating,
        accuracy: currentConversation.custom_fields?.accuracy,
        category: currentConversation.custom_fields?.category,
        tags: currentConversation.tags || [],
        notes: currentConversation.notes || '',
      });
    }
  }, [currentConversation]);

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
            data_filter: conversionConfig.dataFilter,
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

  const handleSaveAnnotation = async () => {
    if (!currentConversation) {
      toast({
        title: '保存失败',
        description: '没有选择要保存的对话',
        variant: 'destructive',
      });
      return;
    }

    // 验证必填字段
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
      // 打印调试信息
      console.log('Current conversation before save:', currentConversation);
      console.log('Original content:', currentConversation?.original_content);

      // 准备V2 API格式的保存数据
      const saveData = {
        dataset_id: currentConversation.dataset_id,
        item_id: currentConversation.id,
        annotation_data: {
          edited_content: currentConversation.edited_content || currentConversation.original_content,
          tags: annotationData.tags || [],
          notes: annotationData.notes || '',
          quality_rating: annotationData.quality_score,
          custom_fields: {
            category: annotationData.category,
            accuracy: annotationData.accuracy,
            annotated_by: 'current_user',
            annotation_time: new Date().toISOString(),
            is_annotated: true
          }
        },
        auto_save: false
      };

      console.log('Save data being sent (V2 format):', JSON.stringify(saveData, null, 2));

      // 保存标注
      const annotationResult = await saveAnnotationMutation.mutateAsync(saveData);
      console.log('Save result:', annotationResult);

      toast({
        title: '保存成功',
        description: `标注已保存到工作副本 ${datasetId.substring(0, 8)}...`,
      });

      // 刷新列表数据
      await queryClient.invalidateQueries({
        queryKey: ['dataset-content', datasetId, currentPage, pageSize]
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

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.total_pages) {
      setCurrentPage(newPage);
      setSelectedIndex(0); // 切换页面时重置选中索引
    }
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(1); // 重置到第一页
    setSelectedIndex(0);
    setSelectedItems(new Set()); // 清空选择
  };

  // 处理项目选择
  const handleItemSelect = (itemId: string, isSelected: boolean) => {
    const newSelected = new Set(selectedItems);
    if (isSelected) {
      newSelected.add(itemId);
    } else {
      newSelected.delete(itemId);
    }
    setSelectedItems(newSelected);
  };

  // 全选/取消全选
  const handleSelectAll = () => {
    if (selectedItems.size === conversations.length) {
      setSelectedItems(new Set());
    } else {
      const allIds = conversations.map(conv => conv.id);
      setSelectedItems(new Set(allIds));
    }
  };

  // 批量标记完成
  const handleBatchMarkComplete = async (markAsAnnotated: boolean) => {
    if (selectedItems.size === 0 && markAsAnnotated) {
      toast({
        title: '提示',
        description: '请先选择要标记的对话',
      });
      return;
    }

    setIsBatchMarking(true);
    try {
      const itemIds = selectedItems.size > 0 ? Array.from(selectedItems) : undefined;
      const result = await batchMarkCompleteMutation.mutateAsync({
        dataset_id: datasetId,
        item_ids: itemIds,
        mark_as_annotated: markAsAnnotated,
      });
      
      toast({
        title: '成功',
        description: result.message,
      });
    } catch (error: any) {
      toast({
        title: '失败',
        description: error.message || '批量标记失败',
        variant: 'destructive',
      });
    } finally {
      setIsBatchMarking(false);
    }
  };

  // 单个标记完成
  const handleMarkComplete = async (itemId: string, markAsAnnotated: boolean) => {
    try {
      await markCompleteMutation.mutateAsync({
        dataset_id: datasetId,
        item_id: itemId,
        mark_as_annotated: markAsAnnotated,
      });
      
      toast({
        title: '成功',
        description: markAsAnnotated ? '已标记为已标注' : '已标记为未标注',
      });
    } catch (error: any) {
      toast({
        title: '失败',
        description: error.message || '标记失败',
        variant: 'destructive',
      });
    }
  };

  const handleContentChange = (updatedContent: any) => {
    if (!currentConversation) return;

    const updatedConversation = {
      ...currentConversation,
      edited_content: updatedContent
    };

    setCurrentConversation(updatedConversation as AnnotationItem);
  };

  const handleToggleDiff = (show: boolean) => {
    setShowDiff(show);
  };

  const handleConversationEdit = (messageIndex: number, field: 'from' | 'value', value: string) => {
    if (!currentConversation) return;

    // 获取当前内容，优先使用edited_content，如果没有则使用original_content
    const currentContent = currentConversation.edited_content || currentConversation.original_content;
    
    // 获取对话数据，支持多种路径
    const conversationData = currentContent?.conversations || 
                           currentContent?.conversation || 
                           currentContent?.messages || [];

    if (!Array.isArray(conversationData)) return;

    // 深拷贝整个数据结构，确保不可变性
    const newConversations = conversationData.map((msg, idx) => {
      if (idx !== messageIndex) return msg;

      // 创建新的消息对象
      const newMessage: any = { ...msg };

      // 根据字段类型更新值
      if (field === 'value') {
        if (msg.value !== undefined) {
          newMessage.value = value;
        } else if (msg.content !== undefined) {
          newMessage.content = value;
        } else if (msg.text !== undefined) {
          newMessage.text = value;
        }
      } else if (field === 'from') {
        if (msg.from !== undefined) {
          newMessage.from = value;
        } else if (msg.role !== undefined) {
          newMessage.role = value;
        }
      }

      return newMessage;
    });

    // 更新状态
    const updatedConversation = {
      ...currentConversation,
      edited_content: {
        ...currentContent,
        conversations: newConversations
      }
    };

    setCurrentConversation(updatedConversation as AnnotationItem);
  };

  const handleContextEdit = (contextIndex: number, field: 'role' | 'content', value: string) => {
    if (!currentConversation) return;

    // 获取当前内容，优先使用edited_content，如果没有则使用original_content
    const currentContent = currentConversation.edited_content || currentConversation.original_content;
    
    // 获取context数据，支持多种路径
    const contextData = currentContent?.context || 
                      currentContent?.contexts || 
                      currentContent?.context_data || [];

    if (!Array.isArray(contextData)) return;

    // 深拷贝整个数据结构，确保不可变性
    const newContext = contextData.map((ctx, idx) => {
      if (idx !== contextIndex) return ctx;

      // 创建新的context对象
      const newContextItem: any = { ...ctx };

      // 根据字段类型更新值
      if (field === 'content') {
        if (ctx.content !== undefined) {
          newContextItem.content = value;
        } else if (ctx.text !== undefined) {
          newContextItem.text = value;
        }
      } else if (field === 'role') {
        if (ctx.role !== undefined) {
          newContextItem.role = value;
        } else if (ctx.from !== undefined) {
          newContextItem.from = value;
        }
      }

      return newContextItem;
    });

    // 更新状态
    const updatedConversation = {
      ...currentConversation,
      edited_content: {
        ...currentContent,
        context: newContext
      }
    };

    setCurrentConversation(updatedConversation as AnnotationItem);
  };

  // 添加复制功能，方便快速复制context或对话内容
  const handleCopyContent = (content: string, type: string) => {
    navigator.clipboard.writeText(content).then(() => {
      // 可以添加一个简单的提示（如Toast）
    });
  };

  // 添加快速导航功能
  const scrollToSection = (section: 'context' | 'conversation') => {
    const element = document.getElementById(section + '-section');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // 键盘快捷键支持
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl+D 切换差异显示
      if (event.ctrlKey && event.key === 'd') {
        event.preventDefault();
        setShowDiff(prev => !prev);
      }
      
      // Ctrl+S 保存标注
      if (event.ctrlKey && event.key === 's') {
        event.preventDefault();
        handleSaveAnnotation();
      }
      
      // Ctrl+A 全选当前页
      if (event.ctrlKey && event.key === 'a') {
        event.preventDefault();
        handleSelectAll();
      }
      
      // Ctrl+M 标记当前选中对话为已标注
      if (event.ctrlKey && event.key === 'm') {
        event.preventDefault();
        if (currentConversation) {
          handleMarkComplete(currentConversation.id, true);
        }
      }
      
      // Ctrl+U 撤销当前选中对话的标注
      if (event.ctrlKey && event.key === 'u') {
        event.preventDefault();
        if (currentConversation) {
          handleMarkComplete(currentConversation.id, false);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [currentConversation]);

  const renderStars = (rating: number | undefined, onRate: (rating: number) => void) => {
    return (
      <div className="flex space-x-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-6 h-6 cursor-pointer ${
              star <= (rating || 0) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'
            }`}
            onClick={() => onRate(star)}
          />
        ))}
      </div>
    );
  };

  if (isLoadingConversations) {
    return <div className="p-8">加载中...</div>;
  }

  // 检查是否为DIALOGUE类型数据
  const isDialogueType = currentConversation?.data_type === 'DIALOGUE' || 
                        currentConversation?.data_type === 'HUMAN_HUMAN_DIALOGUE';

  return (
    <div className="flex h-screen">
      {/* 左侧对话列表 */}
      <div className="w-80 border-r bg-gray-50 flex flex-col">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-lg font-semibold mb-1">对话列表</h2>
              <div className="flex items-center justify-between text-sm text-gray-600">
                <span>第 {pagination.page} 页 / 共 {pagination.total_pages} 页</span>
                <span>共 {pagination.total} 条</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Dialog open={showConversionDialog} onOpenChange={setShowConversionDialog}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                  >
                    <Save className="w-4 h-4 mr-1" />
                    保存为数据集
                  </Button>
                </DialogTrigger>
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
              <Button variant="ghost" size="sm" onClick={onBack || (() => navigate('/annotation'))}>
                <ChevronLeft className="w-4 h-4 mr-1" />
                返回
              </Button>
            </div>
          </div>
          
          {/* 批量操作工具栏 */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
                className="flex items-center gap-1"
                title={selectedItems.size === conversations.length ? "取消全选" : "全选当前页"}
              >
                {selectedItems.size === conversations.length ? (
                  <CheckSquare className="w-4 h-4" />
                ) : (
                  <Square className="w-4 h-4" />
                )}
                全选
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBatchMarkComplete(true)}
                disabled={selectedItems.size === 0 || isBatchMarking}
                className="flex items-center gap-1 bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
                title={selectedItems.size > 0 ? `标记选中的 ${selectedItems.size} 条为已标注` : "请先选择对话"}
              >
                {isBatchMarking ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )}
                {/*标记已标注*/}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBatchMarkComplete(false)}
                disabled={selectedItems.size === 0 || isBatchMarking}
                className="flex items-center gap-1 bg-orange-50 hover:bg-orange-100 text-orange-700 border-orange-200"
                title={selectedItems.size > 0 ? `标记选中的 ${selectedItems.size} 条为未标注` : "请先选择对话"}
              >
                {isBatchMarking ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Square className="w-4 h-4" />
                )}
                {/*标记未标注*/}
              </Button>
            </div>
            <div className="flex items-center gap-4">
              {selectedItems.size > 0 && (
                <span className="text-sm text-gray-600">
                  已选择 {selectedItems.size} 条
                </span>
              )}
              {conversations.length > 0 && (
                <span className="text-sm text-gray-600">
                  标注进度: {conversations.filter(c => c.is_annotated).length}/{conversations.length} 条
                </span>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-2">
            {conversations && Array.isArray(conversations) ? conversations.map((conv, index) => (
              <div
                key={conv.id}
                className={`p-3 rounded-lg cursor-pointer transition-colors ${
                  selectedIndex === index
                    ? 'bg-blue-100 border-blue-300'
                    : 'bg-white hover:bg-gray-100'
                }`}
                onClick={() => setSelectedIndex(index)}
              >
                <div className="flex items-start gap-2">
                  <Checkbox
                    checked={selectedItems.has(conv.id)}
                    onCheckedChange={(checked) => handleItemSelect(conv.id, checked as boolean)}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {(() => {
                        const content = conv.original_content || conv.edited_content;
                        const conversations = content?.conversations || content?.conversation || content?.messages || [];
                        const firstUserMessage = conversations.find((c: any) => c.from === 'user' || c.role === 'user');
                        const previewText = firstUserMessage?.value || firstUserMessage?.content || firstUserMessage?.text || '对话内容';
                        return previewText.length > 50 ? previewText.substring(0, 50) + '...' : previewText;
                      })()}
                    </p>
                    <div className="flex items-center mt-1 space-x-2">
                      {conv.is_annotated ? (
                        <Badge variant="outline" className="text-xs bg-green-100 text-green-800 border-green-300">
                          ✓ 已标注
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs bg-orange-100 text-orange-800 border-orange-300">
                          ○ 未标注
                        </Badge>
                      )}
                      {conv.quality_rating && (
                        <div className="flex">
                          {[...Array(conv.quality_rating)].map((_, i) => (
                            <Star key={i} className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                          ))}
                        </div>
                      )}
                      <Badge variant="outline" className="text-xs">
                        {conv.data_type}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Button
                      variant={conv.is_annotated ? "ghost" : "outline"}
                      size="sm"
                      className={`h-6 px-2 text-xs ${
                        conv.is_annotated
                          ? 'text-orange-600 hover:text-orange-700 hover:bg-orange-50'
                          : 'text-green-600 hover:text-green-700 bg-green-50'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMarkComplete(conv.id, !conv.is_annotated);
                      }}
                      title={conv.is_annotated ? "标记为未标注" : "标记为已标注"}
                    >
                      {conv.is_annotated ? (
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
            )) : <div className="text-center text-gray-500 py-8">暂无对话数据</div>}
          </div>
        </div>
        
        {/* 分页控制 */}
        <div className="p-4 border-t bg-white">
          <div className="flex items-center justify-between mb-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={!pagination.has_previous || isLoadingConversations}
              className="flex items-center"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              上一页
            </Button>
            
            <span className="text-sm text-gray-600">
              {currentPage} / {pagination.total_pages}
            </span>
            
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-6 w-6 p-0"
              title="快捷键：Ctrl+A全选, Ctrl+M标记完成, Ctrl+U撤销, Ctrl+D差异, Ctrl+S保存"
            >
              <HelpCircle className="w-3 h-3" />
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={!pagination.has_next || isLoadingConversations}
              className="flex items-center"
            >
              下一页
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
          
          <div className="flex items-center justify-center">
            <select
              value={pageSize}
              onChange={(e) => handlePageSizeChange(Number(e.target.value))}
              className="text-sm border rounded px-2 py-1"
              disabled={isLoadingConversations}
            >
              <option value={10}>10条/页</option>
              <option value={20}>20条/页</option>
              <option value={50}>50条/页</option>
              <option value={100}>100条/页</option>
            </select>
          </div>
        </div>
      </div>

      {/* 中间内容区域 */}
      <div className="flex-1 flex flex-col h-screen">
        {isLoadingConversations ? (
          <div className="flex-1 flex items-center justify-center">加载中...</div>
        ) : currentConversation ? (
          <div className="flex-1 flex flex-col">
            {/* 顶部数据概览 */}
            <div className="p-4 border-b bg-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <h2 className="text-lg font-semibold">数据标注</h2>
                  <div className="flex items-center space-x-4 text-sm">
                    <Badge variant="outline" className="bg-blue-50">
                      Context: {(() => {
                        const currentContent = currentConversation?.edited_content || currentConversation?.original_content;
                        const contextData = currentContent?.context || 
                                         currentContent?.contexts || 
                                         currentContent?.context_data || [];
                        return Array.isArray(contextData) ? contextData.length : 0;
                      })()} 条
                    </Badge>
                    <Badge variant="outline" className="bg-green-50">
                      对话: {(() => {
                        const currentContent = currentConversation?.edited_content || currentConversation?.original_content;
                        const conversationData = currentContent?.conversations || 
                                               currentContent?.conversation || 
                                               currentContent?.messages || [];
                        return Array.isArray(conversationData) ? conversationData.length : 0;
                      })()} 条
                    </Badge>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {/* 差异显示切换按钮 */}
                  {isDialogueType && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowDiff(!showDiff)}
                      className="flex items-center gap-2"
                      title={showDiff ? "隐藏文本差异" : "显示文本差异"}
                    >
                      {showDiff ? (
                        <>
                          <Eye className="w-4 h-4" />
                          隐藏差异
                        </>
                      ) : (
                        <>
                          <EyeOff className="w-4 h-4" />
                          显示差异
                        </>
                      )}
                    </Button>
                  )}
                  
                  {/* 视图切换按钮 */}
                  {isDialogueType && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowOriginalView(!showOriginalView)}
                      className="flex items-center gap-2"
                    >
                      {showOriginalView ? (
                        <>
                          <Eye className="w-4 h-4" />
                          对话视图
                        </>
                      ) : (
                        <>
                          <EyeOff className="w-4 h-4" />
                          原始视图
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* 主要内容区域 */}
            <div className="flex-1 overflow-hidden">
              {isDialogueType && !showOriginalView ? (
                // 新的对话视图
                <div className="h-full overflow-y-auto p-4">
                  <DialogueAnnotationView
                    annotationItem={currentConversation}
                    onContentChange={handleContentChange}
                    showDiff={showDiff}
                    onToggleDiff={handleToggleDiff}
                  />
                </div>
              ) : (
                // 原始视图
                <div className="flex-1 flex overflow-hidden">
                  {/* Context区域 - 左侧 */}
                  <div className="w-1/2 border-r flex flex-col">
                    <div className="p-3 border-b bg-gray-50">
                      <h3 className="font-medium text-blue-600 flex items-center">
                        <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                        Context 上下文 ({(() => {
                          const currentContent = currentConversation?.edited_content || currentConversation?.original_content;
                          const contextData = currentContent?.context || currentContent?.contexts || currentContent?.context_data || [];
                          return Array.isArray(contextData) ? contextData.length : 0;
                        })()})
                      </h3>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3">
                      {(() => {
                        const currentContent = currentConversation?.edited_content || currentConversation?.original_content;
                        const contextData = currentContent?.context || 
                                          currentContent?.contexts || 
                                          currentContent?.context_data || 
                                          currentContent?.metadata?.context || [];
                        const isValidContext = Array.isArray(contextData) && contextData.length > 0;

                        return isValidContext ? (
                          <div className="space-y-3">
                            {contextData.map((ctx: any, index: number) => {
                              const role = ctx?.role || ctx?.from || 'system';
                              const content = ctx?.content || ctx?.text || ctx?.value || '';
                              
                              return (
                                <div key={`ctx-${index}`} className="border rounded-lg p-3 bg-white hover:shadow-md transition-shadow">
                                  <div className="flex items-center justify-between mb-2">
                                    <Badge variant="outline" className="text-xs">
                                      {role}
                                    </Badge>
                                    <div className="flex items-center space-x-1">
                                      <span className="text-xs text-gray-500">#{index + 1}</span>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-5 w-5 p-0 text-xs"
                                        onClick={() => handleCopyContent(content, 'Context')}
                                        title="复制内容"
                                      >
                                        <Copy className="w-3 h-3" />
                                      </Button>
                                    </div>
                                  </div>
                                  <Textarea
                                    value={content}
                                    onChange={(e) => handleContextEdit(index, 'content', e.target.value)}
                                    className="min-h-[120px] text-sm w-full"
                                    placeholder={`编辑${role}的内容...`}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-center text-gray-500 py-8 text-sm">暂无Context数据</div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* 对话区域 - 右侧 */}
                  <div className="w-1/2 flex flex-col">
                    <div className="p-3 border-b bg-gray-50">
                      <h3 className="font-medium text-green-600 flex items-center">
                        <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                        对话内容 ({(() => {
                          const currentContent = currentConversation?.edited_content || currentConversation?.original_content;
                          const conversationData = currentContent?.conversations || currentContent?.conversation || currentContent?.messages || [];
                          return Array.isArray(conversationData) ? conversationData.length : 0;
                        })()})
                      </h3>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3">
                      {(() => {
                        const currentContent = currentConversation?.edited_content || currentConversation?.original_content;
                        const conversationData = currentContent?.conversations || 
                                               currentContent?.conversation || 
                                               currentContent?.messages || 
                                               currentContent?.dialogue || [];
                        const isValidConversation = Array.isArray(conversationData) && conversationData.length > 0;

                        return isValidConversation ? (
                          <div className="space-y-3">
                            {conversationData.map((conv: any, index: number) => {
                              const from = conv?.from || conv?.role || 'user';
                              const value = conv?.value || conv?.content || conv?.text || '';
                              const isUser = from === 'user' || from === 'human';
                              
                              return (
                                <div key={`conv-${index}`} className="border rounded-lg p-3 bg-white hover:shadow-md transition-shadow">
                                  <div className="flex items-center justify-between mb-2">
                                    <Badge 
                                      variant={isUser ? 'default' : 'secondary'}
                                      className="text-xs"
                                    >
                                      {isUser ? '用户' : '助手'}
                                    </Badge>
                                    <div className="flex items-center space-x-1">
                                      <span className="text-xs text-gray-500">#{index + 1}</span>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-5 w-5 p-0 text-xs"
                                        onClick={() => handleCopyContent(value, '对话')}
                                        title="复制内容"
                                      >
                                        <Copy className="w-3 h-3" />
                                      </Button>
                                    </div>
                                  </div>
                                  <Textarea
                                    value={value}
                                    onChange={(e) => handleConversationEdit(index, 'value', e.target.value)}
                                    className="min-h-[120px] text-sm w-full"
                                    placeholder={`编辑${isUser ? '用户' : '助手'}的消息...`}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-center text-gray-500 py-8 text-sm">暂无对话数据</div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">选择一个对话开始标注</div>
        )}
      </div>

      {/* 右侧标注面板 */}
      <div className="w-96 border-l bg-white overflow-y-auto">
        <div className="p-6 space-y-6">
          <h3 className="text-lg font-semibold">标注信息</h3>
          
          {/* 关联关系快速预览 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">数据关联关系</CardTitle>
            </CardHeader>
            <CardContent className="text-xs">
              <div className="grid grid-cols-1 gap-2">
                <div>
                  <h4 className="font-medium text-sm mb-1 text-blue-600">Context 索引</h4>
                  <div className="space-y-1 max-h-20 overflow-y-auto">
                    {(() => {
                      const currentContent = currentConversation?.edited_content || currentConversation?.original_content;
                      const contextData = currentContent?.context || 
                                       currentContent?.contexts || 
                                       currentContent?.context_data || [];
                      return contextData.map((ctx: any, index: number) => (
                        <div key={`ctx-nav-${index}`} className="flex items-center">
                          <span className="w-4 h-4 bg-blue-500 text-white rounded-full flex items-center justify-center text-[10px] mr-2 flex-shrink-0">
                            {index + 1}
                          </span>
                          <span className="text-gray-600 truncate" title={ctx?.content || ctx?.text || ''}>
                            {(ctx?.content || ctx?.text || '空内容').substring(0, 20)}...
                          </span>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
                <div>
                  <h4 className="font-medium text-sm mb-1 text-green-600">对话轮次</h4>
                  <div className="space-y-1 max-h-20 overflow-y-auto">
                    {(() => {
                      const currentContent = currentConversation?.edited_content || currentConversation?.original_content;
                      const conversationData = currentContent?.conversations || 
                                             currentContent?.conversation || 
                                             currentContent?.messages || [];
                      return conversationData.map((conv: any, index: number) => (
                        <div key={`conv-nav-${index}`} className="flex items-center">
                          <span className={`w-4 h-4 ${conv?.from === 'user' || conv?.role === 'user' ? 'bg-green-500' : 'bg-purple-500'} text-white rounded-full flex items-center justify-center text-[10px] mr-2 flex-shrink-0`}>
                            {index + 1}
                          </span>
                          <span className="text-gray-600 truncate" title={conv?.value || conv?.content || ''}>
                            {(conv?.value || conv?.content || '空内容').substring(0, 20)}...
                          </span>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <div>
            <Label className="mb-2 block">质量评分</Label>
            {renderStars(annotationData.quality_score, (rating) => 
              setAnnotationData({ ...annotationData, quality_score: rating })
            )}
          </div>

          <div>
            <Label className="mb-2 block">回答准确性</Label>
            <Select
              value={annotationData.accuracy}
              onValueChange={(value) => 
                setAnnotationData({ ...annotationData, accuracy: value as any })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="选择准确性" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="correct">完全正确</SelectItem>
                <SelectItem value="partial">部分正确</SelectItem>
                <SelectItem value="incorrect">完全错误</SelectItem>
              </SelectContent>
            </Select>
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
                <SelectItem value="account">账户问题</SelectItem>
                <SelectItem value="transaction">交易问题</SelectItem>
                <SelectItem value="technical">技术问题</SelectItem>
                <SelectItem value="compliance">合规问题</SelectItem>
                <SelectItem value="general">一般咨询</SelectItem>
                <SelectItem value="other">其他</SelectItem>
              </SelectContent>
            </Select>
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
    </div>
  );
};

export default AnnotationPage;