// ==========================
// API BASE URL
// ==========================
export const API_BASE = "http://localhost:8000";

// ==========================
// Upload PDF
// ==========================
export async function uploadPdf(files: File[]) {
  const form = new FormData();
  files.forEach((f) => form.append("files", f));

  const res = await fetch(`${API_BASE}/upload_pdf/`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) throw new Error("Upload failed");
  return res.json();
}

// ==========================
// Ask Question
// ==========================
export async function askQuestion(chat_id: string, question: string) {
  const form = new FormData();
  form.append("chat_id", chat_id);
  form.append("question", question);

  const res = await fetch(`${API_BASE}/ask_question/`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) throw new Error("Ask failed");
  return res.json();
}

// ==========================
// Get PDF by pdf_id (IMPORTANT)
// ==========================
export async function getPdf(pdf_id: string): Promise<Blob> {
  console.log("📥 Fetching PDF:", `${API_BASE}/get_pdf/${pdf_id}`);

  const res = await fetch(`${API_BASE}/get_pdf/${pdf_id}`, {
    method: "GET",
  });

  if (!res.ok) {
    console.error("❌ PDF Fetch Error", res.status);
    throw new Error("Get PDF failed");
  }

  return res.blob();
}

// ==========================
// Types
// ==========================
export interface ChatSummary {
  chat_id: string;
  pdf_id: string;            // added (backend returns it)
  pdf_filename: string;
  file_size_mb: number;
  created_at: string;
  last_accessed: string;
  days_since_last_access: number;
  thumbnail_url?: string;
  num_pages?: number;
}

export interface AllChatsResponse {
  total_chats: number;
  chats: ChatSummary[];
}

// ==========================
// Get All Chats
// ==========================
export async function getAllChats(): Promise<AllChatsResponse> {
  const res = await fetch(`${API_BASE}/all_chats/`, {
    method: "GET",
  });

  if (!res.ok) throw new Error("Failed to fetch chats");

  const data = await res.json();

  // Ensure backward compatibility
  return {
    total_chats: data.total_chats,
    chats: data.chats.map((c: any) => ({
      chat_id: c.chat_id,
      pdf_id: c.pdf_id,               // important!
      pdf_filename: c.pdf_filename,
      file_size_mb: c.file_size_mb,
      created_at: c.created_at,
      last_accessed: c.last_accessed,
      days_since_last_access: c.days_since_last_access,
      thumbnail_url: c.thumbnail_url || "",
      num_pages: c.num_pages ?? 0,
    })),
  };
}

// ==========================
// Chat History Types
// ==========================
export interface ChatInteraction {
  message_id?: string;
  question: string;
  answer: string;
  asked_at: string;
}

export interface ChatHistoryResponse {
  chat_id: string;
  pdf_id: string;
  pdf_filename: string;
  file_size_mb: number;
  created_at: string;
  last_accessed: string;
  days_since_last_access: number;
  total_interactions: number;
  interactions: ChatInteraction[];
}

// ==========================
// Get Chat History
// ==========================
export async function getChatHistory(chatId: string): Promise<ChatHistoryResponse> {
  const res = await fetch(`${API_BASE}/chat_history/${chatId}`, {
    method: "GET",
  });

  if (!res.ok) throw new Error("Failed to fetch chat history");
  return res.json();
}
