# SOP AI

Website untuk upload dokumen SOP (PDF), menampilkan isinya, lalu bertanya jawab dengan AI (via Groq API) berdasarkan isi dokumen tersebut.

## Struktur proyek

```
sop-ai/
├── server.js        # server Node.js — baca .env, proxy ke Groq, extract PDF
├── package.json
├── .env              # berisi GROQ_API_KEY (JANGAN dibagikan/di-commit ke Git)
└── public/
    ├── index.html
    ├── style.css
    └── app.js         # HTML/CSS/JS murni untuk tampilan & interaksi
```

## Kenapa ada server.js kalau maunya cuma HTML/CSS/JS?

File `.env` **tidak bisa dibaca oleh browser**. Kalau API key ditaruh langsung di file `.js` yang dikirim ke browser, siapapun bisa melihatnya lewat "View Page Source" — API key Anda akan bocor dan bisa disalahgunakan orang lain (kena tagihan, dsb).

Solusinya: **frontend tetap HTML/CSS/JS murni** (tidak ada framework, tidak ada build step), tapi ditambah **server Node.js minimal** yang:
1. Membaca `GROQ_API_KEY` dari `.env`
2. Meneruskan (proxy) pertanyaan user ke Groq API — key tidak pernah dikirim ke browser
3. Mengekstrak teks dari PDF yang diupload (library `pdf-parse`)

Ini adalah cara paling minimal dan aman untuk mencapai apa yang Anda minta.

## Cara menjalankan

1. Pastikan Node.js sudah terinstall (v18 ke atas): https://nodejs.org
2. Buka terminal di folder `sop-ai`, lalu install dependency:
   ```
   npm install
   ```
3. Edit file `.env` bila perlu (API key Groq Anda sudah dimasukkan):
   ```
   GROQ_API_KEY=isi_dengan_api_key_anda
   GROQ_MODEL=openai/gpt-oss-120b
   PORT=3000
   ```
4. Jalankan server:
   ```
   npm start
   ```
5. Buka browser ke `http://localhost:3000`

## Cara pakai

1. Upload file PDF SOP lewat tombol "Upload PDF" atau drag-and-drop.
2. PDF asli akan ditampilkan apa adanya (dirender langsung oleh browser) di panel kiri, sekaligus teksnya diekstrak di belakang layar untuk konteks AI.
3. Ketik pertanyaan tentang SOP tersebut di panel kanan — AI akan menjawab berdasarkan isi PDF yang diupload.

Catatan: PDF yang diupload disimpan sementara di `public/uploads/current.pdf` (di-overwrite setiap kali upload baru). Folder ini tidak ikut ter-commit ke Git (lihat `.gitignore`).

## Catatan penting

- **Rotate API key Anda.** Key yang Anda tempel di chat sebelumnya sebaiknya di-regenerate di [console.groq.com](https://console.groq.com/keys), karena key yang pernah dikirim di percakapan sebaiknya dianggap berpotensi bocor.
- **Model saat ini**: `llama-3.3-70b-versatile`. Groq sudah mengumumkan rencana deprecation untuk model ini, jadi sewaktu-waktu bisa berhenti didukung. Kalau chat mulai error, cek daftar model aktif di [console.groq.com/docs/models](https://console.groq.com/docs/models) dan ganti nilai `GROQ_MODEL` di `.env` (misalnya ke `openai/gpt-oss-120b`).
- **Single-user/lokal**: dokumen yang diupload disimpan di memory server (satu dokumen aktif). Untuk multi-user/production, perlu ditambahkan penyimpanan per-session atau database.
- **PDF hasil scan/gambar** tanpa OCR tidak bisa diekstrak teksnya — pastikan PDF berisi teks asli, bukan gambar.
- **Jangan upload `.env` ke GitHub/tempat publik** — tambahkan `.env` ke `.gitignore` jika Anda pakai Git.
