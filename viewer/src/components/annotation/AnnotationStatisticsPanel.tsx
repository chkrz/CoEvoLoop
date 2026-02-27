import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { annotationApiV2 } from '@/lib/annotationApiV2';

interface AnnotationStatisticsPanelProps {
  datasetId: string;
  onRefresh?: () => void;
}

export const AnnotationStatisticsPanel: React.FC<AnnotationStatisticsPanelProps> = ({
  datasetId,
  onRefresh
}) => {
  const { data: stats, isLoading, refetch } = useQuery({
    queryKey: ['annotation-statistics', datasetId],
    queryFn: () => annotationApiV2.getAnnotationStatistics(datasetId),
    enabled: !!datasetId,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const handleRefresh = () => {
    refetch();
    onRefresh?.();
  };

  // 检查字段是否存在且有效
  const hasValidScore = (value: any) => {
    return value !== undefined && value !== null && value >= 0;
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.8) return 'text-green-600';
    if (score >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getKappaLevel = (score: number) => {
    if (score >= 0.8) return '高度一致';
    if (score >= 0.6) return '中等一致';
    if (score >= 0.4) return '一般一致';
    return '一致性差';
  };

  const getTuringLevel = (score: number) => {
    if (score >= 90) return '高度通过';
    if (score >= 75) return '良好通过';
    if (score >= 60) return '基本通过';
    return '未通过';
  };

  const formatKappaScore = (score: number) => {
    return (score).toFixed(3);
  };

  const formatTuringScore = (score: number) => {
    return (score).toFixed(3);
  };

  const formatAssistantScore = (score: number) => {
    return (score).toFixed(3);
  };

  if (isLoading) {
    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">标注统计信息</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-8 w-16" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stats) {
    return null;
  }

  // 检查是否有任何有效分数
  const hasAnyValidScore = hasValidScore(stats.assistant_model_score) || 
                          hasValidScore(stats.turing_score) || 
                          hasValidScore(stats.kappa_score);

  if (!hasAnyValidScore) {
    return null;
  }

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">标注统计信息</CardTitle>
          {hasValidScore(stats.total_annotations) && stats.total_annotations > 0 && (
            <div className="flex items-center space-x-2">
              <Badge variant="outline" className="text-sm">
                总计: {stats.total_annotations} 条
              </Badge>
              <button
                onClick={handleRefresh}
                className="text-sm text-blue-600 hover:text-blue-800 cursor-pointer"
              >
                刷新
              </button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Assistant Model Score */}
          {hasValidScore(stats.assistant_model_score) && (
            <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="text-center">
                <div className="text-2xl font-bold mb-1">
                  <span className={getScoreColor(parseFloat(formatAssistantScore(stats.assistant_model_score)))}>
                    {formatAssistantScore(stats.assistant_model_score)}
                  </span>
                </div>
                <div className="text-sm font-medium text-gray-700 mb-2">Assistant Model Score</div>
                {/*{hasValidScore(stats.total_annotations) && stats.total_annotations > 0 && (*/}
                {/*  <div className="text-xs text-gray-500">*/}
                {/*    优质率：{Math.round(stats.assistant_model_score * stats.total_annotations / 100)}/{stats.total_annotations}*/}
                {/*  </div>*/}
                {/*)}*/}
              </div>
            </div>
          )}

          {/* Turing Score */}
          {hasValidScore(stats.turing_score) && (
            <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="text-center">
                <div className="text-2xl font-bold mb-1">
                  <span className={getScoreColor(parseFloat(formatTuringScore(stats.turing_score)))}>
                    {formatTuringScore(stats.turing_score)}
                  </span>
                </div>
                <div className="text-sm font-medium text-gray-700 mb-2">Turing Score</div>
                {/*<div className="text-xs text-gray-500">*/}
                {/*  图灵测试评分：{getTuringLevel(stats.turing_score)}*/}
                {/*</div>*/}
              </div>
            </div>
          )}

          {/* Kappa Score */}
          {hasValidScore(stats.kappa_score) && (
            <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="text-center">
                <div className="text-2xl font-bold mb-1">
                  <span className={getScoreColor(stats.kappa_score)}>
                    {formatKappaScore(stats.kappa_score)}
                  </span>
                </div>
                <div className="text-sm font-medium text-gray-700 mb-2">Kappa Score</div>
                {/*<div className="text-xs text-gray-500">*/}
                {/*  一致性评分：{getKappaLevel(parseFloat(formatKappaScore(stats.kappa_score)))}*/}
                {/*</div>*/}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};