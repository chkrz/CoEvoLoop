import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronLeft, ChevronRight, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

interface SideBySideDiffProps {
  comparisons: any[];
  selectedComparison: any;
  onSelect: (comparison: any) => void;
}

export default function SideBySideDiff({ 
  comparisons, 
  selectedComparison, 
  onSelect 
}: SideBySideDiffProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const handlePrevious = () => {
    if (currentIndex > 0) {
      const newIndex = currentIndex - 1;
      setCurrentIndex(newIndex);
      onSelect(comparisons[newIndex]);
    }
  };

  const handleNext = () => {
    if (currentIndex < comparisons.length - 1) {
      const newIndex = currentIndex + 1;
      setCurrentIndex(newIndex);
      onSelect(comparisons[newIndex]);
    }
  };

  const handleSelect = (index: number) => {
    setCurrentIndex(index);
    onSelect(comparisons[index]);
  };

  const currentComparison = selectedComparison || comparisons[currentIndex];

  if (!currentComparison) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground">暂无对比数据</p>
        </CardContent>
      </Card>
    );
  }

  const renderDiffContent = (content: any, type: 'original' | 'annotated') => {
    if (typeof content === 'string') {
      return (
        <pre className="text-sm whitespace-pre-wrap break-words">
          {content}
        </pre>
      );
    }

    if (typeof content === 'object') {
      return (
        <pre className="text-sm whitespace-pre-wrap break-words">
          {JSON.stringify(content, null, 2)}
        </pre>
      );
    }

    return (
      <pre className="text-sm whitespace-pre-wrap break-words">
        {String(content)}
      </pre>
    );
  };

  const renderChanges = (changes: any[]) => {
    if (!changes || changes.length === 0) {
      return <p className="text-sm text-muted-foreground">无变更</p>;
    }

    return (
      <div className="space-y-2">
        {changes.map((change, index) => (
          <div key={index} className="text-sm">
            <div className="flex items-center gap-2 mb-1">
              <Badge 
                variant={change.type === 'added' ? 'default' : 
                        change.type === 'modified' ? 'warning' : 'destructive'}
                className="text-xs"
              >
                {change.type === 'added' ? '新增' : 
                 change.type === 'modified' ? '修改' : '删除'}
              </Badge>
              <span className="font-medium">{change.field}</span>
            </div>
            {change.type === 'modified' && (
              <div className="space-y-1 text-xs">
                <div className="text-red-600 dark:text-red-400">
                  <span className="font-medium">原值：</span>
                  {String(change.old_value)}
                </div>
                <div className="text-green-600 dark:text-green-400">
                  <span className="font-medium">新值：</span>
                  {String(change.new_value)}
                </div>
              </div>
            )}
            {change.type === 'added' && (
              <div className="text-green-600 dark:text-green-400 text-xs">
                {String(change.new_value)}
              </div>
            )}
            {change.type === 'deleted' && (
              <div className="text-red-600 dark:text-red-400 text-xs line-through">
                {String(change.old_value)}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* 导航控制 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrevious}
                disabled={currentIndex === 0}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm">
                {currentIndex + 1} / {comparisons.length}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNext}
                disabled={currentIndex === comparisons.length - 1}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const content = JSON.stringify(currentComparison, null, 2);
                  navigator.clipboard.writeText(content);
                }}
              >
                <Copy className="w-4 h-4 mr-1" />
                复制
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 快速导航 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-2 flex-wrap">
            {comparisons.map((_, index) => (
              <Button
                key={index}
                variant={index === currentIndex ? "default" : "outline"}
                size="sm"
                onClick={() => handleSelect(index)}
                className={cn(
                  "text-xs",
                  comparisons[index].has_changes && "ring-2 ring-red-500"
                )}
              >
                {index + 1}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 并排对比 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 原始数据 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              原始数据
              <Badge variant="outline">原数据</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-96">
              {renderDiffContent(currentComparison.original_data, 'original')}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* 标注数据 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              标注数据
              <Badge variant="default">标注后</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-96">
              {renderDiffContent(currentComparison.annotated_data, 'annotated')}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* 变更详情 */}
      {currentComparison.has_changes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">变更详情</CardTitle>
          </CardHeader>
          <CardContent>
            {renderChanges(currentComparison.changes)}
          </CardContent>
        </Card>
      )}
    </div>
  );
}