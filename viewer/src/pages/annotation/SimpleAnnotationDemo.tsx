import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Star, Save, ChevronLeft, ChevronRight } from 'lucide-react';

// 模拟对话数据
const mockConversations = [
  {
    id: 1,
    conversations: [
      {
        from: "user",
        value: "你好，我需要绑定一个外币银行账户，并确认一下我的账户是否符合180天的提现条件。但目前我在绑定银行卡时遇到了问题，系统发送验证码到我的手机号，现在这个号码无法使用，能不能通过邮箱协助我完成绑定？"
      },
      {
        from: "assistant",
        value: "您好，很抱歉给您带来不便了。\n\n绑定银行账户时，验证码是默认发送到您账户绑定的安全手机号上的哦。\n\n不过，如果您原来的手机号已经不用了，**是可以操作修改的**。请问您需要了解如何修改绑定的手机号码吗？"
      }
    ],
    annotation: {
      quality_score: 4,
      accuracy: "correct",
      category: "account",
      tags: ["绑定银行卡", "手机号验证", "邮箱验证"],
      notes: "回答准确，礼貌用语，提供了可行的解决方案"
    }
  },
  {
    id: 2,
    conversations: [
      {
        from: "user",
        value: "我想了解一下WorldFirst的收款账户支持哪些币种？"
      },
      {
        from: "assistant",
        value: "WorldFirst支持多种主流币种收款，包括：\n\n- 美元 (USD)\n- 欧元 (EUR)\n- 英镑 (GBP)\n- 加元 (CAD)\n- 澳元 (AUD)\n- 日元 (JPY)\n- 新加坡元 (SGD)\n- 港币 (HKD)\n\n您可以根据业务需求选择相应的币种账户。"
      }
    ],
    annotation: {
      quality_score: 5,
      accuracy: "correct",
      category: "general",
      tags: ["币种支持", "收款账户"],
      notes: "信息完整，回答清晰"
    }
  }
];

const SimpleAnnotationDemo: React.FC = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [editingData, setEditingData] = useState(mockConversations[0]);
  const [annotation, setAnnotation] = useState(mockConversations[0].annotation);
  const [isEditing, setIsEditing] = useState(false);

  const currentConversation = mockConversations[currentIndex];

  const handleSave = () => {
    console.log('保存标注:', {
      conversation: editingData,
      annotation: annotation
    });
    alert('标注已保存！');
    setIsEditing(false);
  };

  const handleNext = () => {
    if (currentIndex < mockConversations.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setEditingData(mockConversations[currentIndex + 1]);
      setAnnotation(mockConversations[currentIndex + 1].annotation);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setEditingData(mockConversations[currentIndex - 1]);
      setAnnotation(mockConversations[currentIndex - 1].annotation);
    }
  };

  const handleConversationEdit = (index: number, field: string, value: string) => {
    const newData = { ...editingData };
    newData.conversations[index][field] = value;
    setEditingData(newData);
  };

  const renderStars = (rating: number, onRate: (rating: number) => void) => {
    return (
      <div className="flex space-x-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-6 h-6 cursor-pointer ${
              star <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'
            }`}
            onClick={() => onRate(star)}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">对话数据标注平台</h1>
        <p className="text-gray-600">对生成的对话数据进行质量评估和标注</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 对话内容编辑区域 */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>对话内容 #{currentIndex + 1}</CardTitle>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePrevious}
                    disabled={currentIndex === 0}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleNext}
                    disabled={currentIndex === mockConversations.length - 1}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {editingData.conversations.map((conv: any, index: number) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex items-center mb-2">
                      <Badge 
                        variant={conv.from === 'user' ? 'default' : 'secondary'}
                        className="mr-2"
                      >
                        {conv.from === 'user' ? '用户' : '助手'}
                      </Badge>
                    </div>
                    <Textarea
                      value={conv.value}
                      onChange={(e) => handleConversationEdit(index, 'value', e.target.value)}
                      className="min-h-[100px]"
                      readOnly={!isEditing}
                      placeholder={`编辑${conv.from === 'user' ? '用户' : '助手'}的消息...`}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 标注面板 */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>标注信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label className="mb-2 block">质量评分</Label>
                {renderStars(annotation.quality_score, (rating) => 
                  setAnnotation({ ...annotation, quality_score: rating })
                )}
              </div>

              <div>
                <Label className="mb-2 block">回答准确性</Label>
                <Select
                  value={annotation.accuracy}
                  onValueChange={(value) => 
                    setAnnotation({ ...annotation, accuracy: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="correct">完全正确</SelectItem>
                    <SelectItem value="partial">部分正确</SelectItem>
                    <SelectItem value="incorrect">完全错误</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="mb-2 block">问题分类</Label>
                <Select
                  value={annotation.category}
                  onValueChange={(value) => 
                    setAnnotation({ ...annotation, category: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="account">账户问题</SelectItem>
                    <SelectItem value="transaction">交易问题</SelectItem>
                    <SelectItem value="technical">技术问题</SelectItem>
                    <SelectItem value="compliance">合规问题</SelectItem>
                    <SelectItem value="general">一般咨询</SelectItem>
                    <SelectItem value="other">其他</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="mb-2 block">标签</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {annotation.tags.map((tag, index) => (
                    <Badge key={index} variant="outline">
                      {tag}
                    </Badge>
                  ))}
                </div>
                <Textarea
                  value={annotation.tags.join(', ')}
                  onChange={(e) => 
                    setAnnotation({ 
                      ...annotation, 
                      tags: e.target.value.split(',').map(t => t.trim()).filter(t => t) 
                    })
                  }
                  placeholder="用逗号分隔标签"
                  className="text-sm"
                />
              </div>

              <div>
                <Label className="mb-2 block">备注说明</Label>
                <Textarea
                  value={annotation.notes}
                  onChange={(e) => 
                    setAnnotation({ ...annotation, notes: e.target.value })
                  }
                  placeholder="添加备注说明..."
                  className="min-h-[100px]"
                />
              </div>

              <div className="space-y-2">
                <Button 
                  onClick={handleSave}
                  className="w-full"
                  variant={isEditing ? "default" : "outline"}
                >
                  <Save className="w-4 h-4 mr-2" />
                  {isEditing ? '保存标注' : '编辑标注'}
                </Button>
                
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => setIsEditing(!isEditing)}
                >
                  {isEditing ? '取消编辑' : '开始编辑'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 统计信息 */}
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-lg">进度统计</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>当前进度:</span>
                  <span>{currentIndex + 1} / {mockConversations.length}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full" 
                    style={{ width: `${((currentIndex + 1) / mockConversations.length) * 100}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default SimpleAnnotationDemo;