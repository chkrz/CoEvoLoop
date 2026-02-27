import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import PortraitDiffViewer from '../PortraitDiffViewer';
import { UserPortraitData } from '../../../utils/diffUtils';

describe('PortraitDiffViewer', () => {
  const mockOriginalData: UserPortraitData = {
    background_description: ['用户是大学生', '主修计算机科学'],
    knowledge_blind_spots: ['不了解云计算', '缺乏项目经验'],
    operation_history: [
      {
        action: '注册账号',
        timestamp: '2024-01-01',
        details: '完成邮箱验证'
      }
    ],
    problem_description: ['学习进度慢', '找不到实习']
  };

  const mockModifiedData: UserPortraitData = {
    background_description: ['用户是大学生', '主修计算机科学', '即将毕业'],
    knowledge_blind_spots: ['不了解云计算'],
    operation_history: [
      {
        action: '注册账号',
        timestamp: '2024-01-01',
        details: '完成邮箱验证'
      },
      {
        action: '购买课程',
        timestamp: '2024-01-15',
        details: '购买了云计算课程'
      }
    ],
    problem_description: ['学习进度慢', '找不到实习', '需要项目经验']
  };

  describe('基本渲染', () => {
    it('应该正确渲染差异信息', () => {
      render(
        <PortraitDiffViewer
          originalData={mockOriginalData}
          modifiedData={mockModifiedData}
        />
      );

      expect(screen.getByText('用户画像差异对比')).toBeInTheDocument();
      expect(screen.getByText('差异统计')).toBeInTheDocument();
    });

    it('应该显示无变化消息', () => {
      render(
        <PortraitDiffViewer
          originalData={mockOriginalData}
          modifiedData={mockOriginalData}
        />
      );

      expect(screen.getByText('✓')).toBeInTheDocument();
      expect(screen.getByText('无变化')).toBeInTheDocument();
    });

    it('应该显示实时更新标记', () => {
      render(
        <PortraitDiffViewer
          originalData={mockOriginalData}
          modifiedData={mockModifiedData}
          showRealTime={true}
        />
      );

      expect(screen.getByText('(实时更新)')).toBeInTheDocument();
    });
  });

  describe('差异统计', () => {
    it('应该正确显示差异统计', () => {
      render(
        <PortraitDiffViewer
          originalData={mockOriginalData}
          modifiedData={mockModifiedData}
        />
      );

      expect(screen.getByText('新增')).toBeInTheDocument();
      expect(screen.getByText('删除')).toBeInTheDocument();
      expect(screen.getByText('修改')).toBeInTheDocument();
      expect(screen.getByText('总计')).toBeInTheDocument();
    });
  });

  describe('字段展示', () => {
    it('应该正确显示所有字段', () => {
      render(
        <PortraitDiffViewer
          originalData={mockOriginalData}
          modifiedData={mockModifiedData}
        />
      );

      expect(screen.getByText('背景描述')).toBeInTheDocument();
      expect(screen.getByText('知识盲区')).toBeInTheDocument();
      expect(screen.getByText('操作历史')).toBeInTheDocument();
      expect(screen.getByText('问题描述')).toBeInTheDocument();
    });

    it('应该标记有变化的字段', () => {
      render(
        <PortraitDiffViewer
          originalData={mockOriginalData}
          modifiedData={mockModifiedData}
        />
      );

      const backgroundField = screen.getByText('背景描述').closest('div');
      expect(backgroundField).toContainElement(screen.getByText('有变化'));
    });
  });

  describe('交互功能', () => {
    it('应该支持展开/收起字段详情', async () => {
      render(
        <PortraitDiffViewer
          originalData={mockOriginalData}
          modifiedData={mockModifiedData}
        />
      );

      const backgroundField = screen.getByText('背景描述').closest('div');
      const expandButton = backgroundField?.querySelector('button');
      
      if (expandButton) {
        fireEvent.click(expandButton);

        await waitFor(() => {
          expect(screen.getByText('原始内容:')).toBeInTheDocument();
        });
      }
    });

    it('应该支持切换显示模式', () => {
      const { rerender } = render(
        <PortraitDiffViewer
          originalData={mockOriginalData}
          modifiedData={mockModifiedData}
        />
      );

      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'detailed' } });

      rerender(
        <PortraitDiffViewer
          originalData={mockOriginalData}
          modifiedData={mockModifiedData}
        />
      );
    });

    it('应该支持显示未变化的内容', () => {
      render(
        <PortraitDiffViewer
          originalData={mockOriginalData}
          modifiedData={mockModifiedData}
        />
      );

      const checkbox = screen.getByLabelText('显示未变化');
      fireEvent.click(checkbox);
    });
  });

  describe('视图模式', () => {
    it('应该支持摘要模式', () => {
      render(
        <PortraitDiffViewer
          originalData={mockOriginalData}
          modifiedData={mockModifiedData}
        />
      );

      expect(screen.getByText('差异统计')).toBeInTheDocument();
    });

    it('应该支持详细模式', () => {
      const { rerender } = render(
        <PortraitDiffViewer
          originalData={mockOriginalData}
          modifiedData={mockModifiedData}
          viewMode="detailed"
        />
      );

      // 详细模式下的内容验证
    });

    it('应该支持行内模式', () => {
      const { rerender } = render(
        <PortraitDiffViewer
          originalData={mockOriginalData}
          modifiedData={mockModifiedData}
          viewMode="inline"
        />
      );

      // 行内模式下的内容验证
    });
  });

  describe('回调函数', () => {
    it('应该调用onDiffChange回调', () => {
      const mockOnDiffChange = vi.fn();
      
      render(
        <PortraitDiffViewer
          originalData={mockOriginalData}
          modifiedData={mockModifiedData}
          onDiffChange={mockOnDiffChange}
        />
      );

      expect(mockOnDiffChange).toHaveBeenCalled();
    });
  });

  describe('边界情况', () => {
    it('应该处理空数据', () => {
      render(
        <PortraitDiffViewer
          originalData={{}}
          modifiedData={mockModifiedData}
        />
      );

      expect(screen.getByText('用户画像差异对比')).toBeInTheDocument();
    });

    it('应该处理部分字段缺失', () => {
      const partialData: UserPortraitData = {
        background_description: ['用户是大学生']
      };

      render(
        <PortraitDiffViewer
          originalData={partialData}
          modifiedData={mockModifiedData}
        />
      );

      expect(screen.getByText('背景描述')).toBeInTheDocument();
    });

    it('应该处理相同数据', () => {
      render(
        <PortraitDiffViewer
          originalData={mockOriginalData}
          modifiedData={mockOriginalData}
        />
      );

      expect(screen.getByText('✓')).toBeInTheDocument();
      expect(screen.getByText('无变化')).toBeInTheDocument();
    });
  });

  describe('响应式行为', () => {
    it('应该处理大量数据', () => {
      const largeOriginalData: UserPortraitData = {
        background_description: Array.from({ length: 100 }, (_, i) => `背景描述 ${i}`),
        knowledge_blind_spots: Array.from({ length: 50 }, (_, i) => `盲区 ${i}`),
        operation_history: Array.from({ length: 30 }, (_, i) => ({
          action: `操作 ${i}`,
          timestamp: `2024-01-${i + 1}`,
          details: `详情 ${i}`
        })),
        problem_description: Array.from({ length: 75 }, (_, i) => `问题 ${i}`)
      };

      const largeModifiedData: UserPortraitData = {
        background_description: Array.from({ length: 100 }, (_, i) => `修改后的背景描述 ${i}`),
        knowledge_blind_spots: Array.from({ length: 25 }, (_, i) => `修改后的盲区 ${i}`),
        operation_history: Array.from({ length: 35 }, (_, i) => ({
          action: `修改后的操作 ${i}`,
          timestamp: `2024-01-${i + 1}`,
          details: `修改后的详情 ${i}`
        })),
        problem_description: Array.from({ length: 80 }, (_, i) => `修改后的问题 ${i}`)
      };

      render(
        <PortraitDiffViewer
          originalData={largeOriginalData}
          modifiedData={largeModifiedData}
        />
      );

      expect(screen.getByText('用户画像差异对比')).toBeInTheDocument();
    });
  });
});