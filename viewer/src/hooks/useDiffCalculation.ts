import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { DiffResult, UserPortraitData, calculatePortraitDiff, getDiffStats } from '../utils/diffUtils';

interface UseDiffCalculationOptions {
  debounceMs?: number;
  enableRealTime?: boolean;
  maxCacheSize?: number;
  onError?: (error: Error) => void;
}

interface UseDiffCalculationResult {
  diffs: DiffResult[];
  stats: ReturnType<typeof getDiffStats>;
  isCalculating: boolean;
  error: Error | null;
  lastCalculated: Date | null;
  recalculate: () => void;
  clearCache: () => void;
  getCachedDiff: (original: UserPortraitData, modified: UserPortraitData) => DiffResult[] | null;
}

interface CacheEntry {
  diffs: DiffResult[];
  stats: ReturnType<typeof getDiffStats>;
  timestamp: Date;
  originalHash: string;
  modifiedHash: string;
}

/**
 * 计算对象的哈希值用于缓存
 */
function calculateHash(obj: any): string {
  try {
    return JSON.stringify(obj, Object.keys(obj).sort());
  } catch (error) {
    return String(obj);
  }
}

/**
 * 防抖函数
 */
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * 用于计算用户画像数据差异的React Hook
 * 支持防抖、缓存、实时计算等功能
 */
export function useDiffCalculation(
  originalData: UserPortraitData,
  modifiedData: UserPortraitData,
  options: UseDiffCalculationOptions = {}
): UseDiffCalculationResult {
  const {
    debounceMs = 300,
    enableRealTime = true,
    maxCacheSize = 50,
    onError
  } = options;

  const [diffs, setDiffs] = useState<DiffResult[]>([]);
  const [stats, setStats] = useState(getDiffStats([]));
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastCalculated, setLastCalculated] = useState<Date | null>(null);
  
  const cacheRef = useRef<Map<string, CacheEntry>>(new Map());
  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);

  /**
   * 生成缓存键
   */
  const generateCacheKey = useCallback((original: UserPortraitData, modified: UserPortraitData): string => {
    const originalHash = calculateHash(original);
    const modifiedHash = calculateHash(modified);
    return `${originalHash}::${modifiedHash}`;
  }, []);

  /**
   * 从缓存获取差异结果
   */
  const getCachedDiff = useCallback((original: UserPortraitData, modified: UserPortraitData): DiffResult[] | null => {
    const key = generateCacheKey(original, modified);
    const entry = cacheRef.current.get(key);
    
    if (entry && Date.now() - entry.timestamp.getTime() < 5 * 60 * 1000) { // 5分钟缓存
      return entry.diffs;
    }
    
    return null;
  }, [generateCacheKey]);

  /**
   * 清理过期缓存
   */
  const cleanupCache = useCallback(() => {
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5分钟
    
    for (const [key, entry] of cacheRef.current.entries()) {
      if (now - entry.timestamp.getTime() > maxAge) {
        cacheRef.current.delete(key);
      }
    }
    
    // 限制缓存大小
    if (cacheRef.current.size > maxCacheSize) {
      const entries = Array.from(cacheRef.current.entries())
        .sort((a, b) => b[1].timestamp.getTime() - a[1].timestamp.getTime())
        .slice(0, maxCacheSize);
      
      cacheRef.current.clear();
      entries.forEach(([key, entry]) => cacheRef.current.set(key, entry));
    }
  }, [maxCacheSize]);

  /**
   * 执行差异计算
   */
  const performCalculation = useCallback(async (original: UserPortraitData, modified: UserPortraitData, signal?: AbortSignal) => {
    try {
      setIsCalculating(true);
      setError(null);

      // 检查缓存
      const cached = getCachedDiff(original, modified);
      if (cached) {
        if (isMountedRef.current) {
          setDiffs(cached);
          setStats(getDiffStats(cached));
          setLastCalculated(new Date());
          setIsCalculating(false);
        }
        return;
      }

      // 模拟异步计算（实际计算很快，这里主要是为了演示异步处理）
      await new Promise(resolve => setTimeout(resolve, 10));
      
      if (signal?.aborted) return;

      const newDiffs = calculatePortraitDiff(original, modified);
      const newStats = getDiffStats(newDiffs);

      // 缓存结果
      const key = generateCacheKey(original, modified);
      cacheRef.current.set(key, {
        diffs: newDiffs,
        stats: newStats,
        timestamp: new Date(),
        originalHash: calculateHash(original),
        modifiedHash: calculateHash(modified)
      });

      cleanupCache();

      if (isMountedRef.current) {
        setDiffs(newDiffs);
        setStats(newStats);
        setLastCalculated(new Date());
        setIsCalculating(false);
      }
    } catch (err) {
      if (isMountedRef.current) {
        const error = err instanceof Error ? err : new Error('计算差异时发生错误');
        setError(error);
        setIsCalculating(false);
        if (onError) {
          onError(error);
        }
      }
    }
  }, [getCachedDiff, generateCacheKey, cleanupCache, onError]);

  /**
   * 防抖版本的计算函数
   */
  const debouncedCalculate = useMemo(() => {
    return debounce(performCalculation, debounceMs);
  }, [performCalculation, debounceMs]);

  /**
   * 手动触发重新计算
   */
  const recalculate = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    performCalculation(originalData, modifiedData, abortControllerRef.current.signal);
  }, [originalData, modifiedData, performCalculation]);

  /**
   * 清理缓存
   */
  const clearCache = useCallback(() => {
    cacheRef.current.clear();
    recalculate();
  }, [recalculate]);

  /**
   * 监听数据变化
   */
  useEffect(() => {
    if (!enableRealTime) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    if (debounceMs > 0) {
      debouncedCalculate(originalData, modifiedData);
    } else {
      performCalculation(originalData, modifiedData, abortControllerRef.current.signal);
    }

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [originalData, modifiedData, enableRealTime, debounceMs, debouncedCalculate, performCalculation]);

  /**
   * 组件卸载时清理
   */
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      cacheRef.current.clear();
    };
  }, []);

  /**
   * 定期清理缓存
   */
  useEffect(() => {
    const interval = setInterval(cleanupCache, 60000); // 每分钟清理一次
    return () => clearInterval(interval);
  }, [cleanupCache]);

  return {
    diffs,
    stats,
    isCalculating,
    error,
    lastCalculated,
    recalculate,
    clearCache,
    getCachedDiff
  };
}

/**
 * 用于批量差异计算的Hook
 */
export function useBatchDiffCalculation(
  items: Array<{
    id: string;
    original: UserPortraitData;
    modified: UserPortraitData;
  }>,
  options: UseDiffCalculationOptions = {}
) {
  const [results, setResults] = useState<Record<string, {
    diffs: DiffResult[];
    stats: ReturnType<typeof getDiffStats>;
    isCalculating: boolean;
    error: Error | null;
  }>>({});

  const [isCalculatingAll, setIsCalculatingAll] = useState(false);
  const [overallProgress, setOverallProgress] = useState(0);

  const calculateAll = useCallback(async () => {
    if (items.length === 0) return;

    setIsCalculatingAll(true);
    setOverallProgress(0);

    const newResults: typeof results = {};
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      try {
        const diffs = calculatePortraitDiff(item.original, item.modified);
        const stats = getDiffStats(diffs);
        
        newResults[item.id] = {
          diffs,
          stats,
          isCalculating: false,
          error: null
        };
      } catch (error) {
        newResults[item.id] = {
          diffs: [],
          stats: getDiffStats([]),
          isCalculating: false,
          error: error instanceof Error ? error : new Error('计算失败')
        };
      }
      
      setOverallProgress(((i + 1) / items.length) * 100);
    }

    setResults(newResults);
    setIsCalculatingAll(false);
    setOverallProgress(100);
  }, [items]);

  useEffect(() => {
    calculateAll();
  }, [calculateAll]);

  return {
    results,
    isCalculatingAll,
    overallProgress,
    calculateAll
  };
}

/**
 * 用于差异变化监听的Hook
 */
export function useDiffChangeListener(
  diffs: DiffResult[],
  onChange: (diffs: DiffResult[], stats: ReturnType<typeof getDiffStats>) => void
) {
  const prevDiffsRef = useRef<DiffResult[]>([]);
  const prevStatsRef = useRef<ReturnType<typeof getDiffStats>>(getDiffStats([]));

  useEffect(() => {
    const stats = getDiffStats(diffs);
    
    const hasChanged = 
      JSON.stringify(diffs) !== JSON.stringify(prevDiffsRef.current) ||
      JSON.stringify(stats) !== JSON.stringify(prevStatsRef.current);

    if (hasChanged) {
      onChange(diffs, stats);
      prevDiffsRef.current = diffs;
      prevStatsRef.current = stats;
    }
  }, [diffs, onChange]);
}