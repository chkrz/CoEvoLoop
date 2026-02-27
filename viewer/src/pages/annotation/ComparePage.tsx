import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Download, Filter, RefreshCw, GitCompare } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { getDataset, getDatasetRelations, getAnnotationComparison } from "@/lib/datasetApi";
import ComparisonList from "@/components/annotation/ComparisonList";
import SideBySideDiff from "@/components/annotation/SideBySideDiff";

export default function ComparePage() {
  const { datasetId } = useParams<{ datasetId: string }>();
  const navigate = useNavigate();
  const [selectedComparison, setSelectedComparison] = useState<any>(null);
  const [showOnlyChanges, setShowOnlyChanges] = useState(false);

  // 获取数据集详情
  const { data: dataset, isLoading: isLoadingDataset } = useQuery({
    queryKey: ["dataset", datasetId],
    queryFn: () => getDataset(datasetId!),
    enabled: !!datasetId,
  });

  // 获取数据集关联关系
  const { data: relationsData, isLoading: isLoadingRelations } = useQuery({
    queryKey: ["dataset-relations", datasetId],
    queryFn: () => getDatasetRelations(datasetId!),
    enabled: !!datasetId,
  });

  // 获取对比数据
  const { data: comparisonData, isLoading: isLoadingComparison, refetch } = useQuery({
    queryKey: ["annotation-comparison", datasetId],
    queryFn: () => getAnnotationComparison(datasetId!),
    enabled: !!datasetId,
  });

  if (isLoadingDataset || isLoadingRelations || isLoadingComparison) {
    return (
      <div className="min-h-screen flex flex-col bg-background p-6">
        <div className="mb-6">
          <Skeleton className="h-8 w-64 mb-4" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (!dataset || !comparisonData) {
    return (
      <div className="min-h-screen flex flex-col bg-background p-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">数据加载失败</h2>
          <Button onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回
          </Button>
        </div>
      </div>
    );
  }

  const originalDataset = relationsData?.source_datasets?.[0];
  const filteredComparisons = showOnlyChanges 
    ? comparisonData.filter((item: any) => item.has_changes)
    : comparisonData;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="flex-1 p-6">
        {/* 页面标题 */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回
          </Button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <GitCompare className="w-8 h-8" />
                标注数据对比
              </h1>
              <p className="text-muted-foreground mt-1">
                对比数据集：{dataset.name} (ID: {dataset.id})
              </p>
            </div>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                刷新
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowOnlyChanges(!showOnlyChanges)}
              >
                <Filter className="w-4 h-4 mr-2" />
                {showOnlyChanges ? "显示全部" : "仅显示变更"}
              </Button>
            </div>
          </div>
        </div>

        {/* 对比概览 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">对比概览</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">原数据集：</span>
                  <span className="font-medium">{originalDataset?.name || '未知'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">标注数据集：</span>
                  <span className="font-medium">{dataset.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">总条目数：</span>
                  <span className="font-medium">{comparisonData.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">变更条目：</span>
                  <Badge variant={comparisonData.filter((item: any) => item.has_changes).length > 0 ? "destructive" : "secondary"}>
                    {comparisonData.filter((item: any) => item.has_changes).length}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">变更统计</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">新增字段：</span>
                  <Badge variant="default">{comparisonData.filter((item: any) => item.change_type === 'added').length}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">修改字段：</span>
                  <Badge variant="warning">{comparisonData.filter((item: any) => item.change_type === 'modified').length}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">删除字段：</span>
                  <Badge variant="destructive">{comparisonData.filter((item: any) => item.change_type === 'deleted').length}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">操作</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Button 
                  className="w-full" 
                  variant="outline"
                  onClick={() => navigate(`/datasets/${datasetId}`)}
                >
                  查看数据集详情
                </Button>
                <Button 
                  className="w-full" 
                  variant="outline"
                  onClick={() => navigate(`/datasets/${originalDataset?.id}`)}
                  disabled={!originalDataset}
                >
                  查看原数据集
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 对比详情 */}
        <Tabs defaultValue="list" className="w-full">
          <TabsList>
            <TabsTrigger value="list">列表视图</TabsTrigger>
            <TabsTrigger value="sidebyside">并排对比</TabsTrigger>
          </TabsList>
          
          <TabsContent value="list">
            <ComparisonList 
              comparisons={filteredComparisons}
              onSelect={setSelectedComparison}
              selectedId={selectedComparison?.id}
            />
          </TabsContent>
          
          <TabsContent value="sidebyside">
            <SideBySideDiff 
              comparisons={filteredComparisons}
              selectedComparison={selectedComparison}
              onSelect={setSelectedComparison}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}