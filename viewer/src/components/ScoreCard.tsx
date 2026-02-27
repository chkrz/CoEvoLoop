import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { Badge } from './ui/badge';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface ScoreData {
  [key: string]: number | string;
}

interface ScoreCardProps {
  jsonData: string;
}

const ScoreCard: React.FC<ScoreCardProps> = ({ jsonData }) => {
  const [expanded, setExpanded] = React.useState(false);
  
  let scoreDetail: ScoreData = {};
  let scorerVersion: string | undefined;
  let parseError = false;

  try {
    const parsed = JSON.parse(jsonData);
    scoreDetail = parsed.score_detail || parsed;
    scorerVersion = parsed.scorer_version;
  } catch (error) {
    parseError = true;
  }

  if (parseError || Object.keys(scoreDetail).length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>评分详情 (原始JSON)</CardTitle>
        </CardHeader>
        <CardContent>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '12px' }}>
            {jsonData}
          </pre>
        </CardContent>
      </Card>
    );
  }

  // 根据分数获取颜色类
  const getScoreColor = (score: number | string) => {
    const numScore = typeof score === 'string' ? parseFloat(score) : score;
    if (isNaN(numScore)) return 'bg-gray-100 text-gray-800';
    if (numScore === 0) return 'bg-red-100 text-red-800 border-red-200';
    if (numScore === 1) return 'bg-green-100 text-green-800 border-green-200';
    if (numScore === 2) return 'bg-blue-100 text-blue-800 border-blue-200';
    return 'bg-yellow-100 text-yellow-800 border-yellow-200';
  };

  // 分组评分项
  const scoreEntries = Object.entries(scoreDetail);
  const scoreItems = scoreEntries.filter(([key]) => key.endsWith('_评分'));
  const reasonItems = scoreEntries.filter(([key]) => key.endsWith('_评分理由'));

  // 按评分维度分组
  const groupedScores = scoreItems.reduce((acc, [key, value]) => {
    const dimension = key.split('_')[0]; // 提取维度前缀如 G01, G03 等
    if (!acc[dimension]) acc[dimension] = [];
    const reasonKey = key.replace(/_评分$/, '_评分理由');
    acc[dimension].push({ key, value, reason: scoreDetail[reasonKey] as string });
    return acc;
  }, {} as Record<string, Array<{ key: string; value: number | string; reason?: string }>>);

  return (
    <TooltipProvider>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">评分详情</CardTitle>
              {scorerVersion && (
                <Badge variant="outline" className="text-xs">
                  打分器版本: {scorerVersion}
                </Badge>
              )}
            </div>
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              {expanded ? '收起' : '展开'}
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-4">
            {/* 评分概览 */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
              {scoreItems.map(([key, value]) => {
                const reasonKey = key.replace(/_评分$/, '_评分理由');
                const reason = scoreDetail[reasonKey] as string;
                const label = key.replace(/_评分$/, '').replace(/_/g, ' ');
                
                return (
                  <Tooltip key={key}>
                    <TooltipTrigger>
                      <div className="text-center">
                        <Badge 
                          className={`text-[13px] cursor-help w-full justify-center py-1.5 min-h-[34px] ${getScoreColor(value)}`}
                        >
                          {label}
                        </Badge>
                          <div className="text-sm font-semibold mt-1.5">{String(value)}</div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-sm">
                      <div className="text-xs">
                        <div className="font-medium mb-1">{label}</div>
                        <div>{reason || '暂无评分理由'}</div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>

            {/* 详细评分理由 */}
            {expanded && (
              <div className="border-t pt-4">
                <h4 className="text-sm font-medium mb-3">详细评分理由</h4>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {reasonItems.map(([key, value]) => {
                    const scoreKey = key.replace(/_评分理由$/, '_评分');
                    const score = scoreDetail[scoreKey];
                    const label = key.replace(/_评分理由$/, '').replace(/_/g, ' ');
                    
                    return (
                      <div key={key} className="border rounded-lg p-3 bg-gray-50">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className={`text-xs ${getScoreColor(score || 0)}`}>
                            {score || 'N/A'}
                          </Badge>
                          <span className="text-sm font-medium">{label}</span>
                        </div>
                        <p className="text-xs text-gray-700 leading-relaxed">
                          {String(value)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
};

export default ScoreCard;