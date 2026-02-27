import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SidebarLayout } from "@/components/SidebarLayout";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import DatasetList from "./pages/DatasetList";
import DatasetForm from "./pages/DatasetForm";
import DatasetDetail from "./pages/DatasetDetail";
import DatasetConversionPage from "./pages/dataset/DatasetConversionPage";
import DatasetComparisonPage from "./pages/dataset/DatasetComparisonPage";
import SynthesisList from "./pages/SynthesisList";
import SynthesisForm from "./pages/SynthesisForm";
import SynthesisDetail from "./pages/SynthesisDetail";
import RLPlayground from "./pages/RLPlayground";
import AnnotationDashboard from "./pages/annotation/AnnotationDashboard";
import AnnotationDashboardNew from "./pages/annotation/AnnotationDashboardNew";
import SimpleAnnotationDemo from "./pages/annotation/SimpleAnnotationDemo";
import AnnotationV2 from "./pages/AnnotationV2";
import DiffDemo from "./pages/DiffDemo";
import { DialogueBSLayout } from "@/components/DialogueBSLayout";
import { UserProvider } from "@/contexts/UserContext";
import { AuthGuard } from "@/components/AuthGuard";
import ComparePage from "./pages/annotation/ComparePage";
import AnnotationWorkspacePage from "./pages/annotation/AnnotationWorkspacePage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <UserProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Homepage without sidebar */}
            <Route path="/" element={<Index />} />
            
            {/* All other pages with sidebar */}
            <Route path="/*" element={
              <SidebarLayout>
                <Routes>
                  {/* Dialogue System */}
                  <Route path="/dialogue_bs" element={
                    <AuthGuard>
                      <DialogueBSLayout />
                    </AuthGuard>
                  } />
                  
                  {/* Dataset Management */}
                  <Route path="/datasets" element={<DatasetList />} />
                  <Route path="/datasets/new" element={<DatasetForm />} />
<Route path="/datasets/:id" element={<DatasetDetail />} />
                  <Route path="/datasets/:id/edit" element={<DatasetForm />} />
                  <Route path="/datasets/:id/convert" element={<DatasetConversionPage />} />
                  <Route path="/datasets/compare/:originalId/:annotatedId" element={<DatasetComparisonPage />} />
                  <Route path="/datasets/:originalId/compare/:annotatedId" element={<DatasetComparisonPage />} />
                  
                  {/* Data Synthesis */}
                  <Route path="/synthesis" element={<SynthesisList />} />
                  <Route path="/synthesis/new" element={<SynthesisForm />} />
                  <Route path="/synthesis/:id" element={<SynthesisDetail />} />
                  
                  {/* RL Playground */}
                  <Route path="/rl-playground" element={<RLPlayground />} />
                  
                  {/* Annotation */}
                  <Route path="/annotation" element={<AnnotationDashboardNew />} />
                  <Route path="/annotation/dashboard" element={<AnnotationDashboard />} />
                  <Route path="/annotation/demo" element={<SimpleAnnotationDemo />} />
                  <Route path="/annotation/v2/:datasetId" element={<AnnotationV2 />} />
                  <Route path="/annotation/diff-demo" element={<DiffDemo />} />
                  <Route path="/annotation/compare/:datasetId" element={<ComparePage />} />
                  <Route path="/annotation/compare/:datasetId/results" element={<ComparePage />} />
                  <Route path="/annotation/workspace/:datasetId" element={<AnnotationWorkspacePage />} />

                  {/* 404 */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </SidebarLayout>
            } />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </UserProvider>
  </QueryClientProvider>
);

export default App;
