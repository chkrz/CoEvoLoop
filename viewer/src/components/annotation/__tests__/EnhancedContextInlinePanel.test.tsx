import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EnhancedContextInlinePanel } from '../EnhancedContextInlinePanel';
import { ContextMessage } from '../DialogueAnnotationView';

// 模拟 toast
jest.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

// 模拟剪贴板
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn(),
  },
});

describe('EnhancedContextInlinePanel', () => {
  const mockMessages: ContextMessage[] = [
    {
      id: '1',
      role: 'user',
      content: 'Hello, this is a test message',
      timestamp: new Date('2024-01-15T10:30:00').toISOString(),
    },
    {
      id: '2',
      role: 'assistant',
      content: 'This is an AI response',
      timestamp: new Date('2024-01-15T10:31:00').toISOString(),
    },
  ];

  const defaultProps = {
    contextMessages: mockMessages,
    isExpanded: true,
    onToggle: jest.fn(),
    onEdit: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('渲染测试', () => {
    it('应该正确渲染消息列表', () => {
      render(<EnhancedContextInlinePanel {...defaultProps} />);
      
      expect(screen.getByText('用户')).toBeInTheDocument();
      expect(screen.getByText('AI助手')).toBeInTheDocument();
      expect(screen.getByText('Hello, this is a test message')).toBeInTheDocument();
      expect(screen.getByText('This is an AI response')).toBeInTheDocument();
    });

    it('应该显示统计信息', () => {
      render(<EnhancedContextInlinePanel {...defaultProps} />);
      
      expect(screen.getByText('2条')).toBeInTheDocument();
      expect(screen.getByText('1用户')).toBeInTheDocument();
      expect(screen.getByText('1AI')).toBeInTheDocument();
    });

    it('空状态应该显示正确信息', () => {
      render(
        <EnhancedContextInlinePanel
          {...defaultProps}
          contextMessages={[]}
        />
      );
      
      expect(screen.getByText('暂无相关Context消息')).toBeInTheDocument();
    });
  });

  describe('交互测试', () => {
    it('应该响应双击进入编辑模式', async () => {
      const user = userEvent.setup();
      render(<EnhancedContextInlinePanel {...defaultProps} />);
      
      const messageContent = screen.getByText('Hello, this is a test message');
      await user.dblClick(messageContent);
      
      expect(screen.getByRole('textbox')).toBeInTheDocument();
      expect(screen.getByText('取消 (Esc)')).toBeInTheDocument();
      expect(screen.getByText('保存 (Ctrl+Enter)')).toBeInTheDocument();
    });

    it('应该响应键盘快捷键', async () => {
      const user = userEvent.setup();
      render(<EnhancedContextInlinePanel {...defaultProps} />);
      
      // 进入编辑模式
      const messageCard = screen.getAllByRole('article')[0];
      messageCard.focus();
      await user.keyboard('{Enter}');
      
      const textarea = screen.getByRole('textbox');
      expect(textarea).toBeInTheDocument();
      
      // 测试 Escape 取消
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });

    it('应该保存编辑内容', async () => {
      const user = userEvent.setup();
      render(<EnhancedContextInlinePanel {...defaultProps} />);
      
      // 进入编辑模式
      const messageContent = screen.getByText('Hello, this is a test message');
      await user.dblClick(messageContent);
      
      const textarea = screen.getByRole('textbox');
      await user.clear(textarea);
      await user.type(textarea, 'Updated message content');
      
      const saveButton = screen.getByText('保存 (Ctrl+Enter)');
      await user.click(saveButton);
      
      expect(defaultProps.onEdit).toHaveBeenCalledWith(0, 'Updated message content');
    });

    it('应该复制消息内容', async () => {
      const user = userEvent.setup();
      const mockClipboard = navigator.clipboard.writeText as jest.Mock;
      
      render(<EnhancedContextInlinePanel {...defaultProps} />);
      
      // 悬停显示复制按钮
      const messageCard = screen.getAllByRole('article')[0];
      fireEvent.mouseEnter(messageCard);
      
      const copyButton = screen.getAllByTitle('复制消息')[0];
      await user.click(copyButton);
      
      expect(mockClipboard).toHaveBeenCalledWith('Hello, this is a test message');
    });
  });

  describe('响应式测试', () => {
    it('应该适配不同屏幕尺寸', () => {
      const { container } = render(<EnhancedContextInlinePanel {...defaultProps} />);
      
      // 检查响应式类是否存在
      expect(container.querySelector('.sm\:inline')).toBeInTheDocument();
      expect(container.querySelector('.md\:flex')).toBeInTheDocument();
    });
  });

  describe('无障碍测试', () => {
    it('应该有正确的ARIA属性', () => {
      render(<EnhancedContextInlinePanel {...defaultProps} />);
      
      const messageCards = screen.getAllByRole('article');
      expect(messageCards[0]).toHaveAttribute('aria-label', 'user消息，双击或按Enter键编辑');
      expect(messageCards[0]).toHaveAttribute('tabIndex', '0');
    });

    it('应该支持键盘导航', async () => {
      const user = userEvent.setup();
      render(<EnhancedContextInlinePanel {...defaultProps} />);
      
      const firstMessage = screen.getAllByRole('article')[0];
      firstMessage.focus();
      
      await user.keyboard('{Enter}');
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });
  });

  describe('边界测试', () => {
    it('应该处理空内容', async () => {
      const user = userEvent.setup();
      const messagesWithEmpty = [
        {
          id: '1',
          role: 'user' as const,
          content: '',
          timestamp: new Date().toISOString(),
        },
      ];
      
      render(
        <EnhancedContextInlinePanel
          {...defaultProps}
          contextMessages={messagesWithEmpty}
        />
      );
      
      const messageContent = screen.getByRole('article');
      await user.dblClick(messageContent);
      
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveValue('');
    });

    it('应该处理很长的消息', async () => {
      const longMessage = 'A'.repeat(1000);
      const messagesWithLong = [
        {
          id: '1',
          role: 'user' as const,
          content: longMessage,
          timestamp: new Date().toISOString(),
        },
      ];
      
      render(
        <EnhancedContextInlinePanel
          {...defaultProps}
          contextMessages={messagesWithLong}
        />
      );
      
      expect(screen.getByText('1000 字符')).toBeInTheDocument();
    });
  });
});