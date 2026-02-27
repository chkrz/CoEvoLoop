import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Star, ChevronLeft, ChevronRight, Users, MessageSquare, ArrowLeft, Save, Loader2, CheckCircle, Square, CheckSquare } from 'lucide-react';
import { annotationApi } from '@/lib/annotationApi';
import { annotationApiV2 } from '@/lib/annotationApiV2';

interface HumanDialogueAnnotationPageProps {
  datasetId: string;
  onBack: () => void;
}

interface HumanDialogueData {
  dialogue_id: string;
  participants: Array<{
    id: string;
    role: string;
    profile?: {
      age?: number;
      gender?: string;
      background?: string;
    };
  }>;
  context: {
    scenario: string;
    location?: string;
    time?: string;
    topic?: string;
  };
  conversation: Array<{
    speaker: string;
    message: string;
    timestamp?: string;
    emotion?: string;
    intent?: string;
  }>;
  metadata?: {
    duration?: number;
    total_messages?: number;
    language?: string;
    quality_score?: number;
  };
}

const HumanDialogueAnnotationPage: React.FC<HumanDialogueAnnotationPageProps> = ({ datasetId, onBack }) => {
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
    naturalness_score: undefined as number | undefined,
    relevance_score: undefined as number | undefined,
    engagement_score: undefined as number | undefined,
    information_quality: undefined as number | undefined,
    conversation_flow: undefined as 'smooth' | 'moderate' | 'poor' | undefined,
    topic_adherence: undefined as 'high' | 'medium' | 'low' | undefined,
    emotional_appropriateness: undefined as number | undefined,
    issues: [] as string[],
    highlights: [] as string[],
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

  // 获取人人对话列表
  const { data: dialoguesData, isLoading: isLoadingDialogues } = useQuery({
    queryKey: ['human-dialogues', datasetId, currentPage, pageSize],
    queryFn: () => annotationApi.getConversations(datasetId, currentPage, pageSize),
    enabled: !!datasetId,
  });

  // 批量标记完成的mutation
  const batchMarkCompleteMutation = useMutation({
    mutationFn: (data: { dataset_id: string; item_ids?: string[]; mark_as_annotated: boolean }) =>
      annotationApiV2.batchMarkComplete(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['human-dialogues', datasetId, currentPage, pageSize] });
      setSelectedItems(new Set());
    },
  });

  // 单个标记完成的mutation
  const markCompleteMutation = useMutation({
    mutationFn: (data: { dataset_id: string; item_id: string; mark_as_annotated: boolean }) =>
      annotationApiV2.markComplete(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['human-dialogues', datasetId, currentPage, pageSize] });
    },
  });

  const dialogues = dialoguesData?.conversations || [];
  const pagination = dialoguesData?.pagination || {
    page: 1,
    page_size: 20,
    total: 0,
    total_pages: 0,
    has_next: false,
    has_previous: false
  };

  const currentDialogue = dialogues[selectedIndex];

  useEffect(() => {
    if (currentDialogue) {
      // 从annotation_data中读取标注信息，支持向后兼容
      const annotationInfo = currentDialogue.annotation_data || {};
      const customFields = annotationInfo.custom_fields || {};
      
      setAnnotationData({
        naturalness_score: customFields.naturalness_score ?? currentDialogue.naturalness_score ?? undefined,
        relevance_score: customFields.relevance_score ?? currentDialogue.relevance_score ?? undefined,
        engagement_score: customFields.engagement_score ?? currentDialogue.engagement_score ?? undefined,
        information_quality: customFields.information_quality ?? currentDialogue.information_quality ?? undefined,
        conversation_flow: customFields.conversation_flow ?? currentDialogue.conversation_flow ?? undefined,
        topic_adherence: customFields.topic_adherence ?? currentDialogue.topic_adherence ?? undefined,
        emotional_appropriateness: customFields.emotional_appropriateness ?? currentDialogue.emotional_appropriateness ?? undefined,
        issues: annotationInfo.tags || currentDialogue.issues || [],
        highlights: customFields.highlights || currentDialogue.highlights || [],
        notes: annotationInfo.notes || currentDialogue.notes || '',
      });
    }
  }, [currentDialogue]);

  const saveAnnotationV2Mutation = useMutation({
    mutationFn: (data: any) => annotationApi.saveAnnotationV2(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['human-dialogues', datasetId, currentPage, pageSize] });
    },
  });

  const handleSaveAnnotation = async () => {
    // 验证必填字段
    if (!currentDialogue) {
      toast({
        title: '保存失败',
        description: '没有选择要保存的人人对话',
        variant: 'destructive',
      });
      return;
    }

    if (!currentDialogue.id) {
      toast({
        title: '保存失败',
        description: '对话ID不能为空',
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
      const saveData = {
        dataset_id: currentDialogue.dataset_id,
        item_id: currentDialogue.id,
        annotation_data: {
          edited_content: currentDialogue.original_data,
          tags: annotationData.issues || [],
          notes: annotationData.notes || '',
          quality_rating: annotationData.naturalness_score || annotationData.relevance_score,
          intent: {
            conversation_purpose: '人人对话评估',
            naturalness_level: annotationData.naturalness_score,
            engagement_level: annotationData.engagement_score
          },
          roles: {
            participant_behavior: '待评估',
            conversation_quality: annotationData.information_quality >= 4 ? 'excellent' :
                                 annotationData.information_quality >= 3 ? 'good' :
                                 annotationData.information_quality >= 2 ? 'fair' : 'poor'
          },
          custom_fields: {
            field_level_annotations: annotationData.field_annotations,
            annotated_by: 'current_user',
            is_annotated: true,
            annotation_time: new Date().toISOString(),
            data_type: 'HUMAN_DIALOGUE'
          }
        },
        auto_save: false
      };

      await saveAnnotationV2Mutation.mutateAsync(saveData);

      toast({
        title: '保存成功',
        description: `对话标注已保存`,
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
    if (selectedItems.size === dialogues.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(dialogues.map(d => d.id)));
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
      <div className="space-y-1">
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

  const renderDialogueData = (rawData: any) => {
    // 安全处理人人对话数据
    const data: HumanDialogueData = {
      dialogue_id: rawData?.dialogue_id || rawData?.id || '未知对话',
      participants: Array.isArray(rawData?.participants) ? rawData.participants : [],
      context: {
        scenario: rawData?.context?.scenario || rawData?.scenario || '未知场景',
        location: rawData?.context?.location || rawData?.location,
        time: rawData?.context?.time || rawData?.time,
        topic: rawData?.context?.topic || rawData?.topic,
      },
      conversation: Array.isArray(rawData?.conversation) ? rawData.conversation : 
                   Array.isArray(rawData?.messages) ? rawData.messages : [],
      metadata: rawData?.metadata || rawData?.meta || {},
    };

    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              人人对话详情
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">对话背景</h4>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-gray-600">场景:</span>
                  <span className="ml-2">{data.context.scenario}</span>
                </div>
                {data.context.location && (
                  <div>
                    <span className="text-gray-600">地点:</span>
                    <span className="ml-2">{data.context.location}</span>
                  </div>
                )}
                {data.context.time && (
                  <div>
                    <span className="text-gray-600">时间:</span>
                    <span className="ml-2">{data.context.time}</span>
                  </div>
                )}
                {data.context.topic && (
                  <div>
                    <span className="text-gray-600">主题:</span>
                    <span className="ml-2">{data.context.topic}</span>
                  </div>
                )}
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-2">参与者</h4>
              <div className="flex flex-wrap gap-2">
                {data.participants.length > 0 ? data.participants.map((participant, idx) => (
                  <Card key={idx} className="p-3">
                    <div className="text-sm">
                      <div className="font-medium">{participant.role || participant.id || `参与者 ${idx + 1}`}</div>
                      {participant.profile && (
                        <div className="text-gray-600 text-xs mt-1">
                          {participant.profile?.age && <div>年龄: {participant.profile.age}</div>}
                          {participant.profile?.gender && <div>性别: {participant.profile.gender}</div>}
                          {participant.profile?.background && <div>背景: {participant.profile.background}</div>}
                        </div>
                      )}
                    </div>
                  </Card>
                )) : <span className="text-gray-400">无参与者信息</span>}
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-2">对话内容</h4>
              <div className="space-y-3">
                {data.conversation.length > 0 ? data.conversation.map((turn, idx) => (
                  <Card key={idx} className="p-3">
                    <div className="flex items-start gap-3">
                      <Badge variant={idx % 2 === 0 ? "default" : "secondary"}>
                        {turn.speaker || turn.role || `说话人 ${idx + 1}`}
                      </Badge>
                      <div className="flex-1">
                        <div className="text-sm">{turn.message || turn.content || turn.text || '无内容'}</div>
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                          {turn.timestamp && <span>{turn.timestamp}</span>}
                          {turn.emotion && (
                            <Badge variant="outline" className="text-xs">
                              {turn.emotion}
                            </Badge>
                          )}
                          {turn.intent && (
                            <Badge variant="outline" className="text-xs">
                              {turn.intent}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                )) : <span className="text-gray-400">无对话内容</span>}
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-2">统计信息</h4>
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">时长:</span>
                  <span className="ml-2">{data.metadata?.duration ? `${data.metadata.duration}分钟` : 'N/A'}</span>
                </div>
                <div>
                  <span className="text-gray-600">消息数:</span>
                  <span className="ml-2">{data.metadata?.total_messages || data.conversation.length || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-gray-600">语言:</span>
                  <span className="ml-2">{data.metadata?.language || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-gray-600">质量分:</span>
                  <span className="ml-2">{data.metadata?.quality_score || 'N/A'}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  if (isLoadingDialogues) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div>加载中...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      {/* 左侧对话列表 */}
      <div className="w-80 border-r bg-gray-50 flex flex-col">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold">人人对话列表</h2>
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
              checked={selectedItems.size === dialogues.length && dialogues.length > 0}
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
              title={selectedItems.size > 0 ? `标记选中的 ${selectedItems.size} 条为已标注` : "请先选择对话"}
            >
              <CheckCircle className="w-3 h-3" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleBatchMarkComplete(false)}
              disabled={selectedItems.size === 0 || isBatchMarking}
              className="h-7 px-2 text-xs bg-orange-50 hover:bg-orange-100 text-orange-700 border-orange-200"
              title={selectedItems.size > 0 ? `标记选中的 ${selectedItems.size} 条为未标注` : "请先选择对话"}
            >
              <Square className="w-3 h-3" />
            </Button>
          </div>
        </div>
        <div className="px-3 py-1 bg-gray-50 text-xs text-gray-600">
          已选择 {selectedItems.size} 条 / 总 {dialogues.length} 条
        </div>
        
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-2">
            {dialogues.map((dialogue, index) => (
              <div
                key={`${dialogue.dataset_id}_${dialogue.sample_index}`}
                className={`p-3 rounded-lg cursor-pointer transition-colors ${
                  selectedIndex === index
                    ? 'bg-orange-100 border-orange-300'
                    : 'bg-white hover:bg-gray-100'
                }`}
                onClick={() => setSelectedIndex(index)}
              >
                <div className="flex items-start gap-2">
                  <Checkbox
                    checked={selectedItems.has(dialogue.id)}
                    onCheckedChange={(checked) => handleItemSelect(dialogue.id, checked as boolean)}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      对话 #{dialogue.sample_index}
                    </p>
                    <div className="text-xs text-gray-500 mt-1">
                      {dialogue.original_data?.context?.scenario || '未知场景'}
                    </div>
                    <div className="flex items-center mt-1 space-x-2">
                      {dialogue.is_annotated ? (
                        <Badge variant="outline" className="text-xs bg-green-100 text-green-800 border-green-300">
                          ✓ 已标注
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs bg-orange-100 text-orange-800 border-orange-300">
                          ○ 未标注
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Button
                      variant={dialogue.is_annotated ? "ghost" : "outline"}
                      size="sm"
                      className={`h-6 px-2 text-xs ${
                        dialogue.is_annotated
                          ? 'text-orange-600 hover:text-orange-700 hover:bg-orange-50'
                          : 'text-green-600 hover:text-green-700 bg-green-50'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMarkComplete(dialogue.id, !dialogue.is_annotated);
                      }}
                      title={dialogue.is_annotated ? "标记为未标注" : "标记为已标注"}
                    >
                      {dialogue.is_annotated ? (
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
            ))}
          </div>
        </div>

        {/* 分页控制 */}
        <div className="p-4 border-t bg-white">
          <div className="flex items-center justify-between mb-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={!pagination.has_previous || isLoadingDialogues}
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
              disabled={!pagination.has_next || isLoadingDialogues}
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
        {currentDialogue ? (
          <div className="space-y-6">
            {renderDialogueData(currentDialogue.original_data as HumanDialogueData)}
          </div>
        ) : (
          <div className="text-center text-gray-500">选择一个对话开始标注</div>
        )}
      </div>

      {/* 右侧标注面板 */}
      <div className="w-96 border-l bg-white overflow-y-auto">
        <div className="p-6 space-y-6">
          <h3 className="text-lg font-semibold">标注信息</h3>
          
          <div className="grid grid-cols-2 gap-4">
            {renderStars(annotationData.naturalness_score, (rating) => 
              setAnnotationData({ ...annotationData, naturalness_score: rating }), '自然度评分')}
            {renderStars(annotationData.relevance_score, (rating) => 
              setAnnotationData({ ...annotationData, relevance_score: rating }), '相关性评分')}
            {renderStars(annotationData.engagement_score, (rating) => 
              setAnnotationData({ ...annotationData, engagement_score: rating }), '参与度评分')}
            {renderStars(annotationData.information_quality, (rating) => 
              setAnnotationData({ ...annotationData, information_quality: rating }), '信息质量评分')}
            {renderStars(annotationData.emotional_appropriateness, (rating) => 
              setAnnotationData({ ...annotationData, emotional_appropriateness: rating }), '情感适当性评分')}
          </div>

          <div>
            <Label className="mb-2 block">对话流畅度</Label>
            <Select
              value={annotationData.conversation_flow}
              onValueChange={(value) => 
                setAnnotationData({ ...annotationData, conversation_flow: value as 'smooth' | 'moderate' | 'poor' })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="选择流畅度" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="smooth">流畅</SelectItem>
                <SelectItem value="moderate">一般</SelectItem>
                <SelectItem value="poor">不流畅</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="mb-2 block">主题一致性</Label>
            <Select
              value={annotationData.topic_adherence}
              onValueChange={(value) => 
                setAnnotationData({ ...annotationData, topic_adherence: value as 'high' | 'medium' | 'low' })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="选择一致性" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="high">高</SelectItem>
                <SelectItem value="medium">中</SelectItem>
                <SelectItem value="low">低</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="mb-2 block">发现的问题</Label>
            <Textarea
              value={annotationData.issues.join(', ')}
              onChange={(e) => 
                setAnnotationData({ ...annotationData, issues: e.target.value.split(',').map(s => s.trim()) })
              }
              placeholder="输入发现的问题，用逗号分隔..."
              className="min-h-[80px]"
            />
          </div>

          <div>
            <Label className="mb-2 block">亮点</Label>
            <Textarea
              value={annotationData.highlights.join(', ')}
              onChange={(e) => 
                setAnnotationData({ ...annotationData, highlights: e.target.value.split(',').map(s => s.trim()) })
              }
              placeholder="输入对话亮点，用逗号分隔..."
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

export default HumanDialogueAnnotationPage;