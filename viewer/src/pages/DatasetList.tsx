import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  listDatasets,
  uploadDataset,
  deleteDataset,
  getDatasetPreview,
  getDatasetDownloadUrl,
  getDatasetRelations,
  type DatasetRecord,
  type DatasetType,
} from "@/lib/datasetApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Database, Upload, Download, Trash2, Search, Eye, FileText } from "lucide-react";

export default function DatasetList() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [datasetToDelete, setDatasetToDelete] = useState<DatasetRecord | null>(null);
  const [uploadType, setUploadType] = useState<DatasetType>("DIALOGUE");
  const [uploadName, setUploadName] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["datasets", typeFilter, sourceFilter, search],
    queryFn: () =>
      listDatasets({
        type: typeFilter !== "all" ? (typeFilter as DatasetType) : undefined,
        source: sourceFilter !== "all" ? sourceFilter : undefined,
        search: search || undefined,
      }),
  });

  const uploadMutation = useMutation({
    mutationFn: uploadDataset,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["datasets"] });
      toast({ title: "上传成功", description: "数据集已添加" });
      setUploadOpen(false);
      setUploadFile(null);
      setUploadName("");
      setUploadType("DIALOGUE");
    },
    onError: (error: Error) => {
      toast({ title: "上传失败", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteDataset,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["datasets"] });
      toast({ title: "删除成功", description: "数据集已删除" });
      setDeleteDialogOpen(false);
      setDatasetToDelete(null);
    },
    onError: (error: Error) => {
      toast({ title: "删除失败", description: error.message, variant: "destructive" });
    },
  });

  const datasets = useMemo(() => data?.datasets ?? [], [data]);

  const typeLabels: Record<DatasetType, string> = {
    PORTRAIT: "用户画像",
    DIALOGUE: "对话合成",
    EVALUATION: "质量评估",
    HUMAN_HUMAN_DIALOGUE: "人人对话",
  };

  const sourceLabels = {
    TASK: "任务生成",
    UPLOAD: "手动上传",
    ANNOTATION: "标注导出",
    ANNOTATION_V2: "标注导出",
  } as const;

  const handleUpload = () => {
    if (!uploadFile || !uploadName.trim()) {
      toast({
        title: "请填写完整信息",
        description: "请选择文件并输入数据集名称",
        variant: "destructive",
      });
      return;
    }
    uploadMutation.mutate({ name: uploadName, dataType: uploadType, file: uploadFile });
  };

  const handleDelete = (dataset: DatasetRecord) => {
    setDatasetToDelete(dataset);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (datasetToDelete) {
      deleteMutation.mutate(datasetToDelete.id);
    }
  };

  const handleDownload = async (dataset: DatasetRecord) => {
    try {
      const url = getDatasetDownloadUrl(dataset.id);
      window.location.href = url;
      toast({ title: "下载成功", description: "文件已开始下载" });
    } catch (error: any) {
      toast({ title: "下载失败", description: error.message, variant: "destructive" });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="flex-1 p-6">
        {/* 页面标题 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Database className="w-8 h-8" />
              Dataset
            </h1>
            <p className="text-muted-foreground mt-1">自动汇总任务输出与手动上传数据。</p>
          </div>
          <Button onClick={() => setUploadOpen(true)} size="lg">
            <Upload className="w-4 h-4 mr-2" />
            上传数据集
          </Button>
        </div>

        {/* 筛选栏 */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="搜索数据集名称..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>

              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="数据类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部类型</SelectItem>
                  <SelectItem value="PORTRAIT">用户画像</SelectItem>
                  <SelectItem value="DIALOGUE">对话合成</SelectItem>
                  <SelectItem value="EVALUATION">质量评估</SelectItem>
                  <SelectItem value="HUMAN_HUMAN_DIALOGUE">人人对话</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="数据来源" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部来源</SelectItem>
                  <SelectItem value="TASK">任务生成</SelectItem>
                  <SelectItem value="UPLOAD">手动上传</SelectItem>
                  <SelectItem value="ANNOTATION">标注导出</SelectItem>
                  <SelectItem value="ANNOTATION_V2">标注导出</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* 数据集列表 */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">加载中...</div>
            ) : datasets.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">暂无数据集</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>名称</TableHead>
                    <TableHead>类型</TableHead>
                    <TableHead>来源</TableHead>
                    <TableHead>格式</TableHead>
                    <TableHead>条目数</TableHead>
                    <TableHead>创建时间</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {datasets.map((dataset) => (
                    <TableRow
                      key={dataset.id}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-muted-foreground" />
                          {dataset.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{typeLabels[dataset.data_type]}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={["TASK", "ANNOTATION", "ANNOTATION_V2"].includes(dataset.source) ? "default" : "secondary"}>
                          {sourceLabels[dataset.source as keyof typeof sourceLabels]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs font-mono text-muted-foreground">
                          {dataset.file_format}
                        </span>
                      </TableCell>
                      <TableCell>{dataset.item_count.toLocaleString()}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(dataset.created_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/datasets/${dataset.id}`)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownload(dataset)}
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(dataset)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 上传对话框 */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>上传数据集</DialogTitle>
            <DialogDescription>上传json或jsonl格式的数据文件</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">数据集名称</Label>
              <Input
                id="name"
                value={uploadName}
                onChange={(e) => setUploadName(e.target.value)}
                placeholder="输入数据集名称"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="type">数据类型</Label>
              <Select value={uploadType} onValueChange={(v) => setUploadType(v as DatasetType)}>
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PORTRAIT">用户画像</SelectItem>
                  <SelectItem value="DIALOGUE">对话合成</SelectItem>
                  <SelectItem value="EVALUATION">质量评估</SelectItem>
                  <SelectItem value="HUMAN_HUMAN_DIALOGUE">人人对话</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="file">选择文件</Label>
              <Input
                id="file"
                type="file"
                accept=".json,.jsonl"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)}>
              取消
            </Button>
            <Button onClick={handleUpload} disabled={uploadMutation.isPending}>
              {uploadMutation.isPending ? "上传中..." : "上传"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除数据集 "{datasetToDelete?.name}" 吗？此操作不可恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
