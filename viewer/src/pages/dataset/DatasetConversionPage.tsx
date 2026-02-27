import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, RotateCcw, Filter, Save, CheckCircle, BarChart3, GitCompare, Calendar, User, Clock, Download, Upload } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { datasetApi, DatasetRecord } from '@/lib/datasetApi';
import { annotationApi, ConversationAnnotation } from '@/lib/annotationApi';
import { DateRangePicker } from '@/components/DateRangePicker';

const DatasetConversionPage: React.FC = () => {
  const { id: sourceDatasetId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [selectedAnnotations, setSelectedAnnotations] = useState<string[]>([]);
  const [newDatasetName, setNewDatasetName] = useState('');
  const [newDatasetDescription, setNewDatasetDescription] = useState('');
  const [qualityFilter, setQualityFilter] = useState<number>(0);
  const [accuracyFilter, setAccuracyFilter] = useState<string[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [annotatorFilter, setAnnotatorFilter] = useState<string[]>([]);
  const [dateRangeFilter, setDateRangeFilter] = useState<{start?: Date, end?: Date}>({});
  const [isDateSelectOpen, setIsDateSelectOpen] = useState(false);
  const [quickDate, setQuickDate] = useState<string>('');
  const [dataTypeFilter, setDataTypeFilter] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [createdDatasetId, setCreatedDatasetId] = useState<string>('');

  // 计算当前激活的过滤器数量
  const activeFiltersCount = React.useMemo(() => {
    let count = 0;
    if (qualityFilter > 0) count++;
    if (accuracyFilter.length > 0) count++;
    if (categoryFilter.length > 0) count++;
    if (annotatorFilter.length > 0) count++;
    if (dateRangeFilter.start && dateRangeFilter.end) count++;
    if (dataTypeFilter.length > 0) count++;
    return count;
  }, [qualityFilter, accuracyFilter, categoryFilter, annotatorFilter, dateRangeFilter, dataTypeFilter]);

  // 获取源数据集信息
  const { data: sourceDataset } = useQuery({
    queryKey: ['dataset', sourceDatasetId],
    queryFn: () => datasetApi.getDataset(sourceDatasetId),
    enabled: !!sourceDatasetId,
  });

  // 获取已标注的数据 - 加入所有新过滤器
  const { data: annotatedConversations, isLoading } = useQuery({
    queryKey: [
      'annotated-conversations',
      sourceDatasetId,
      qualityFilter,
      accuracyFilter,
      categoryFilter,
      annotatorFilter,
      dateRangeFilter,
      dataTypeFilter
    ],
    queryFn: () => annotationApi.getAnnotatedConversations(sourceDatasetId, {
      min_quality_score: qualityFilter > 0 ? qualityFilter : undefined,
      accuracy: accuracyFilter.length > 0 ? accuracyFilter : undefined,
      category: categoryFilter.length > 0 ? categoryFilter : undefined,
      annotator: annotatorFilter.length > 0 ? annotatorFilter : undefined,
      start_date: dateRangeFilter.start ? dateRangeFilter.start.toISOString() : undefined,
      end_date: dateRangeFilter.end ? dateRangeFilter.end.toISOString() : undefined,
      data_types: dataTypeFilter.length > 0 ? dataTypeFilter : undefined,
    }),
    enabled: !!sourceDatasetId,
  });

  // 获取所有标注数据的分类和准确性选项
  const { data: annotationStats } = useQuery({
    queryKey: ['annotation-stats', sourceDatasetId],
    queryFn: () => annotationApi.getStats(sourceDatasetId),
    enabled: !!sourceDatasetId,
  });

  useEffect(() => {
    if (annotatedConversations) {
      // 默认选中所有标注数据，过滤掉空ID
      setSelectedAnnotations(annotatedConversations.filter(item => item.id && item.id !== '').map(item => item.id));
    }
  }, [annotatedConversations]);

  const handleSelectAll = (checked: boolean) => {
    if (checked && annotatedConversations) {
      setSelectedAnnotations(annotatedConversations.filter(item => item.id && item.id !== '').map(item => item.id));
    } else {
      setSelectedAnnotations([]);
    }
  };

  const handleSelectItem = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedAnnotations(prev => [...prev, id]);
    } else {
      setSelectedAnnotations(prev => prev.filter(item => item !== id));
    }
  };

  const handleCreateDataset = async () => {
    if (!newDatasetName.trim() || selectedAnnotations.length === 0) return;

    setIsCreating(true);
    try {
      const newDataset = await datasetApi.createDatasetFromAnnotations({
        name: newDatasetName,
        description: newDatasetDescription,
        annotation_ids: selectedAnnotations,
        source_dataset_id: sourceDatasetId,
      });

      setCreatedDatasetId(newDataset.id);
      alert(`成功创建新数据集: ${newDataset.name}`);
      // 提供查看对比的选项
      const viewComparison = window.confirm('是否查看新数据集与原数据集的对比？');
      if (viewComparison) {
        navigate(`/datasets/${newDataset.id}/compare/${sourceDatasetId}`);
      }
    } catch (error) {
      console.error('创建数据集失败:', error);
      alert('创建数据集失败，请重试');
    } finally {
      setIsCreating(false);
    }
  };

  const resetFilters = () => {
    setQualityFilter(0);
    setAccuracyFilter([]);
    setCategoryFilter([]);
    setAnnotatorFilter([]);
    setDateRangeFilter({});
    setQuickDate('');
    setDataTypeFilter([]);
  };

  const handleViewNewDataset = () => {
    if (createdDatasetId) {
      navigate(`/datasets/${createdDatasetId}`);
    }
  };

  const handleViewComparison = () => {
    if (createdDatasetId && sourceDatasetId) {
      navigate(`/datasets/compare/${sourceDatasetId}/${createdDatasetId}`);
    }
  };

  const allSelected = annotatedConversations 
    ? selectedAnnotations.length === annotatedConversations.length 
    : false;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">数据集转换</h1>
          <p className="text-gray-600">
            从标注数据创建新的高质量数据集
          </p>
        </div>
        <div className="flex gap-2">
          {createdDatasetId && (
            <>
              <Button
                onClick={handleViewComparison}
                variant="default"
                className="gap-2"
              >
                <GitCompare className="w-4 h-4" />
                对比数据集
              </Button>
              <Button
                onClick={handleViewNewDataset}
                variant="outline"
                className="gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                查看新数据集
              </Button>
            </>
          )}
          <Button
            onClick={() => navigate(`/annotation?dataset=${sourceDatasetId}`)}
            variant="outline"
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            返回标注
          </Button>
        </div>
      </div>

      {/* 源数据集信息 */}
      {sourceDataset && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>源数据集信息</span>
              <Badge variant="outline" className="bg-blue-50">
                {sourceDataset.data_type}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-sm text-gray-500">数据集名称</Label>
                <p className="font-medium">{sourceDataset.name}</p>
              </div>
              <div>
                <Label className="text-sm text-gray-500">数据项数量</Label>
                <p className="font-medium">{sourceDataset.item_count || 0}</p>
              </div>
              <div>
                <Label className="text-sm text-gray-500">创建时间</Label>
                <p className="font-medium">
                  {new Date(sourceDataset.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          </CardContent>
          {/* 过滤统计 */}
          {(annotatedConversations?.length || 0) > 0 && (
            <div className="pt-4 border-t bg-gray-50 rounded-b-lg">
              <div className="px-6 pb-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">过滤效果：</span>
                  <div className="flex items-center gap-4">
                    <Badge variant="outline">
                      原始数据：{annotationStats?.total || 'N/A'}
                    </Badge>
                    <span className="text-gray-400">→</span>
                    <Badge variant="secondary" className="bg-blue-50 text-blue-700">
                      过滤后：<b>{annotatedConversations?.length || 0}</b>
                    </Badge>
                    <Badge variant="outline">
                      筛选率：{annotationStats?.total ?
                        Math.round(((annotationStats.total - (annotatedConversations?.length || 0)) / annotationStats.total) * 100) : 0}%
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* 筛选条件 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              筛选条件
              {activeFiltersCount > 0 && (
                <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                  {activeFiltersCount} 个激活
                </Badge>
              )}
            </CardTitle>
            <Button
              onClick={resetFilters}
              variant="ghost"
              size="sm"
              className="gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              重置筛选
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 快速过滤器 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 质量评分 */}
            <div>
              <Label className="flex items-center gap-2">
                <span>⭐</span>
                最低质量评分
              </Label>
              <Select
                value={qualityFilter.toString()}
                onValueChange={(value) => setQualityFilter(Number(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择质量评分" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">不限</SelectItem>
                  <SelectItem value="1">1星及以上</SelectItem>
                  <SelectItem value="2">2星及以上</SelectItem>
                  <SelectItem value="3">3星及以上</SelectItem>
                  <SelectItem value="4">4星及以上</SelectItem>
                  <SelectItem value="5">5星</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 数据类型 */}
            <div>
              <Label className="flex items-center gap-2">
                <span>📁</span>
                数据类型
              </Label>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {['PORTRAIT', 'DIALOGUE', 'EVALUATION', 'HUMAN_HUMAN_DIALOGUE'].map((type) => (
                  <div key={type} className="flex items-center space-x-2">
                    <Checkbox
                      id={`datatype-${type}`}
                      checked={dataTypeFilter.includes(type)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setDataTypeFilter(prev => [...prev, type]);
                        } else {
                          setDataTypeFilter(prev => prev.filter(t => t !== type));
                        }
                      }}
                    />
                    <Label htmlFor={`datatype-${type}`} className="text-sm">
                      {type === 'PORTRAIT' ? '用户画像' :
                       type === 'DIALOGUE' ? '对话合成' :
                       type === 'EVALUATION' ? '质量评估' :
                       '人人对话'}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* 标注者 */}
            <div>
              <Label className="flex items-center gap-2">
                <User className="w-4 h-4" />
                标注者
              </Label>
              <Input
                placeholder="输入标注者名称（支持模糊匹配）"
                value={annotatorFilter.join(", ")}
                onChange={(e) => {
                  const names = e.target.value.split(",").map(name => name.trim()).filter(Boolean);
                  setAnnotatorFilter(names);
                }}
              />
              <p className="text-xs text-gray-500 mt-1">
                多个标注者用逗号分隔，如：张三, 李四
              </p>
            </div>

            {/* 日期范围 */}
            <div>
              <Label className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                标注日期
              </Label>
              <DateRangePicker
                dateRange={dateRangeFilter}
                onDateRangeChange={setDateRangeFilter}
                quickDate={quickDate}
                onQuickDateChange={setQuickDate}
              />
            </div>
          </div>

          {/* 高级过滤器 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
            {/* 准确性 */}
            <div>
              <Label className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                准确性
              </Label>
              <div className="space-y-2">
                {[
                  { value: 'correct', label: '完全正确', color: 'text-green-600' },
                  { value: 'partial', label: '部分正确', color: 'text-yellow-600' },
                  { value: 'incorrect', label: '完全错误', color: 'text-red-600' }
                ].map((accuracy) => (
                  <div key={accuracy.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`accuracy-${accuracy.value}`}
                      checked={accuracyFilter.includes(accuracy.value)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setAccuracyFilter(prev => [...prev, accuracy.value]);
                        } else {
                          setAccuracyFilter(prev => prev.filter(a => a !== accuracy.value));
                        }
                      }}
                    />
                    <Label
                      htmlFor={`accuracy-${accuracy.value}`}
                      className={`text-sm ${accuracy.color} flex items-center gap-2`}
                    >
                      <div
                        className={`w-3 h-3 rounded-full ${
                          accuracy.value === 'correct' ? 'bg-green-500' :
                          accuracy.value === 'partial' ? 'bg-yellow-500' :
                          'bg-red-500'
                        }`}
                      />
                      {accuracy.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* 分类标签 */}
            <div>
              <Label className="flex items-center gap-2">
                <span>🏷️</span>
                分类标签
              </Label>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {annotationStats?.category_distribution &&
                  Object.entries(annotationStats.category_distribution).map(([category, count]) => (
                    <div key={category} className="flex items-center space-x-2">
                      <Checkbox
                        id={`category-${category}`}
                        checked={categoryFilter.includes(category)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setCategoryFilter(prev => [...prev, category]);
                          } else {
                            setCategoryFilter(prev => prev.filter(c => c !== category));
                          }
                        }}
                      />
                      <Label htmlFor={`category-${category}`} className="text-sm flex-1">
                        <Badge variant="outline" className="mr-2">
                          {category}
                        </Badge>
                        <span className="text-gray-500">({count})</span>
                      </Label>
                    </div>
                  ))}
                {!annotationStats?.category_distribution && (
                  <div className="text-sm text-gray-500">暂无分类数据</div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 当前过滤条件摘要 */}
      {(qualityFilter > 0 ||
        accuracyFilter.length > 0 ||
        categoryFilter.length > 0 ||
        annotatorFilter.length > 0 ||
        (dateRangeFilter.start && dateRangeFilter.end) ||
        dataTypeFilter.length > 0) && (
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="w-4 h-4 text-blue-600" />
              <span className="text-blue-900">当前过滤条件</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-wrap gap-2">
              {qualityFilter > 0 && (
                <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                  质量 ≥ {qualityFilter}⭐
                </Badge>
              )}
              {accuracyFilter.map(accuracy => (
                <Badge key={accuracy} variant="secondary" className="bg-green-100 text-green-800">
                  {accuracy === 'correct' ? '完全正确' : accuracy === 'partial' ? '部分正确' : '完全错误'}
                </Badge>
              ))}
              {categoryFilter.map(category => (
                <Badge key={category} variant="secondary" className="bg-purple-100 text-purple-800">
                  {category}
                </Badge>
              ))}
              {annotatorFilter.map(annotator => (
                <Badge key={annotator} variant="secondary" className="bg-orange-100 text-orange-800">
                  标注者: {annotator}
                </Badge>
              ))}
              {dataTypeFilter.map(type => (
                <Badge key={type} variant="secondary" className="bg-indigo-100 text-indigo-800">
                  {type === 'PORTRAIT' ? '用户画像' :
                   type === 'DIALOGUE' ? '对话合成' :
                   type === 'EVALUATION' ? '质量评估' :
                   '人人对话'}
                </Badge>
              ))}
              {dateRangeFilter.start && dateRangeFilter.end && (
                <Badge variant="secondary" className="bg-teal-100 text-teal-800">
                  {dateRangeFilter.start.toLocaleDateString('zh-CN')} - {dateRangeFilter.end.toLocaleDateString('zh-CN')}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 标注数据列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>标注数据列表</span>
            <div className="text-sm text-gray-500">
              已选择 {selectedAnnotations.length} / {annotatedConversations?.length || 0} 项
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">加载中...</div>
          ) : annotatedConversations && annotatedConversations.length > 0 ? (
            <>
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={allSelected}
                          onCheckedChange={handleSelectAll}
                        />
                      </TableHead>
                      <TableHead>预览</TableHead>
                      <TableHead className="w-24">质量评分</TableHead>
                      <TableHead className="w-24">准确性</TableHead>
                      <TableHead className="w-32">分类</TableHead>
                      <TableHead className="w-24">标注者</TableHead>
                      <TableHead className="w-24">标注时间</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {annotatedConversations.map((item) => {
                      const isSelected = selectedAnnotations.includes(item.id);
                      const firstUserMessage = item.original_data?.conversations?.find(
                        (msg: any) => msg.from === 'user' || msg.role === 'user'
                      );
                      const preview = firstUserMessage 
                        ? (firstUserMessage.value || firstUserMessage.content || '').substring(0, 50) + '...'
                        : '无预览内容';

                      return (
                        <TableRow key={item.id} className={isSelected ? 'bg-blue-50' : ''}>
                          <TableCell>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={(checked) => handleSelectItem(item.id, checked as boolean)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{preview}</TableCell>
                          <TableCell>
                            <div className="flex">
                              {[...Array(5)].map((_, i) => (
                                <span 
                                  key={i} 
                                  className={`text-xs ${i < (item.quality_score || 0) ? 'text-yellow-400' : 'text-gray-300'}`}
                                >
                                  ★
                                </span>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={
                                item.accuracy === 'correct' ? 'default' :
                                item.accuracy === 'partial' ? 'secondary' : 'destructive'
                              }
                              className="text-xs"
                            >
                              {item.accuracy === 'correct' ? '正确' : 
                               item.accuracy === 'partial' ? '部分' : '错误'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {item.category && (
                              <Badge variant="outline" className="text-xs">
                                {item.category}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {item.annotated_by ? (
                              <Badge variant="outline" className="text-xs bg-gray-50 text-gray-700">
                                {item.annotated_by}
                              </Badge>
                            ) : (
                              <span className="text-xs text-gray-400">未标注</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {item.annotation_time ? (
                              <span className="text-xs text-gray-500">
                                {new Date(item.annotation_time).toLocaleDateString('zh-CN')}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* 创建新数据集表单 */}
              <div className="mt-6 p-4 border rounded-lg bg-gray-50">
                <div className="flex items-center gap-2 mb-4">
                  <Save className="w-5 h-5 text-gray-600" />
                  <h3 className="font-medium">创建新数据集</h3>
                  {createdDatasetId && (
                    <Badge variant="outline" className="ml-auto bg-green-50 text-green-700">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      创建成功
                    </Badge>
                  )}
                </div>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="dataset-name">数据集名称 *</Label>
                    <Input
                      id="dataset-name"
                      value={newDatasetName}
                      onChange={(e) => setNewDatasetName(e.target.value)}
                      placeholder="请输入新数据集的名称"
                      disabled={!!createdDatasetId}
                    />
                  </div>
                  <div>
                    <Label htmlFor="dataset-description">描述</Label>
                    <Input
                      id="dataset-description"
                      value={newDatasetDescription}
                      onChange={(e) => setNewDatasetDescription(e.target.value)}
                      placeholder="可选的数据集描述"
                      disabled={!!createdDatasetId}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-500">
                      将从 {selectedAnnotations.length} 个标注样本创建新数据集
                    </div>
                    {!createdDatasetId ? (
                      <Button
                        onClick={handleCreateDataset}
                        disabled={!newDatasetName.trim() || selectedAnnotations.length === 0 || isCreating}
                        className="gap-2"
                      >
                        {isCreating ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            创建中...
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4" />
                            创建数据集
                          </>
                        )}
                      </Button>
                    ) : (
                      <Button
                        onClick={() => {
                          setNewDatasetName('');
                          setNewDatasetDescription('');
                          setSelectedAnnotations([]);
                          setCreatedDatasetId('');
                        }}
                        variant="outline"
                        className="gap-2"
                      >
                        <RotateCcw className="w-4 h-4" />
                        重新创建
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-gray-500">
              暂无符合条件的标注数据
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DatasetConversionPage;