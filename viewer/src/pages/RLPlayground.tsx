import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  getRLLogs, 
  deleteRLLog, 
  deleteAllRLLogs,
  uploadRLLog, 
  getRLLogBatch,
  getRLLogOverview,
  getRLLogDimensionTrends,
  getRLLogStepComparison,
  compareRLLogBatches,
  getRLLogAnalysis,
  getRLLogStorageInfo,
  // New case-based APIs
  getRLLogStepComparisonV2,
  getRLLogCaseTrend,
  getRLLogCaseStepDetail,
  compareRLLogSteps,
  // TensorBoard APIs
  uploadTensorBoardFile,
  getTensorBoardStatus,
  getTensorBoardScalars,
  getTensorBoardTags,
  CORE_TB_METRICS,
  TB_METRIC_LABELS,
  TB_METRIC_GROUPS,
  type RLLog, 
  type BatchAnalysis,
  type LogOverview,
  type DimensionTrends,
  type StepComparison,
  type BatchCompareResult,
  type LogAnalysis,
  type ParsedRollout,
  type StorageInfo,
  // New case-based types
  type StepComparisonV2,
  type CaseTrend,
  type CaseStepDetail,
  type StepCompareResult,
  type CaseInfo,
  // TensorBoard types
  type TensorBoardStatus,
  type TensorBoardScalars,
} from "@/lib/rlPlaygroundApi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Slider } from "@/components/ui/slider";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { 
  Upload, Trash2, ChevronLeft, ChevronRight, Loader2, 
  TrendingUp, TrendingDown, BarChart3, Users, MessageSquare,
  AlertCircle, HelpCircle, ChevronDown, ChevronUp, PanelLeftClose, PanelLeft, X, Trash,
  ExternalLink, FileUp, Activity
} from "lucide-react";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, 
  Legend, ResponsiveContainer, BarChart, Bar
} from "recharts";

// ==================== Helper Components ====================

// Loading placeholder for tab content
interface TabLoadingProps {
  tabName: string;
  isLoading: boolean;
  children: React.ReactNode;
}

function TabLoading({ tabName, isLoading, children }: TabLoadingProps) {
  if (isLoading) {
    return (
      <Card className="flex flex-col items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">正在加载{tabName}...</p>
        <Progress className="w-48 h-2 mt-4" value={undefined} />
      </Card>
    );
  }
  return <>{children}</>;
}

// Loading step indicator for initial parsing
interface LoadingStepProps {
  label: string;
  isLoading: boolean;
  isComplete: boolean;
}

function LoadingStep({ label, isLoading, isComplete }: LoadingStepProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-5 h-5 flex items-center justify-center">
        {isComplete ? (
          <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        ) : isLoading ? (
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        ) : (
          <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30" />
        )}
      </div>
      <span className={`text-sm ${isComplete ? 'text-green-600' : isLoading ? 'text-foreground' : 'text-muted-foreground'}`}>
        {label}
      </span>
      {isLoading && (
        <span className="text-xs text-muted-foreground animate-pulse">处理中...</span>
      )}
    </div>
  );
}

interface MetricCardProps {
  label: string;
  value: string | number;
  delta?: number;
  deltaDesc?: string;
  icon?: React.ReactNode;
  tooltip?: string;
}

function MetricCard({ label, value, delta, deltaDesc, icon, tooltip }: MetricCardProps) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-1">
              <p className="text-sm text-muted-foreground">{label}</p>
              {tooltip && (
                <TooltipProvider>
                  <UITooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="text-sm">{tooltip}</p>
                    </TooltipContent>
                  </UITooltip>
                </TooltipProvider>
              )}
            </div>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {delta !== undefined && (
              <div className={`flex items-center gap-1 mt-1 text-sm ${
                delta > 0 ? "text-green-600" : delta < 0 ? "text-red-600" : "text-muted-foreground"
              }`}>
                {delta > 0 ? <TrendingUp className="w-4 h-4" /> : delta < 0 ? <TrendingDown className="w-4 h-4" /> : null}
                <span>{delta > 0 ? "+" : ""}{delta.toFixed(3)}</span>
                {deltaDesc && <span className="text-muted-foreground">({deltaDesc})</span>}
              </div>
            )}
          </div>
          {icon && <div className="text-muted-foreground">{icon}</div>}
        </div>
      </CardContent>
    </Card>
  );
}

interface ChatBubbleProps {
  role: string;
  content: string;
}

function ChatBubble({ role, content }: ChatBubbleProps) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
        isUser 
          ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white" 
          : "bg-gradient-to-r from-gray-100 to-gray-200 text-gray-800"
      }`}>
        <p className="text-xs font-medium mb-1 opacity-70">{role}</p>
        <p className="whitespace-pre-wrap break-words">{content.length > 300 ? content.slice(0, 300) + "..." : content}</p>
      </div>
    </div>
  );
}

// ==================== Data Smoothing Functions ====================

/**
 * Apply moving average smoothing to data
 * @param data Array of values to smooth
 * @param window Window size for moving average (1 = no smoothing)
 * @returns Smoothed array
 */
function applySmoothing(data: number[], window: number): number[] {
  if (window <= 1 || data.length === 0) return data;
  
  const result: number[] = [];
  const halfWindow = Math.floor(window / 2);
  
  for (let i = 0; i < data.length; i++) {
    const start = Math.max(0, i - halfWindow);
    const end = Math.min(data.length, i + halfWindow + 1);
    const slice = data.slice(start, end);
    const avg = slice.reduce((a, b) => a + b, 0) / slice.length;
    result.push(avg);
  }
  
  return result;
}

/**
 * Apply smoothing to chart data with multiple series
 */
function smoothChartData<T extends Record<string, unknown>>(
  data: T[],
  keys: string[],
  window: number
): T[] {
  if (window <= 1) return data;
  
  // Extract arrays for each key
  const smoothedArrays: Record<string, number[]> = {};
  for (const key of keys) {
    const values = data.map(d => (typeof d[key] === 'number' ? d[key] : 0) as number);
    smoothedArrays[key] = applySmoothing(values, window);
  }
  
  // Reconstruct data with smoothed values
  return data.map((d, idx) => {
    const result = { ...d } as Record<string, unknown>;
    for (const key of keys) {
      result[key] = smoothedArrays[key][idx];
    }
    return result as T;
  });
}

interface UserProfileCardProps {
  profile: Record<string, string>;
  userInfo?: Record<string, unknown>;
}

function UserProfileCard({ profile, userInfo }: UserProfileCardProps) {
  // 优先使用 userInfo，否则使用 profile
  const displayData = userInfo && Object.keys(userInfo).length > 0 
    ? Object.fromEntries(Object.entries(userInfo).map(([k, v]) => [k, String(v ?? '')]))
    : profile;
  
  const isEmpty = Object.keys(displayData).length === 0;
  
  return (
    <Card className={`mb-4 ${isEmpty ? 'opacity-50' : ''}`}>
      <CardHeader className="py-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Users className="w-4 h-4" />
          用户画像
          {isEmpty && <Badge variant="outline" className="text-xs">暂无数据</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="py-2">
        {isEmpty ? (
          <p className="text-sm text-muted-foreground">未检测到用户画像数据</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {Object.entries(displayData).map(([key, value]) => (
              <div key={key} className="flex gap-2 text-sm">
                <span className="text-muted-foreground">{key}:</span>
                <span className="font-medium truncate" title={String(value)}>{String(value)}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ==================== Main Component ====================

export default function RLPlayground() {
  const queryClient = useQueryClient();
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [currentBatchIndex, setCurrentBatchIndex] = useState(0);
  const [selectedTab, setSelectedTab] = useState("overview");
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTfeventsFile, setUploadTfeventsFile] = useState<File | null>(null);
  const [uploadName, setUploadName] = useState("");
  const [uploadDesc, setUploadDesc] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStep, setUploadStep] = useState<'rollout' | 'tfevents'>('rollout');
  const [uploadedLogId, setUploadedLogId] = useState<string | null>(null);
  
  // Sidebar Controls
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(300);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isResizing = useRef(false);
  
  // Dimension Score Controls
  const [selectedDimensions, setSelectedDimensions] = useState<string[]>([]);
  const [yAxisMin, setYAxisMin] = useState<number | "auto">("auto");
  const [yAxisMax, setYAxisMax] = useState<number | "auto">("auto");
  
  // Trend Smoothing Controls
  const [smoothWindow, setSmoothWindow] = useState(1); // 1 = no smoothing
  const [overviewSmoothWindow, setOverviewSmoothWindow] = useState(10); // Overview chart smoothing
  
  // Case-Based Navigation Controls (New)
  const [selectedCaseId, setSelectedCaseId] = useState<number>(0);
  const [selectedStep, setSelectedStep] = useState<number>(1);
  const [compareStepA, setCompareStepA] = useState<number>(1);
  const [compareStepB, setCompareStepB] = useState<number>(10);
  
  // Step Comparison Controls (Legacy)
  const [stepA, setStepA] = useState(0);
  const [stepB, setStepB] = useState(1);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [maxRolloutsDisplay, setMaxRolloutsDisplay] = useState(5);
  const [expandedRollouts, setExpandedRollouts] = useState<Set<number>>(new Set([0]));

  // Sidebar resize handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isResizing.current = true;
    e.preventDefault();
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing.current) return;
    const newWidth = e.clientX - (sidebarRef.current?.getBoundingClientRect().left ?? 0);
    if (newWidth >= 200 && newWidth <= 500) {
      setSidebarWidth(newWidth);
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    isResizing.current = false;
  }, []);

  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  // ==================== Queries ====================

  const { data: logsResponse, isLoading: logsLoading } = useQuery({
    queryKey: ["rl-logs"],
    queryFn: getRLLogs,
  });

  const logs = logsResponse?.logs ?? [];

  const { data: logAnalysis } = useQuery({
    queryKey: ["rl-log-analysis", selectedLogId],
    queryFn: () => getRLLogAnalysis(selectedLogId!),
    enabled: !!selectedLogId,
  });

  const { data: batchAnalysis, isLoading: analysisLoading } = useQuery({
    queryKey: ["rl-log-batch", selectedLogId, currentBatchIndex],
    queryFn: () => getRLLogBatch(selectedLogId!, currentBatchIndex),
    enabled: !!selectedLogId,
  });

  const { data: overviewData, isLoading: overviewLoading } = useQuery({
    queryKey: ["rl-log-overview", selectedLogId],
    queryFn: () => getRLLogOverview(selectedLogId!),
    enabled: !!selectedLogId,
  });

  const { data: dimensionTrendsData, isLoading: dimensionTrendsLoading } = useQuery({
    queryKey: ["rl-log-dimension-trends", selectedLogId],
    queryFn: () => getRLLogDimensionTrends(selectedLogId!),
    enabled: !!selectedLogId,
  });

  const { data: stepComparisonData, isLoading: stepComparisonLoading } = useQuery({
    queryKey: ["rl-log-step-comparison", selectedLogId],
    queryFn: () => getRLLogStepComparison(selectedLogId!),
    enabled: !!selectedLogId,
  });

  const { data: compareData, isLoading: compareLoading } = useQuery({
    queryKey: ["rl-log-compare", selectedLogId, stepA, stepB],
    queryFn: () => compareRLLogBatches(selectedLogId!, stepA, stepB),
    enabled: !!selectedLogId && stepA !== stepB,
  });

  // ==================== Case-Based Queries (New) ====================
  
  // Get step comparison info (V2 with case structure)
  const { data: stepComparisonV2Data, isLoading: stepComparisonV2Loading } = useQuery({
    queryKey: ["rl-log-step-comparison-v2", selectedLogId],
    queryFn: () => getRLLogStepComparisonV2(selectedLogId!),
    enabled: !!selectedLogId,
  });

  // Get case trend (for selected case)
  const { data: caseTrendData, isLoading: caseTrendLoading } = useQuery({
    queryKey: ["rl-log-case-trend", selectedLogId, selectedCaseId],
    queryFn: () => getRLLogCaseTrend(selectedLogId!, selectedCaseId),
    enabled: !!selectedLogId && selectedCaseId >= 0,
  });

  // Get case step detail (for case inspector)
  const { data: caseStepDetailData, isLoading: caseStepDetailLoading } = useQuery({
    queryKey: ["rl-log-case-step-detail", selectedLogId, selectedCaseId, selectedStep],
    queryFn: () => getRLLogCaseStepDetail(selectedLogId!, selectedCaseId, selectedStep),
    enabled: !!selectedLogId && selectedCaseId >= 0 && selectedStep > 0,
  });

  // Compare two steps for a case
  const { data: stepCompareData, isLoading: stepCompareLoading } = useQuery({
    queryKey: ["rl-log-step-compare", selectedLogId, selectedCaseId, compareStepA, compareStepB],
    queryFn: () => compareRLLogSteps(selectedLogId!, selectedCaseId, compareStepA, compareStepB),
    enabled: !!selectedLogId && selectedCaseId >= 0 && compareStepA !== compareStepB && compareStepA > 0 && compareStepB > 0,
  });

  // ==================== TensorBoard Queries ====================
  
  // Get TensorBoard status
  const { data: tbStatusData, isLoading: tbStatusLoading } = useQuery({
    queryKey: ["rl-log-tb-status", selectedLogId],
    queryFn: () => getTensorBoardStatus(selectedLogId!),
    enabled: !!selectedLogId,
  });

  // Get TensorBoard tags
  const { data: tbTagsData } = useQuery({
    queryKey: ["rl-log-tb-tags", selectedLogId],
    queryFn: () => getTensorBoardTags(selectedLogId!),
    enabled: !!selectedLogId && tbStatusData?.has_tfevents === true,
  });

  // Get TensorBoard scalars (core metrics for overview)
  const { data: tbScalarsData, isLoading: tbScalarsLoading } = useQuery({
    queryKey: ["rl-log-tb-scalars", selectedLogId],
    queryFn: () => getTensorBoardScalars(selectedLogId!),
    enabled: !!selectedLogId && tbStatusData?.has_tfevents === true,
  });

  // Get all TensorBoard metrics for trends page
  const allTbMetrics = useMemo(() => {
    const metrics: string[] = [];
    Object.values(TB_METRIC_GROUPS).forEach(group => {
      metrics.push(...group.metrics);
    });
    return [...new Set(metrics)];
  }, []);

  const { data: tbAllScalarsData, isLoading: tbAllScalarsLoading } = useQuery({
    queryKey: ["rl-log-tb-all-scalars", selectedLogId],
    queryFn: () => getTensorBoardScalars(selectedLogId!, allTbMetrics),
    enabled: !!selectedLogId && tbStatusData?.has_tfevents === true,
  });

  // ==================== Mutations ====================

  const uploadMutation = useMutation({
    mutationFn: async (params: { file: File; name: string; desc: string }) => {
      setIsUploading(true);
      setUploadProgress(0);
      
      // Simulate progress during upload
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) return prev;
          return prev + Math.random() * 10;
        });
      }, 200);
      
      try {
        const result = await uploadRLLog(params.file, params.name, params.desc);
        setUploadProgress(100);
        clearInterval(progressInterval);
        return result;
      } catch (error) {
        clearInterval(progressInterval);
        throw error;
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["rl-logs"] });
      setUploadedLogId(data.log_id);
      setUploadStep('tfevents'); // 进入第二步
      setUploadFile(null);
      // 不关闭对话框，继续上传 TensorBoard 文件
      setIsUploading(false);
      setUploadProgress(0);
    },
    onError: () => {
      setIsUploading(false);
      setUploadProgress(0);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (logId: string) => deleteRLLog(logId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rl-logs"] });
      if (selectedLogId) setSelectedLogId(null);
    },
  });

  // TensorBoard file upload mutation
  const uploadTfeventsMutation = useMutation({
    mutationFn: async (params: { logId: string; file: File }) => {
      return uploadTensorBoardFile(params.logId, params.file);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rl-log-tb-status", uploadedLogId] });
      queryClient.invalidateQueries({ queryKey: ["rl-log-tb-scalars", uploadedLogId] });
      // 完成后关闭对话框
      setUploadDialogOpen(false);
    },
  });

  // Helper to close upload dialog (state reset is handled by useEffect)
  const closeUploadDialog = () => {
    setUploadDialogOpen(false);
  };

  const deleteAllMutation = useMutation({
    mutationFn: deleteAllRLLogs,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["rl-logs"] });
      queryClient.invalidateQueries({ queryKey: ["rl-log-analysis"] });
      queryClient.invalidateQueries({ queryKey: ["rl-log-overview"] });
      queryClient.invalidateQueries({ queryKey: ["rl-log-dimension-trends"] });
      queryClient.invalidateQueries({ queryKey: ["rl-log-step-comparison"] });
      setSelectedLogId(null);
      console.log(`清空完成: ${result.message}`);
    },
  });

  // Delete All confirmation dialog state
  const [deleteAllDialogOpen, setDeleteAllDialogOpen] = useState(false);

  // ==================== Effects ====================

  // Reset upload dialog state when closed
  useEffect(() => {
    if (!uploadDialogOpen) {
      // Only reset if dialog was previously open (avoid initial render)
      const timer = setTimeout(() => {
        setUploadFile(null);
        setUploadTfeventsFile(null);
        setUploadName("");
        setUploadDesc("");
        setUploadStep('rollout');
        setUploadedLogId(null);
        setIsUploading(false);
        setUploadProgress(0);
      }, 200); // Small delay to allow closing animation
      return () => clearTimeout(timer);
    }
  }, [uploadDialogOpen]);

  useEffect(() => {
    if (dimensionTrendsData?.dimensions && selectedDimensions.length === 0) {
      setSelectedDimensions(dimensionTrendsData.dimensions.slice(0, 3));
    }
  }, [dimensionTrendsData, selectedDimensions.length]);

  // ==================== Computed Values ====================

  const totalBatches = overviewData?.total_batches ?? logAnalysis?.total_batches ?? 0;
  
  // Chart Data Transformations
  const getDimensionChartData = () => {
    if (!dimensionTrendsData?.batch_dimension_scores) return [];
    return dimensionTrendsData.batch_dimension_scores.map((batch) => {
      const data: Record<string, number | string> = { 
        batch: batch.batch_index + 1, 
        step: batch.step 
      };
      selectedDimensions.forEach(dim => {
        data[dim] = batch.dimensions[dim] ?? 0;
      });
      return data;
    });
  };

  const getYAxisDomain = (): [number | "auto", number | "auto"] => {
    return [yAxisMin, yAxisMax];
  };

  // Color palette for dimensions
  const COLORS = ["#8884d8", "#82ca9d", "#ffc658", "#ff7300", "#00C49F", "#FFBB28", "#FF8042", "#0088FE"];

  // ==================== Helpers ====================

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDateTime = (dateStr: string): string => {
    return new Date(dateStr).toLocaleString("zh-CN");
  };

  // Extract rollout info
  const getRolloutInfo = (rollout: ParsedRollout, score: number) => {
    const switchHuman = rollout.penalty?.switch_human_count?.toString() ?? "0";
    const tokenPenalty = rollout.penalty?.token_penalty === 1;
    return { switchHuman, tokenPenalty, score };
  };

  // ==================== Render ====================

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">RL Playground</h1>
            <p className="text-muted-foreground">分析和可视化强化学习训练日志</p>
          </div>
          <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Upload className="w-4 h-4 mr-2" />
                上传日志
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>
                  {uploadStep === 'rollout' ? '步骤 1: 上传 Rollout 日志' : '步骤 2: 上传 TensorBoard 日志 (可选)'}
                </DialogTitle>
              </DialogHeader>
              
              {uploadStep === 'rollout' ? (
                // Step 1: Upload Rollout JSONL
                <div className="space-y-4 pt-4">
                  <div>
                    <Label htmlFor="logName">日志名称</Label>
                    <Input
                      id="logName"
                      placeholder="输入日志名称"
                      className="mt-2"
                      value={uploadName}
                      onChange={(e) => setUploadName(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="logDesc">描述 (可选)</Label>
                    <Input
                      id="logDesc"
                      placeholder="输入描述"
                      className="mt-2"
                      value={uploadDesc}
                      onChange={(e) => setUploadDesc(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="logFile" className="flex items-center gap-2">
                      <FileUp className="w-4 h-4" />
                      选择 Rollout 文件 (.jsonl)
                    </Label>
                    <Input
                      id="logFile"
                      type="file"
                      accept=".jsonl,.json"
                      className="mt-2 cursor-pointer file:cursor-pointer"
                      onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                      disabled={isUploading}
                    />
                    {uploadFile && (
                      <p className="text-xs text-muted-foreground mt-1">
                        已选择: {uploadFile.name} ({formatFileSize(uploadFile.size)})
                      </p>
                    )}
                  </div>
                  {isUploading && (
                    <div className="space-y-3 bg-muted/50 rounded-lg p-3">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>正在上传并解析日志文件...</span>
                      </div>
                      <Progress value={uploadProgress} className="h-2" />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>
                          {uploadProgress < 50 ? '上传文件中' : 
                           uploadProgress < 80 ? '解析 JSONL 格式' : 
                           uploadProgress < 95 ? '验证数据结构' : '即将完成'}
                        </span>
                        <span>{Math.round(uploadProgress)}%</span>
                      </div>
                    </div>
                  )}
                  <Button
                    className="w-full"
                    disabled={!uploadFile || !uploadName || uploadMutation.isPending || isUploading}
                    onClick={() => uploadFile && uploadMutation.mutate({ 
                      file: uploadFile, 
                      name: uploadName, 
                      desc: uploadDesc 
                    })}
                  >
                    {uploadMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        上传中...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        上传 Rollout 日志
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                // Step 2: Upload TensorBoard file (optional)
                <div className="space-y-4 pt-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <p className="text-sm text-green-700">
                      ✅ Rollout 日志上传成功！
                    </p>
                  </div>
                  
                  <div>
                    <Label htmlFor="tfeventsFile" className="flex items-center gap-2">
                      <Activity className="w-4 h-4" />
                      选择 TensorBoard 文件 (tfevents)
                    </Label>
                    <Input
                      id="tfeventsFile"
                      type="file"
                      className="mt-2"
                      onChange={(e) => setUploadTfeventsFile(e.target.files?.[0] || null)}
                      disabled={uploadTfeventsMutation.isPending}
                    />
                    {uploadTfeventsFile && (
                      <p className="text-xs text-muted-foreground mt-1">
                        已选择: {uploadTfeventsFile.name} ({formatFileSize(uploadTfeventsFile.size)})
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                      文件名通常包含 "tfevents"，例如: events.out.tfevents.1234567890.hostname.xxx
                    </p>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={closeUploadDialog}
                    >
                      跳过
                    </Button>
                    <Button
                      className="flex-1"
                      disabled={!uploadTfeventsFile || uploadTfeventsMutation.isPending}
                      onClick={() => uploadTfeventsFile && uploadedLogId && uploadTfeventsMutation.mutate({
                        logId: uploadedLogId,
                        file: uploadTfeventsFile
                      })}
                    >
                      {uploadTfeventsMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          上传中...
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 mr-2" />
                          上传 TensorBoard
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex gap-4">
          {/* Sidebar - Log List */}
          {!sidebarCollapsed && (
            <div 
              ref={sidebarRef}
              className="relative shrink-0"
              style={{ width: sidebarWidth }}
            >
              <Card className="h-[calc(100vh-180px)]">
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-base">日志列表</CardTitle>
                  <div className="flex items-center gap-1">
                    {logs.length > 0 && (
                      <AlertDialog open={deleteAllDialogOpen} onOpenChange={setDeleteAllDialogOpen}>
                        <TooltipProvider>
                          <UITooltip>
                            <TooltipTrigger asChild>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  disabled={deleteAllMutation.isPending}
                                >
                                  {deleteAllMutation.isPending ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Trash className="w-4 h-4 text-destructive" />
                                  )}
                                </Button>
                              </AlertDialogTrigger>
                            </TooltipTrigger>
                            <TooltipContent>清空所有日志</TooltipContent>
                          </UITooltip>
                        </TooltipProvider>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>确定要清空所有日志吗？</AlertDialogTitle>
                            <AlertDialogDescription>
                              此操作将删除 {logs.length} 个日志文件及其所有数据，且无法撤销。
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>取消</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              onClick={() => deleteAllMutation.mutate()}
                            >
                              确定删除
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setSidebarCollapsed(true)}
                    >
                      <PanelLeftClose className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[calc(100vh-280px)]">
                    {logsLoading ? (
                    <div className="flex justify-center p-4">
                      <Loader2 className="w-6 h-6 animate-spin" />
                    </div>
                  ) : !logs.length ? (
                    <div className="text-center p-4 text-muted-foreground">
                      暂无日志，请上传
                    </div>
                  ) : (
                    <div className="space-y-2 p-4">
                      {logs.map((log) => (
                        <div
                          key={log.id}
                          className={`p-3 rounded-lg cursor-pointer transition-all ${
                            selectedLogId === log.id
                              ? "bg-primary/10 border-2 border-primary"
                              : "bg-muted/50 hover:bg-muted border-2 border-transparent"
                          }`}
                          onClick={() => {
                            setSelectedLogId(log.id);
                            setCurrentBatchIndex(0);
                            setSelectedDimensions([]);
                          }}
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{log.name}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {log.batch_count ?? log.stats?.total_batches ?? 0} batches · {formatFileSize(log.file_size)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatDateTime(log.created_at)}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 shrink-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm("确定要删除此日志吗？")) {
                                  deleteMutation.mutate(log.id);
                                }
                              }}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
              {/* Resize Handle */}
              <div
                className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/50 transition-colors"
                onMouseDown={handleMouseDown}
              />
            </div>
          )}
          
          {/* Collapsed Sidebar Toggle */}
          {sidebarCollapsed && (
            <div className="shrink-0">
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10"
                onClick={() => setSidebarCollapsed(false)}
              >
                <PanelLeft className="w-4 h-4" />
              </Button>
            </div>
          )}

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            {!selectedLogId ? (
              <Card className="h-[calc(100vh-180px)] flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>选择一个日志开始分析</p>
                </div>
              </Card>
            ) : overviewLoading || dimensionTrendsLoading || stepComparisonV2Loading || tbStatusLoading ? (
              <Card className="h-[calc(100vh-180px)] flex items-center justify-center">
                <div className="w-full max-w-md px-8">
                  <div className="text-center mb-6">
                    <Loader2 className="w-10 h-10 animate-spin mx-auto text-primary mb-3" />
                    <h3 className="font-semibold text-lg">正在解析日志数据</h3>
                    <p className="text-sm text-muted-foreground mt-1">请稍候，大型日志文件可能需要较长时间...</p>
                  </div>
                  <div className="space-y-3">
                    <LoadingStep 
                      label="加载概览数据" 
                      isLoading={overviewLoading} 
                      isComplete={!!overviewData}
                    />
                    <LoadingStep 
                      label="解析维度分数" 
                      isLoading={dimensionTrendsLoading} 
                      isComplete={!!dimensionTrendsData}
                    />
                    <LoadingStep 
                      label="构建 Case 索引" 
                      isLoading={stepComparisonV2Loading} 
                      isComplete={!!stepComparisonV2Data}
                    />
                    <LoadingStep 
                      label="检查 TensorBoard 数据" 
                      isLoading={tbStatusLoading} 
                      isComplete={!!tbStatusData}
                    />
                  </div>
                </div>
              </Card>
            ) : (
              <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-4">
                <TabsList className="grid w-full grid-cols-5">
                  <TabsTrigger value="overview">概览</TabsTrigger>
                  <TabsTrigger value="trends">训练趋势</TabsTrigger>
                  <TabsTrigger value="inspector">Case 检查</TabsTrigger>
                  <TabsTrigger value="comparison">Step 对比</TabsTrigger>
                  <TabsTrigger value="dimensions">维度分数</TabsTrigger>
                </TabsList>

                {/* ==================== Tab 1: Overview ==================== */}
                <TabsContent value="overview" className="space-y-4">
                  <TabLoading tabName="概览数据" isLoading={overviewLoading}>
                    {overviewData && (
                      <>
                      {/* Key Metrics - 修正为 Case/Step/Rollout 概念 */}
                      <div className="grid grid-cols-4 gap-4">
                        <MetricCard
                          label="Case 数量"
                          value={overviewData.total_cases}
                          icon={<Users className="w-5 h-5" />}
                          tooltip="测试用例数量，每个 Case 代表一个用户画像"
                        />
                        <MetricCard
                          label="Step 数量"
                          value={overviewData.total_steps}
                          icon={<TrendingUp className="w-5 h-5" />}
                          tooltip="训练步数"
                        />
                        <MetricCard
                          label="总 Rollout 数"
                          value={overviewData.total_rollouts}
                          icon={<MessageSquare className="w-5 h-5" />}
                          tooltip={`= ${overviewData.total_cases} Cases × ${overviewData.total_steps} Steps × ${overviewData.rollouts_per_batch} Rollouts/Batch`}
                        />
                        <MetricCard
                          label="平均分数"
                          value={overviewData.avg_score.toFixed(3)}
                          delta={overviewData.mean_scores.length > 1 
                            ? overviewData.mean_scores[overviewData.mean_scores.length - 1] - overviewData.mean_scores[0]
                            : undefined}
                          deltaDesc="首末差"
                        />
                      </div>

                      {/* Trend Preview Chart - Using TensorBoard rewards/mean */}
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base flex items-center justify-between">
                            <span>Reward Trend (TensorBoard)</span>
                            <div className="flex items-center gap-3">
                              <Label className="text-sm font-normal text-muted-foreground">平滑:</Label>
                              <Slider
                                value={[overviewSmoothWindow]}
                                onValueChange={([v]) => setOverviewSmoothWindow(v)}
                                min={1}
                                max={50}
                                step={1}
                                className="w-32"
                              />
                              <span className="text-xs text-muted-foreground w-12">
                                {overviewSmoothWindow === 1 ? '关闭' : `${overviewSmoothWindow}`}
                              </span>
                            </div>
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          {tbStatusData?.has_tfevents && tbScalarsData?.scalars['critic/rewards/mean'] ? (
                            <ResponsiveContainer width="100%" height={200}>
                              <LineChart data={smoothChartData(
                                tbScalarsData.scalars['critic/rewards/mean'].steps.map((step, idx) => ({ 
                                  step, 
                                  reward: tbScalarsData.scalars['critic/rewards/mean'].values[idx] 
                                })),
                                ['reward'],
                                overviewSmoothWindow
                              )}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis 
                                  dataKey="step" 
                                  label={{ value: 'Training Step', position: 'insideBottom', offset: -5 }}
                                />
                                <YAxis label={{ value: 'Reward', angle: -90, position: 'insideLeft' }} />
                                <Tooltip 
                                  formatter={(value: number) => [value.toFixed(4), 'Reward Mean']}
                                  labelFormatter={(step) => `Step ${step}`}
                                />
                                <Line type="monotone" dataKey="reward" stroke="#8884d8" strokeWidth={2} dot={false} />
                              </LineChart>
                            </ResponsiveContainer>
                          ) : (
                            <div className="h-[200px] flex flex-col items-center justify-center text-muted-foreground">
                              <Activity className="w-8 h-8 mb-2 opacity-50" />
                              <p className="text-sm">未检测到 TensorBoard 数据</p>
                              <p className="text-xs mt-1">上传 tfevents 文件以查看 Reward 趋势</p>
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      {/* Statistics */}
                      <div className="grid grid-cols-2 gap-4">
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-base">分数统计</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-3">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">最高分</span>
                                <span className="font-medium">{overviewData.max_score.toFixed(3)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">最低分</span>
                                <span className="font-medium">{overviewData.min_score.toFixed(3)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">平均分</span>
                                <span className="font-medium">{overviewData.avg_score.toFixed(3)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Token 惩罚次数</span>
                                <span className="font-medium">{overviewData.total_token_penalties}</span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-base">数据结构</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-3">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">每 Batch Rollouts</span>
                                <span className="font-medium">{overviewData.rollouts_per_batch}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">总 Batch 数</span>
                                <span className="font-medium">{overviewData.total_batches}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">数据公式</span>
                                <span className="font-medium text-xs">
                                  {overviewData.total_cases} × {overviewData.total_steps} × {overviewData.rollouts_per_batch}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">计算结果</span>
                                <span className="font-medium">
                                  = {overviewData.total_cases * overviewData.total_steps * overviewData.rollouts_per_batch} rollouts
                                </span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      {/* TensorBoard Training Metrics */}
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Activity className="w-4 h-4" />
                              训练指标 (TensorBoard)
                            </div>
                            {tbStatusData?.has_tfevents && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  window.open('http://localhost:6006', '_blank');
                                }}
                              >
                                <ExternalLink className="w-3 h-3 mr-1" />
                                打开 TensorBoard
                              </Button>
                            )}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          {tbStatusLoading ? (
                            <div className="flex items-center justify-center h-32">
                              <Loader2 className="w-6 h-6 animate-spin" />
                            </div>
                          ) : !tbStatusData?.has_tfevents ? (
                            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                              <Activity className="w-8 h-8 mb-2 opacity-50" />
                              <p className="text-sm">未上传 TensorBoard 日志</p>
                              <p className="text-xs mt-1">上传 tfevents 文件以查看训练指标</p>
                            </div>
                          ) : tbScalarsLoading ? (
                            <div className="flex items-center justify-center h-32">
                              <Loader2 className="w-6 h-6 animate-spin" />
                              <span className="ml-2 text-sm text-muted-foreground">加载指标数据...</span>
                            </div>
                          ) : tbScalarsData ? (
                            <div className="grid grid-cols-2 gap-4">
                              {CORE_TB_METRICS.map((metric) => {
                                const data = tbScalarsData.scalars[metric];
                                if (!data) return null;
                                
                                const chartData = data.steps.map((step, idx) => ({
                                  step,
                                  value: data.values[idx]
                                }));
                                
                                const lastValue = data.values[data.values.length - 1];
                                const firstValue = data.values[0];
                                const delta = lastValue - firstValue;
                                
                                return (
                                  <div key={metric} className="border rounded-lg p-3">
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="text-sm font-medium">{TB_METRIC_LABELS[metric] || metric}</span>
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm font-bold">{lastValue.toFixed(4)}</span>
                                        {delta !== 0 && (
                                          <span className={`text-xs ${delta > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {delta > 0 ? '+' : ''}{delta.toFixed(4)}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <ResponsiveContainer width="100%" height={80}>
                                      <LineChart data={chartData}>
                                        <XAxis dataKey="step" hide />
                                        <YAxis hide domain={['auto', 'auto']} />
                                        <Tooltip 
                                          formatter={(value: number) => [value.toFixed(4), TB_METRIC_LABELS[metric]]}
                                          labelFormatter={(step) => `Step ${step}`}
                                        />
                                        <Line 
                                          type="monotone" 
                                          dataKey="value" 
                                          stroke="#8884d8" 
                                          strokeWidth={1.5} 
                                          dot={false} 
                                        />
                                      </LineChart>
                                    </ResponsiveContainer>
                                  </div>
                                );
                              })}
                            </div>
                          ) : null}
                        </CardContent>
                      </Card>
                      </>
                    )}
                  </TabLoading>
                </TabsContent>

                {/* ==================== Tab 2: Dimension Scores ==================== */}
                <TabsContent value="dimensions" className="space-y-4">
                  <TabLoading tabName="维度分数数据" isLoading={dimensionTrendsLoading}>
                    {dimensionTrendsData && (
                      <>
                      {/* Dimension Selection */}
                      <Card>
                        <CardContent className="pt-4">
                          <div className="flex flex-wrap gap-2 mb-4">
                            {dimensionTrendsData.dimensions.map((dim, idx) => (
                              <label
                                key={dim}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-full border cursor-pointer transition-colors ${
                                  selectedDimensions.includes(dim)
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "bg-muted/50 hover:bg-muted border-transparent"
                                }`}
                              >
                                <Checkbox
                                  checked={selectedDimensions.includes(dim)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setSelectedDimensions([...selectedDimensions, dim]);
                                    } else {
                                      setSelectedDimensions(selectedDimensions.filter(d => d !== dim));
                                    }
                                  }}
                                  className="hidden"
                                />
                                <span className="text-sm">{dim}</span>
                              </label>
                            ))}
                          </div>
                          
                          {/* Y-Axis Controls */}
                          <div className="flex items-center gap-4">
                            <Label className="text-sm">Y轴范围:</Label>
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                placeholder="Min (auto)"
                                className="w-24 h-8"
                                value={yAxisMin === "auto" ? "" : yAxisMin}
                                onChange={(e) => setYAxisMin(e.target.value ? Number(e.target.value) : "auto")}
                              />
                              <span>-</span>
                              <Input
                                type="number"
                                placeholder="Max (auto)"
                                className="w-24 h-8"
                                value={yAxisMax === "auto" ? "" : yAxisMax}
                                onChange={(e) => setYAxisMax(e.target.value ? Number(e.target.value) : "auto")}
                              />
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => { setYAxisMin("auto"); setYAxisMax("auto"); }}
                            >
                              重置
                            </Button>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Dimension Chart */}
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base">维度分数趋势</CardTitle>
                        </CardHeader>
                        <CardContent>
                          {selectedDimensions.length === 0 ? (
                            <div className="h-64 flex items-center justify-center text-muted-foreground">
                              请选择至少一个维度
                            </div>
                          ) : (
                            <ResponsiveContainer width="100%" height={350}>
                              <LineChart data={getDimensionChartData()}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="batch" />
                                <YAxis domain={getYAxisDomain()} />
                                <Tooltip />
                                <Legend />
                                {selectedDimensions.map((dim, idx) => (
                                  <Line
                                    key={dim}
                                    type="monotone"
                                    dataKey={dim}
                                    stroke={COLORS[idx % COLORS.length]}
                                    strokeWidth={2}
                                    dot={false}
                                  />
                                ))}
                              </LineChart>
                            </ResponsiveContainer>
                          )}
                        </CardContent>
                      </Card>
                      </>
                    )}
                  </TabLoading>
                </TabsContent>

                {/* ==================== Tab 3: TensorBoard Training Trends ==================== */}
                <TabsContent value="trends" className="space-y-4">
                  {!tbStatusData?.has_tfevents ? (
                    <Card className="p-8 text-center text-muted-foreground">
                      <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>未上传 TensorBoard 日志</p>
                      <p className="text-sm mt-2">请上传 tfevents 文件以查看详细训练指标</p>
                    </Card>
                  ) : tbAllScalarsLoading ? (
                    <Card className="p-8 flex flex-col items-center justify-center">
                      <Loader2 className="w-8 h-8 animate-spin mb-4" />
                      <p className="text-muted-foreground">正在加载 TensorBoard 指标...</p>
                    </Card>
                  ) : tbAllScalarsData ? (
                    <>
                      {/* Header with TensorBoard Link */}
                      <Card>
                        <CardContent className="py-3">
                          <div className="flex items-center justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                window.open('http://localhost:6006', '_blank');
                              }}
                            >
                              <ExternalLink className="w-3 h-3 mr-1" />
                              打开 TensorBoard
                            </Button>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Metric Groups */}
                      {Object.entries(TB_METRIC_GROUPS).map(([groupKey, group]) => {
                        const availableMetrics = group.metrics.filter(m => tbAllScalarsData.scalars[m]);
                        if (availableMetrics.length === 0) return null;

                        return (
                          <Card key={groupKey}>
                            <CardHeader className="pb-2">
                              <CardTitle className="text-base">{group.label}</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                                {availableMetrics.map((metric) => {
                                  const data = tbAllScalarsData.scalars[metric];
                                  if (!data) return null;

                                  const chartData = smoothChartData(
                                    data.steps.map((step, idx) => ({
                                      step,
                                      value: data.values[idx]
                                    })),
                                    ['value'],
                                    smoothWindow
                                  );

                                  const lastValue = data.values[data.values.length - 1];
                                  const firstValue = data.values[0];
                                  const delta = lastValue - firstValue;

                                  return (
                                    <div key={metric} className="border rounded-lg p-3">
                                      <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-medium truncate" title={metric}>
                                          {TB_METRIC_LABELS[metric] || metric.split('/').pop()}
                                        </span>
                                        <div className="flex items-center gap-2">
                                          <span className="text-sm font-bold">
                                            {lastValue >= 1000 ? lastValue.toExponential(2) : lastValue.toFixed(4)}
                                          </span>
                                          {delta !== 0 && (
                                            <span className={`text-xs ${delta > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                              {delta > 0 ? '+' : ''}{delta >= 1000 ? delta.toExponential(1) : delta.toFixed(3)}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                      <ResponsiveContainer width="100%" height={100}>
                                        <LineChart data={chartData}>
                                          <XAxis dataKey="step" hide />
                                          <YAxis hide domain={['auto', 'auto']} />
                                          <Tooltip 
                                            formatter={(value: number) => [
                                              value >= 1000 ? value.toExponential(3) : value.toFixed(4), 
                                              TB_METRIC_LABELS[metric] || metric
                                            ]}
                                            labelFormatter={(step) => `Step ${step}`}
                                          />
                                          <Line 
                                            type="monotone" 
                                            dataKey="value" 
                                            stroke="#8884d8" 
                                            strokeWidth={1.5} 
                                            dot={false} 
                                          />
                                        </LineChart>
                                      </ResponsiveContainer>
                                    </div>
                                  );
                                })}
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </>
                  ) : (
                    <Card className="p-8 text-center text-muted-foreground">
                      <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>无法加载 TensorBoard 数据</p>
                    </Card>
                  )}
                </TabsContent>

                {/* ==================== Tab 4: Case Inspector (New Case-Based) ==================== */}
                <TabsContent value="inspector" className="space-y-4">
                  <TabLoading tabName="Case 数据" isLoading={stepComparisonV2Loading}>
                    {stepComparisonV2Data && (
                      <>
                        {/* Case & Step Navigation */}
                        <Card>
                          <CardContent className="py-3">
                            <div className="grid grid-cols-4 gap-4 items-end">
                              {/* Case Selection */}
                              <div>
                                <Label className="text-sm">选择 Case</Label>
                                <Select 
                                  value={String(selectedCaseId)} 
                                  onValueChange={(v) => {
                                    setSelectedCaseId(Number(v));
                                    // Reset step to 1 when case changes
                                    if (stepComparisonV2Data.steps.length > 0) {
                                      setSelectedStep(stepComparisonV2Data.steps[0]);
                                    }
                                  }}
                                >
                                  <SelectTrigger className="mt-2">
                                    <SelectValue placeholder="选择 Case" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {stepComparisonV2Data.cases.filter(c => c.case_id != null && c.case_id !== '').map((caseInfo) => (
                                      <SelectItem key={caseInfo.case_id} value={String(caseInfo.case_id)}>
                                        Case {caseInfo.case_id + 1}: {caseInfo.preview?.slice(0, 40) || '...'} ({caseInfo.num_steps} steps)
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              {/* Step Selection */}
                              <div>
                                <Label className="text-sm">选择 Step</Label>
                                <Select 
                                  value={String(selectedStep)} 
                                  onValueChange={(v) => setSelectedStep(Number(v))}
                                >
                                  <SelectTrigger className="mt-2">
                                    <SelectValue placeholder="选择 Step" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {stepComparisonV2Data.steps.map((step) => (
                                      <SelectItem key={step} value={String(step)}>
                                        Step {step}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              {/* Quick Navigation */}
                              <div className="flex gap-2 items-center">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={selectedStep <= stepComparisonV2Data.steps[0]}
                                  onClick={() => {
                                    const idx = stepComparisonV2Data.steps.indexOf(selectedStep);
                                    if (idx > 0) setSelectedStep(stepComparisonV2Data.steps[idx - 1]);
                                  }}
                                >
                                  <ChevronLeft className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={selectedStep >= stepComparisonV2Data.steps[stepComparisonV2Data.steps.length - 1]}
                                  onClick={() => {
                                    const idx = stepComparisonV2Data.steps.indexOf(selectedStep);
                                    if (idx < stepComparisonV2Data.steps.length - 1) setSelectedStep(stepComparisonV2Data.steps[idx + 1]);
                                  }}
                                >
                                  <ChevronRight className="w-4 h-4" />
                                </Button>
                              </div>

                              {/* Summary Badge */}
                              <div className="flex items-center gap-2">
                                <Badge variant="outline">
                                  {stepComparisonV2Data.total_cases} Cases × {stepComparisonV2Data.total_steps} Steps
                                </Badge>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        {/* Case User Profile (从 step 1 获取一次) */}
                        {stepComparisonV2Data.cases[selectedCaseId]?.user_info && 
                         Object.keys(stepComparisonV2Data.cases[selectedCaseId].user_info).length > 0 && (
                          <UserProfileCard 
                            profile={{}} 
                            userInfo={stepComparisonV2Data.cases[selectedCaseId].user_info}
                          />
                        )}

                        {/* Case Step Detail */}
                        {caseStepDetailLoading ? (
                          <div className="flex justify-center p-12">
                            <Loader2 className="w-8 h-8 animate-spin" />
                          </div>
                        ) : caseStepDetailData ? (
                          <>
                            {/* Step Statistics */}
                            <div className="grid grid-cols-4 gap-4">
                              <MetricCard label="平均分数" value={caseStepDetailData.avg_score.toFixed(3)} />
                              <MetricCard label="最高分" value={caseStepDetailData.max_score.toFixed(3)} />
                              <MetricCard label="最低分" value={caseStepDetailData.min_score.toFixed(3)} />
                              <MetricCard label="Rollout 数量" value={caseStepDetailData.rollout_count} />
                            </div>

                            {/* Rollout Cards */}
                            <div className="space-y-4">
                              {caseStepDetailData.parsed_rollouts.map((rollout, idx) => {
                                const { switchHuman, tokenPenalty, score } = getRolloutInfo(rollout, caseStepDetailData.scores[idx]);
                                return (
                                  <Card key={idx}>
                                    <CardHeader className="py-3">
                                      <div className="flex items-center justify-between">
                                        <CardTitle className="text-sm flex items-center gap-2">
                                          Rollout {idx + 1}
                                          <Badge variant={score >= 0.5 ? "default" : "destructive"}>
                                            Score: {score.toFixed(3)}
                                          </Badge>
                                          {switchHuman !== "0" && (
                                            <Badge variant="outline" className="text-orange-600">
                                              转人工: {switchHuman}
                                            </Badge>
                                          )}
                                          {tokenPenalty && (
                                            <Badge variant="destructive">Token 惩罚</Badge>
                                          )}
                                        </CardTitle>
                                      </div>
                                    </CardHeader>
                                    <CardContent>
                                      <ScrollArea className="h-64">
                                        <div className="space-y-2">
                                          {rollout.trajectory.map((msg, msgIdx) => (
                                            <ChatBubble key={msgIdx} role={msg.role} content={msg.content} />
                                          ))}
                                        </div>
                                      </ScrollArea>
                                    </CardContent>
                                  </Card>
                                );
                              })}
                            </div>
                          </>
                        ) : (
                          <Card className="p-8 text-center text-muted-foreground">
                            选择 Case 和 Step 查看详情
                          </Card>
                        )}
                      </>
                    )}
                  </TabLoading>
                </TabsContent>

                {/* ==================== Tab 5: Step Comparison (New Case-Based) ==================== */}
                <TabsContent value="comparison" className="space-y-4">
                  <TabLoading tabName="对比数据" isLoading={stepComparisonV2Loading}>
                    {stepComparisonV2Data && (
                      <>
                        {/* Case & Step Selection */}
                        <Card>
                          <CardContent className="pt-4">
                            <div className="grid grid-cols-4 gap-4">
                              {/* Case Selection */}
                              <div>
                                <Label className="text-sm">选择 Case</Label>
                                <Select 
                                  value={String(selectedCaseId)} 
                                  onValueChange={(v) => setSelectedCaseId(Number(v))}
                                >
                                  <SelectTrigger className="mt-2">
                                    <SelectValue placeholder="选择 Case" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {stepComparisonV2Data.cases.filter(c => c.case_id != null && c.case_id !== '').map((caseInfo) => (
                                      <SelectItem key={caseInfo.case_id} value={String(caseInfo.case_id)}>
                                        Case {caseInfo.case_id + 1}: {caseInfo.preview?.slice(0, 30) || '...'}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              
                              {/* Step A Selection */}
                              <div>
                                <Label className="text-sm">Step A (基准)</Label>
                                <Select 
                                  value={String(compareStepA)} 
                                  onValueChange={(v) => setCompareStepA(Number(v))}
                                >
                                  <SelectTrigger className="mt-2">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {stepComparisonV2Data.steps.map((step) => (
                                      <SelectItem key={step} value={String(step)}>
                                        Step {step}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              
                              {/* Step B Selection */}
                              <div>
                                <Label className="text-sm">Step B (对比)</Label>
                                <Select 
                                  value={String(compareStepB)} 
                                  onValueChange={(v) => setCompareStepB(Number(v))}
                                >
                                  <SelectTrigger className="mt-2">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {stepComparisonV2Data.steps.map((step) => (
                                      <SelectItem key={step} value={String(step)}>
                                        Step {step}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              {/* Quick Jump to Last Step */}
                              <div className="flex items-end">
                                <Button 
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    const steps = stepComparisonV2Data.steps;
                                    if (steps.length > 0) {
                                      setCompareStepA(steps[0]);
                                      setCompareStepB(steps[steps.length - 1]);
                                    }
                                  }}
                                >
                                  首尾对比
                                </Button>
                              </div>
                            </div>
                            
                            {/* Max Rollouts Display Control */}
                            <div className="mt-4 flex items-center gap-4">
                              <Label className="text-sm whitespace-nowrap">显示 Rollout 数量:</Label>
                              <Slider
                                value={[maxRolloutsDisplay]}
                                onValueChange={(v) => setMaxRolloutsDisplay(v[0])}
                                min={1}
                                max={20}
                                step={1}
                                className="w-48"
                              />
                              <span className="text-sm text-muted-foreground w-8">{maxRolloutsDisplay}</span>
                            </div>
                          </CardContent>
                        </Card>

                        {/* Case Trend Chart - Use TensorBoard reward mean */}
                        {tbStatusData?.has_tfevents && tbScalarsData?.scalars['critic/rewards/mean'] ? (
                          <Card>
                            <CardHeader className="pb-2">
                              <CardTitle className="text-base flex items-center gap-2">
                                Reward 趋势 (TensorBoard)
                                {overviewSmoothWindow > 1 && (
                                  <Badge variant="secondary" className="text-xs">
                                    已平滑 (窗口={overviewSmoothWindow})
                                  </Badge>
                                )}
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <ResponsiveContainer width="100%" height={200}>
                                <LineChart data={smoothChartData(
                                  tbScalarsData.scalars['critic/rewards/mean'].steps.map((step, idx) => ({
                                    step,
                                    reward: tbScalarsData.scalars['critic/rewards/mean'].values[idx]
                                  })),
                                  ['reward'],
                                  overviewSmoothWindow
                                )}>
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis 
                                    dataKey="step" 
                                    label={{ value: 'Training Step', position: 'insideBottom', offset: -5 }}
                                  />
                                  <YAxis label={{ value: 'Reward', angle: -90, position: 'insideLeft' }} />
                                  <Tooltip 
                                    formatter={(value: number) => [value.toFixed(4), 'Reward Mean']}
                                    labelFormatter={(step) => `Step ${step}`}
                                  />
                                  <Line type="monotone" dataKey="reward" stroke="#8884d8" strokeWidth={2} name="Reward Mean" dot={false} />
                                </LineChart>
                              </ResponsiveContainer>
                            </CardContent>
                          </Card>
                        ) : caseTrendData && caseTrendData.trend_data.length > 0 ? (
                          <Card>
                            <CardHeader className="pb-2">
                              <CardTitle className="text-base flex items-center gap-2">
                                Case {selectedCaseId + 1} 训练趋势 (Rollout 数据)
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <ResponsiveContainer width="100%" height={200}>
                                <LineChart data={caseTrendData.trend_data.map(d => ({
                                  step: d.step,
                                  avg_score: d.avg_score
                                }))}>
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis dataKey="step" />
                                  <YAxis />
                                  <Tooltip formatter={(value: number) => value.toFixed(4)} />
                                  <Line type="monotone" dataKey="avg_score" stroke="#8884d8" strokeWidth={2} name="平均分" dot={false} />
                                </LineChart>
                              </ResponsiveContainer>
                            </CardContent>
                          </Card>
                        ) : null}

                        {/* Comparison Content */}
                        {compareStepA === compareStepB ? (
                          <Card className="p-8 text-center text-muted-foreground">
                            请选择不同的 Step 进行对比
                          </Card>
                        ) : stepCompareLoading ? (
                          <div className="flex justify-center p-12">
                            <Loader2 className="w-8 h-8 animate-spin" />
                          </div>
                        ) : stepCompareData ? (
                          <div className="space-y-4">
                            {/* Delta Metrics */}
                            <div className="grid grid-cols-3 gap-4">
                              <MetricCard
                                label="Score Delta"
                                value={stepCompareData.delta.score >= 0 ? `+${stepCompareData.delta.score.toFixed(3)}` : stepCompareData.delta.score.toFixed(3)}
                                delta={stepCompareData.delta.score}
                                deltaDesc={`Step ${compareStepA} → ${compareStepB}`}
                              />
                              <MetricCard
                                label={`Step ${compareStepA} Mean Score`}
                                value={stepCompareData.step_a.avg_score.toFixed(3)}
                              />
                              <MetricCard
                                label={`Step ${compareStepB} Mean Score`}
                                value={stepCompareData.step_b.avg_score.toFixed(3)}
                              />
                            </div>
                            
                            {/* Side-by-side Comparison */}
                            <div className="grid grid-cols-2 gap-4">
                              {/* Step A */}
                              <Card>
                                <CardHeader className="pb-2 bg-blue-50">
                                  <CardTitle className="text-base flex items-center gap-2">
                                    <Badge variant="outline">Step A</Badge>
                                    Step {compareStepA}
                                  </CardTitle>
                                </CardHeader>
                                <CardContent className="pt-4">
                                  <div className="space-y-2 mb-4">
                                    <div className="flex justify-between text-sm">
                                      <span className="text-muted-foreground">Mean Score</span>
                                      <span className="font-medium">{stepCompareData.step_a.avg_score.toFixed(3)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                      <span className="text-muted-foreground">Score Range</span>
                                      <span className="font-medium">{stepCompareData.step_a.min_score.toFixed(3)} - {stepCompareData.step_a.max_score.toFixed(3)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                      <span className="text-muted-foreground">Rollouts</span>
                                      <span className="font-medium">{stepCompareData.step_a.rollout_count}</span>
                                    </div>
                                  </div>
                                  
                                  {/* Multiple Rollout Previews with Collapse */}
                                  <div className="border-t pt-4 space-y-2">
                                    <p className="text-xs text-muted-foreground mb-2">
                                      对话预览 (显示 {Math.min(maxRolloutsDisplay, stepCompareData.step_a.parsed_rollouts.length)} / {stepCompareData.step_a.parsed_rollouts.length} 条)
                                    </p>
                                    {stepCompareData.step_a.parsed_rollouts.slice(0, maxRolloutsDisplay).map((rollout, idx) => (
                                      <Collapsible 
                                        key={idx}
                                        open={expandedRollouts.has(idx)}
                                        onOpenChange={(open) => {
                                          const newExpanded = new Set(expandedRollouts);
                                          if (open) {
                                            newExpanded.add(idx);
                                          } else {
                                            newExpanded.delete(idx);
                                          }
                                          setExpandedRollouts(newExpanded);
                                        }}
                                      >
                                        <CollapsibleTrigger className="flex items-center justify-between w-full p-2 bg-muted/50 rounded-lg hover:bg-muted">
                                          <span className="text-sm font-medium">
                                            Rollout {idx + 1} 
                                            <Badge variant="outline" className="ml-2">
                                              Score: {stepCompareData.step_a.scores[idx]?.toFixed(3) ?? 'N/A'}
                                            </Badge>
                                          </span>
                                          {expandedRollouts.has(idx) ? (
                                            <ChevronUp className="w-4 h-4" />
                                          ) : (
                                            <ChevronDown className="w-4 h-4" />
                                          )}
                                        </CollapsibleTrigger>
                                        <CollapsibleContent>
                                          <ScrollArea className="h-48 mt-2">
                                            <div className="space-y-2 p-2">
                                              {rollout.trajectory.slice(0, 8).map((msg, msgIdx) => (
                                                <ChatBubble key={msgIdx} role={msg.role} content={msg.content} />
                                              ))}
                                              {rollout.trajectory.length > 8 && (
                                                <p className="text-xs text-center text-muted-foreground">
                                                  ... 更多对话 ({rollout.trajectory.length - 8} 条)
                                                </p>
                                              )}
                                            </div>
                                          </ScrollArea>
                                        </CollapsibleContent>
                                      </Collapsible>
                                    ))}
                                  </div>
                                </CardContent>
                              </Card>
                              
                              {/* Step B */}
                              <Card>
                                <CardHeader className="pb-2 bg-green-50">
                                  <CardTitle className="text-base flex items-center gap-2">
                                    <Badge variant="outline">Step B</Badge>
                                    Step {compareStepB}
                                    {stepCompareData.delta.score_improved && (
                                      <Badge variant="default" className="bg-green-500">
                                        <TrendingUp className="w-3 h-3 mr-1" />
                                        +{stepCompareData.delta.score.toFixed(3)}
                                      </Badge>
                                    )}
                                  </CardTitle>
                                </CardHeader>
                                <CardContent className="pt-4">
                                  <div className="space-y-2 mb-4">
                                    <div className="flex justify-between text-sm">
                                      <span className="text-muted-foreground">Mean Score</span>
                                      <span className="font-medium">{stepCompareData.step_b.avg_score.toFixed(3)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                      <span className="text-muted-foreground">Score Range</span>
                                      <span className="font-medium">{stepCompareData.step_b.min_score.toFixed(3)} - {stepCompareData.step_b.max_score.toFixed(3)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                      <span className="text-muted-foreground">Rollouts</span>
                                      <span className="font-medium">{stepCompareData.step_b.rollout_count}</span>
                                    </div>
                                  </div>
                                  
                                  {/* Multiple Rollout Previews with Collapse */}
                                  <div className="border-t pt-4 space-y-2">
                                    <p className="text-xs text-muted-foreground mb-2">
                                      对话预览 (显示 {Math.min(maxRolloutsDisplay, stepCompareData.step_b.parsed_rollouts.length)} / {stepCompareData.step_b.parsed_rollouts.length} 条)
                                    </p>
                                    {stepCompareData.step_b.parsed_rollouts.slice(0, maxRolloutsDisplay).map((rollout, idx) => (
                                      <Collapsible 
                                        key={idx}
                                        open={expandedRollouts.has(idx + 1000)} // Offset to avoid conflict with Step A
                                        onOpenChange={(open) => {
                                          const newExpanded = new Set(expandedRollouts);
                                          if (open) {
                                            newExpanded.add(idx + 1000);
                                          } else {
                                            newExpanded.delete(idx + 1000);
                                          }
                                          setExpandedRollouts(newExpanded);
                                        }}
                                      >
                                        <CollapsibleTrigger className="flex items-center justify-between w-full p-2 bg-muted/50 rounded-lg hover:bg-muted">
                                          <span className="text-sm font-medium">
                                            Rollout {idx + 1} 
                                            <Badge variant="outline" className="ml-2">
                                              Score: {stepCompareData.step_b.scores[idx]?.toFixed(3) ?? 'N/A'}
                                            </Badge>
                                          </span>
                                          {expandedRollouts.has(idx + 1000) ? (
                                            <ChevronUp className="w-4 h-4" />
                                          ) : (
                                            <ChevronDown className="w-4 h-4" />
                                          )}
                                        </CollapsibleTrigger>
                                        <CollapsibleContent>
                                          <ScrollArea className="h-48 mt-2">
                                            <div className="space-y-2 p-2">
                                              {rollout.trajectory.slice(0, 8).map((msg, msgIdx) => (
                                                <ChatBubble key={msgIdx} role={msg.role} content={msg.content} />
                                              ))}
                                              {rollout.trajectory.length > 8 && (
                                                <p className="text-xs text-center text-muted-foreground">
                                                  ... 更多对话 ({rollout.trajectory.length - 8} 条)
                                                </p>
                                              )}
                                            </div>
                                          </ScrollArea>
                                        </CollapsibleContent>
                                      </Collapsible>
                                    ))}
                                  </div>
                                </CardContent>
                              </Card>
                            </div>
                          </div>
                        ) : null}
                      </>
                    )}
                  </TabLoading>
                </TabsContent>
              </Tabs>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
