import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { Upload, FileText, Calendar, Layers } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ThemeToggle from "@/components/ThemeToggle";
import CategorySelection from "@/components/CategorySelection";
import { getAllChats, ChatSummary } from "@/lib/api";

interface PDF {
  id: string;
  title: string;
  lastUsed: string;
  pages: number;
  thumbnail: string;
  pdfId: string;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const selectedFileRef = useRef<File | null>(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [pdfs, setPdfs] = useState<PDF[]>([]);
  const [isLoadingChats, setIsLoadingChats] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string>("");

  useEffect(() => {
    let isMounted = true;
    const fetchChats = async () => {
      try {
        setIsLoadingChats(true);
        setLoadError("");
        const res = await getAllChats();
        if (!isMounted) return;
        const mapped: PDF[] = res.chats.map((c: ChatSummary) => ({
          id: c.chat_id,
          title: c.pdf_filename,
          lastUsed: c.last_accessed || c.created_at,
          pages: c.num_pages,
          thumbnail: c.thumbnail_url && c.thumbnail_url.length > 0 ? c.thumbnail_url : "/placeholder.svg",
          pdfId: c.pdf_id || "",
        }));
        setPdfs(mapped);
      } catch (err: any) {
        if (!isMounted) return;
        console.error(err);
        setLoadError(err?.message || "Failed to load chats");
        toast({
          title: "Failed to load chats",
          description: err?.message || String(err),
          variant: "destructive",
        });
      } finally {
        if (isMounted) setIsLoadingChats(false);
      }
    };
    fetchChats();
    return () => {
      isMounted = false;
    };
  }, [toast]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === "application/pdf") {
      setUploadedFileName(file.name);
      setShowCategoryModal(true);
      toast({
        title: "PDF Selected",
        description: `${file.name} - Please select a category`,
      });
    } else {
      toast({
        title: "Invalid File",
        description: "Please upload a PDF file.",
        variant: "destructive",
      });
    }
  };

  // More tolerant PDF detection: some browsers/OS set a different mime-type.
  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    console.log("file input change event, file:", file);
    if (!file) return;
    const isPdfByType = file.type === "application/pdf";
    const isPdfByExt = file.name.toLowerCase().endsWith(".pdf");
    if (isPdfByType || isPdfByExt) {
      setUploadedFileName(file.name);
      selectedFileRef.current = file;
      setShowCategoryModal(true);
      toast({
        title: "PDF Selected",
        description: `${file.name} - Please select a category`,
      });
    } else {
      toast({
        title: "Invalid File",
        description: "Please upload a PDF file.",
        variant: "destructive",
      });
    }
  };

  const handleCategorySelect = async (category: string) => {
    setShowCategoryModal(false);
    toast({
      title: "Uploading",
      description: `Uploading ${uploadedFileName}...`,
    });

    try {
      const file = selectedFileRef.current;
      if (!file) throw new Error("No file selected");
      const { uploadPdf } = await import("@/lib/api");
      const res = await uploadPdf([file]);
      toast({
        title: "Upload Complete",
        description: res.message || "PDF uploaded",
      });
      const chatId = res.chat_id;
      const pdfId = res.pdf_id;
      if (!chatId) throw new Error("No chat ID returned from server");
      navigate(`/chat/${chatId}?pdf=${pdfId}`);
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Upload Failed",
        description: err?.message || String(err),
        variant: "destructive",
      });
    } finally {
      selectedFileRef.current = null;
    }
  };

  const handlePDFClick = (chatId: string, pdfId: string) => {
    // Direct navigation for history PDFs (no category selection)
    navigate(`/chat/${chatId}?pdf=${pdfId}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-7xl px-4 py-12">
        {/* Header */}
        <div className="mb-12 flex items-start justify-between">
          <div>
            <h1 className="mb-3 text-4xl font-bold">Dashboard</h1>
            <p className="text-lg text-muted-foreground">Upload and manage your PDF documents</p>
          </div>
          <ThemeToggle />
        </div>

        {/* Upload Section */}
        <Card className="mb-12 border-2 border-dashed border-primary/30 bg-card transition-all hover:border-primary/50">
          <CardContent className="p-12">
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                <Upload className="h-8 w-8 text-primary" />
              </div>

              <h3 className="mb-2 text-2xl font-semibold">Upload PDF</h3>
              <p className="mb-6 text-muted-foreground">
                Drag and drop your PDF file here, or click to browse
              </p>

              <div>
                <Button
                  size="lg"
                  className="cursor-pointer"
                  onClick={() => {
                    console.log("Upload button clicked, inputRef:", inputRef.current);
                    inputRef.current?.click();
                  }}
                >
                  Choose PDF File
                </Button>
                <input
                  ref={inputRef}
                  id="pdf-upload"
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={handleFileInput}
                />
              </div>

            </div>
          </CardContent>
        </Card>

        {/* Recent PDFs */}
        <div>
          <h2 className="mb-6 text-2xl font-bold">Recent PDFs</h2>

          {isLoadingChats && (
            <div className="text-muted-foreground">Loading your chats…</div>
          )}

          {!isLoadingChats && loadError && (
            <div className="text-red-500 text-sm">{loadError}</div>
          )}

          {!isLoadingChats && !loadError && pdfs.length === 0 && (
            <div className="text-muted-foreground">No chats yet. Upload a PDF to get started.</div>
          )}

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {pdfs.map((pdf) => (
              <Card
                key={pdf.id}
                className="group cursor-pointer overflow-hidden border-2 transition-all duration-300 hover:border-primary/50 hover:shadow-[var(--shadow-hover)]"
                onClick={() => handlePDFClick(pdf.id,pdf.pdfId)}
              >
                <div className="aspect-[4/5] overflow-hidden bg-muted">
                  <img
                    src={pdf.thumbnail}
                    alt={pdf.title}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                </div>

                <CardContent className="p-6">
                  <div className="mb-4 flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h3 className="mb-1 line-clamp-2 font-semibold">{pdf.title}</h3>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      <span>{pdf.lastUsed}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Layers className="h-4 w-4" />
                      <span>{pdf.pages} pages</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      <CategorySelection
        isOpen={showCategoryModal}
        onSelect={handleCategorySelect}
        onClose={() => setShowCategoryModal(false)}
      />
    </div>
  );
};

export default Dashboard;
