import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { BookOpen, CheckCircle, Clock, AlertCircle, Star, User, MessageSquare, Users, FileCheck, Save, GitCompare } from 'lucide-react';
import { Label } from '@/components/ui/label';
import AnnotationPage from './AnnotationPage';
import PortraitAnnotationPage from './PortraitAnnotationPage';
import EvaluationAnnotationPage from './EvaluationAnnotationPage';
import HumanDialogueAnnotationPage from './HumanDialogueAnnotationPage';
import { annotationApi } from '@/lib/annotationApi';
import { useNavigate } from 'react-router-dom';

const AnnotationDashboard: React.FC = () => {
  const [selectedDataset, setSelectedDataset] = useState<string>('');
  const [selectedDatasetType, setSelectedDatasetType] = useState<string>('');
  const [showAnnotation, setShowAnnotation] = useState(false);
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

  // 获取数据集列表（直接从API获取）
  const { data: datasets, isLoading: isLoadingDatasets } = useQuery({
    queryKey: ['datasets'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/datasets/');
        if (!response.ok) {
          throw new Error('Failed to fetch datasets');
        }
        const data = await response.json();

        // 返回所有类型的数据集用于标注
        return data.datasets || [];
      } catch (error) {
        console.error('Failed to fetch datasets:', error);
        // 当API失败时返回空数组，不要使用假数据
        return [];
      }
    },
  });

  // 获取标注统计
  const { data: stats, isLoading: isLoadingStats } = useQuery({
    queryKey: ['annotation-stats', selectedDataset],
    queryFn: () => annotationApi.getStats(selectedDataset),
    enabled: !!selectedDataset,
  });

  if (showAnnotation && selectedDataset) {
    const renderAnnotationPage = () => {
      const commonProps = {
        datasetId: selectedDataset,
        onBack: () => setShowAnnotation(false),
      };

      switch (selectedDatasetType) {
        case 'PORTRAIT':
          return <PortraitAnnotationPage {...commonProps} />;
        case 'DIALOGUE':
          return <AnnotationPage {...commonProps} />;
        case 'EVALUATION':
          return <EvaluationAnnotationPage {...commonProps} />;
        case 'HUMAN_HUMAN_DIALOGUE':
          return <HumanDialogueAnnotationPage {...commonProps} />;
        default:
          return <AnnotationPage {...commonProps} />;
      }
    };

    return (
      <div className="h-screen">
        {renderAnnotationPage()}
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">对话数据标注平台</h1>
          <p className="text-gray-600">对生成的对话数据进行质量评估和标注</p>
        </div>

        <div className="grid gap-6">
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
                      onClick={() => setShowAnnotation(true)}
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

        </div>
      </div>
    </div>
  );
};

export default AnnotationDashboard;