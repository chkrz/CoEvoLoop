import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { 
  MessageSquare, 
  Database, 
  Sparkles, 
  ArrowRight, 
  Cpu, 
  FileText, 
  Zap, 
  BarChart3,
  ArrowDown,
  TrendingUp,
  CheckCircle2
} from "lucide-react";
import { useUser } from "@/contexts/UserContext";

export function Homepage() {
  const navigate = useNavigate();
  const { isLoggedIn } = useUser();
  const { t } = useTranslation();

  const features = [
    {
      icon: Database,
      title: t('navigation.datasets'),
      subtitle: t('dataset.management'),
      description: t('homepage.dataset_description'),
      path: "/datasets",
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      borderColor: "border-blue-200",
      hoverBorder: "hover:border-blue-400",
      requiresAuth: false,
      features: [
        t('homepage.feature_upload'),
        t('homepage.feature_version'),
        t('homepage.feature_quality')
      ]
    },
    {
      icon: Sparkles,
      title: t('homepage.synthesis_evaluation'),
      subtitle: t('homepage.synthesis_subtitle'),
      description: t('homepage.synthesis_description'),
      path: "/synthesis",
      color: "text-green-600",
      bgColor: "bg-green-50",
      borderColor: "border-green-200",
      hoverBorder: "hover:border-green-400",
      requiresAuth: false,
      features: [
        t('homepage.feature_intelligent'),
        t('homepage.feature_quality_eval'),
        t('homepage.feature_batch')
      ]
    },
    {
      icon: FileText,
      title: t('navigation.annotations'),
      subtitle: t('homepage.annotation_subtitle'),
      description: t('homepage.annotation_description'),
      path: "/annotation",
      color: "text-orange-600",
      bgColor: "bg-orange-50",
      borderColor: "border-orange-200",
      hoverBorder: "hover:border-orange-400",
      requiresAuth: false,
      features: [
        t('homepage.feature_manual'),
        t('homepage.feature_quality_review'),
        t('homepage.feature_collaboration')
      ]
    },
    {
      icon: MessageSquare,
      title: t('homepage.model_playground'),
      subtitle: t('homepage.playground_subtitle'),
      description: t('homepage.playground_description'),
      path: "/dialogue_bs",
      color: "text-purple-600",
      bgColor: "bg-purple-50",
      borderColor: "border-purple-200",
      hoverBorder: "hover:border-purple-400",
      requiresAuth: true,
      features: [
        t('homepage.feature_comparison'),
        t('homepage.feature_realtime'),
        t('homepage.feature_assessment')
      ]
    },
    {
      icon: Zap,
      title: t('navigation.rl_playground'),
      subtitle: t('homepage.rl_subtitle'),
      description: t('homepage.rl_description'),
      path: "/rl-playground",
      color: "text-red-600",
      bgColor: "bg-red-50",
      borderColor: "border-red-200",
      hoverBorder: "hover:border-red-400",
      requiresAuth: false,
      features: [
        t('homepage.feature_reward'),
        t('homepage.feature_rollout'),
        t('homepage.feature_tracking')
      ]
    }
  ];

  const workflow = [
    { step: 1, title: t('homepage.workflow_synthesis'), module: "Synthesis", color: "from-emerald-400 to-teal-500" },
    { step: 2, title: t('homepage.workflow_evaluation'), module: "Evaluation", color: "from-sky-400 to-blue-500" },
    { step: 3, title: t('homepage.workflow_annotation'), module: "Annotation", color: "from-amber-400 to-orange-500" },
    { step: 4, title: t('homepage.workflow_training'), module: "RL Inspection", color: "from-rose-400 to-pink-500" },
    { step: 5, title: t('homepage.workflow_testing'), module: "Model Playground", color: "from-violet-400 to-purple-500" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Hero Section */}
      <div className="pt-16 pb-12 px-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="mb-6 flex justify-center">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-500 rounded-2xl blur-xl opacity-50"></div>
                <div className="relative p-4 bg-gradient-to-br from-blue-500 to-purple-500 rounded-2xl shadow-xl">
                  <Cpu className="w-12 h-12 text-white" />
                </div>
              </div>
            </div>

            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-4 leading-tight">
              CoEvoLoop
            </h1>
            <p className="text-lg text-gray-500 max-w-3xl mx-auto">
              {t('homepage.subtitle')}
            </p>
          </div>

          {/* Workflow Overview */}
          <div className="mb-16">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-2 flex items-center justify-center gap-2">
                <TrendingUp className="w-6 h-6 text-blue-500" />
                {t('homepage.workflow_title')}
              </h2>
              <p className="text-gray-600">{t('homepage.workflow_subtitle')}</p>
            </div>
            
            {/* Dataset as foundation */}
            <div className="max-w-6xl mx-auto mb-8">
              <div className="relative">
                {/* Dataset base layer */}
                <div className="bg-gradient-to-r from-blue-100 via-blue-50 to-blue-100 rounded-2xl p-6 border-2 border-blue-200 shadow-md">
                  <div className="flex items-center justify-center gap-3">
                    <Database className="w-8 h-8 text-blue-600" />
                    <div className="text-center">
                      <h3 className="text-xl font-bold text-gray-800">{t('homepage.dataset_foundation')}</h3>
                    </div>
                    <Database className="w-8 h-8 text-blue-600" />
                  </div>
                </div>
              </div>
            </div>

            {/* Main workflow */}
            <div className="flex flex-col lg:flex-row items-center justify-center gap-0 max-w-6xl mx-auto">
              {workflow.map((item, index) => (
                <div key={item.step} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <div className="relative group">
                      <div className={`absolute inset-0 bg-gradient-to-br ${item.color} rounded-full blur-lg opacity-20 group-hover:opacity-40 transition-opacity`}></div>
                      <div className={`relative w-24 h-24 bg-gradient-to-br ${item.color} rounded-full flex items-center justify-center shadow-xl`}>
                        <span className="text-3xl font-bold text-white">{item.step}</span>
                      </div>
                    </div>
                    <p className="mt-4 font-bold text-gray-800 text-center whitespace-nowrap">{item.title}</p>
                    <Badge variant="secondary" className="mt-2 text-xs px-3 py-1 font-medium">
                      {item.module}
                    </Badge>
                  </div>
                  {index < workflow.length - 1 && (
                    <div className="flex items-center mb-12">
                      <ArrowRight className="w-12 h-12 text-gray-300 mx-4 hidden lg:block flex-shrink-0" strokeWidth={2.5} />
                      <ArrowDown className="w-12 h-12 text-gray-300 my-4 lg:hidden flex-shrink-0" strokeWidth={2.5} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="max-w-7xl mx-auto px-6 pb-20">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold text-gray-800 mb-2">{t('homepage.features_title')}</h2>
          <p className="text-gray-600">{t('homepage.features_subtitle')}</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => {
            const Icon = feature.icon;
            const canAccess = !feature.requiresAuth || isLoggedIn;
            
            return (
              <Card 
                key={feature.title}
                className={`group relative overflow-hidden hover:shadow-2xl transition-all duration-300 cursor-pointer border-2 ${feature.borderColor} ${
                  canAccess ? feature.hoverBorder : 'opacity-75'
                } hover:-translate-y-1`}
                onClick={() => canAccess && navigate(feature.path)}
              >
                {/* Background gradient effect */}
                <div className={`absolute inset-0 ${feature.bgColor} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}></div>
                
                <CardHeader className="relative z-10">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`p-3 rounded-xl ${feature.bgColor} ring-2 ring-white shadow-md group-hover:scale-110 transition-transform duration-300`}>
                      <Icon className={`w-7 h-7 ${feature.color}`} />
                    </div>
                    {canAccess ? (
                      <ArrowRight className={`w-6 h-6 text-gray-300 group-hover:${feature.color} group-hover:translate-x-1 transition-all duration-300`} />
                    ) : (
                      <Badge variant="outline" className="text-amber-600 border-amber-600">
                        {t('homepage.login_required')}
                      </Badge>
                    )}
                  </div>
                  <CardTitle className="text-2xl mb-1 group-hover:text-gray-900 transition-colors">
                    {feature.title}
                  </CardTitle>
                  <p className={`text-sm font-medium ${feature.color} mb-3`}>
                    {feature.subtitle}
                  </p>
                  <CardDescription className="text-sm leading-relaxed min-h-[60px]">
                    {feature.description}
                  </CardDescription>
                </CardHeader>
                
                <CardContent className="relative z-10">
                  <div className="space-y-3">
                    {/* Feature tags */}
                    <div className="flex flex-wrap gap-2">
                      {feature.features.map((feat) => (
                        <div key={feat} className="flex items-center gap-1.5 text-xs text-gray-600">
                          <CheckCircle2 className={`w-3.5 h-3.5 ${feature.color}`} />
                          <span>{feat}</span>
                        </div>
                      ))}
                    </div>
                    
                    {canAccess && (
                      <Button 
                        variant="ghost" 
                        className={`w-full justify-center ${feature.color} hover:bg-white font-semibold group-hover:shadow-md transition-all`}
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(feature.path);
                        }}
                      >
                        {t('homepage.get_started')}
                        <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
