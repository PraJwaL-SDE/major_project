import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useParams, useNavigate } from "react-router-dom";
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
  const pdfId = useParams<{ pdfId: string }>().pdfId ?? "e6401bc3-497a-40e8-96be-d28722913b99";

  const navigate = useNavigate();
  const { toast } = useToast();
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
      // if it looks like HTML, extract text
      if (/<[a-z][\s\S]*>/i.test(content)) {
        const div = document.createElement("div");
        div.innerHTML = content;
        return div.textContent || div.innerText || "";
      }
      return content;
    }
    // for objects, stringify nicely
    try {
      return typeof content === "object" ? JSON.stringify(content, null, 2) : String(content);
    } catch {
      return String(content);
    }
  }

  async function copyToClipboard(rawContent?: string | any) {
    const text = toPlainText(rawContent);
    // early return if nothing to copy
    if (!text && text !== "") throw new Error("No text to copy");

    // Prefer Clipboard API
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return;
      } catch (err) {
        console.warn("Clipboard API failed:", err);
        // fallthrough to textarea fallback
      }
    }

    // Fallback - textarea method
    const textarea = document.createElement("textarea");
    textarea.value = text;
    // Avoid scrolling to bottom
    textarea.style.position = "fixed";
    textarea.style.top = "-9999px";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    try {
      const ok = document.execCommand("copy");
      if (!ok) throw new Error("execCommand returned false");
    } finally {
      document.body.removeChild(textarea);
    }
  }


  useEffect(() => {
    let isMounted = true;
    const loadHistory = async () => {
      if (!pdfId) return;
      try {
        setIsLoadingHistory(true);
        setHistoryError("");
        const data = await getChatHistory(pdfId);
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
        setMessages(historyMessages);
      } catch (err: any) {
        if (!isMounted) return;
        console.error(err);
        setHistoryError(err?.message || "Failed to load chat history");
        setMessages([
          {
            id: "welcome",
            role: "assistant",
            content: "Hello! I'm ready to help you understand this PDF. Ask me any questions about the content, and I'll provide detailed explanations.",
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
  }, [pdfId]);

  useEffect(() => {
    let isMounted = true;
    const loadPdf = async () => {
      
      if (!pdfId) return;
      try {
        setIsLoadingPdf(true);
        const blob = await getPdf(pdfId);
        if (!isMounted) return;
        const url = URL.createObjectURL(blob);
        setPdfUrl(url);
      } catch (err: any) {
        if (!isMounted) return;
        console.error("Failed to load PDF:", err);
      } finally {
        if (isMounted) setIsLoadingPdf(false);
      }
    };
    loadPdf();
    return () => {
      isMounted = false;
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfId]);

  const handleSend = () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: "Just now"
    };

    setMessages((m) => [...m, userMessage]);
    setInput("");

    (async () => {
      try {
        const { askQuestion } = await import("@/lib/api");
        const chatId = pdfId || `chat_${Date.now()}`;
        const res: any = await askQuestion(chatId, userMessage.content);
        const aiResp: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: res.answer || "(no answer)",
          timestamp: "Just now",
        };
        setMessages((m) => [...m, aiResp]);
      } catch (err) {
        console.error(err);
        const errResp: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "Failed to get answer from server.",
          timestamp: "Just now",
        };
        setMessages((m) => [...m, errResp]);
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
          description: "Translation feature coming soon!",
        });
        break;
      case "speak":
        if (!content) {
          toast({
            title: "Error",
            description: "No text available to speak.",
          });
          return;
        }

        // Cancel any previous speech
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(content);
        utterance.lang = "en-US";      // You can change language
        utterance.rate = 1;            // Speed (0.5–2)
        utterance.pitch = 1;           // Voice pitch
        utterance.volume = 1;          // 0–1

        window.speechSynthesis.speak(utterance);

        toast({
          title: "Speaking...",
          description: "Text-to-speech started",
        });
        break;
      case "copy":
        try {
          await copyToClipboard(content);
          toast({
            title: "Copied",
            description: "Answer copied to clipboard"

          });
        } catch (err) {
          console.error("Copy failed:", err);
          toast({
            title: "Copy failed",
            description: "Could not copy text. Try selecting and copying manually."
          });
        }
        break;

      case "like":
        toast({
          title: "Liked",
          description: "Answer saved to favorites",
        });
        break;
      case "highlight":
        toast({
          title: "Highlight",
          description: "PDF highlight feature coming soon!",
        });
        break;
    }
  };

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <div className="border-b bg-card px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/dashboard")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-semibold">PDF Chat</h1>
              <p className="text-sm text-muted-foreground">Ask questions about your document</p>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </div>

      {/* Main Content: 2-column layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: PDF Viewer */}
        <div className="w-1/2 border-r bg-card p-4 overflow-auto">
          {isLoadingPdf ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">Loading PDF…</div>
          ) : pdfUrl ? (
            <iframe
              src={pdfUrl}
              className="w-full h-full border rounded"
              title="PDF Viewer"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">No PDF loaded</div>
          )}
        </div>

        {/* Right: Chat Interface */}
        <div className="w-1/2 flex flex-col">
          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-6">
            <div className="space-y-6">
              {isLoadingHistory && (
                <div className="text-muted-foreground">Loading chat history…</div>
              )}
              {!isLoadingHistory && historyError && (
                <div className="text-red-500 text-sm">{historyError}</div>
              )}
              {!isLoadingHistory && messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div className={`max-w-[80%]`}>
                    <Card className={message.role === "assistant" ? "border-2" : ""}>
                      <CardContent className="p-4">
                        <p className="mb-2 whitespace-pre-wrap text-sm">{message.content}</p>
                        <p className="text-xs text-muted-foreground">{message.timestamp}</p>
                      </CardContent>
                    </Card>

                    {message.role === "assistant" && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1 text-xs h-8"
                          onClick={() => handleAction("slide", message.content)}
                        >
                          <Presentation className="h-3 w-3" />
                          Slide
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1 text-xs h-8"
                          onClick={() => handleAction("translate")}
                        >
                          <Globe className="h-3 w-3" />
                          Translate
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1 text-xs h-8"
                          onClick={() => handleAction("speak", message.content)}
                        >
                          <Volume2 className="h-3 w-3" />
                          Speak
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1 text-xs h-8"
                          onClick={() => handleAction("copy", message.content)}
                        >
                          <Copy className="h-3 w-3" />
                          Copy
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1 text-xs h-8"
                          onClick={() => handleAction("like")}
                        >
                          <Heart className="h-3 w-3" />
                          Like
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1 text-xs h-8"
                          onClick={() => handleAction("highlight")}
                        >
                          <Highlighter className="h-3 w-3" />
                          Highlight
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
                onKeyPress={(e) => e.key === "Enter" && handleSend()}
                className="flex-1 text-sm"
              />
              <Button onClick={handleSend} size="sm">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <SlideModal
        isOpen={showSlideModal}
        onClose={() => setShowSlideModal(false)}
        content={selectedAnswer}
      />
    </div>
  );
};

export default Chat;
