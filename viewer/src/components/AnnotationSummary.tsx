import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ThumbsUp, ThumbsDown, Edit3, MessageSquare, Download, Eye, X } from "lucide-react";
import { Annotation } from "./AnnotationPanel";
import { cn } from "@/lib/utils";

interface AnnotationSummaryProps {
  conversationId: string | null;
  messages: any[];
  onClose: () => void;
}

export function AnnotationSummary({ conversationId, messages, onClose }: AnnotationSummaryProps) {
  const [annotations, setAnnotations] = useState<Record<string, Annotation>>({});
  const [selectedAnnotation, setSelectedAnnotation] = useState<Annotation | null>(null);

  useEffect(() => {
    const allAnnotations: Record<string, Annotation> = {};
    
    // 遍历所有可能的对话标注
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('annotations-')) {
        try {
          const savedAnnotations = localStorage.getItem(key);
          if (savedAnnotations) {
            const annotationsData = JSON.parse(savedAnnotations);
            Object.assign(allAnnotations, annotationsData);
          }
        } catch (error) {
          console.error('Failed to load annotations:', error);
        }
      }
    }
    
    setAnnotations(allAnnotations);
  }, [conversationId]);

  const getAnnotationStats = () => {
    const annotationList = Object.values(annotations);
    return {
      total: annotationList.length,
      positive: annotationList.filter(a => a.type === 'positive').length,
      negative: annotationList.filter(a => a.type === 'negative').length,
      improvement: annotationList.filter(a => a.type === 'improvement').length,
      neutral: annotationList.filter(a => a.type === 'neutral').length,
      modified: annotationList.filter(a => a.modifiedContent).length,
      byType: {
        message: annotationList.filter(a => a.targetType === 'message').length,
        planner: annotationList.filter(a => a.targetType === 'planner').length,
        score: annotationList.filter(a => a.targetType === 'score').length
      }
    };
  };

  const stats = getAnnotationStats();

  const getTypeIcon = (type: Annotation['type']) => {
    switch (type) {
      case 'positive': return <ThumbsUp className="w-4 h-4" />;
      case 'negative': return <ThumbsDown className="w-4 h-4" />;
      case 'improvement': return <Edit3 className="w-4 h-4" />;
      default: return <MessageSquare className="w-4 h-4" />;
    }
  };

  const getTypeColor = (type: Annotation['type']) => {
    switch (type) {
      case 'positive': return 'text-green-600 bg-green-50 border-green-200';
      case 'negative': return 'text-red-600 bg-red-50 border-red-200';
      case 'improvement': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getTypeLabel = (type: Annotation['type']) => {
    switch (type) {
      case 'positive': return '好评';
      case 'negative': return '差评';
      case 'improvement': return '改进';
      default: return '备注';
    }
  };

  const exportAllAnnotations = () => {
    if (Object.keys(annotations).length === 0) return;
    
    const exportData = {
      exportTime: new Date().toISOString(),
      summary: stats,
      annotations: Object.values(annotations).map(anno => ({
        ...anno,
        targetTypeLabel: {
          'message': 'AI回复',
          'planner': '思考过程',
          'score': '打分结果'
        }[anno.targetType] || anno.targetType
      }))
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `all-annotations-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const findMessageById = (messageId: string) => {
    return messages.find(m => m.id === messageId);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">标注概览</h3>
              <p className="text-sm text-muted-foreground">
                共 {stats.total} 条标注，{stats.modified} 条已修改
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={exportAllAnnotations}
                disabled={stats.total === 0}
              >
                <Download className="w-4 h-4 mr-1" />
                导出
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={onClose}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          <div className="grid grid-cols-2 gap-4 p-4 border-b">
            <div className="text-center">
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-sm text-muted-foreground">总标注</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{stats.modified}</div>
              <div className="text-sm text-muted-foreground">已修改</div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 p-4 border-b bg-muted/20">
            <div className="text-center">
              <div className="text-lg font-bold text-blue-600">{stats.byType.message}</div>
              <div className="text-sm text-muted-foreground">消息</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-green-600">{stats.byType.planner}</div>
              <div className="text-sm text-muted-foreground">思考过程</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-purple-600">{stats.byType.score}</div>
              <div className="text-sm text-muted-foreground">打分结果</div>
            </div>
          </div>

          <ScrollArea className="flex-1 p-4">
            {Object.values(annotations).length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>暂无标注数据</p>
              </div>
            ) : (
              <div className="space-y-3">
                {Object.values(annotations).map((annotation) => {
                  const message = findMessageById(annotation.messageId);
                  return (
                    <div key={annotation.id} className="border rounded-lg p-3">
                      <div className="flex items-start justify-between mb-2">
                        <Badge className={cn("text-xs", getTypeColor(annotation.type))}>
                          {getTypeIcon(annotation.type)}
                          <span className="ml-1">{getTypeLabel(annotation.type)}</span>
                        </Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-xs"
                          onClick={() => setSelectedAnnotation(annotation)}
                        >
                          <Eye className="w-3 h-3" />
                        </Button>
                      </div>
                      
                      {message && (
                        <div className="text-xs text-muted-foreground mb-2">
                          原始消息：{message.content.substring(0, 100)}...
                        </div>
                      )}
                      
                      {annotation.modifiedContent && (
                        <div className="text-xs text-muted-foreground mb-2">
                          <span className="font-medium">修改内容：</span>
                          <div className="mt-1 p-2 bg-muted rounded text-xs">
                            {annotation.modifiedContent.substring(0, 100)}...
                          </div>
                        </div>
                      )}
                      
                      {annotation.annotation && (
                        <div className="text-xs text-muted-foreground">
                          <span className="font-medium">标注说明：</span>
                          <div className="mt-1 p-2 bg-muted rounded text-xs">
                            {annotation.annotation}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>
      </Card>

      {selectedAnnotation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="p-4 border-b">
              <div className="flex items-center justify-between">
                <h4 className="text-lg font-semibold">标注详情</h4>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedAnnotation(null)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
            
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                <div>
                  <h5 className="text-sm font-medium mb-2">标注类型</h5>
                  <Badge className={cn("text-sm", getTypeColor(selectedAnnotation.type))}>
                    {getTypeIcon(selectedAnnotation.type)}
                    <span className="ml-1">{getTypeLabel(selectedAnnotation.type)}</span>
                  </Badge>
                </div>
                
                <div>
                  <h5 className="text-sm font-medium mb-2">原始内容</h5>
                  <div className="p-3 bg-gray-50 rounded-md border text-sm whitespace-pre-wrap">
                    {selectedAnnotation.originalContent}
                  </div>
                </div>
                
                {selectedAnnotation.modifiedContent && (
                  <div>
                    <h5 className="text-sm font-medium mb-2">修改后内容</h5>
                    <div className="p-3 bg-blue-50 rounded-md border text-sm whitespace-pre-wrap">
                      {selectedAnnotation.modifiedContent}
                    </div>
                  </div>
                )}
                
                {selectedAnnotation.annotation && (
                  <div>
                    <h5 className="text-sm font-medium mb-2">标注说明</h5>
                    <div className="p-3 bg-muted rounded-md border text-sm whitespace-pre-wrap">
                      {selectedAnnotation.annotation}
                    </div>
                  </div>
                )}
                
                <div className="text-xs text-muted-foreground">
                  标注时间：{new Date(selectedAnnotation.timestamp).toLocaleString('zh-CN')}
                  {selectedAnnotation.author && ` · 标注人：${selectedAnnotation.author}`}
                </div>
              </div>
            </ScrollArea>
          </Card>
        </div>
      )}
    </div>
  );
}