require('dotenv').config();

const express = require('express');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';

if (!GROQ_API_KEY) {
  console.warn('[WARNING] GROQ_API_KEY tidak ditemukan di .env — fitur chat tidak akan berfungsi.');
}

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Simpan dokumen aktif di memory (single-user, cocok untuk pemakaian personal/lokal).
// Untuk multi-user production, ganti dengan penyimpanan per-session/per-user.
let activeDocument = {
  filename: null,
  text: null,
  pageCount: 0,
};

const MAX_CONTEXT_CHARS = 60000; // batas aman agar tidak melebihi context window model

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      return cb(new Error('Hanya file PDF yang diperbolehkan.'));
    }
    cb(null, true);
  },
});

// Upload & extract PDF
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Tidak ada file yang diupload.' });
    }

    const data = await pdfParse(req.file.buffer);
    const text = (data.text || '').trim();

    if (!text) {
      return res.status(422).json({
        error: 'Tidak bisa mengekstrak teks dari PDF ini. Mungkin hasil scan/gambar tanpa OCR.',
      });
    }

    activeDocument = {
      filename: req.file.originalname,
      text,
      pageCount: data.numpages || 0,
    };

    res.json({
      filename: activeDocument.filename,
      pageCount: activeDocument.pageCount,
      charCount: text.length,
      preview: text.slice(0, 4000),
      truncatedForAI: text.length > MAX_CONTEXT_CHARS,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Gagal memproses PDF.' });
  }
});

// Ambil dokumen aktif (untuk reload halaman)
app.get('/api/document', (req, res) => {
  if (!activeDocument.text) {
    return res.status(404).json({ error: 'Belum ada dokumen yang diupload.' });
  }
  res.json({
    filename: activeDocument.filename,
    pageCount: activeDocument.pageCount,
    charCount: activeDocument.text.length,
    preview: activeDocument.text.slice(0, 4000),
  });
});

// Chat tentang SOP yang sudah diupload
app.post('/api/chat', async (req, res) => {
  try {
    if (!GROQ_API_KEY) {
      return res.status(500).json({ error: 'GROQ_API_KEY belum diset di file .env server.' });
    }
    if (!activeDocument.text) {
      return res.status(400).json({ error: 'Belum ada SOP yang diupload. Upload PDF terlebih dahulu.' });
    }

    const { message, history } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Pertanyaan (message) wajib diisi.' });
    }

    const contextText = activeDocument.text.slice(0, MAX_CONTEXT_CHARS);

    const systemPrompt = `Kamu adalah asisten AI bernama "SOP AI" yang bertugas menjawab pertanyaan HANYA berdasarkan dokumen SOP (Standard Operating Procedure) berikut ini. Jawab dalam Bahasa Indonesia, jelas dan ringkas. Jika jawabannya ada di dokumen, kutip/rujuk bagian atau langkah yang relevan. Jika informasi yang ditanyakan TIDAK ada di dalam dokumen, katakan dengan jujur bahwa informasi tersebut tidak ditemukan di dalam SOP, jangan mengarang.

Nama file dokumen: ${activeDocument.filename}

=== ISI DOKUMEN SOP ===
${contextText}
=== AKHIR DOKUMEN ===`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...(Array.isArray(history) ? history.slice(-10) : []),
      { role: 'user', content: message },
    ];

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages,
        temperature: 0.3,
        max_tokens: 1024,
      }),
    });

    if (!groqRes.ok) {
      const errBody = await groqRes.text();
      console.error('Groq API error:', errBody);
      return res.status(502).json({ error: 'Gagal menghubungi Groq API.', detail: errBody });
    }

    const data = await groqRes.json();
    const answer = data.choices?.[0]?.message?.content || 'Maaf, tidak ada jawaban yang dihasilkan.';

    res.json({ answer });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Terjadi kesalahan pada server.' });
  }
});

app.listen(PORT, () => {
  console.log(`SOP AI server berjalan di http://localhost:${PORT}`);
});
