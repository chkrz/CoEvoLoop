import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
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
      toast({ title: t('dataset.upload_success'), description: t('dataset.added_success') });
      setUploadOpen(false);
      setUploadFile(null);
      setUploadName("");
      setUploadType("DIALOGUE");
    },
    onError: (error: Error) => {
      toast({ title: t('dataset.upload_failed'), description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteDataset,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["datasets"] });
      toast({ title: t('dataset.delete_success'), description: t('dataset.deleted_success') });
      setDeleteDialogOpen(false);
      setDatasetToDelete(null);
    },
    onError: (error: Error) => {
      toast({ title: t('dataset.delete_failed'), description: error.message, variant: "destructive" });
    },
  });

  const datasets = useMemo(() => data?.datasets ?? [], [data]);

  const typeLabels: Record<DatasetType, string> = {
    PORTRAIT: t('dataset.types.portrait'),
    DIALOGUE: t('dataset.types.dialogue'),
    EVALUATION: t('dataset.types.evaluation'),
    HUMAN_HUMAN_DIALOGUE: t('dataset.types.human_dialogue'),
  };

  const sourceLabels = {
    TASK: t('dataset.sources.task'),
    UPLOAD: t('dataset.sources.upload'),
    ANNOTATION: t('dataset.sources.annotation'),
    ANNOTATION_V2: t('dataset.sources.annotation'),
  } as const;

  const handleUpload = () => {
    if (!uploadFile || !uploadName.trim()) {
      toast({
        title: t('common.error'),
        description: t('dataset.fill_complete_info'),
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
      toast({ title: t('dataset.download_success'), description: t('dataset.download_started') });
    } catch (error: any) {
      toast({ title: t('dataset.download_failed'), description: error.message, variant: "destructive" });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="flex-1 p-6">
        {/* 页面标题 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Database className="w-8 h-8" />
              {t('dataset.management')}
            </h1>
            <p className="text-muted-foreground mt-1">{t('dataset.description')}</p>
          </div>
          <Button onClick={() => setUploadOpen(true)} size="lg">
            <Upload className="w-4 h-4 mr-2" />
            {t('dataset.upload')}
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
                <SelectValue placeholder={t('dataset.type')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('common.all')}</SelectItem>
                  <SelectItem value="PORTRAIT">{t('dataset.types.portrait')}</SelectItem>
                  <SelectItem value="DIALOGUE">{t('dataset.types.dialogue')}</SelectItem>
                  <SelectItem value="EVALUATION">{t('dataset.types.evaluation')}</SelectItem>
                  <SelectItem value="HUMAN_HUMAN_DIALOGUE">{t('dataset.types.human_dialogue')}</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder={t('dataset.source')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('common.all')}</SelectItem>
                  <SelectItem value="TASK">{t('dataset.sources.task')}</SelectItem>
                  <SelectItem value="UPLOAD">{t('dataset.sources.upload')}</SelectItem>
                  <SelectItem value="ANNOTATION">{t('dataset.sources.annotation')}</SelectItem>
                  <SelectItem value="ANNOTATION_V2">{t('dataset.sources.annotation')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* 数据集列表 */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">{t('common.loading')}</div>
            ) : datasets.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">{t('dataset.no_datasets')}</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('common.name')}</TableHead>
                    <TableHead>{t('common.type')}</TableHead>
                    <TableHead>{t('dataset.source')}</TableHead>
                    <TableHead>{t('common.format')}</TableHead>
                    <TableHead>{t('dataset.item_count')}</TableHead>
                    <TableHead>{t('common.created')}</TableHead>
                    <TableHead className="text-right">{t('common.actions')}</TableHead>
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
            <DialogTitle>{t('dataset.upload')}</DialogTitle>
            <DialogDescription>{t('dataset.upload_description')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">{t('dataset.name')}</Label>
              <Input
                id="name"
                value={uploadName}
                onChange={(e) => setUploadName(e.target.value)}
                placeholder={t('dataset.name_placeholder')}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="type">{t('common.type')}</Label>
              <Select value={uploadType} onValueChange={(v) => setUploadType(v as DatasetType)}>
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PORTRAIT">{t('dataset.types.portrait')}</SelectItem>
                  <SelectItem value="DIALOGUE">{t('dataset.types.dialogue')}</SelectItem>
                  <SelectItem value="EVALUATION">{t('dataset.types.evaluation')}</SelectItem>
                  <SelectItem value="HUMAN_HUMAN_DIALOGUE">{t('dataset.types.human_dialogue')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="file">{t('common.file')}</Label>
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
              {t('common.cancel')}
            </Button>
            <Button onClick={handleUpload} disabled={uploadMutation.isPending}>
              {uploadMutation.isPending ? t('common.uploading') : t('common.upload')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('common.confirm_delete')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('dataset.delete_confirm', { name: datasetToDelete?.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>{t('common.delete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
