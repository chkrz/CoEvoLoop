import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import DiffDisplay from '../DiffDisplay';
import { DiffResult } from '../../../utils/diffUtils';

describe('DiffDisplay', () => {
  const mockDiffs: DiffResult[] = [
    {
      field: 'name',
      type: 'modified',
      original: 'John',
      modified: 'Jane',
      textDiff: [
        { type: 'removed', text: 'John' },
        { type: 'added', text: 'Jane' }
      ]
    },
    {
      field: 'age',
      type: 'added',
      original: undefined,
      modified: 25
    },
    {
      field: 'city',
      type: 'removed',
      original: 'NY',
      modified: undefined
    }
  ];

  const mockOriginalData = {
    name: 'John',
    city: 'NY'
  };

  const mockModifiedData = {
    name: 'Jane',
    age: 25
  };

  describe('基本渲染', () => {
    it('应该正确渲染差异信息', () => {
      render(
        <DiffDisplay
          diffs={mockDiffs}
          originalData={mockOriginalData}
          modifiedData={mockModifiedData}
        />
      );

      expect(screen.getByText('共 3 项变化')).toBeInTheDocument();
      expect(screen.getByText('name')).toBeInTheDocument();
      expect(screen.getByText('age')).toBeInTheDocument();
      expect(screen.getByText('city')).toBeInTheDocument();
    });

    it('应该显示无变化消息', () => {
      render(
        <DiffDisplay
          diffs={[]}
          originalData={mockOriginalData}
          modifiedData={mockModifiedData}
        />
      );

      expect(screen.getByText('✓')).toBeInTheDocument();
      expect(screen.getByText('无变化')).toBeInTheDocument();
    });

    it('应该根据模式渲染不同的视图', () => {
      const { rerender } = render(
        <DiffDisplay
          diffs={mockDiffs}
          originalData={mockOriginalData}
          modifiedData={mockModifiedData}
          mode="compact"
        />
      );

      expect(screen.getByText('~修改')).toBeInTheDocument();
      expect(screen.getByText('+新增')).toBeInTheDocument();
      expect(screen.getByText('-删除')).toBeInTheDocument();
    });
  });

  describe('交互功能', () => {
    it('应该支持展开/收起功能', async () => {
      render(
        <DiffDisplay
          diffs={mockDiffs}
          originalData={mockOriginalData}
          modifiedData={mockModifiedData}
        />
      );

      const nameField = screen.getByText('name');
      fireEvent.click(nameField);

      await waitFor(() => {
        expect(screen.getByText('原始内容:')).toBeInTheDocument();
        expect(screen.getByText('修改后内容:')).toBeInTheDocument();
      });
    });

    it('应该支持显示未变化的内容', () => {
      const unchangedDiff: DiffResult[] = [
        {
          field: 'name',
          type: 'unchanged',
          original: 'John',
          modified: 'John'
        }
      ];

      render(
        <DiffDisplay
          diffs={unchangedDiff}
          originalData={mockOriginalData}
          modifiedData={mockModifiedData}
          showUnchanged={true}
        />
      );

      expect(screen.getByText('name')).toBeInTheDocument();
    });

    it('应该支持全部展开/收起按钮', async () => {
      render(
        <DiffDisplay
          diffs={mockDiffs}
          originalData={mockOriginalData}
          modifiedData={mockModifiedData}
        />
      );

      const expandAllButton = screen.getByText('全部展开');
      fireEvent.click(expandAllButton);

      await waitFor(() => {
        expect(screen.getAllByText('原始内容:').length).toBeGreaterThan(0);
      });

      const collapseAllButton = screen.getByText('全部收起');
      fireEvent.click(collapseAllButton);
    });
  });

  describe('数组差异展示', () => {
    const arrayDiffs: DiffResult[] = [
      {
        field: 'items',
        type: 'modified',
        original: ['a', 'b'],
        modified: ['a', 'c', 'd'],
        arrayDiff: [
          { type: 'unchanged', index: 0, original: 'a', modified: 'a' },
          { type: 'modified', index: 1, original: 'b', modified: 'c' },
          { type: 'added', index: 2, modified: 'd' }
        ]
      }
    ];

    it('应该正确渲染数组差异', () => {
      render(
        <DiffDisplay
          diffs={arrayDiffs}
          originalData={{ items: ['a', 'b'] }}
          modifiedData={{ items: ['a', 'c', 'd'] }}
        />
      );

      expect(screen.getByText('items')).toBeInTheDocument();
    });
  });

  describe('文本差异展示', () => {
    const textDiffs: DiffResult[] = [
      {
        field: 'description',
        type: 'modified',
        original: 'Hello world',
        modified: 'Hello beautiful world',
        textDiff: [
          { type: 'unchanged', text: 'Hello ', start: 0, end: 6 },
          { type: 'added', text: 'beautiful ', start: 6, end: 16 },
          { type: 'unchanged', text: 'world', start: 16, end: 21 }
        ]
      }
    ];

    it('应该正确渲染文本差异', () => {
      render(
        <DiffDisplay
          diffs={textDiffs}
          originalData={{ description: 'Hello world' }}
          modifiedData={{ description: 'Hello beautiful world' }}
        />
      );

      expect(screen.getByText('description')).toBeInTheDocument();
    });
  });

  describe('响应式行为', () => {
    it('应该处理大量数据', () => {
      const largeDiffs: DiffResult[] = Array.from({ length: 50 }, (_, i) => ({
        field: `field_${i}`,
        type: 'modified',
        original: `original_${i}`,
        modified: `modified_${i}`
      }));

      render(
        <DiffDisplay
          diffs={largeDiffs}
          originalData={mockOriginalData}
          modifiedData={mockModifiedData}
        />
      );

      expect(screen.getByText('共 50 项变化')).toBeInTheDocument();
    });
  });
});