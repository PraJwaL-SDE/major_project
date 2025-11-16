# PDF Loading Issue - Root Causes & Solutions

## 🔴 Problems Identified

### 1. **Wrong Parameter in Chat Page** (PRIMARY ISSUE)
**Location:** `src/pages/Chat.tsx`

**Problem:**
- The Chat component was extracting `pdfId` from URL params, but the backend API expects `chat_id`
- It called `getChatHistory(pdfId)` instead of `getChatHistory(chatId)`
- This caused chat history to fail loading because `pdfId` ≠ `chat_id`

**Example:**
```
URL: /chat/chat_abc123xyz?pdf=pdf_abc123
pdfId = undefined (not in URL params)
Should use: chatId = "chat_abc123xyz"
```

### 2. **Incorrect Navigation from Dashboard**
**Location:** `src/pages/Dashboard.tsx`

**Problem:**
- When uploading a new PDF: `navigate(/chat/${chatId}?pdf=${pdfId})` ✓ (Correct)
- When clicking existing PDF: Used `pdf.pdfId` which wasn't in the interface type
- The `PDF` interface didn't include the `pdfId` field

### 3. **Missing Error Handling**
**Location:** `src/pages/Chat.tsx`

**Problem:**
- PDF loading errors were silently ignored (no user notification)
- Question sending didn't validate if `chatId` exists
- Generic error messages didn't help debugging

## ✅ Solutions Implemented

### Fix 1: Corrected Parameter Extraction
```tsx
// BEFORE (Wrong)
const pdfId = useParams<{ pdfId: string }>().pdfId ?? "hardcoded-id";

// AFTER (Correct)
const params = useParams<{ chatId: string }>();
const searchParams = new URLSearchParams(window.location.search);
const chatId = params.chatId || searchParams.get("chat_id") || "";
const pdfId = searchParams.get("pdf") || "";
```

### Fix 2: Updated Chat History Loading
```tsx
// BEFORE (Wrong)
const data = await getChatHistory(pdfId);  // pdfId is undefined!

// AFTER (Correct)
const data = await getChatHistory(chatId);  // Uses actual chat_id
```

### Fix 3: Added PDF Interface Field
```tsx
interface PDF {
  id: string;
  title: string;
  lastUsed: string;
  pages: number;
  thumbnail: string;
  pdfId: string;  // ← ADDED
}
```

### Fix 4: Improved Error Messages
```tsx
// BEFORE
console.error("Failed to load PDF:", err);  // Silent failure

// AFTER
toast({
  title: "Error",
  description: "Failed to load PDF: " + (err?.message || "Unknown error"),
  variant: "destructive",
});
```

### Fix 5: Added ChatId Validation
```tsx
// BEFORE
const chatId = pdfId || `chat_${Date.now()}`;  // pdfId is wrong source

// AFTER
if (!chatId) {
  throw new Error("No chat session available");
}
```

## 📋 Updated URL Structure

### Upload Flow
```
Dashboard → Select PDF → Upload → /chat/{chatId}?pdf={pdfId}
```

### Access Flow
```
Dashboard → Click PDF Card → /chat/{chatId}?pdf={pdfId}
```

### Chat API Flow
```
Chat Page reads: chatId (from route) + pdfId (from query)
                    ↓
        Backend: /chat_history/{chatId}
        Backend: /ask_question/?chat_id={chatId}
        Backend: /get_pdf/{pdfId}
```

## 🧪 Testing Checklist

- [ ] Upload new PDF - should navigate to chat with both chatId and pdfId
- [ ] PDF should load in left panel
- [ ] Chat history should load on right panel
- [ ] Ask a question - should send and receive response
- [ ] Navigate back to Dashboard - should show new PDF in recent list
- [ ] Click existing PDF from Dashboard - should load chat with full history

## 🚀 How To Test

1. **Start the backend:**
   ```bash
   cd backend
   python pdf_chatbot3.py
   # Should show: INFO:     Uvicorn running on http://0.0.0.0:8000
   ```

2. **Start the frontend:**
   ```bash
   npm run dev
   # Visit http://localhost:5173
   ```

3. **Test flow:**
   - Go to Dashboard
   - Click "Choose PDF File"
   - Select a PDF
   - Select a category
   - Wait for upload completion
   - You should now be on `/chat/{chatId}?pdf={pdfId}` page
   - PDF should load on the left
   - Chat history should appear (or welcome message if new)
   - Ask a question and verify response

## 📝 Key Changes Made

| File | Change | Reason |
|------|--------|--------|
| `Chat.tsx` | Use `chatId` instead of `pdfId` for API calls | `pdfId` wasn't defined in params |
| `Chat.tsx` | Extract from both route params and query string | Support both navigation methods |
| `Chat.tsx` | Added error toasts for PDF loading | Better user feedback |
| `Chat.tsx` | Validate `chatId` before sending questions | Prevent API errors |
| `Dashboard.tsx` | Added `pdfId` to PDF interface | Enable proper type checking |

## 🔗 Related Backend Endpoints

All these should work now that chatId/pdfId are correctly passed:

```
POST /upload_pdf/          → Returns chat_id, pdf_id
POST /ask_question/        → Takes chat_id
GET  /chat_history/{chatId}
GET  /get_pdf/{pdfId}
```

---

**Status:** ✅ Fixed - PDF loading should now work correctly
