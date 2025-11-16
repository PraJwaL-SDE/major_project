import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  Send,
  ArrowLeft,
  Presentation,
  Globe,
  Volume2,
  Copy,
  Heart,
  Highlighter
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import SlideModal from "@/components/SlideModal";
import ThemeToggle from "@/components/ThemeToggle";
import { getChatHistory, getPdf } from "@/lib/api";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

const Chat = () => {
  const params = useParams(); // may contain chatId
  const { chatId: paramChatId } = params;
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();

  // pdfId comes from query string ?pdf=<pdf_id>
  const pdfId = new URLSearchParams(location.search).get("pdf") || "";

  // Compute an effective chatId that matches backend expectation ("chat_<uuid>")
  const effectiveChatId = (() => {
    if (paramChatId && paramChatId.startsWith("chat_")) return paramChatId;
    if (pdfId) return `chat_${pdfId}`;
    return undefined;
  })();

  const [input, setInput] = useState("");
  const [showSlideModal, setShowSlideModal] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);
  const [historyError, setHistoryError] = useState<string>("");

  const [pdfUrl, setPdfUrl] = useState<string>("");
  const [isLoadingPdf, setIsLoadingPdf] = useState<boolean>(false);

  // helper: convert content to plain text
  function toPlainText(content?: string | any) {
    if (!content && content !== "") return "";
    if (typeof content === "string") {
      if (/<[a-z][\s\S]*>/i.test(content)) {
        const div = document.createElement("div");
        div.innerHTML = content;
        return div.textContent || div.innerText || "";
      }
      return content;
    }
    try {
      return typeof content === "object" ? JSON.stringify(content, null, 2) : String(content);
    } catch {
      return String(content);
    }
  }

  async function copyToClipboard(rawContent?: string | any) {
    const text = toPlainText(rawContent);
    if (!text && text !== "") throw new Error("No text to copy");

    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return;
      } catch {}
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.top = "-9999px";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    try {
      document.execCommand("copy");
    } finally {
      document.body.removeChild(textarea);
    }
  }

  // --------------------------
  // LOAD CHAT HISTORY (uses effectiveChatId)
  // --------------------------
  useEffect(() => {
    let isMounted = true;

    const loadHistory = async () => {
      if (!effectiveChatId) {
        // No chatId available yet — show friendly assistant message
        setMessages([
          {
            id: "welcome",
            role: "assistant",
            content:
              "Hello! Upload a PDF or open a chat to start. Once you open a chat, ask me anything about the document.",
            timestamp: "Just now",
          },
        ]);
        return;
      }

      try {
        setIsLoadingHistory(true);
        setHistoryError("");
        const data = await getChatHistory(effectiveChatId);

        if (!isMounted) return;

        const historyMessages: Message[] = [];

        data.interactions.forEach((it, idx) => {
          historyMessages.push({
            id: `${idx}-q`,
            role: "user",
            content: it.question,
            timestamp: it.asked_at,
          });
          historyMessages.push({
            id: `${idx}-a`,
            role: "assistant",
            content: it.answer,
            timestamp: it.asked_at,
          });
        });

        setMessages(historyMessages.length ? historyMessages : [
          {
            id: "welcome",
            role: "assistant",
            content:
              "No previous interactions found. Ask a question to get started!",
            timestamp: "Just now",
          },
        ]);
      } catch (err: any) {
        if (!isMounted) return;
        console.error("History load failed:", err);
        setHistoryError(err?.message || "Failed to load chat history");
        setMessages([
          {
            id: "welcome",
            role: "assistant",
            content:
              "Hello! I'm ready to help you understand this PDF. Ask me any questions!",
            timestamp: "Just now",
          },
        ]);
      } finally {
        if (isMounted) setIsLoadingHistory(false);
      }
    };

    loadHistory();

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveChatId]); // reload when effectiveChatId changes

  // --------------------------
  // LOAD PDF (uses pdfId — VERY IMPORTANT)
  // --------------------------
  useEffect(() => {
    let isMounted = true;
    let currentUrl = "";

    const loadPdf = async () => {
      if (!pdfId) {
        console.warn("No pdfId in URL; skipping PDF load");
        return;
      }

      try {
        setIsLoadingPdf(true);
        const blob = await getPdf(pdfId);
        if (!isMounted) return;

        const url = URL.createObjectURL(blob);
        currentUrl = url;
        setPdfUrl(url);
      } catch (err: any) {
        console.error("PDF LOAD ERROR:", err);
        toast({
          title: "PDF load failed",
          description: err?.message || String(err),
          variant: "destructive",
        });
      } finally {
        if (isMounted) setIsLoadingPdf(false);
      }
    };

    loadPdf();

    return () => {
      isMounted = false;
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
  }, [pdfId, toast]);

  // --------------------------
  // SEND MESSAGE
  // --------------------------
  const handleSend = () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: "Just now",
    };

    setMessages((m) => [...m, userMessage]);
    setInput("");

    (async () => {
      try {
        const { askQuestion } = await import("@/lib/api");

        // We must send chat_id in the form backend expects (e.g. "chat_<uuid>")
        if (!effectiveChatId) {
          toast({
            title: "Missing chat id",
            description: "Cannot send question because chat id is missing.",
            variant: "destructive",
          });
          return;
        }

        // Primary attempt
        try {
          const res: any = await askQuestion(effectiveChatId, userMessage.content);
          const aiResp: Message = {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: res.answer || "(no answer)",
            timestamp: "Just now",
          };
          setMessages((m) => [...m, aiResp]);
          return;
        } catch (err: any) {
          // If server returned 404 (chat not found), try fallback using chat_<pdfId>
          console.warn("askQuestion primary attempt failed:", err);
          // Only attempt fallback if pdfId exists and effectiveChatId was not constructed from pdfId
          const fallbackChat = pdfId ? `chat_${pdfId}` : undefined;
          if (fallbackChat && fallbackChat !== effectiveChatId) {
            try {
              const { askQuestion: askQ } = await import("@/lib/api");
              const res2: any = await askQ(fallbackChat, userMessage.content);
              const aiResp2: Message = {
                id: (Date.now() + 2).toString(),
                role: "assistant",
                content: res2.answer || "(no answer)",
                timestamp: "Just now",
              };
              setMessages((m) => [...m, aiResp2]);
              // Also navigate to fallback chat route so future requests hit the same chat
              navigate(`/chat/${fallbackChat}?pdf=${pdfId}`, { replace: true });
              return;
            } catch (err2: any) {
              console.error("askQuestion fallback failed:", err2);
              toast({
                title: "Server error",
                description: err2?.message || "Failed to get answer from server",
                variant: "destructive",
              });
              setMessages((m) => [
                ...m,
                {
                  id: (Date.now() + 3).toString(),
                  role: "assistant",
                  content: "Failed to get answer from server.",
                  timestamp: "Just now",
                },
              ]);
              return;
            }
          }

          // No fallback or fallback didn't succeed
          toast({
            title: "Server error",
            description: err?.message || "Failed to get answer from server",
            variant: "destructive",
          });
          setMessages((m) => [
            ...m,
            {
              id: (Date.now() + 4).toString(),
              role: "assistant",
              content: "Failed to get answer from server.",
              timestamp: "Just now",
            },
          ]);
        }
      } catch (err) {
        console.error("Unexpected ask flow error:", err);
        toast({
          title: "Error",
          description: "Unexpected error while sending question",
          variant: "destructive",
        });
        setMessages((m) => [
          ...m,
          {
            id: (Date.now() + 5).toString(),
            role: "assistant",
            content: "Failed to get answer from server.",
            timestamp: "Just now",
          },
        ]);
      }
    })();
  };

  const handleAction = async (action: string, content?: string) => {
    switch (action) {
      case "slide":
        setSelectedAnswer(content || "");
        setShowSlideModal(true);
        break;

      case "translate":
        toast({
          title: "Translation",
          description: "Feature coming soon!",
        });
        break;

      case "speak":
        if (!content) {
          toast({ title: "Error", description: "No text available to speak." });
          return;
        }
        window.speechSynthesis.cancel();
        {
          const utterance = new SpeechSynthesisUtterance(content);
          utterance.lang = "en-US";
          window.speechSynthesis.speak(utterance);
        }
        break;

      case "copy":
        try {
          await copyToClipboard(content);
          toast({ title: "Copied", description: "Answer copied to clipboard" });
        } catch (err) {
          console.error("Copy failed:", err);
          toast({ title: "Copy failed", description: "Could not copy text." });
        }
        break;

      case "like":
        toast({ title: "Liked", description: "Answer saved to favorites" });
        break;

      case "highlight":
        toast({ title: "Highlight", description: "PDF highlight coming soon!" });
        break;
    }
  };

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <div className="border-b bg-card px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-semibold">PDF Chat</h1>
              <p className="text-sm text-muted-foreground">
                Ask questions about your document
              </p>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </div>

      {/* Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* PDF Viewer */}
        <div className="w-1/2 border-r bg-card p-4 overflow-auto">
          {isLoadingPdf ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Loading PDF…
            </div>
          ) : pdfUrl ? (
            <iframe src={pdfUrl} className="w-full h-full border rounded" title="PDF Viewer" />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              No PDF loaded
            </div>
          )}
        </div>

        {/* Chat Section */}
        <div className="w-1/2 flex flex-col">
          <div className="flex-1 overflow-y-auto px-4 py-6">
            <div className="space-y-6">
              {isLoadingHistory && (
                <div className="text-muted-foreground">Loading chat history…</div>
              )}
              {!isLoadingHistory && historyError && (
                <div className="text-red-500 text-sm">{historyError}</div>
              )}

              {!isLoadingHistory &&
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div className="max-w-[80%]">
                      <Card className={message.role === "assistant" ? "border-2" : ""}>
                        <CardContent className="p-4">
                          <p className="mb-2 whitespace-pre-wrap text-sm">{message.content}</p>
                          <p className="text-xs text-muted-foreground">{message.timestamp}</p>
                        </CardContent>
                      </Card>

                      {message.role === "assistant" && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          <Button variant="outline" size="sm" className="gap-1 text-xs h-8" onClick={() => handleAction("slide", message.content)}>
                            <Presentation className="h-3 w-3" /> Slide
                          </Button>

                          <Button variant="outline" size="sm" className="gap-1 text-xs h-8" onClick={() => handleAction("translate")}>
                            <Globe className="h-3 w-3" /> Translate
                          </Button>

                          <Button variant="outline" size="sm" className="gap-1 text-xs h-8" onClick={() => handleAction("speak", message.content)}>
                            <Volume2 className="h-3 w-3" /> Speak
                          </Button>

                          <Button variant="outline" size="sm" className="gap-1 text-xs h-8" onClick={() => handleAction("copy", message.content)}>
                            <Copy className="h-3 w-3" /> Copy
                          </Button>

                          <Button variant="outline" size="sm" className="gap-1 text-xs h-8" onClick={() => handleAction("like")}>
                            <Heart className="h-3 w-3" /> Like
                          </Button>

                          <Button variant="outline" size="sm" className="gap-1 text-xs h-8" onClick={() => handleAction("highlight")}>
                            <Highlighter className="h-3 w-3" /> Highlight
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Chat Input */}
          <div className="border-t bg-card px-4 py-4">
            <div className="flex gap-2">
              <Input
                placeholder="Ask a question..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                className="flex-1 text-sm"
              />
              <Button onClick={handleSend} size="sm">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <SlideModal isOpen={showSlideModal} onClose={() => setShowSlideModal(false)} content={selectedAnswer} />
    </div>
  );
};

export default Chat;
