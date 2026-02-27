import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Eye, Search, Filter } from "lucide-react";
import { cn } from "@/lib/utils";

interface ComparisonListProps {
  comparisons: any[];
  onSelect: (comparison: any) => void;
  selectedId?: string;
}

export default function ComparisonList({ 
  comparisons, 
  onSelect, 
  selectedId 
}: ComparisonListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<'all' | 'changed' | 'unchanged'>('all');

  const filteredComparisons = comparisons.filter((comparison) => {
    const matchesSearch = searchTerm === "" || 
      JSON.stringify(comparison).toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = filterType === 'all' ||
      (filterType === 'changed' && comparison.has_changes) ||
      (filterType === 'unchanged' && !comparison.has_changes);

    return matchesSearch && matchesFilter;
  });

  const getChangeTypeBadge = (changeType: string) => {
    switch (changeType) {
      case 'added':
        return <Badge variant="default" className="text-xs">新增</Badge>;
      case 'modified':
        return <Badge variant="warning" className="text-xs">修改</Badge>;
      case 'deleted':
        return <Badge variant="destructive" className="text-xs">删除</Badge>;
      default:
        return <Badge variant="secondary" className="text-xs">无变更</Badge>;
    }
  };

  const renderChangeSummary = (changes: any[]) => {
    if (!changes || changes.length === 0) {
      return <span className="text-sm text-muted-foreground">无变更</span>;
    }

    const summary = changes.reduce((acc, change) => {
      acc[change.type] = (acc[change.type] || 0) + 1;
      return acc;
    }, {});

    return (
      <div className="flex gap-2 flex-wrap">
        {Object.entries(summary).map(([type, count]) => (
          <Badge key={type} variant={
            type === 'added' ? 'default' : 
            type === 'modified' ? 'warning' : 'destructive'
          } className="text-xs">
            {type === 'added' ? '新增' : 
             type === 'modified' ? '修改' : '删除'} {count}
          </Badge>
        ))}
      </div>
    );
  };

  const renderPreview = (data: any, maxLength: number = 100) => {
    const text = typeof data === 'string' ? data : JSON.stringify(data);
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  return (
    <div className="space-y-4">
      {/* 搜索和过滤 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="搜索对比数据..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={filterType === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterType('all')}
              >
                全部
              </Button>
              <Button
                variant={filterType === 'changed' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterType('changed')}
              >
                变更
              </Button>
              <Button
                variant={filterType === 'unchanged' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterType('unchanged')}
              >
                未变更
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 统计信息 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              显示 {filteredComparisons.length} / {comparisons.length} 条记录
            </div>
            <div className="flex gap-2 text-sm">
              <Badge variant="default">新增: {comparisons.filter(c => c.changes?.some((ch: any) => ch.type === 'added')).length}</Badge>
              <Badge variant="warning">修改: {comparisons.filter(c => c.changes?.some((ch: any) => ch.type === 'modified')).length}</Badge>
              <Badge variant="destructive">删除: {comparisons.filter(c => c.changes?.some((ch: any) => ch.type === 'deleted')).length}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 对比列表 */}
      <ScrollArea className="h-[600px]">
        <div className="space-y-3">
          {filteredComparisons.map((comparison, index) => (
            <Card
              key={comparison.id || index}
              className={cn(
                "hover:shadow-md transition-all cursor-pointer",
                selectedId === (comparison.id || index) && "ring-2 ring-primary",
                comparison.has_changes && "border-l-4 border-l-warning"
              )}
              onClick={() => onSelect(comparison)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-medium text-sm">
                        记录 #{index + 1}
                      </span>
                      {comparison.has_changes ? (
                        <Badge variant="warning" className="text-xs">
                          有变更
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          无变更
                        </Badge>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <div>
                        <span className="text-xs text-muted-foreground">原始数据预览：</span>
                        <p className="text-sm text-muted-foreground mt-1">
                          {renderPreview(comparison.original_data)}
                        </p>
                      </div>
                      
                      {comparison.has_changes && (
                        <div>
                          <span className="text-xs text-muted-foreground">标注数据预览：</span>
                          <p className="text-sm text-muted-foreground mt-1">
                            {renderPreview(comparison.annotated_data)}
                          </p>
                        </div>
                      )}
                      
                      <div>
                        <span className="text-xs text-muted-foreground">变更摘要：</span>
                        {renderChangeSummary(comparison.changes)}
                      </div>
                    </div>
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-4"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(comparison);
                    }}
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>

      {filteredComparisons.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">没有找到匹配的对比数据</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}