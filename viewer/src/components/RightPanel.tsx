import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Plus, ArrowUp } from "lucide-react";

export function RightPanel() {
  return (
    <aside className="w-80 border-l bg-background p-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            问答
            <Button variant="ghost" size="icon" className="ml-auto h-6 w-6">
              <Plus className="h-4 w-4" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">新问答</span>
            <div className="h-4 w-4 rounded-full border-2 border-dashed border-muted-foreground/30"></div>
          </div>
          
          <ScrollArea className="h-64">
            <div className="space-y-3">
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-sm">苹果公司的盈利能力如何？</p>
              </div>
              <div className="p-3 bg-primary/10 rounded-lg">
                <p className="text-sm">根据财务数据，苹果公司展现出强劲的盈利能力，毛利率达46.5%，净利润率高达24.3%...</p>
              </div>
            </div>
          </ScrollArea>

          <div className="space-y-2">
            <Textarea 
              placeholder="输入您的问题..." 
              className="min-h-[80px] resize-none"
            />
            <Button className="w-full gap-2">
              <ArrowUp className="h-4 w-4" />
              发送问题
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="mt-4 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-muted rounded-full mb-2">
          <MessageSquare className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">暂无个人数据的问题</p>
      </div>
    </aside>
  );
}