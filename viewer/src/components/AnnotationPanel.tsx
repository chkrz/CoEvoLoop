import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Edit3, Check, X, MessageSquare, AlertCircle, ThumbsUp, ThumbsDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Annotation {
  id: string;
  messageId: string;
  targetType: 'message' | 'planner' | 'score';
  originalContent: string;
  modifiedContent?: string;
  annotation?: string;
  type: 'positive' | 'negative' | 'neutral' | 'improvement';
  timestamp: string;
  author?: string;
  metadata?: {
    turn?: number;
    section?: string;
    title?: string;
  };
}

interface AnnotationPanelProps {
  messageId: string;
  originalContent: string;
  onSaveAnnotation: (annotation: Annotation) => void;
  onClose: () => void;
  existingAnnotation?: Annotation;
}

export function AnnotationPanel({ 
  messageId, 
  originalContent, 
  onSaveAnnotation, 
  onClose, 
  existingAnnotation 
}: AnnotationPanelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [modifiedContent, setModifiedContent] = useState(existingAnnotation?.modifiedContent || originalContent);
  const [annotation, setAnnotation] = useState(existingAnnotation?.annotation || '');
  const [annotationType, setAnnotationType] = useState<Annotation['type']>(existingAnnotation?.type || 'neutral');

  const handleSave = () => {
    const newAnnotation: Annotation = {
      id: existingAnnotation?.id || `annotation-${Date.now()}`,
      messageId,
      targetType: existingAnnotation?.targetType || 'message',
      originalContent,
      modifiedContent: modifiedContent !== originalContent ? modifiedContent : undefined,
      annotation: annotation.trim() || undefined,
      type: annotationType,
      timestamp: existingAnnotation?.timestamp || new Date().toISOString(),
      author: existingAnnotation?.author || '当前用户',
      metadata: existingAnnotation?.metadata
    };
    onSaveAnnotation(newAnnotation);
    onClose();
  };

  const handleCancel = () => {
    setModifiedContent(existingAnnotation?.modifiedContent || originalContent);
    setAnnotation(existingAnnotation?.annotation || '');
    setAnnotationType(existingAnnotation?.type || 'neutral');
    onClose();
  };

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

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl border-0">
        <div className="p-6 border-b bg-gradient-to-r from-blue-50 to-purple-50">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-gray-900">消息标注</h3>
              <p className="text-sm text-gray-600 mt-1">为对话内容添加详细标注和反馈</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              className="hover:bg-white/50"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden bg-gray-50">
          <Tabs defaultValue="content" className="h-full">
            <TabsList className="w-full justify-start rounded-none border-b bg-white px-6">
              <TabsTrigger value="content" className="px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <Edit3 className="w-4 h-4" />
                  内容编辑
                </div>
              </TabsTrigger>
              <TabsTrigger value="annotation" className="px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  标注详情
                </div>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="content" className="p-6 h-[calc(100%-60px)] overflow-y-auto">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold text-gray-700">原始内容</h4>
                      <Badge variant="outline" className="text-xs bg-gray-100">只读</Badge>
                    </div>
                    <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
                      <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                        {originalContent}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold text-gray-700">修改后内容</h4>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant={isEditing ? "default" : "outline"}
                          onClick={() => setIsEditing(!isEditing)}
                          className="h-8 text-xs"
                        >
                          <Edit3 className="w-3 h-3 mr-1" />
                          {isEditing ? '完成编辑' : '开始编辑'}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setModifiedContent(originalContent)}
                          className="h-8 text-xs"
                        >
                          重置
                        </Button>
                      </div>
                    </div>
                    {isEditing ? (
                      <Textarea
                        value={modifiedContent}
                        onChange={(e) => setModifiedContent(e.target.value)}
                        className="min-h-[200px] text-sm border-gray-300 focus:border-blue-500 focus:ring-blue-500 rounded-lg"
                        placeholder="在此输入修改后的内容..."
                      />
                    ) : (
                      <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                          {modifiedContent || originalContent}
                        </div>
                      </div>
                    )}
                  </div>

                  {modifiedContent !== originalContent && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-3">修改差异对比</h4>
                      <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                        <DiffViewer original={originalContent} modified={modifiedContent} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="annotation" className="p-6 h-[calc(100%-60px)] overflow-y-auto">
              <div className="max-w-2xl mx-auto space-y-6">
                {existingAnnotation?.metadata && (
                  <div className="p-4 bg-white rounded-lg border border-gray-200">
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">标注目标信息</h4>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
                        {{
                          'message': 'AI回复',
                          'planner': '思考过程',
                          'score': '打分结果'
                        }[existingAnnotation.metadata.title?.includes('思考') ? 'planner' : 
                          existingAnnotation.metadata.title?.includes('打分') ? 'score' : 'message'] || '未知'}
                      </Badge>
                      {existingAnnotation.metadata.title && (
                        <span className="text-sm text-gray-600">{existingAnnotation.metadata.title}</span>
                      )}
                    </div>
                  </div>
                )}

                <div className="p-4 bg-white rounded-lg border border-gray-200">
                  <h4 className="text-sm font-semibold text-gray-700 mb-4">选择标注类型</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {(['positive', 'negative', 'improvement', 'neutral'] as const).map((type) => (
                      <Button
                        key={type}
                        variant={annotationType === type ? "default" : "outline"}
                        size="sm"
                        onClick={() => setAnnotationType(type)}
                        className={cn(
                          "h-10 justify-start px-3 py-2 transition-all",
                          annotationType === type && getTypeColor(type),
                          annotationType !== type && "hover:bg-gray-50"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          {getTypeIcon(type)}
                          <div className="text-left">
                            <div className="text-xs font-medium">
                              {type === 'positive' ? '好评' : 
                               type === 'negative' ? '差评' : 
                               type === 'improvement' ? '改进建议' : '中性备注'}
                            </div>
                            <div className="text-xs text-gray-500">
                              {type === 'positive' ? '内容质量很好' : 
                               type === 'negative' ? '存在问题或错误' : 
                               type === 'improvement' ? '可以优化改进' : '一般性备注'}
                            </div>
                          </div>
                        </div>
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="p-4 bg-white rounded-lg border border-gray-200">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">详细标注说明</h4>
                  <Textarea
                    value={annotation}
                    onChange={(e) => setAnnotation(e.target.value)}
                    className="min-h-[150px] text-sm border-gray-300 focus:border-blue-500 focus:ring-blue-500 rounded-lg"
                    placeholder="请详细说明您的标注原因、改进建议或其他备注信息..."
                  />
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-xs text-gray-500">
                      支持详细描述问题、建议改进方案等
                    </p>
                    <span className="text-xs text-gray-400">
                      {annotation.length}/500
                    </span>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
          <Button 
            variant="outline" 
            onClick={handleCancel}
            className="px-6"
          >
            取消
          </Button>
          <Button 
            onClick={handleSave}
            className="px-6 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
          >
            <Check className="w-4 h-4 mr-2" />
            保存标注
          </Button>
        </div>
      </Card>
    </div>
  );
}

// 差异查看器组件
function DiffViewer({ original, modified }: { original: string; modified: string }) {
  const getDiff = (oldStr: string, newStr: string) => {
    const oldLines = oldStr.split('\n');
    const newLines = newStr.split('\n');
    
    const result = [];
    let oldIndex = 0;
    let newIndex = 0;
    
    while (oldIndex < oldLines.length || newIndex < newLines.length) {
      if (oldIndex >= oldLines.length) {
        // 新增的行
        result.push(
          <div key={`add-${newIndex}`} className="text-green-700 bg-green-50 px-1 rounded">
            + {newLines[newIndex]}
          </div>
        );
        newIndex++;
      } else if (newIndex >= newLines.length) {
        // 删除的行
        result.push(
          <div key={`del-${oldIndex}`} className="text-red-700 bg-red-50 px-1 rounded line-through">
            - {oldLines[oldIndex]}
          </div>
        );
        oldIndex++;
      } else if (oldLines[oldIndex] === newLines[newIndex]) {
        // 相同的行
        result.push(
          <div key={`same-${oldIndex}`} className="text-gray-700">
            {oldLines[oldIndex]}
          </div>
        );
        oldIndex++;
        newIndex++;
      } else {
        // 修改的行
        result.push(
          <div key={`mod-${oldIndex}`} className="text-red-700 bg-red-50 px-1 rounded line-through">
            - {oldLines[oldIndex]}
          </div>
        );
        result.push(
          <div key={`mod-${newIndex}`} className="text-green-700 bg-green-50 px-1 rounded">
            + {newLines[newIndex]}
          </div>
        );
        oldIndex++;
        newIndex++;
      }
    }
    
    return result;
  };

  return (
    <div className="font-mono text-xs leading-relaxed">
      {getDiff(original, modified)}
    </div>
  );
}