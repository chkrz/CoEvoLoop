import React, { useMemo, useState, useEffect } from 'react';
import { DiffSegment, diffToReactNodes, getDiffStats, computeDiff } from '../../lib/diffUtils';
import './DiffHighlight.css';

export interface DiffHighlightProps {
  original: string;
  modified: string;
  showDiff?: boolean;
  className?: string;
  onToggleDiff?: (show: boolean) => void;
  compact?: boolean;
}

export const DiffHighlight: React.FC<DiffHighlightProps> = ({
  original,
  modified,
  showDiff = true,
  className = '',
  onToggleDiff,
  compact = false,
}) => {
  const [internalShowDiff, setInternalShowDiff] = useState(showDiff);

  useEffect(() => {
    setInternalShowDiff(showDiff);
  }, [showDiff]);

  const handleToggleDiff = () => {
    const newValue = !internalShowDiff;
    setInternalShowDiff(newValue);
    onToggleDiff?.(newValue);
  };

  // 如果没有差异，直接显示修改后的文本
  if (original === modified) {
    return (
      <div className={`diff-highlight ${className}`}>
        <div className="diff-content">
          <span className="diff-equal">{modified}</span>
        </div>
      </div>
    );
  }

  // 计算差异
  const segments = useMemo(() => {
    if (!internalShowDiff) return [{ type: 'equal' as const, value: modified }];
    
    const result = computeDiff(original, modified);
    return result.segments;
  }, [original, modified, internalShowDiff]);

  const stats = useMemo(() => {
    if (!internalShowDiff) return null;
    
    const result = computeDiff(original, modified);
    return getDiffStats(result.segments);
  }, [original, modified, internalShowDiff]);

  return (
    <div className={`diff-highlight ${className} ${compact ? 'compact' : ''}`}>
      <div className="diff-header">
        {onToggleDiff && (
          <button
            className="diff-toggle-btn"
            onClick={handleToggleDiff}
            title={internalShowDiff ? '隐藏差异' : '显示差异'}
          >
            {internalShowDiff ? '👁️' : '👁️‍🗨️'}
          </button>
        )}
        
        {internalShowDiff && stats && !compact && (
          <div className="diff-stats">
            {stats.insertions > 0 && (
              <span className="stat-insert">+{stats.insertions}</span>
            )}
            {stats.deletions > 0 && (
              <span className="stat-delete">-{stats.deletions}</span>
            )}
          </div>
        )}
      </div>

      <div className="diff-content">
        {diffToReactNodes(segments)}
      </div>

      {internalShowDiff && compact && stats && (
        <div className="diff-mini-stats">
          {stats.insertions > 0 && <span className="mini-insert">+</span>}
          {stats.deletions > 0 && <span className="mini-delete">-</span>}
        </div>
      )}
    </div>
  );
};

export interface DiffTooltipProps {
  original: string;
  modified: string;
  children: React.ReactNode;
}

export const DiffTooltip: React.FC<DiffTooltipProps> = ({
  original,
  modified,
  children,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  if (original === modified) {
    return <>{children}</>;
  }

  return (
    <div
      className="diff-tooltip-container"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {children}
      
      {showTooltip && (
        <div className="diff-tooltip">
          <div className="diff-tooltip-content">
            <div className="diff-tooltip-section">
              <strong>原始文本:</strong>
              <div className="diff-tooltip-original">{original}</div>
            </div>
            <div className="diff-tooltip-section">
              <strong>修改后:</strong>
              <div className="diff-tooltip-modified">{modified}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export interface DiffViewerProps {
  original: string;
  modified: string;
  sideBySide?: boolean;
  className?: string;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({
  original,
  modified,
  sideBySide = false,
  className = '',
}) => {
  const diff = useMemo(() => computeDiff(original, modified), [original, modified]);

  if (sideBySide) {
    return (
      <div className={`diff-viewer side-by-side ${className}`}>
        <div className="diff-panel">
          <div className="diff-panel-header">原始文本</div>
          <div className="diff-panel-content">
            {diff.segments.map((segment, index) => {
              if (segment.type === 'insert') return null;
              return (
                <span
                  key={index}
                  className={`diff-segment diff-${segment.type}`}
                >
                  {segment.value}
                </span>
              );
            })}
          </div>
        </div>
        
        <div className="diff-panel">
          <div className="diff-panel-header">修改后文本</div>
          <div className="diff-panel-content">
            {diff.segments.map((segment, index) => {
              if (segment.type === 'delete') return null;
              return (
                <span
                  key={index}
                  className={`diff-segment diff-${segment.type}`}
                >
                  {segment.value}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`diff-viewer inline ${className}`}>
      <div className="diff-content">
        {diffToReactNodes(diff.segments)}
      </div>
    </div>
  );
};