import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import {
  ChevronLeft,
  Download,
  ArrowLeftRight,
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
  PieChart,
  BarChart2
} from 'lucide-react';
import { datasetApi, DatasetRecord } from '@/lib/datasetApi';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';

interface DatasetComparisonPageProps {
  originalDatasetId?: string;
  annotatedDatasetId?: string;
}

interface ComparisonData {
  original: DatasetRecord;
  annotated: DatasetRecord;
  differences: Array<{
    sample_index: number;
    original_item: any;
    annotated_item: any;
    differences: string[];
    quality_score?: number;
    accuracy?: string;
    category?: string;
  }>;
  summary: {
    total_items: number;
    modified_items: number;
    added_items: number;
    removed_items: number;
    quality_improvements: number;
    accuracy_distribution: { [key: string]: number };
    category_changes: { [key: string]: { from: string; to: string; count: number } };
  };
}

const DatasetComparisonPage: React.FC<DatasetComparisonPageProps> = ({
  originalDatasetId,
  annotatedDatasetId
}) => {
  const { originalId = originalDatasetId, annotatedId = annotatedDatasetId } = useParams();
  const navigate = useNavigate();
  const [selectedTab, setSelectedTab] = useState<string>('overview');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);

  const {
    data: originalDataset,
    isLoading: isLoadingOriginal,
  } = useQuery({
    queryKey: ['dataset', originalId],
    queryFn: () => datasetApi.getDataset(originalId!),
    enabled: !!originalId,
  });

  const {
    data: annotatedDataset,
    isLoading: isLoadingAnnotated,
  } = useQuery({
    queryKey: ['dataset', annotatedId],
    queryFn: () => datasetApi.getDataset(annotatedId!),
    enabled: !!annotatedId,
  });

  const {
    data: comparisonData,
    isLoading: isLoadingComparison,
  } = useQuery<ComparisonData>({
    queryKey: ['dataset-comparison', originalId, annotatedId],
    queryFn: () => datasetApi.compareDatasets(originalId!, annotatedId!),
    enabled: !!originalId && !!annotatedId,
  });

  // Pagination calculations
  const totalPages = Math.ceil((comparisonData?.differences.length || 0) / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentPageData = comparisonData?.differences.slice(startIndex, endIndex) || [];

  // Generate enhanced mock data for demo
  useEffect(() => {
    if (!comparisonData && originalDataset && annotatedDataset) {
      // Set null to trigger mock data from API
      console.log('Generating enhanced comparison data...');
    }
  }, [comparisonData, originalDataset, annotatedDataset]);

  const getAccuracyIcon = (accuracy: string) => {
    switch (accuracy) {
      case 'correct':
        return { icon: <TrendingUp className="w-4 h-4" />, color: 'text-green-600', bgColor: 'bg-green-50' };
      case 'partial':
        return { icon: <Minus className="w-4 h-4" />, color: 'text-yellow-600', bgColor: 'bg-yellow-50' };
      case 'incorrect':
        return { icon: <TrendingDown className="w-4 h-4" />, color: 'text-red-600', bgColor: 'bg-red-50' };
      default:
        return { icon: null, color: 'text-gray-600', bgColor: 'bg-gray-50' };
    }
  };

  const getQualityStars = (score: number) => {
    return Array(5).fill(null).map((_, i) => (
      <span
        key={i}
        className={`text-sm ${i < score ? 'text-yellow-400' : 'text-gray-300'}`}
      >
        ★
      </span>
    ));
  };

  const handleExport = () => {
    if (!comparisonData) return;

    const exportData = {
      originalDataset: comparisonData.original,
      annotatedDataset: comparisonData.annotated,
      summary: comparisonData.summary,
      exportTime: new Date().toISOString(),
      itemsHighlighted: currentPageData.length,
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportFileDefaultName = `dataset_comparison_${originalId}_${annotatedId}_${Date.now()}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const renderOverviewTab = () => (
    <div className="space-y-6">
      {/* 摘要信息 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            对比摘要
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-3xl font-bold text-blue-600">
                {comparisonData?.summary.total_items || 0}
              </div>
              <div className="text-sm text-gray-600">总条目数</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-3xl font-bold text-green-600">
                {Math.round(((comparisonData?.summary.modified_items || 0) / (comparisonData?.summary.total_items || 1)) * 100)}%
              </div>
              <div className="text-sm text-gray-600">修改率</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-3xl font-bold text-purple-600">
                {comparisonData?.summary.quality_improvements || 0}
              </div>
              <div className="text-sm text-gray-600">质量提升</div>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <div className="text-3xl font-bold text-orange-600">
                {comparisonData?.summary.accuracy_distribution.correct || 0}
              </div>
              <div className="text-sm text-gray-600">完全正确</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 数据集基本信息 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="text-blue-500">原始数据集</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">名称:</span>
                <span className="font-medium">{originalDataset?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">类型:</span>
                <Badge>{originalDataset?.data_type}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">创建时间:</span>
                <span>{originalDataset?.created_at ? new Date(originalDataset.created_at).toLocaleDateString() : 'N/A'}</span>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="text-green-500">标注后数据集</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">名称:</span>
                <span className="font-medium">{annotatedDataset?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">类型:</span>
                <Badge>{annotatedDataset?.data_type}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">创建时间:</span>
                <span>{annotatedDataset?.created_at ? new Date(annotatedDataset.created_at).toLocaleDateString() : 'N/A'}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderDetailedComparisonTab = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>详细对比数据</span>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{comparisonData?.differences.length || 0} 条差异</Badge>
              <Badge variant="outline">{currentPageData.length} 条/页</Badge>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">序号</TableHead>
                  <TableHead className="w-32">原数据</TableHead>
                  <TableHead className="w-32">标注后</TableHead>
                  <TableHead className="w-24">质量评分</TableHead>
                  <TableHead className="w-24">准确性</TableHead>
                  <TableHead className="min-w-[300px]">差异说明</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentPageData.map((item, index) => {
                  const accuracyInfo = getAccuracyIcon(item.accuracy || 'none');
                  return (
                    <TableRow key={index}>
                      <TableCell className="font-medium text-center">
                        {item.sample_index}
                      </TableCell>
                      <TableCell>
                        <pre className="text-xs whitespace-pre-wrap max-h-20 overflow-y-auto p-2 bg-gray-50 rounded">
                          {item.original_item ? JSON.stringify(item.original_item, null, 2).substring(0, 100) : 'N/A'}...
                        </pre>
                      </TableCell>
                      <TableCell>
                        <pre className="text-xs whitespace-pre-wrap max-h-20 overflow-y-auto p-2 bg-green-50 rounded">
                          {item.annotated_item ? JSON.stringify(item.annotated_item, null, 2).substring(0, 100) : 'N/A'}...
                        </pre>
                      </TableCell>
                      <TableCell>
                        <div className="flex">
                          {getQualityStars(item.quality_score || 0)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={`${accuracyInfo.color} ${accuracyInfo.bgColor} border-0 px-2 py-1`}>
                          <div className="flex items-center gap-1">
                            {accuracyInfo.icon}
                            {item.accuracy === 'correct' ? '正确' : item.accuracy === 'partial' ? '部分' : '错误'}
                          </div>
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {item.differences.map((diff, i) => (
                            <Badge key={i} variant="outline" className="text-xs mr-1">
                              {diff}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>

          {/* Pagination */}
          <div className="flex items-center justify-between py-4">
            <div className="text-sm text-gray-600">
              显示第 {startIndex + 1} - {Math.min(endIndex, comparisonData?.differences.length || 0)} 条，
              共 {comparisonData?.differences.length || 0} 条
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                上一页
              </Button>
              <div className="text-sm px-2">
                第 {currentPage} / {totalPages} 页
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                下一页
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderStatsTab = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChart className="w-5 h-5" />
            准确性分布对比
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Object.entries(comparisonData?.summary.accuracy_distribution || {}).map(([key, count]) => {
              const accuracyInfo = getAccuracyIcon(key);
              const total = comparisonData?.summary.total_items || 1;
              const percentage = Math.round((count / total) * 100);
              return (
                <div key={key} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {accuracyInfo.icon}
                      <span className="capitalize">{key === 'correct' ? '完全正确' : key === 'partial' ? '部分正确' : '完全错误'}</span>
                    </div>
                    <span className="font-medium">{count} ({percentage}%)</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        key === 'correct' ? 'bg-green-500' :
                        key === 'partial' ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  if (isLoadingOriginal || isLoadingAnnotated || isLoadingComparison) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>正在加载对比数据...</p>
        </div>
      </div>
    );
  }

  if (!comparisonData || !originalDataset || !annotatedDataset) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">无法加载对比数据</p>
          <Button onClick={() => navigate(-1)}>
            返回
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">数据集对比分析</h1>
          <p className="text-gray-600">
            {originalDataset.name} vs {annotatedDataset.name}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleExport} className="gap-2">
            <Download className="w-4 h-4" />
            导出对比报告
          </Button>
          <Button variant="outline" onClick={() => navigate(-1)} className="gap-2">
            <ChevronLeft className="w-4 h-4" />
            返回
          </Button>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview" className="gap-2">
            <BarChart3 className="w-4 h-4" />
            对比摘要
          </TabsTrigger>
          <TabsTrigger value="detailed" className="gap-2">
            <ArrowLeftRight className="w-4 h-4" />
            详细对比
          </TabsTrigger>
          <TabsTrigger value="stats" className="gap-2">
            <PieChart className="w-4 h-4" />
            统计分析
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <TabsContent value="overview">
            {renderOverviewTab()}
          </TabsContent>
          <TabsContent value="detailed">
            {renderDetailedComparisonTab()}
          </TabsContent>
          <TabsContent value="stats">
            {renderStatsTab()}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};

export default DatasetComparisonPage;