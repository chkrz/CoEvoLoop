import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import EvaluationDiffField from '../EvaluationDiffField';

describe('EvaluationDiffField', () => {
  const defaultProps = {
    fieldName: '测试字段',
    originalValue: '原始值',
    editedValue: '修改值',
    onValueChange: jest.fn(),
    isEditing: false,
    onEditToggle: jest.fn(),
  };

  it('应该正确渲染差异内容', () => {
    render(<EvaluationDiffField {...defaultProps} />);
    
    expect(screen.getByText('测试字段')).toBeInTheDocument();
    expect(screen.getByText('原始:')).toBeInTheDocument();
    expect(screen.getByText('修改:')).toBeInTheDocument();
  });

  it('应该显示已修改标记', () => {
    render(<EvaluationDiffField {...defaultProps} />);
    
    expect(screen.getByText('已修改')).toBeInTheDocument();
  });

  it('应该处理无变化的情况', () => {
    const props = {
      ...defaultProps,
      originalValue: '相同值',
      editedValue: '相同值',
    };
    
    render(<EvaluationDiffField {...props} />);
    
    expect(screen.queryByText('已修改')).not.toBeInTheDocument();
    expect(screen.getByText('相同值')).toBeInTheDocument();
  });

  it('应该处理分数类型', () => {
    const props = {
      ...defaultProps,
      originalValue: 0.5,
      editedValue: 0.8,
      type: 'score' as const,
    };
    
    render(<EvaluationDiffField {...props} />);
    
    expect(screen.getByText('0.50/1')).toBeInTheDocument();
    expect(screen.getByText('0.80/1')).toBeInTheDocument();
  });

  it('应该触发编辑模式', () => {
    render(<EvaluationDiffField {...defaultProps} />);
    
    const editButton = screen.getByRole('button', { name: /edit/i });
    fireEvent.click(editButton);
    
    expect(defaultProps.onEditToggle).toHaveBeenCalled();
  });
});