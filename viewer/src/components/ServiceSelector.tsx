import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ServiceType, ServiceConfig } from "@/components/DialogueBSLayout";
import { Check, AlertCircle } from "lucide-react";

interface ServiceSelectorProps {
  services: ServiceConfig[];
  selectedServices: ServiceType[];
  onServiceToggle: (serviceId: ServiceType) => void;
}

export function ServiceSelector({ services, selectedServices, onServiceToggle }: ServiceSelectorProps) {
  const isServiceSelected = (serviceId: ServiceType) => selectedServices.includes(serviceId);
  const canSelectMore = selectedServices.length < 3;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>选择对话服务</span>
          <Badge variant="secondary" className="text-sm">
            {selectedServices.length}/3
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {services.map((service) => {
            const isSelected = isServiceSelected(service.id);
            const isDisabled = !isSelected && !canSelectMore;

            return (
              <div
                key={service.id}
                className={`
                  relative p-4 rounded-lg border-2 transition-all
                  ${isSelected 
                    ? 'border-primary bg-primary/5' 
                    : isDisabled 
                    ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-60'
                    : 'border-gray-200 hover:border-primary/50 hover:bg-gray-50 cursor-pointer'
                  }
                `}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!isDisabled) {
                    onServiceToggle(service.id);
                  }
                }}
              >
                {/* 选择状态指示器 */}
                <div className="absolute top-2 right-2">
                  <div className={`
                    w-6 h-6 rounded-full flex items-center justify-center
                    ${isSelected ? 'bg-primary text-white' : 'bg-gray-200'}
                  `}>
                    {isSelected && <Check className="w-4 h-4" />}
                  </div>
                </div>

                {/* 服务图标 */}
                <div className="text-3xl mb-2">{service.icon}</div>
                
                {/* 服务名称 */}
                <h3 className="font-semibold text-lg mb-1">{service.name}</h3>
                
                {/* 服务描述 */}
                <p className="text-sm text-muted-foreground mb-3">
                  {service.description}
                </p>

                {/* 状态标签 */}
                <div className="flex items-center gap-2">
                  <div className={`
                    w-2 h-2 rounded-full
                    ${service.color}
                  `} />
                  <span className="text-xs text-muted-foreground">
                    {isSelected ? '已选择' : isDisabled ? '已达上限' : '可选'}
                  </span>
                </div>

                {/* 禁用提示 */}
                {isDisabled && !isSelected && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-lg">
                    <div className="text-center">
                      <AlertCircle className="w-5 h-5 text-orange-500 mx-auto mb-1" />
                      <p className="text-xs text-orange-600">最多选择3个服务</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 选择提示 */}
        {selectedServices.length === 0 && (
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-700 text-center">
              💡 请选择至少一个服务来开始多服务并行对话
            </p>
          </div>
        )}

        {selectedServices.length > 0 && (
          <div className="mt-4 p-3 bg-green-50 rounded-lg">
            <p className="text-sm text-green-700 text-center">
              ✅ 已选择 {selectedServices.length} 个服务，点击下方区域开始对话
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}