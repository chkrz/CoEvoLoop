import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DatasetForm() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="flex-1 p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Dataset</h1>
          <p className="text-muted-foreground mt-1">
            页面逻辑已清空，等待重新设计。
          </p>
        </div>

        <Card className="max-w-3xl">
          <CardHeader>
            <CardTitle>占位内容</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              这里将重新构建 Dataset 页面。
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
