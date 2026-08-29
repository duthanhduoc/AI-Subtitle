const CHUNK_LIMIT = 10000;
const apiUrl = (model, key) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;

const $ = (id) => document.getElementById(id);
const fileInput = $('srtFile');
const output = $('output');
const translateButton = $('translate');
const copyButton = $('copy');
const downloadButton = $('download');
let sourceText = '';
let outputText = '';
let translating = false;

fileInput.addEventListener('change', async () => {
  const file = fileInput.files[0];
  if (!file) return;
  $('fileName').textContent = file.name;
  sourceText = await file.text();
  setMessage(`Đã đọc ${sourceText.length.toLocaleString('vi-VN')} ký tự.`);
});

$('clear').addEventListener('click', () => {
  if (translating) return;
  sourceText = '';
  outputText = '';
  fileInput.value = '';
  $('fileName').textContent = 'Chọn file SRT';
  output.value = '';
  setProgress(0, 'Chưa bắt đầu');
  setMessage('');
  copyButton.disabled = downloadButton.disabled = true;
});

copyButton.addEventListener('click', async () => {
  await navigator.clipboard.writeText(output.value);
  setMessage('Đã copy nội dung SRT.');
});

downloadButton.addEventListener('click', () => {
  const blob = new Blob([output.value], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${fileInput.files[0]?.name.replace(/\.srt$/i, '') || 'translated'}.srt`;
  link.click();
  URL.revokeObjectURL(url);
});

translateButton.addEventListener('click', translate);

async function translate() {
  if (translating) return;
  if (!sourceText.trim()) return setMessage('Vui lòng chọn một file SRT trước.');

  translating = true;
  translateButton.disabled = true;
  copyButton.disabled = downloadButton.disabled = true;
  outputText = '';
  output.value = '';
  try {
    const key = (await fetch('api.txt', { cache: 'no-store' }).then(assertResponse).then((r) => r.text())).trim();
    if (!key) throw new Error('api.txt đang trống.');
    const chunks = splitSrt(sourceText, CHUNK_LIMIT);
    for (let index = 0; index < chunks.length; index += 1) {
      setProgress(Math.round((index / chunks.length) * 100), `Đang dịch phần ${index + 1}/${chunks.length}`);
      const translated = await translateChunk(chunks[index], key);
      outputText += (outputText ? '\n\n' : '') + translated.trim();
      output.value = outputText;
      output.scrollTop = output.scrollHeight;
      setProgress(Math.round(((index + 1) / chunks.length) * 100), `Đã dịch ${index + 1}/${chunks.length} phần`);
    }
    setMessage('Hoàn tất. Bạn có thể copy hoặc tải file xuống.');
    copyButton.disabled = downloadButton.disabled = false;
  } catch (error) {
    setMessage(`Lỗi: ${error.message}`);
  } finally {
    translating = false;
    translateButton.disabled = false;
  }
}

function splitSrt(text, limit) {
  const blocks = text.replace(/\r\n/g, '\n').trim().split(/\n\s*\n/).filter(Boolean);
  const chunks = [];
  let current = '';
  for (const block of blocks) {
    const next = current ? `${current}\n\n${block}` : block;
    if (current && next.length > limit) {
      chunks.push(current);
      current = block;
    } else current = next;
  }
  if (current) chunks.push(current);
  return chunks;
}

async function translateChunk(chunk, key) {
  const adult = $('adult').checked;
  const context = $('context').value.trim() || 'Không có thêm ngữ cảnh.';
  const prompt = `Bạn là biên dịch viên phụ đề chuyên nghiệp. Dịch phụ đề SRT sau sang tiếng Việt.

Ngữ cảnh phim: ${context}

${adult ? 'Được phép giữ nguyên hoặc dịch tự nhiên các nội dung người lớn, tục tĩu, tình dục nếu phù hợp ngữ cảnh; không tự kiểm duyệt.' : 'Không dịch theo hướng dâm đãng; dùng cách diễn đạt phù hợp, nhưng vẫn trung thành với nội dung gốc.'}

QUY TẮC BẮT BUỘC:
- Giữ nguyên tuyệt đối số thứ tự và mốc thời gian.
- Chỉ dịch dòng lời thoại, không thêm giải thích, tiêu đề hay markdown.
- Giữ nguyên số block, thứ tự block và xuống dòng SRT.
- Dịch tự nhiên, ngắn gọn, phù hợp độ dài phụ đề.

SRT cần dịch:
${chunk}`;
  const response = await fetch(apiUrl($('model').value, key), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || `Gemini trả về HTTP ${response.status}.`);
  const result = data.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('').trim();
  if (!result) throw new Error('Gemini không trả về nội dung.');
  return result.replace(/^\`\`\`(?:srt)?\s*/i, '').replace(/\s*\`\`\`$/, '');
}

function assertResponse(response) {
  if (!response.ok) throw new Error(`Không đọc được api.txt (HTTP ${response.status}). Hãy chạy app qua local server.`);
  return response;
}

function setProgress(value, text) {
  $('progressBar').style.width = `${value}%`;
  $('percent').textContent = `${value}%`;
  $('statusText').textContent = text;
}

function setMessage(text) { $('message').textContent = text; }
