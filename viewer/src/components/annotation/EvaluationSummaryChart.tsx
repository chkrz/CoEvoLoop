import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import ScoreCard from '@/components/ScoreCard';

interface EvaluationSummaryChartProps {
  evaluationData: Record<string, any>;
  className?: string;
}

// 直接从DatasetDetail.tsx复用的渲染函数
const renderPortraitList = (items?: string[]) => {
  if (!items || items.length === 0) {
    return <p className="text-sm text-muted-foreground">暂无</p>;
  }
  return (
    <ul className="list-disc list-inside mt-2 space-y-1">
      {items.map((item, idx) => (
        <li key={idx} className="text-sm text-muted-foreground">{item}</li>
      ))}
    </ul>
  );
};

const EvaluationSummaryChart: React.FC<EvaluationSummaryChartProps> = ({ 
  evaluationData, 
  className 
}) => {
  // 复用DatasetDetail中的质量评估展示逻辑
  const formatScore = (score: number) => (score * 100).toFixed(1);
  
  const getScoreColor = (score: number) => {
    if (score >= 0.8) return 'text-green-600';
    if (score >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  // 计算统计信息
  const scoreEntries = Object.entries(evaluationData).filter(([_, value]) => typeof value === 'number');
  const averageScore = scoreEntries.length > 0 
    ? scoreEntries.reduce((sum, [, value]) => sum + (value as number), 0) / scoreEntries.length 
    : 0;
  const passedCount = scoreEntries.filter(([, value]) => (value as number) >= 0.8).length;
  const passRate = scoreEntries.length > 0 ? (passedCount / scoreEntries.length) * 100 : 0;

  return (
    <Card className={className}>
      <CardContent className="space-y-6">
        {/* 复用DatasetDetail中的质量评估得分概览布局 */}
        {/* 评估结果展示 - 去掉统计信息，只保留评估结果 */}
        <div>
          {evaluationData ? (
            <ScoreCard jsonData={JSON.stringify(evaluationData)} />
          ) : (
            <div className="text-sm text-muted-foreground">暂无评估结果</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default EvaluationSummaryChart;