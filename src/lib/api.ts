export const API_BASE = "http://localhost:8000";

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

export async function getPdf(pdf_id: string): Promise<Blob> {
  const res = await fetch(`${API_BASE}/get_pdf/${pdf_id}`, {
    method: "GET",
  });
  if (!res.ok) throw new Error("Get PDF failed");
  return res.blob();
}

export interface ChatSummary {
  chat_id: string;
  pdf_filename: string;
  num_pages: number;
  created_at: string;
  last_accessed: string;
  days_since_last_access: number;
  thumbnail_url?: string;
  pdf_id?: string;
}

export interface AllChatsResponse {
  total_chats: number;
  chats: ChatSummary[];
}

export async function getAllChats(): Promise<AllChatsResponse> {
  const res = await fetch(`${API_BASE}/all_chats/`, {
    method: "GET",
  });
  if (!res.ok) throw new Error("Failed to fetch chats");
  return res.json();
}

export interface ChatInteraction {
  question: string;
  answer: string;
  asked_at: string;
}

export interface ChatHistoryResponse {
  chat_id: string;
  pdf_filename: string;
  num_pages: number;
  first_page_preview?: string;
  created_at: string;
  last_accessed: string;
  days_since_last_access: number;
  total_interactions: number;
  interactions: ChatInteraction[];
}

export async function getChatHistory(chatId: string): Promise<ChatHistoryResponse> {
  const res = await fetch(`${API_BASE}/chat_history/${chatId}`, {
    method: "GET",
  });
  if (!res.ok) throw new Error("Failed to fetch chat history");
  return res.json();
}