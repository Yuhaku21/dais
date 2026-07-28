const fileInput = document.getElementById('fileInput');
const dropZone = document.getElementById('dropZone');
const docMeta = document.getElementById('docMeta');
const docPreview = document.getElementById('docPreview');
const metaFilename = document.getElementById('metaFilename');
const metaPages = document.getElementById('metaPages');
const docPreviewFrame = document.getElementById('docPreviewFrame');
const docStatus = document.getElementById('docStatus');

const chatLog = document.getElementById('chatLog');
const chatForm = document.getElementById('chatForm');
const chatText = document.getElementById('chatText');
const sendBtn = document.getElementById('sendBtn');

let history = []; // {role, content}

// ---------- Upload handling ----------

fileInput.addEventListener('change', (e) => {
  if (e.target.files[0]) uploadFile(e.target.files[0]);
});

['dragenter', 'dragover'].forEach((evt) => {
  dropZone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });
});

['dragleave', 'drop'].forEach((evt) => {
  dropZone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
  });
});

dropZone.addEventListener('drop', (e) => {
  const file = e.dataTransfer.files[0];
  if (file) uploadFile(file);
});

async function uploadFile(file) {
  if (file.type !== 'application/pdf') {
    alert('Hanya file PDF yang didukung.');
    return;
  }

  dropZone.querySelector('.dropzone__inner p').innerHTML = `<strong>Mengunggah &amp; memproses "${file.name}"...</strong>`;

  const formData = new FormData();
  formData.append('file', file);

  try {
    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Gagal mengupload dokumen.');
    }

    metaFilename.textContent = data.filename;
    metaPages.textContent = `${data.pageCount} halaman`;
    docPreviewFrame.src = data.fileUrl;

    docMeta.classList.remove('hidden');
    docPreview.classList.remove('hidden');
    dropZone.classList.add('hidden');

    docStatus.innerHTML = `<span class="dot dot--on"></span><span>${data.filename} — siap ditanya</span>`;

    chatText.disabled = false;
    sendBtn.disabled = false;
    chatText.focus();

    history = [];
    addMessage('ai', `Dokumen "${data.filename}" (${data.pageCount} halaman) berhasil dimuat. Silakan tanyakan apa saja tentang SOP ini.`);
  } catch (err) {
    dropZone.querySelector('.dropzone__inner p').innerHTML = `<strong>Seret file PDF ke sini</strong><br>atau klik tombol Upload PDF`;
    addMessage('ai', `Gagal memproses PDF: ${err.message}`, true);
  }
}

// ---------- Chat handling ----------

chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const message = chatText.value.trim();
  if (!message) return;

  addMessage('user', message);
  chatText.value = '';
  chatText.disabled = true;
  sendBtn.disabled = true;

  const typingEl = addMessage('ai', 'Membaca SOP dan menyusun jawaban…', false, true);

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, history }),
    });
    const data = await res.json();

    typingEl.remove();

    if (!res.ok) {
      throw new Error(data.error || 'Terjadi kesalahan.');
    }

    addMessage('ai', data.answer);
    history.push({ role: 'user', content: message });
    history.push({ role: 'assistant', content: data.answer });
  } catch (err) {
    typingEl.remove();
    addMessage('ai', `Terjadi kesalahan: ${err.message}`, true);
  } finally {
    chatText.disabled = false;
    sendBtn.disabled = false;
    chatText.focus();
  }
});

function addMessage(role, text, isError = false, isTyping = false) {
  const wrap = document.createElement('div');
  wrap.className = `msg msg--${role === 'user' ? 'user' : 'ai'}`;

  const bubble = document.createElement('div');
  bubble.className = 'msg__bubble' + (isError ? ' error' : '') + (isTyping ? ' typing' : '');
  bubble.textContent = text;

  wrap.appendChild(bubble);
  chatLog.appendChild(wrap);
  chatLog.scrollTop = chatLog.scrollHeight;
  return wrap;
}

// ---------- Restore document on page reload ----------

(async function restoreDocument() {
  try {
    const res = await fetch('/api/document');
    if (!res.ok) return;
    const data = await res.json();

    metaFilename.textContent = data.filename;
    metaPages.textContent = `${data.pageCount} halaman`;
    docPreviewFrame.src = data.fileUrl;

    docMeta.classList.remove('hidden');
    docPreview.classList.remove('hidden');
    dropZone.classList.add('hidden');

    docStatus.innerHTML = `<span class="dot dot--on"></span><span>${data.filename} — siap ditanya</span>`;

    chatText.disabled = false;
    sendBtn.disabled = false;
  } catch (_) {
    // Belum ada dokumen — biarkan state awal.
  }
})();
