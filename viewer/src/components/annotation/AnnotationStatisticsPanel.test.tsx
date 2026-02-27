import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AnnotationStatisticsPanel } from './AnnotationStatisticsPanel';

// 创建测试用的QueryClient
const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

// Mock annotationApiV2
jest.mock('@/lib/annotationApiV2', () => ({
  annotationApiV2: {
    getAnnotationStatistics: jest.fn(),
  },
})));

describe('AnnotationStatisticsPanel', () => {
  const mockStats = {
    assistant_model_score: 85.5,
    turing_score: 78.2,
    kappa_score: 92.1,
    total_annotations: 1250,
    dataset_id: 'test_dataset',
    message: '统计信息获取成功',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading state', () => {
    const queryClient = createTestQueryClient();
    const { annotationApiV2 } = require('@/lib/annotationApiV2');
    annotationApiV2.getAnnotationStatistics.mockImplementation(() => new Promise(() => {}));

    render(
      <QueryClientProvider client={queryClient}>
        <AnnotationStatisticsPanel datasetId="test_dataset" />
      </QueryClientProvider>
    );

    expect(screen.getByText('标注统计信息')).toBeInTheDocument();
  });

  it('renders statistics correctly', async () => {
    const queryClient = createTestQueryClient();
    const { annotationApiV2 } = require('@/lib/annotationApiV2');
    annotationApiV2.getAnnotationStatistics.mockResolvedValue(mockStats);

    render(
      <QueryClientProvider client={queryClient}>
        <AnnotationStatisticsPanel datasetId="test_dataset" />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('85.5')).toBeInTheDocument();
      expect(screen.getByText('78.2')).toBeInTheDocument();
      expect(screen.getByText('92.1')).toBeInTheDocument();
      expect(screen.getByText('总计: 1250 条')).toBeInTheDocument();
    });
  });

  it('handles empty data gracefully', async () => {
    const queryClient = createTestQueryClient();
    const { annotationApiV2 } = require('@/lib/annotationApiV2');
    annotationApiV2.getAnnotationStatistics.mockResolvedValue({
      assistant_model_score: 0,
      turing_score: 0,
      kappa_score: 0,
      total_annotations: 0,
      message: '暂无标注数据',
    });

    render(
      <QueryClientProvider client={queryClient}>
        <AnnotationStatisticsPanel datasetId="empty_dataset" />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('0.0')).toBeInTheDocument();
      expect(screen.getByText('暂无标注数据')).toBeInTheDocument();
    });
  });
});