import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BookOpen, CheckCircle, Clock, AlertCircle, Star, User, MessageSquare, Users, FileCheck, Save, GitCompare, Play, RotateCcw } from 'lucide-react';
import { Label } from '@/components/ui/label';
import AnnotationPage from './AnnotationPage';
import PortraitAnnotationPage from './PortraitAnnotationPage';
import EvaluationAnnotationPage from './EvaluationAnnotationPage';
import HumanDialogueAnnotationPage from './HumanDialogueAnnotationPage';
import { annotationApiFileBased } from '@/lib/annotationApiFileBased';
import { annotationApiV2 } from '@/lib/annotationApiV2';
import { useNavigate } from 'react-router-dom';

const AnnotationDashboardNew: React.FC = () => {
  const [selectedDataset, setSelectedDataset] = useState<string>('');
  const [selectedDatasetType, setSelectedDatasetType] = useState<string>('');
  const navigate = useNavigate();

  const typeLabels: Record<string, string> = {
    PORTRAIT: '用户画像',
    DIALOGUE: '对话合成',
    EVALUATION: '质量评估',
    HUMAN_HUMAN_DIALOGUE: '人人对话',
  };

  const typeColors: Record<string, string> = {
    PORTRAIT: 'bg-purple-100 text-purple-800',
    DIALOGUE: 'bg-blue-100 text-blue-800',
    EVALUATION: 'bg-green-100 text-green-800',
    HUMAN_HUMAN_DIALOGUE: 'bg-orange-100 text-orange-800',
  };

  const typeIcons: Record<string, React.ReactNode> = {
    PORTRAIT: <User className="w-4 h-4" />,
    DIALOGUE: <MessageSquare className="w-4 h-4" />,
    EVALUATION: <FileCheck className="w-4 h-4" />,
    HUMAN_HUMAN_DIALOGUE: <Users className="w-4 h-4" />,
  };

  // 获取所有数据集（用于开始标注）
  const { data: datasets, isLoading: isLoadingDatasets } = useQuery({
    queryKey: ['datasets'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/datasets/');
        if (!response.ok) {
          throw new Error('Failed to fetch datasets');
        }
        const data = await response.json();
        return data.datasets || [];
      } catch (error) {
        console.error('Failed to fetch datasets:', error);
        return [];
      }
    },
  });

  // 获取正在标注的数据集（用于继续标注）
  const { data: inProgressDatasetsData, isLoading: isLoadingInProgress } = useQuery({
    queryKey: ['in-progress-annotations'],
    queryFn: async () => {
      try {
        // 使用 v2 接口获取已标注的数据集
        const { datasets } = await annotationApiV2.getAnnotatedDatasets();

        // 转换数据格式以兼容现有UI
        return datasets.map(dataset => ({
          dataset_id: dataset.dataset_id,
          dataset_name: dataset.dataset_name,
          data_type: dataset.data_type,
          item_count: dataset.item_count,
          total_items: dataset.item_count, // 添加total_items字段保持兼容
          annotated_items: dataset.annotated_items || 0,
          progress: dataset.progress || 0,
          last_updated: dataset.last_updated,
          copy_path: dataset.copy_path
        }));
      } catch (error) {
        console.error('Failed to fetch annotated datasets:', error);
        return [];
      }
    },
  });

  // 为了保持向后兼容，确保inProgressDatasets变量存在
  const inProgressDatasets = inProgressDatasetsData || [];

  // 获取标注统计
  const { data: stats, isLoading: isLoadingStats } = useQuery({
    queryKey: ['annotation-stats', selectedDataset],
    queryFn: () => annotationApiFileBased.getStats(selectedDataset),
    enabled: !!selectedDataset,
  });



  return (
    <div className="container mx-auto p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">对话数据标注平台</h1>
          <p className="text-gray-600">对生成的对话数据进行质量评估和标注</p>
        </div>

        <Tabs defaultValue="continue" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="continue" className="flex items-center gap-2">
              <RotateCcw className="w-4 h-4" />
              继续标注
            </TabsTrigger>
            <TabsTrigger value="start" className="flex items-center gap-2">
              <Play className="w-4 h-4" />
              开始标注
            </TabsTrigger>
          </TabsList>

          {/* 继续标注标签页 */}
          <TabsContent value="continue" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>正在标注的数据集</CardTitle>
                <p className="text-sm text-gray-600">选择一个已开始标注的数据集继续工作</p>
              </CardHeader>
              <CardContent>
                {isLoadingInProgress ? (
                  <div className="text-center py-8">加载中...</div>
                ) : inProgressDatasets && Array.isArray(inProgressDatasets) && inProgressDatasets.length > 0 ? (
                  <div className="space-y-4">
                    {inProgressDatasets.map((dataset: any) => (
                      <div key={dataset.dataset_id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex-1">
                            <h3 className="font-medium text-lg">{dataset.dataset_name}</h3>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge className={typeColors[dataset.data_type] || 'bg-gray-100 text-gray-800'}>
                                <div className="flex items-center gap-1">
                                  {typeIcons[dataset.data_type]}
                                  {typeLabels[dataset.data_type] || dataset.data_type}
                                </div>
                              </Badge>
                              <span className="text-sm text-gray-500">
                                ID: {dataset.dataset_id.substring(0, 8)}...
                              </span>
                            </div>
                          </div>
                           <Button
                            onClick={() => {
                              navigate(`/annotation/workspace/${dataset.dataset_id}`);
                            }}
                          >
                            继续标注
                          </Button>
                        </div>

                        {/* 进度信息 */}
                        <div className="grid grid-cols-3 gap-4 mb-3">
                          <div className="text-center">
                            <div className="text-xl font-bold">{dataset.annotated_items}</div>
                            <div className="text-sm text-gray-600">已标注</div>
                          </div>
                          <div className="text-center">
                            <div className="text-xl font-bold">{dataset.total_items}</div>
                            <div className="text-sm text-gray-600">总样本</div>
                          </div>
                          <div className="text-center">
                            <div className="text-xl font-bold text-blue-600">{Math.round(dataset.progress)}%</div>
                            <div className="text-sm text-gray-600">完成度</div>
                          </div>
                        </div>

                        {/* 进度条 */}
                        <div className="mb-2">
                          <div className="flex justify-between text-sm mb-1">
                            <span>标注进度</span>
                            <span>{Math.round(dataset.progress)}%</span>
                          </div>
                          <Progress value={dataset.progress} />
                        </div>

                        {/* 最后更新时间 */}
                        <div className="text-xs text-gray-500">
                          最后更新: {dataset.last_updated ? new Date(dataset.last_updated).toLocaleString() : '未知'}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <RotateCcw className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>暂无正在标注的数据集</p>
                    <p className="text-sm mt-2">请切换到"开始标注"标签页创建新的标注任务</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* 开始标注标签页 - 使用原有逻辑 */}
          <TabsContent value="start" className="space-y-6">
            {/* 数据类型统计 */}
            {datasets && datasets.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>数据类型分布</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.entries(typeLabels).map(([type, label]) => {
                      const count = datasets.filter((d: any) => d.data_type === type).length;
                      return (
                        <div key={type} className="text-center">
                          <div className={`inline-flex items-center justify-center w-12 h-12 rounded-full ${typeColors[type].replace('text-', 'bg-').replace('-800', '-500')} mb-2`}>
                            <div className="text-white">
                              {typeIcons[type]}
                            </div>
                          </div>
                          <div className="text-2xl font-bold">{count}</div>
                          <div className="text-sm text-gray-600">{label}</div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 数据集选择 */}
            <Card>
              <CardHeader>
                <CardTitle>选择数据集</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label className="mb-2 block">数据集</Label>
                    <Select
                      value={selectedDataset}
                      onValueChange={(value) => {
                        setSelectedDataset(value);
                        const dataset = datasets?.find((d: any) => d.id === value);
                        setSelectedDatasetType(dataset?.data_type || '');
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="选择要标注的数据集" />
                      </SelectTrigger>
                      <SelectContent>
                        {isLoadingDatasets ? (
                          <SelectItem value="loading">加载中...</SelectItem>
                        ) : datasets && Array.isArray(datasets) && datasets.length > 0 ? (
                          datasets.filter((d: any) => d.id && d.id !== '').map((dataset: any) => (
                            <SelectItem key={dataset.id} value={dataset.id}>
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <div className="font-medium">{dataset.name}</div>
                                  <div className="text-xs text-gray-500">
                                    {dataset.file_count || dataset.sample_count || 0} 条样本
                                  </div>
                                </div>
                                <Badge className={`ml-2 ${typeColors[dataset.data_type] || 'bg-gray-100 text-gray-800'}`}>
                                  <div className="flex items-center gap-1">
                                    {typeIcons[dataset.data_type]}
                                    {typeLabels[dataset.data_type] || dataset.data_type}
                                  </div>
                                </Badge>
                              </div>
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="no-data">暂无数据集</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedDataset && (
                    <Button
                      onClick={() => {
                        if (selectedDataset) {
                          navigate(`/annotation/workspace/${selectedDataset}`);
                        }
                      }}
                      disabled={!selectedDataset}
                      className="w-full"
                    >
                      <BookOpen className="w-4 h-4 mr-2" />
                      开始标注
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

          </TabsContent>
        </Tabs>

      </div>
    </div>
  );
};

export default AnnotationDashboardNew;