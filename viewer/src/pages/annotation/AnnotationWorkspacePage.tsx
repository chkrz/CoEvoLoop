import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AnnotationPage from './AnnotationPage';
import PortraitAnnotationPage from './PortraitAnnotationPage';
import EvaluationAnnotationPage from './EvaluationAnnotationPage';
import HumanDialogueAnnotationPage from './HumanDialogueAnnotationPage';
import { annotationApiV2 } from '@/lib/annotationApiV2';
import { useQuery } from '@tanstack/react-query';

const AnnotationWorkspacePage: React.FC = () => {
  const { datasetId } = useParams<{ datasetId: string }>();
  const navigate = useNavigate();

  // 获取数据集信息来确定类型
  const { data: datasetInfo, isLoading } = useQuery({
    queryKey: ['dataset-info', datasetId],
    queryFn: () => annotationApiV2.getDatasetInfo(datasetId!),
    enabled: !!datasetId,
  });

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p>加载中...</p>
        </div>
      </div>
    );
  }

  if (!datasetId || !datasetInfo) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">数据集不存在</h2>
          <button 
            onClick={() => navigate('/annotation')}
            className="text-blue-600 hover:text-blue-800"
          >
            返回标注首页
          </button>
        </div>
      </div>
    );
  }

  const handleBack = () => {
    navigate('/annotation');
  };

  const renderAnnotationPage = () => {
    const commonProps = {
      datasetId,
      onBack: handleBack,
    };

    switch (datasetInfo.data_type) {
      case 'PORTRAIT':
        return <PortraitAnnotationPage {...commonProps} />;
      case 'EVALUATION':
        return <EvaluationAnnotationPage {...commonProps} />;
      case 'HUMAN_HUMAN_DIALOGUE':
        return <HumanDialogueAnnotationPage {...commonProps} />;
      case 'DIALOGUE':
      default:
        return <AnnotationPage {...commonProps} />;
    }
  };

  return (
    <div className="h-screen">
      {renderAnnotationPage()}
    </div>
  );
};

export default AnnotationWorkspacePage;