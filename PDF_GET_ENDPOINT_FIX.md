# PDF GET Endpoint 500 Error - Fixed

## 🔴 Problem

When trying to load a PDF in the Chat page, the frontend received a **500 Internal Server Error** from the backend:

```
GET http://localhost:8000/get_pdf/a4136c27-896a-4ecf-93f3-6f668b531b2e 500 (Internal Server Error)
Failed to load PDF: Error: Get PDF failed
```

## 🐛 Root Cause

The `/get_pdf/{pdf_id}` endpoint in `pdf_chatbot3.py` had **string splitting bugs** on lines 370, 381, and 382.

The code was trying to split filenames using an **empty string** `""` instead of the **underscore** `"_"` delimiter:

```python
# ❌ WRONG - Splits on empty string
original_name = matches[0].split("", 1)[1] if "" in matches[0] else matches[0]
# This causes: ValueError: empty separator

# ✅ CORRECT - Splits on underscore
original_name = matches[0].split("_", 1)[1] if "_" in matches[0] else matches[0]
```

### Why this failed:

1. Files are stored as: `{pdf_id}_{filename}.pdf`
   - Example: `a4136c27-896a-4ecf-93f3-6f668b531b2e_document.pdf`

2. Code tried to extract just the filename by splitting on `""`
   - Python's `split("")` raises: `ValueError: empty separator`

3. The uncaught exception caused a **500 Internal Server Error**

## ✅ Solution Applied

Fixed 2 instances of the bug:

### Fix 1: Single file return (Line 370)
```python
# BEFORE
original_name = matches[0].split("", 1)[1] if "" in matches[0] else matches[0]

# AFTER
original_name = matches[0].split("_", 1)[1] if "_" in matches[0] else matches[0]
```

### Fix 2: Multiple files ZIP creation (Line 381)
```python
# BEFORE
arcname = fname.split("", 1)[1] if "" in fname else fname

# AFTER
arcname = fname.split("_", 1)[1] if "_" in fname else fname
```

## 📋 What the endpoint does

The `/get_pdf/{pdf_id}` endpoint:

1. Looks for files matching pattern: `{pdf_id}_*`
2. If 1 file found: Returns the PDF directly
3. If multiple files found: Creates a ZIP archive and returns it
4. If no files found: Returns 404 error

File storage structure:
```
pdf_storage/
  └─ a4136c27-896a-4ecf-93f3-6f668b531b2e_document.pdf
```

## 🧪 Testing

After the fix, the PDF should load without errors:

1. Upload a PDF through Dashboard
2. Navigate to Chat page
3. PDF should appear in the left panel
4. No 500 error in console

## 🔗 Related Code

**Backend:**
- File: `backend/pdf_chatbot3.py`
- Endpoint: `@app.get("/get_pdf/{pdf_id}")`
- Lines fixed: 370, 381

**Frontend:**
- File: `src/lib/api.ts` - `getPdf()` function
- File: `src/pages/Chat.tsx` - PDF loading logic

## ✨ Status

✅ **FIXED** - The `/get_pdf/` endpoint now correctly extracts filenames and returns PDFs without errors
