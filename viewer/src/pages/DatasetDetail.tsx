import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  getDataset,
  getDatasetPreview,
  getDatasetDownloadUrl,
  getDatasetRelations,
  type DatasetType,
  type DatasetRecord,
} from "@/lib/datasetApi";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Download, RefreshCw, Database, Edit } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import ScoreCard from "@/components/ScoreCard";

const typeLabels: Record<DatasetType, string> = {
  PORTRAIT: "用户画像",
  DIALOGUE: "对话合成",
  EVALUATION: "质量评估",
  HUMAN_HUMAN_DIALOGUE: "人人对话",
};

const sourceLabels = {
  TASK: "任务生成",
  UPLOAD: "手动上传",
} as const;

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

export default function DatasetDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: dataset, isLoading } = useQuery({
    queryKey: ["dataset", id],
    queryFn: () => getDataset(id!),
    enabled: !!id,
  });

const { data: previewData, isLoading: isLoadingPreview } = useQuery({
    queryKey: ["dataset-preview", id],
    queryFn: () => getDatasetPreview(id!, 10),
    enabled: !!id,
  });

  // 获取数据集关联关系
  const { data: relationsData, isLoading: isLoadingRelations } = useQuery({
    queryKey: ["dataset-relations", id],
    queryFn: () => getDatasetRelations(id!),
    enabled: !!id,
  });

  const handleDownload = () => {
    if (dataset) {
      const url = getDatasetDownloadUrl(dataset.id);
      window.location.href = url;
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-background p-6">
        <Skeleton className="h-8 w-64 mb-6" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!dataset) {
    return (
      <div className="min-h-screen flex flex-col bg-background p-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">数据集不存在</h2>
          <Button onClick={() => navigate("/datasets")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回列表
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="flex-1 p-6">
        {/* 页面标题 */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate("/datasets")}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回列表
          </Button>
<div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Database className="w-8 h-8" />
                {dataset.name}
              </h1>
              <p className="text-muted-foreground mt-1">数据集 ID: {dataset.id}</p>
            </div>
            <div className="flex space-x-2">
              <Button
                onClick={() => navigate(`/datasets/${dataset.id}/convert`)}
                variant="outline"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                转换为数据集
              </Button>
              <Button
                onClick={() => navigate(`/annotation/v2/${dataset.id}`)}
                variant="outline"
              >
                <Edit className="w-4 h-4 mr-2" />
                开始标注
              </Button>
              <Button onClick={handleDownload}>
                <Download className="w-4 h-4 mr-2" />
                下载数据集
              </Button>
            </div>
          </div>
        </div>

        {/* 基本信息卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <Card>
            <CardHeader>
              <CardTitle>基本信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">数据类型：</span>
                <Badge variant="outline">{typeLabels[dataset.data_type]}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">数据来源：</span>
                <Badge variant={dataset.source === "TASK" ? "default" : "secondary"}>
                  {sourceLabels[dataset.source as keyof typeof sourceLabels]}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">文件格式：</span>
                <span className="font-mono text-sm">{dataset.file_format}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">创建时间：</span>
                <span className="text-sm">{formatDate(dataset.created_at)}</span>
              </div>
              {dataset.description && (
                <div className="pt-2 border-t">
                  <span className="text-sm text-muted-foreground">描述：</span>
                  <p className="text-sm mt-1">{dataset.description}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>统计信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">总条目数：</span>
                <span className="text-2xl font-bold">{(dataset.item_count ?? 0).toLocaleString()}</span>
              </div>
              {dataset.size_bytes && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">文件大小：</span>
                  <span className="font-medium">
                    {(dataset.size_bytes / 1024 / 1024).toFixed(2)} MB
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">文件名：</span>
                <span className="text-xs font-mono text-muted-foreground break-all">
                  {dataset.file_name}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 质量评估得分概览 */}
        {dataset.data_type === 'EVALUATION' && (dataset.evaluation_stats || dataset.kappa_score !== undefined || dataset.turing_score !== undefined) && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>质量评估得分概览</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {dataset.evaluation_stats && (
                  <div className="flex flex-col p-4 bg-muted rounded-lg">
                    <span className="text-sm text-muted-foreground mb-1">AssistantModel 得分</span>
                    <span className={`text-2xl font-bold ${dataset.evaluation_stats.pass_rate >= 80 ? 'text-green-600' : dataset.evaluation_stats.pass_rate >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {dataset.evaluation_stats.pass_rate.toFixed(1)}%
                    </span>
                    <span className="text-xs text-muted-foreground mt-1">
                      优质率：{dataset.evaluation_stats.passed_count}/{dataset.evaluation_stats.total_evaluated}
                    </span>
                  </div>
                )}
                {dataset.turing_score !== undefined && (
                  <div className="flex flex-col p-4 bg-muted rounded-lg">
                    <span className="text-sm text-muted-foreground mb-1">Turing Score</span>
                    <span className={`text-2xl font-bold ${dataset.turing_score >= 0.8 ? 'text-green-600' : dataset.turing_score >= 0.6 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {dataset.turing_score.toFixed(3)}
                    </span>
                    <span className="text-xs text-muted-foreground mt-1">
                      图灵测试评分：{dataset.turing_score >= 0.8 ? '高度通过' : dataset.turing_score >= 0.6 ? '中等通过' : '通过率较低'}
                    </span>
                  </div>
                )}
                {dataset.kappa_score !== undefined && (
                  <div className="flex flex-col p-4 bg-muted rounded-lg">
                    <span className="text-sm text-muted-foreground mb-1">Kappa Score</span>
                    <span className={`text-2xl font-bold ${dataset.kappa_score >= 0.8 ? 'text-green-600' : dataset.kappa_score >= 0.6 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {dataset.kappa_score.toFixed(3)}
                    </span>
                    <span className="text-xs text-muted-foreground mt-1">
                      一致性评分：{dataset.kappa_score >= 0.8 ? '高度一致' : dataset.kappa_score >= 0.6 ? '中等一致' : '一致性较低'}
                    </span>
                  </div>
                )}
              </div>
              <div className="mt-4 p-3 bg-muted rounded-md space-y-2">
                {dataset.evaluation_stats && (
                  <p className="text-xs text-muted-foreground">
                    <strong>AssistantModel 得分：</strong>每个对话包含约20个维度的评分，只要有任意一个维度评分为0，该对话为0分，否则为1分（优质）。优质率 = 优质对话数 / 总对话数。
                  </p>
                )}
                {dataset.turing_score !== undefined && (
                  <p className="text-xs text-muted-foreground">
                    <strong>Turing Score：</strong>图灵测试评分，衡量AI生成对话与真人对话的相似度。分数越高表示AI对话越接近真人水平，难以被区分。
                  </p>
                )}
                {dataset.kappa_score !== undefined && (
                  <p className="text-xs text-muted-foreground">
                    <strong>Kappa Score：</strong>Cohen's Kappa系数，衡量多个评估者之间的一致性程度。分数范围0-1，0.8以上表示高度一致，0.6-0.8为中等一致。
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

{/* 数据流转关系 */}
        {(relationsData?.source_datasets.length > 0 || relationsData?.derived_datasets.length > 0) && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>数据流转关系</CardTitle>
              <CardDescription>显示该数据集的来源和衍生关系</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* 源数据集 */}
                {relationsData?.source_datasets.length > 0 && (
                  <div>
                    <h3 className="font-medium mb-3 flex items-center">
                      <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                      源数据集
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {relationsData.source_datasets.map((sourceDataset: DatasetRecord) => (
                        <Card key={sourceDataset.id} className="hover:shadow-md transition-shadow">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <h4 className="font-medium text-sm">{sourceDataset.name}</h4>
                                <p className="text-xs text-muted-foreground">
                                  {typeLabels[sourceDataset.data_type]} • {sourceDataset.item_count}条
                                </p>
                              </div>
                              <Badge variant="outline" className="text-xs">
                                源
                              </Badge>
                            </div>
                            <div className="mt-2 text-xs text-muted-foreground">
                              创建于 {new Date(sourceDataset.created_at).toLocaleDateString()}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* 衍生数据集 */}
                {relationsData?.derived_datasets.length > 0 && (
                  <div>
                    <h3 className="font-medium mb-3 flex items-center">
                      <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                      衍生数据集
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {relationsData.derived_datasets.map((derivedDataset: DatasetRecord) => (
                        <Card key={derivedDataset.id} className="hover:shadow-md transition-shadow">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <h4 className="font-medium text-sm">{derivedDataset.name}</h4>
                                <p className="text-xs text-muted-foreground">
                                  {typeLabels[derivedDataset.data_type]} • {derivedDataset.item_count}条
                                </p>
                              </div>
                              <Badge variant="outline" className="text-xs">
                                衍生
                              </Badge>
                            </div>
                            <div className="mt-2 text-xs text-muted-foreground">
                              创建于 {new Date(derivedDataset.created_at).toLocaleDateString()}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 数据预览 */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>数据预览</CardTitle>
                <CardDescription>显示前 10 条数据（共 {dataset.item_count} 条）</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  queryClient.invalidateQueries({ queryKey: ["dataset-preview", id] })
                }
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                刷新
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingPreview ? (
              <div className="space-y-4">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            ) : previewData && previewData.items && previewData.items.length > 0 ? (
              <div className="max-h-[600px] overflow-y-auto pr-2">
                <div className="space-y-4">
                  {previewData.items.map((item: any, idx: number) => (
                    <Card key={idx} className="border">
                      <CardHeader className="py-3">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">
                            {dataset.data_type === 'PORTRAIT' ? `画像 #${idx + 1}` : 
                             dataset.data_type === 'EVALUATION' ? `评估 #${idx + 1}` :
                             `对话 #${idx + 1}`}
                          </Badge>
                          {item.uuid && (
                            <span className="text-xs text-muted-foreground font-mono ml-auto">
                              {item.uuid}
                            </span>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent>
                        {dataset.data_type === 'PORTRAIT' ? (
                          // 用户画像渲染
                          <div className="space-y-4">
                            {item.success === false && (
                              <div className="p-3 bg-destructive/10 rounded-md">
                                <p className="text-sm text-destructive">{item.error || '画像抽取失败'}</p>
                              </div>
                            )}
                            {item.portrait ? (
                              <div className="space-y-4">
                                <div>
                                  <Label className="text-base">背景描述</Label>
                                  {renderPortraitList(item.portrait?.背景描述)}
                                </div>
                                <div>
                                  <Label className="text-base">知识盲区</Label>
                                  {renderPortraitList(item.portrait?.知识盲区)}
                                </div>
                                <div>
                                  <Label className="text-base">问题描述</Label>
                                  {renderPortraitList(item.portrait?.问题描述)}
                                </div>
                                <div>
                                  <Label className="text-base">操作历史</Label>
                                  {item.portrait?.操作历史 && item.portrait.操作历史.length > 0 ? (
                                    <div className="mt-2 space-y-2">
                                      {item.portrait.操作历史.map((op: any, opIdx: number) => (
                                        <div key={opIdx} className="text-sm border-l-2 pl-3">
                                          <div><strong>{op.action}</strong> → {op.target}</div>
                                          <div className="text-muted-foreground">{op.details}</div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-sm text-muted-foreground">暂无</p>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground">暂无画像结果</p>
                            )}
                          </div>
                        ) : dataset.data_type === 'EVALUATION' ? (
                          // 质量评估渲染
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label className="text-base">对话预览</Label>
                              {item.conversation && Array.isArray(item.conversation) && item.conversation.length > 0 ? (
                                <div className="space-y-2">
                                  {item.conversation.map((msg: any, msgIdx: number) => (
                                    <div 
                                      key={msgIdx}
                                      className={`text-sm p-2 rounded ${
                                        msg.role === 'user' 
                                          ? 'bg-blue-50 text-blue-900 dark:bg-blue-950/20 dark:text-blue-200' 
                                          : 'bg-green-50 text-green-900 dark:bg-green-950/20 dark:text-green-200'
                                      }`}
                                    >
                                      <span className="font-medium">
                                        {msg.role === 'user' ? '👤 用户' : '🤖 客服'}:
                                      </span>
                                      <span className="ml-2">{msg.content}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-sm text-muted-foreground">暂无对话内容</div>
                              )}
                            </div>
                            <div className="space-y-2">
                              <Label className="text-base">评估结果</Label>
                              {item.evaluation ? (
                                <ScoreCard jsonData={JSON.stringify(item.evaluation)} />
                              ) : (
                                <div className="text-sm text-muted-foreground">暂无评估结果</div>
                              )}
                            </div>
                          </div>
                        ) : item.conversation && Array.isArray(item.conversation) && item.conversation.length > 0 ? (
                          // 对话合成或人人对话渲染
                          <div className="space-y-2">
                            {item.conversation.map((msg: any, msgIdx: number) => (
                              <div 
                                key={msgIdx}
                                className={`text-sm p-2 rounded ${
                                  msg.role === 'user' 
                                    ? 'bg-blue-50 text-blue-900 dark:bg-blue-950/20 dark:text-blue-200' 
                                    : 'bg-green-50 text-green-900 dark:bg-green-950/20 dark:text-green-200'
                                }`}
                              >
                                <span className="font-medium">
                                  {msg.role === 'user' ? '👤 用户' : '🤖 客服'}:
                                </span>
                                <span className="ml-2">{msg.content}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          // 默认JSON渲染
                          <pre className="text-xs bg-background p-3 rounded-md overflow-x-auto whitespace-pre-wrap break-words">
                            {JSON.stringify(item, null, 2)}
                          </pre>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">暂无数据</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
