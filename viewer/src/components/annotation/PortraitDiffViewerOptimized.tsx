import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { DiffResult, UserPortraitData } from '../../utils/diffUtilsOptimized';
import { calculatePortraitDiffOptimized } from '../../utils/diffUtilsOptimized';
import { getDiffStats } from '../../utils/diffUtils';
import { Eye, EyeOff, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';

interface PortraitDiffViewerOptimizedProps {
  originalData: UserPortraitData;
  modifiedData: UserPortraitData;
  className?: string;
  showRealTime?: boolean;
  onDiffChange?: (diffs: DiffResult[]) => void;
  maxVisibleItems?: number;
  enableVirtualization?: boolean;
}

interface FieldConfig {
  key: keyof UserPortraitData;
  label: string;
  type: 'text' | 'array' | 'object';
  description?: string;
  icon?: string;
}

const FIELD_CONFIGS: FieldConfig[] = [
  {
    key: 'background_description',
    label: '背景描述',
    type: 'array',
    description: '用户的背景信息和上下文',
    icon: '📋'
  },
  {
    key: 'knowledge_blind_spots',
    label: '知识盲区',
    type: 'array',
    description: '用户知识体系的空白区域',
    icon: '❓'
  },
  {
    key: 'operation_history',
    label: '操作历史',
    type: 'object',
    description: '用户的操作记录和时间线',
    icon: '📊'
  },
  {
    key: 'problem_description',
    label: '问题描述',
    type: 'array',
    description: '用户遇到的问题和挑战',
    icon: '⚠️'
  }
];

// 虚拟滚动Hook
function useVirtualScroll<T>(
  items: T[],
  itemHeight: number,
  containerHeight: number,
  overscan = 5
) {
  const [scrollTop, setScrollTop] = useState(0);
  
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    items.length,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
  );
  
  const visibleItems = items.slice(startIndex, endIndex);
  const offsetY = startIndex * itemHeight;
  
  return {
    visibleItems,
    offsetY,
    totalHeight: items.length * itemHeight,
    startIndex,
    endIndex
  };
}

// 防抖Hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  
  return debouncedValue;
}

// 懒加载Hook
function useLazyCalculation<T>(
  calculate: () => T,
  dependencies: any[],
  delay = 100
) {
  const [result, setResult] = useState<T | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  useEffect(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    const controller = abortControllerRef.current;
    
    setIsCalculating(true);
    
    const timer = setTimeout(() => {
      if (controller.signal.aborted) return;
      
      try {
        const newResult = calculate();
        if (!controller.signal.aborted) {
          setResult(newResult);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error('计算错误:', error);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsCalculating(false);
        }
      }
    }, delay);
    
    return () => {
      clearTimeout(timer);
      if (abortControllerRef.current === controller) {
        controller.abort();
      }
    };
  }, dependencies);
  
  return { result, isCalculating };
}

const PortraitDiffViewerOptimized: React.FC<PortraitDiffViewerOptimizedProps> = ({
  originalData,
  modifiedData,
  className = '',
  showRealTime = false,
  onDiffChange,
  maxVisibleItems = 50,
  enableVirtualization = true
}) => {
  const [viewMode, setViewMode] = useState<'summary' | 'detailed' | 'inline'>('summary');
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set());
  const [showUnchanged, setShowUnchanged] = useState(false);
  const [showDiff, setShowDiff] = useState(true);
  const [isCompact, setIsCompact] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  
  // 防抖数据
  const debouncedOriginalData = useDebounce(originalData, 300);
  const debouncedModifiedData = useDebounce(modifiedData, 300);
  
  // 懒加载计算差异
  const { result: diffs, isCalculating } = useLazyCalculation(
    () => calculatePortraitDiffOptimized(debouncedOriginalData, debouncedModifiedData, {
      maxDepth: 5,
      maxStringLength: 5000,
      skipLargeArrays: true,
      cacheResults: true
    }),
    [debouncedOriginalData, debouncedModifiedData],
    100
  );
  
  // 统计信息
  const stats = useMemo(() => {
    if (!diffs) return { added: 0, removed: 0, modified: 0, total: 0 };
    return getDiffStats(diffs);
  }, [diffs]);
  
  // 通知父组件差异变化
  useEffect(() => {
    if (diffs && onDiffChange) {
      onDiffChange(diffs);
    }
  }, [diffs, onDiffChange]);
  
  // 按字段分组的差异
  const fieldDiffs = useMemo(() => {
    if (!diffs) return {};
    
    const grouped: Record<string, DiffResult[]> = {};
    for (const diff of diffs) {
      if (!grouped[diff.field]) {
        grouped[diff.field] = [];
      }
      grouped[diff.field].push(diff);
    }
    return grouped;
  }, [diffs]);
  
  // 可见的差异
  const visibleDiffs = useMemo(() => {
    if (!diffs) return [];
    return showUnchanged ? diffs : diffs.filter(diff => diff.type !== 'unchanged');
  }, [diffs, showUnchanged]);
  
  // 切换字段展开状态
  const toggleField = useCallback((fieldKey: string) => {
    setSelectedFields(prev => {
      const newSet = new Set(prev);
      if (newSet.has(fieldKey)) {
        newSet.delete(fieldKey);
      } else {
        newSet.add(fieldKey);
      }
      return newSet;
    });
  }, []);
  
  // 展开/收起所有字段
  const toggleAllFields = useCallback(() => {
    if (selectedFields.size === FIELD_CONFIGS.length) {
      setSelectedFields(new Set());
    } else {
      setSelectedFields(new Set(FIELD_CONFIGS.map(f => f.key)));
    }
  }, [selectedFields.size]);
  
  // 渲染字段差异
  const renderFieldDiff = useCallback((field: FieldConfig) => {
    const fieldDiffsList = fieldDiffs[field.key] || [];
    const hasChanges = fieldDiffsList.some(diff => diff.type !== 'unchanged');
    
    if (!hasChanges && !showUnchanged) {
      return null;
    }
    
    const isExpanded = selectedFields.has(field.key);
    
    return (
      <div key={field.key} className="border rounded-lg mb-3 overflow-hidden">
        <div 
          className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors"
          onClick={() => toggleField(field.key)}
        >
          <div className="flex items-center space-x-2">
            <span className="text-lg">{field.icon}</span>
            <div>
              <h4 className="font-medium text-gray-900">{field.label}</h4>
              {field.description && (
                <p className="text-sm text-gray-600">{field.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {hasChanges && (
              <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded">
                有变化
              </span>
            )}
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </div>
        </div>
        
        {isExpanded && (
          <div className="p-3 border-t">
            {renderFieldChanges(field, fieldDiffsList)}
          </div>
        )}
      </div>
    );
  }, [fieldDiffs, selectedFields, showUnchanged, toggleField]);
  
  // 渲染字段变化
  const renderFieldChanges = useCallback((field: FieldConfig, diffs: DiffResult[]) => {
    const originalValue = originalData[field.key];
    const modifiedValue = modifiedData[field.key];
    
    if (field.type === 'array') {
      return renderArrayChanges(originalValue as string[], modifiedValue as string[]);
    }
    
    if (field.type === 'object') {
      return renderObjectChanges(originalValue, modifiedValue);
    }
    
    return renderTextChanges(originalValue, modifiedValue);
  }, [originalData, modifiedData]);
  
  // 渲染数组变化
  const renderArrayChanges = useCallback((original: string[], modified: string[]) => {
    const maxLength = Math.max(original?.length || 0, modified?.length || 0);
    const changes = [];
    
    for (let i = 0; i < Math.min(maxLength, maxVisibleItems); i++) {
      const orig = original?.[i];
      const mod = modified?.[i];
      
      if (i >= (original?.length || 0)) {
        changes.push(
          <div key={i} className="flex items-start space-x-2 text-sm">
            <span className="text-xs text-gray-500 mt-1">[{i}]</span>
            <span className="bg-green-100 text-green-800 px-2 py-1 rounded">
              + {mod}
            </span>
          </div>
        );
      } else if (i >= (modified?.length || 0)) {
        changes.push(
          <div key={i} className="flex items-start space-x-2 text-sm">
            <span className="text-xs text-gray-500 mt-1">[{i}]</span>
            <span className="bg-red-100 text-red-800 px-2 py-1 rounded line-through">
              - {orig}
            </span>
          </div>
        );
      } else if (orig !== mod) {
        changes.push(
          <div key={i} className="flex items-start space-x-2 text-sm">
            <span className="text-xs text-gray-500 mt-1">[{i}]</span>
            <div className="flex-1 space-y-1">
              <div className="bg-red-50 p-2 rounded line-through text-xs">
                - {orig}
              </div>
              <div className="bg-green-50 p-2 rounded text-xs">
                + {mod}
              </div>
            </div>
          </div>
        );
      } else if (showUnchanged) {
        changes.push(
          <div key={i} className="flex items-start space-x-2 text-sm text-gray-600">
            <span className="text-xs text-gray-500 mt-1">[{i}]</span>
            <span>{orig}</span>
          </div>
        );
      }
    }
    
    if (maxLength > maxVisibleItems) {
      changes.push(
        <div key="more" className="text-sm text-gray-500 italic">
          ... 还有 {maxLength - maxVisibleItems} 项未显示
        </div>
      );
    }
    
    return (
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {changes}
      </div>
    );
  }, [showUnchanged, maxVisibleItems]);
  
  // 渲染对象变化
  const renderObjectChanges = useCallback((original: any, modified: any) => {
    return (
      <div className="space-y-2">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="text-sm font-medium text-gray-600 mb-1">原始内容:</div>
            <pre className="bg-gray-50 p-3 rounded text-xs overflow-auto max-h-32">
              {JSON.stringify(original, null, 2)}
            </pre>
          </div>
          <div>
            <div className="text-sm font-medium text-gray-600 mb-1">修改后内容:</div>
            <pre className="bg-gray-50 p-3 rounded text-xs overflow-auto max-h-32">
              {JSON.stringify(modified, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    );
  }, []);
  
  // 渲染文本变化
  const renderTextChanges = useCallback((original: any, modified: any) => {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div className="text-sm font-medium text-gray-600 mb-1">原始内容:</div>
          <div className="bg-red-50 p-3 rounded text-sm">
            {original || <span className="text-gray-400">空</span>}
          </div>
        </div>
        <div>
          <div className="text-sm font-medium text-gray-600 mb-1">修改后内容:</div>
          <div className="bg-green-50 p-3 rounded text-sm">
            {modified || <span className="text-gray-400">空</span>}
          </div>
        </div>
      </div>
    );
  }, []);
  
  // 渲染统计信息
  const renderStats = useCallback(() => {
    if (stats.total === 0) return null;
    
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
        <h3 className="font-medium text-blue-900 mb-2">差异统计</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{stats.added}</div>
            <div className="text-green-700">新增</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{stats.removed}</div>
            <div className="text-red-700">删除</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600">{stats.modified}</div>
            <div className="text-yellow-700">修改</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-600">{stats.total}</div>
            <div className="text-gray-700">总计</div>
          </div>
        </div>
      </div>
    );
  }, [stats]);
  
  if (!diffs) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-500" />
        <div className="text-gray-500">计算差异中...</div>
      </div>
    );
  }
  
  if (diffs.length === 0) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <div className="text-green-600 text-4xl mb-2">✓</div>
        <div className="text-gray-600">无变化</div>
      </div>
    );
  }
  
  return (
    <div className={`${className}`} ref={containerRef}>
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h3 className="text-lg font-medium text-gray-900">
          用户画像差异对比
          {showRealTime && (
            <span className="ml-2 text-sm text-green-600">(实时更新)</span>
          )}
        </h3>
        
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value as any)}
            className="text-sm border rounded px-2 py-1 bg-white"
          >
            <option value="summary">摘要模式</option>
            <option value="detailed">详细模式</option>
            <option value="inline">行内模式</option>
          </select>
          
          <label className="flex items-center space-x-1 text-sm">
            <input
              type="checkbox"
              checked={showUnchanged}
              onChange={(e) => setShowUnchanged(e.target.checked)}
              className="rounded"
            />
            <span>显示未变化</span>
          </label>
          
          <label className="flex items-center space-x-1 text-sm">
            <input
              type="checkbox"
              checked={isCompact}
              onChange={(e) => setIsCompact(e.target.checked)}
              className="rounded"
            />
            <span>紧凑模式</span>
          </label>
          
          <button
            onClick={toggleAllFields}
            className="text-sm px-2 py-1 bg-gray-100 rounded hover:bg-gray-200"
          >
            {selectedFields.size === FIELD_CONFIGS.length ? '全部收起' : '全部展开'}
          </button>
        </div>
      </div>
      
      {viewMode === 'summary' && (
        <>
          {renderStats()}
          <div className={isCompact ? 'space-y-2' : 'space-y-4'}>
            {FIELD_CONFIGS.map(field => renderFieldDiff(field))}
          </div>
        </>
      )}
      
      {viewMode === 'detailed' && (
        <div className="space-y-4">
          {visibleDiffs.map((diff, index) => (
            <div key={`${diff.field}-${index}`} className="border rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-2">{diff.field}</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-600 mb-1">原始:</div>
                  <pre className="bg-red-50 p-2 rounded text-sm overflow-auto max-h-40">
                    {JSON.stringify(diff.original, null, 2)}
                  </pre>
                </div>
                <div>
                  <div className="text-sm text-gray-600 mb-1">修改后:</div>
                  <pre className="bg-green-50 p-2 rounded text-sm overflow-auto max-h-40">
                    {JSON.stringify(diff.modified, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {viewMode === 'inline' && (
        <div className="text-sm space-y-2">
          {visibleDiffs.map((diff, index) => (
            <div key={`${diff.field}-${index}`} className="flex items-center space-x-2">
              <span className="font-medium">{diff.field}:</span>
              {diff.type === 'added' && (
                <span className="text-green-600">+新增</span>
              )}
              {diff.type === 'removed' && (
                <span className="text-red-600">-删除</span>
              )}
              {diff.type === 'modified' && (
                <span className="text-yellow-600">~修改</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PortraitDiffViewerOptimized;