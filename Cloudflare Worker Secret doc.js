var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

var Config = {
  SharePath: "s",
  // 分享路径
  DeletePath: "delete",
  // 删除路径
  Shareid_control: 2,
  // 1: UUID, 2: 哈希ID
  Max_times: -1,
  // 最大浏览次数，-1表示无限制
  Max_countdown: 10080,
  // 最长倒计时（分钟），-1表示不限制，1440是一天，10080是一周，43200是一个月，525600是一年
  HmacKey: "\u98CE\u4E4B\u6687\u60F3",
  // HMAC密钥，用于请求签名验证
  HomePageCacheDuration: 36e5,
  // 首页内存缓存时间（毫秒），1小时 = 3600000
  BrowserCacheDuration: 86400
  // 浏览器缓存时间（秒），1天 = 86400
};

var createResponse = /* @__PURE__ */ __name((body, status = 200, contentType = "text/html; charset=UTF-8", extraHeaders = {}) => new Response(body, {
  status,
  headers: { "Content-Type": contentType, ...extraHeaders }
}), "createResponse");
var createJSONResponse = /* @__PURE__ */ __name((data, status = 200) => createResponse(JSON.stringify(data), status, "application/json; charset=UTF-8"), "createJSONResponse");
var createHTMLResponse = /* @__PURE__ */ __name((html, status = 200, cacheSeconds = 0) => {
  const headers = { "Content-Type": "text/html; charset=UTF-8" };
  if (cacheSeconds > 0) {
    headers["Cache-Control"] = `public, max-age=${cacheSeconds}`;
  }
  return createResponse(html, status, "text/html; charset=UTF-8", headers);
}, "createHTMLResponse");
var createRedirectResponse = /* @__PURE__ */ __name((location = "/") => createResponse("404", 302, "text/plain; charset=UTF-8", { Location: location }), "createRedirectResponse");
var createForbiddenResponse = /* @__PURE__ */ __name(() => createResponse("", 403, "text/plain; charset=UTF-8"), "createForbiddenResponse");
var ERROR_MESSAGES = {
  NOT_FOUND: '\u4E0D\u5B58\u5728\u6216\u5DF2\u8FC7\u671F\u6216\u5DF2\u88AB\u9500\u6BC1\uFF0C<a href="/"><strong>\u8FD4\u56DE\u9996\u9875</strong></a>\u3002',
  INVALID_DATA: '\u6587\u6863\u6570\u636E\u65E0\u6548\uFF0C<a href="/"><strong>\u8FD4\u56DE\u9996\u9875</strong></a>\u3002'
};

var crc32Table = (() => {
  const table = [];
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = c & 1 ? 3988292384 ^ c >>> 1 : c >>> 1;
    }
    table[i] = c;
  }
  return table;
})();
function crc32(str) {
  let crc = 0 ^ -1;
  for (let i = 0, len = str.length; i < len; i++) {
    crc = crc >>> 8 ^ crc32Table[(crc ^ str.charCodeAt(i)) & 255];
  }
  return (crc ^ -1) >>> 0;
}
__name(crc32, "crc32");
function generateDocIdWithCrc(docId) {
  return `${docId}${crc32(docId).toString(16).padStart(8, "0")}`;
}
__name(generateDocIdWithCrc, "generateDocIdWithCrc");
function validateAndExtractDocId(docIdWithCrc) {
  if (docIdWithCrc.length < 8) return null;
  const crc = docIdWithCrc.slice(-8);
  const docId = docIdWithCrc.slice(0, -8);
  return crc === crc32(docId).toString(16).padStart(8, "0") ? docId : null;
}
__name(validateAndExtractDocId, "validateAndExtractDocId");
async function generateHmacSignature(message, key) {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(message));
  return Array.from(new Uint8Array(signature)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(generateHmacSignature, "generateHmacSignature");
async function verifyHmacSignature(message, signature, key) {
  try {
    return signature === await generateHmacSignature(message, key);
  } catch {
    return false;
  }
}
__name(verifyHmacSignature, "verifyHmacSignature");

async function verifyRequestSignature(request) {
  const token = request.headers.get("X-Signature");
  if (!token) return false;
  const body = await request.text();
  let requestId;
  try {
    requestId = JSON.parse(body).requestId;
  } catch {
    return false;
  }
  return requestId ? await verifyHmacSignature(body, token, Config.HmacKey) : false;
}
__name(verifyRequestSignature, "verifyRequestSignature");

function validateInput(markdown, views, expiration) {
  if (!markdown || markdown === "") return "\u8BF7\u8F93\u5165\u6587\u6863\u5185\u5BB9";
  if (!views || views === "" || views < 0) return "\u8BF7\u8F93\u5165\u23F3\u6B63\u786E\u7684\u67E5\u770B\u6B21\u6570";
  if (parseInt(views) === 0) return "\u23F3\u67E5\u770B\u6B21\u6570\u4E0D\u80FD\u4E3A0\uFF081=\u9605\u540E\u5373\u711A, \u226510000=\u65E0\u9650\u6B21\uFF09";
  if (!expiration || expiration === "" || expiration < 0) return "\u8BF7\u8F93\u5165\u23F2\uFE0F\u6B63\u786E\u7684\u6709\u6548\u671F";
  return null;
}
__name(validateInput, "validateInput");
function processViews(views, maxTimes) {
  const viewsInt = parseInt(views);
  if (viewsInt === 0 || viewsInt === 1) return viewsInt;
  return maxTimes === -1 ? viewsInt >= 1e4 ? -1 : viewsInt : Math.min(viewsInt, maxTimes);
}
__name(processViews, "processViews");
function processExpiration(expiration, maxCountdown) {
  const expirationMs = parseInt(expiration);
  const now = Date.now();
  if (maxCountdown === -1) {
    return now + expirationMs * 60 * 1e3;
  }
  const effectiveExpiration = expirationMs < 1 || expirationMs > maxCountdown ? maxCountdown : expirationMs;
  return now + effectiveExpiration * 60 * 1e3;
}
__name(processExpiration, "processExpiration");
function formatRemainingTime(ms) {
  if (ms === void 0 || isNaN(ms) || ms === "") return "\u4E0D\u5B58\u5728";
  const totalSeconds = Math.floor(ms / 1e3);
  return `${Math.floor(totalSeconds / 60)}\u5206 ${totalSeconds % 60}\u79D2`;
}
__name(formatRemainingTime, "formatRemainingTime");

function generateUUIDv7() {
  const timestamp = Date.now();
  const timestampBytes = new Uint8Array(8);
  let ts = timestamp;
  for (let i = 7; i >= 0; i--) {
    timestampBytes[i] = ts & 255;
    ts >>= 8;
  }
  const randomBytes = new Uint8Array(10);
  crypto.getRandomValues(randomBytes);
  const uuid = new Uint8Array(16);
  uuid.set(timestampBytes.slice(2), 0);
  uuid[6] = 112 | randomBytes[0] & 15;
  uuid[7] = randomBytes[1];
  uuid[8] = 128 | randomBytes[2] & 63;
  uuid.set(randomBytes.slice(3), 9);
  const hex = Array.from(uuid, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
__name(generateUUIDv7, "generateUUIDv7");
async function generateHashId() {
  const timestamp = Date.now().toString();
  const randomBytes = new Uint8Array(64);
  crypto.getRandomValues(randomBytes);
  const encoder = new TextEncoder();
  const timestampBytes = encoder.encode(timestamp);
  const combinedBytes = new Uint8Array(timestampBytes.length + randomBytes.length);
  combinedBytes.set(timestampBytes, 0);
  combinedBytes.set(randomBytes, timestampBytes.length);
  const hashBuffer = await crypto.subtle.digest("SHA-512", combinedBytes);
  return btoa(String.fromCharCode(...new Uint8Array(hashBuffer))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
__name(generateHashId, "generateHashId");
async function generateDocId(shareidControl) {
  if (shareidControl === 2) {
    return await generateHashId();
  }
  return generateUUIDv7();
}
__name(generateDocId, "generateDocId");

var getCommonFunctions = /* @__PURE__ */ __name(() => `
    const HMAC_KEY = '${Config.HmacKey}';
    const generateHmacSignature = async (message, key) => {
      const encoder = new TextEncoder();
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        encoder.encode(key),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      const signature = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message));
      return Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
    };
    const generateRequestId = async () => {
      const timestamp = Date.now().toString();
      const randomBytes = new Uint8Array(16);
      crypto.getRandomValues(randomBytes);
      const encoder = new TextEncoder();
      const data = timestamp + String.fromCharCode(...randomBytes);
      const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
      return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
    };
    const sendSignedRequest = async (url, data) => {
      const requestId = await generateRequestId();
      const body = JSON.stringify({ ...data, requestId });
      const token = await generateHmacSignature(body, HMAC_KEY);
      
      return fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Signature': token
        },
        body: body
      });
    };
    
    const debounce = (func, wait) => {
      let timeout;
      return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
      };
    };

    const setTheme = (isDark) => {
      const root = document.documentElement;
      root.style.setProperty('--bg-color', isDark ? '#0d1117' : '#fff');
      root.style.setProperty('--text-color', isDark ? '#c9d1d9' : '#24292e');
      root.style.setProperty('--link-color', isDark ? '#58a6ff' : '#0366d6');
      root.style.setProperty('--border-color', isDark ? '#30363d' : '#e1e4e8');
      root.style.setProperty('--code-bg-color', isDark ? '#161b22' : '#f6f8fa');
      document.getElementById('highlight-theme-light').disabled = isDark;
      document.getElementById('highlight-theme-dark').disabled = !isDark;
    };

    const formatRemainingTime = (ms) => {
      if (ms === undefined || isNaN(ms) || ms === "") return '\u4E0D\u5B58\u5728';
      const totalSeconds = Math.floor(ms / 1000);
      return Math.floor(totalSeconds / 60) + '\u5206 ' + (totalSeconds % 60) + '\u79D2';
    };

    const encodeBase64 = (txt_md) => btoa(String.fromCharCode(...new TextEncoder().encode(txt_md)));

    const decodeBase64 = (txt_md) => {
      const decodedtxt_md = atob(txt_md);
      return new TextDecoder().decode(new Uint8Array(decodedtxt_md.split('').map(char => char.charCodeAt(0))));
    };

    const generateRandomPassword = (inputId, length = 20) => {
      const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+';
      let password = '';
      const randomBytes = new Uint8Array(length);
      crypto.getRandomValues(randomBytes);
      for (let i = 0; i < length; i++) {
        password += charset.charAt(randomBytes[i] % charset.length);
      }
      const passwordInput = document.getElementById(inputId);
      if (passwordInput) passwordInput.value = password;
    };

    const togglePasswordVisibility = (inputId) => {
      const passwordInput = document.getElementById(inputId);
      if (!passwordInput) return;
      const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
      passwordInput.setAttribute('type', type);
      const button = passwordInput.parentElement.querySelector('button:last-child');
      if (button) button.textContent = type === 'password' ? '\u663E\u793A' : '\u9690\u85CF';
    };

    const deriveKey = async (password, salt) => {
      const encoder = new TextEncoder();
      const keyMaterial = await crypto.subtle.importKey(
        'raw', encoder.encode(password), { name: 'PBKDF2' }, false, ['deriveKey']
      );
      return await crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt: encoder.encode(salt), iterations: 500000, hash: 'SHA-256' },
        keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
      );
    };

    const decompress = async (compressedData) => {
      const stream = new DecompressionStream('deflate-raw');
      const writer = stream.writable.getWriter();
      writer.write(new Uint8Array(compressedData));
      writer.close();
      return new TextDecoder().decode(await new Response(stream.readable).arrayBuffer());
    };

    const configureMarked = () => {
      const renderer = new marked.Renderer();
      renderer.link = ({ href, title, text }) => {
        const titleAttr = title ? ' title="' + title + '"' : '';
        return '<a href="' + href + '"' + titleAttr + ' target="_blank" rel="noopener noreferrer">' + text + '</a>';
      };
      marked.setOptions({
        gfm: true, breaks: true, headerIds: false,
        renderer: renderer,
        highlight: (code, lang) => {
          const language = hljs.getLanguage(lang) ? lang : 'plaintext';
          return hljs.highlight(code, { language }).value;
        }
      });
    };

    const themeToggle = document.getElementById('theme-toggle-checkbox');
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = savedTheme ? savedTheme === 'dark' : window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    themeToggle.checked = prefersDark;
    setTheme(prefersDark);
    themeToggle.addEventListener('change', (e) => {
      const isDark = e.target.checked;
      setTheme(isDark);
      localStorage.setItem('theme', isDark ? 'dark' : 'light');
    });
  `, "getCommonFunctions");
var getDocPageFunctions = /* @__PURE__ */ __name((markdown, isError, remainingTime, remainingViews, docId, usePasswordEncryption) => `
    const isErrorPage = ${isError};
    const usePasswordEncryption = ${usePasswordEncryption};
    let originalMarkdownContent = '';

    const decrypt = async (encryptedData, urlkey, password = null) => {
      try {
        const decoded = atob(encryptedData);
        const combined = new Uint8Array(decoded.split('').map(char => char.charCodeAt(0)));
        const nonce = combined.slice(0, 12);
        const ciphertext = combined.slice(12);
        
        const cryptoKey = password 
          ? await deriveKey(password, btoa(String.fromCharCode(...urlkey)))
          : await crypto.subtle.importKey('raw', urlkey, { name: 'AES-GCM' }, false, ['decrypt']);
        
        const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, cryptoKey, ciphertext);
        return await decompress(decrypted);
      } catch (error) {
        throw new Error('\u89E3\u5BC6\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u5BC6\u7801\u662F\u5426\u6B63\u786E');
      }
    };

    const decryptDocument = async () => {
      const password = document.getElementById('sharePassword').value;
      if (!password) { alert('\u8BF7\u8F93\u5165\u5BC6\u7801'); return; }
      
      try {
        const hash = window.location.hash.substring(1);
        if (!hash) throw new Error('\u7F3A\u5C11\u89E3\u5BC6\u5BC6\u94A5');
        
        const urlkey = new Uint8Array(atob(hash).split('').map(char => char.charCodeAt(0)));
        const encryptedData = ${JSON.stringify(markdown)};
        const decryptedMarkdown = await decrypt(encryptedData, urlkey, password);
        
        originalMarkdownContent = decryptedMarkdown;
        configureMarked();
        document.getElementById('markdown-container').innerHTML = marked.parse(decryptedMarkdown);
        hljs.highlightAll();
        addCopyButtons();
      } catch (error) {
        document.getElementById('markdown-container').innerHTML = '<p><strong><span style="color: #ff0000;">' + error.message + '</span></strong></p>';
      }
    };

    document.getElementById('sharePassword')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') decryptDocument();
    });

    const addCopyButtons = () => {
      document.querySelectorAll('pre').forEach(pre => {
        const copyBtn = document.createElement('button');
        copyBtn.className = 'copy-btn';
        copyBtn.textContent = 'Copy';
        copyBtn.addEventListener('click', () => {
          navigator.clipboard.writeText(pre.querySelector('code').innerText).then(() => {
            copyBtn.textContent = 'Copied!';
            setTimeout(() => copyBtn.textContent = 'Copy', 2000);
          });
        });
        pre.appendChild(copyBtn);
      });
    };

    const renderMarkdown = debounce(async () => {
      try {
        const encryptedData = ${JSON.stringify(markdown)};
        if (!encryptedData) throw new Error('\u6587\u6863\u4E0D\u5B58\u5728\u6216\u5DF2\u8FC7\u671F');
        
        const hash = window.location.hash.substring(1);
        if (!hash) throw new Error('\u7F3A\u5C11\u89E3\u5BC6\u5BC6\u94A5');
        
        const urlkey = new Uint8Array(atob(hash).split('').map(char => char.charCodeAt(0)));
        const decryptedMarkdown = await decrypt(encryptedData, urlkey);
        
        originalMarkdownContent = decryptedMarkdown;
        configureMarked();
        document.getElementById('markdown-container').innerHTML = marked.parse(decryptedMarkdown);
        hljs.highlightAll();
        addCopyButtons();
      } catch (error) {
        document.getElementById('markdown-container').innerHTML = '<p><strong><span style="color: #ff0000;">' + error.message + '</span></strong></p>';
      }
    }, 300);

    if (!isErrorPage) {
      setTimeout(() => {
        if (usePasswordEncryption) {
          document.getElementById('markdown-container').innerHTML = '<p><strong><span style="color: #ff0000;">\u8BF7\u8F93\u5165\u5BC6\u7801\u8FDB\u884C\u89E3\u5BC6\u3002</span></strong></p>';
        } else {
          renderMarkdown();
        }
      }, 3000);
    }

    async function copyDocument() {
      if (${isError}) return;
      try {
        await navigator.clipboard.writeText(originalMarkdownContent);
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = '\u2705\u6587\u6863\u5DF2\u590D\u5236\u5230\u526A\u8D34\u677F';
        document.body.appendChild(notification);
        notification.style.display = 'block';
        setTimeout(() => {
          notification.style.display = 'none';
          setTimeout(() => document.body.removeChild(notification), 300);
        }, 2000);
      } catch (error) {}
    }

    async function confirmDestruction() {
      if (${isError}) return;
      const response = await sendSignedRequest('/${Config.DeletePath}/${docId}', {});
      const data = await response.json();
      if (data.success) {
        location.reload();
      } else {
        document.getElementById('markdown-container').innerHTML = '<p><strong><span style="color: #ff0000;">\u9500\u6BC1\u6587\u6863\u65F6\u51FA\u9519</span></strong></p>';
      }
    }

    let remainingTime = ${remainingTime};
    const remainingTimeElement = document.getElementById('remaining-time');
    const updateRemainingTime = () => {
      if (remainingTime !== 0) {
        remainingTime -= 1000;
        if (remainingTime < 0) {
          remainingTime = 0;
          clearInterval(timerInterval);
          location.reload();
        }
        remainingTimeElement.textContent = ' \u23F1\uFE0F\u5269\u4F59\u65F6\u95F4: ' + formatRemainingTime(remainingTime);
      }
    };
    updateRemainingTime();
    const timerInterval = setInterval(updateRemainingTime, 1000);
  `, "getDocPageFunctions");
var getHomePageFunctions = /* @__PURE__ */ __name(() => `
    const showNotification = () => {
      const notification = document.getElementById('notification');
      notification.style.display = 'block';
      setTimeout(() => notification.style.display = 'none', 2000);
    };

    const copyLink = debounce(() => {
      navigator.clipboard.writeText(document.getElementById('link').textContent).then(showNotification);
    }, 300);

    const generateUrlkey = async () => crypto.getRandomValues(new Uint8Array(32));
    const generateNonce = () => crypto.getRandomValues(new Uint8Array(12));

    const compress = async (text) => {
      const encoder = new TextEncoder();
      const stream = new CompressionStream('deflate-raw');
      const writer = stream.writable.getWriter();
      writer.write(encoder.encode(text));
      writer.close();
      return await new Response(stream.readable).arrayBuffer();
    };

    const encrypt = async (plaintext, urlkey, password = null, salt = null) => {
      const nonce = generateNonce();
      const compressedData = await compress(plaintext);
      
      const cryptoKey = password && salt
        ? await deriveKey(password, salt)
        : await crypto.subtle.importKey('raw', urlkey, { name: 'AES-GCM' }, false, ['encrypt']);
      
      const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, cryptoKey, compressedData);
      const combined = new Uint8Array(nonce.length + encrypted.byteLength);
      combined.set(nonce, 0);
      combined.set(new Uint8Array(encrypted), nonce.length);
      return btoa(String.fromCharCode(...combined));
    };

    const createDocument = debounce(async () => {
      const markdown = document.getElementById('markdownText').value;
      const views = document.getElementById('views').value;
      const expiration = document.getElementById('expiration').value;
      const password = document.getElementById('password').value;
      const submitButton = document.querySelector('button[onclick="createDocument()"]');
      
      if (!markdown || markdown.trim() === "") { alert('\u8BF7\u8F93\u5165\u6587\u6863\u5185\u5BB9'); return; }
      
      submitButton.disabled = true;
      submitButton.textContent = '\u751F\u6210\u4E2D...';

      try {
        const urlkey = await generateUrlkey();
        let encryptedContent;
        let usePasswordEncryption = false;
        
        if (password) {
          usePasswordEncryption = true;
          encryptedContent = await encrypt(markdown, urlkey, password, btoa(String.fromCharCode(...urlkey)));
        } else {
          encryptedContent = await encrypt(markdown, urlkey);
        }
        
        const response = await sendSignedRequest('/submit', {
          views, expiration, usePasswordEncryption, markdown: encryptedContent
        });
        
        const data = await response.json();
        if (data.error) {
          alert(data.error);
        } else {
          const urlkeyBase64 = btoa(String.fromCharCode(...urlkey));
          document.getElementById('link').textContent = data.link + '#' + urlkeyBase64;
          document.getElementById('linkContainer').style.display = 'flex';
          copyLink();
        }
      } catch (error) {
        alert('\u52A0\u5BC6\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5: ' + error.message);
      } finally {
        submitButton.disabled = false;
        submitButton.textContent = '\u751F\u6210\u7AEF\u5230\u7AEF\u52A0\u5BC6\u94FE\u63A5\u{1F517}';
      }
    }, 300);

    let isPreviewMode = false;
    
    const renderPreview = debounce(() => {
      configureMarked();
      document.getElementById('previewContent').innerHTML = marked.parse(document.getElementById('markdownText').value);
      hljs.highlightAll();
    }, 300);
    
    const togglePreview = () => {
      const previewContainer = document.getElementById('previewContainer');
      const previewToggle = document.getElementById('previewToggle');
      const markdownText = document.getElementById('markdownText');
      
      isPreviewMode = !isPreviewMode;
      
      if (isPreviewMode) {
        renderPreview();
        previewContainer.style.display = 'block';
        markdownText.style.display = 'none';
        previewToggle.textContent = '\u7F16\u8F91';
      } else {
        previewContainer.style.display = 'none';
        markdownText.style.display = 'block';
        previewToggle.textContent = '\u9884\u89C8';
      }
    };
    
    document.getElementById('markdownText').addEventListener('input', () => {
      if (isPreviewMode) renderPreview();
    });

    const updateCharCount = () => {
      const textarea = document.getElementById('markdownText');
      const charCount = document.getElementById('charCount');
      if (textarea && charCount) charCount.textContent = textarea.value.length;
    };
    updateCharCount();
  `, "getHomePageFunctions");
var getDocPageContent = /* @__PURE__ */ __name((markdown, isError, remainingTime, remainingViews, docId, usePasswordEncryption) => `
    <div class="doc-header" style="margin-bottom: 8px; margin-top: 40px;">
      <div class="doc-header-row" style="display: flex; align-items: center; gap: 8px;">
        <div class="info-block" style="flex: 1; display: flex; align-items: center; justify-content: space-between; background-color: var(--code-bg-color); border: 1px solid var(--border-color); border-radius: 4px; padding: 4px 8px; height: 32px; box-sizing: border-box;">
          <div style="display: flex; gap: 15px;">
            <p style="margin: 0; font-size: 13px; line-height: 24px;">\u23F3\u5269\u4F59\u67E5\u770B\u6B21\u6570: ${remainingViews === -1 ? "\u65E0\u9650" : remainingViews === null ? "\u4E0D\u5B58\u5728" : remainingViews}</p>
            <p id="remaining-time" style="margin: 0; font-size: 13px; line-height: 24px;"> \u23F1\uFE0F\u5269\u4F59\u65F6\u95F4: ${formatRemainingTime(remainingTime)}</p>
          </div>
          <div style="display: flex; gap: 6px;">
            <button ${isError ? 'disabled="disabled"' : ""} onclick="copyDocument()" style="background-color: #1E90FF; padding: 3px 8px; margin: 0; height: 24px; font-size: 12px;">\u590D\u5236\u6587\u6863</button>
            <button ${isError ? 'disabled="disabled"' : ""} onclick="confirmDestruction()" style="background-color: #ff0000; padding: 3px 8px; margin: 0; height: 24px; font-size: 12px;">\u9500\u6BC1\u6587\u6863</button>
          </div>
        </div>
        
        ${usePasswordEncryption ? `
        <div class="password-block" style="flex: 1; display: flex; align-items: center; gap: 6px; background-color: var(--code-bg-color); border: 1px solid var(--border-color); border-radius: 4px; padding: 4px 8px; height: 32px; box-sizing: border-box;">
          <label for="sharePassword" style="margin: 0; flex-shrink: 0; font-size: 13px; color: var(--text-color); line-height: 24px;">\u{1F512} \u5BC6\u7801\uFF1A</label>
          <div style="flex: 1; position: relative; display: flex; align-items: center;">
            <input type="password" id="sharePassword" placeholder="\u8F93\u5165\u5BC6\u7801\u89E3\u5BC6\u6587\u6863" style="width: 100%; height: 24px; margin: 0; padding: 2px 60px 2px 8px; font-size: 13px;">
            <div style="position: absolute; right: 5px; top: 50%; transform: translateY(-50%);">
              <button type="button" onclick="togglePasswordVisibility('sharePassword')" style="background-color: #1E90FF; padding: 2px 6px; font-size: 11px; width: auto; height: auto; margin: 0;">\u663E\u793A</button>
            </div>
          </div>
          <button ${isError ? 'disabled="disabled"' : ""} onclick="decryptDocument()" style="background-color: #1E90FF; padding: 3px 8px; width: auto; white-space: nowrap; height: 24px; margin: 0; font-size: 12px;">\u89E3\u5BC6</button>
        </div>
        ` : ""}
      </div>

      <style>
        @media (max-width: 768px) {
          .doc-header { margin-top: 35px; }
          .doc-header-row { flex-direction: column; }
          .info-block, .password-block { width: 100%; flex: none; }
          .info-block { flex-wrap: wrap; height: auto; min-height: 32px; }
        }
      </style>
    </div>
    <article class="markdown-body" id="markdown-container">${isError ? `${markdown}` : '<p><strong><span style="color: #ff0000;">\u{1F510}\u6B63\u5728\u7AEF\u5230\u7AEF\u89E3\u5BC6\u6587\u6863</span></strong></p>'}</article>
  `, "getDocPageContent");
var getHomePageContent = /* @__PURE__ */ __name(() => `
    <div class="header-section" style="text-align: center; margin-bottom: 8px; flex-shrink: 0;">
      <p style="margin: 0; font-size: 16px; color: var(--text-color); opacity: 0.8;">\u8BA9\u4F60\u7684\u79D8\u5BC6\u5728\u2601\uFE0F\u98DE\u4E00\u4F1A \u2708\uFE0F</p>
    </div>

    <div class="form-section" style="flex: 1; display: flex; flex-direction: column; min-height: 0;">
      <div class="form-group" style="margin-bottom: 8px; flex: 1; display: flex; flex-direction: column; min-height: 0;">
        <div class="editor-wrapper" style="position: relative; flex: 1; min-height: 300px;">
          <textarea id="markdownText" class="editor-box" placeholder="\u8BF7\u8F93\u5165\u4F60\u7684\u79D8\u5BC6\u{1F4C4}\uFF0C\u652F\u6301 MarkDown \u683C\u5F0F\u3002" maxlength="100000" oninput="updateCharCount()"></textarea>
          <div style="position: absolute; bottom: 5px; right: 5px; font-size: 12px; color: var(--text-color); opacity: 0.7; z-index: 5;">
            <span id="charCount">0</span>/100000
          </div>
          <button type="button" id="previewToggle" onclick="togglePreview()" style="background-color: #1E90FF; position: absolute; top: 5px; right: 5px; padding: 4px 8px; font-size: 12px; width: auto; z-index: 10; margin: 0;">\u9884\u89C8</button>
          <div id="previewContainer" class="editor-box" style="display: none; background-color: var(--bg-color); border: 1px solid var(--border-color); padding: 10px;">
            <article class="markdown-body" id="previewContent" style="height: 100%; overflow-y: auto;"></article>
          </div>
        </div>
      </div>

      <div class="options-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 0; flex-shrink: 0;">
        <div class="form-group" style="display: flex; align-items: center; gap: 6px; height: 38px; margin-bottom: 0;">
          <label for="views" style="margin: 0; flex-shrink: 0; font-size: 14px; color: var(--text-color); line-height: 38px;">\u231B \u67E5\u770B\u6B21\u6570\uFF1A</label>
          <div style="flex: 1; position: relative; display: flex; align-items: center;">
            <input type="number" id="views" value="1" min="1" max="10000" step="1" oninput="this.value = this.value.replace(/[^0-9]/g, '')" style="width: 100%; height: 32px; margin: 0;">
          </div>
        </div>

        <div class="form-group" style="display: flex; align-items: center; gap: 6px; height: 38px; margin-bottom: 0;">
          <label for="expiration" style="margin: 0; flex-shrink: 0; font-size: 14px; color: var(--text-color); line-height: 38px;">\u23F2\uFE0F \u6709\u6548\u671F\uFF1A</label>
          <div style="flex: 1; position: relative; display: flex; align-items: center;">
            <input type="number" id="expiration" value="1440" min="1" step="1" oninput="this.value = this.value.replace(/[^0-9]/g, '')" style="width: 100%; height: 32px; margin: 0;">
          </div>
          <small style="flex-shrink: 0; font-size: 12px; color: var(--text-color); opacity: 0.7; line-height: 38px; margin: 0;">\u5206\u949F</small>
        </div>
      </div>

      <div class="password-section" style="margin-top: 8px; margin-bottom: 0; height: 38px; flex-shrink: 0;">
        <div style="display: flex; align-items: center; gap: 6px; height: 100%;">
          <label for="password" style="margin: 0; flex-shrink: 0; font-size: 14px; color: var(--text-color); line-height: 38px;">\u{1F512} \u5BC6\u7801\uFF1A</label>
          <div style="flex: 1; position: relative; display: flex; align-items: center;">
            <input type="password" id="password" placeholder="\u53EF\u9009\uFF0C\u8BBE\u7F6E\u5BC6\u7801\u52A0\u5BC6" style="width: 100%; height: 32px; margin: 0;">
            <div style="position: absolute; right: 5px; top: 50%; transform: translateY(-50%); display: flex; gap: 5px;">
              <button type="button" onclick="generateRandomPassword('password')" style="background-color: #1E90FF; padding: 2px 6px; font-size: 12px; width: auto; height: auto; margin: 0;">\u968F\u673A\u5BC6\u7801</button>
              <button type="button" onclick="togglePasswordVisibility('password')" style="background-color: #1E90FF; padding: 2px 6px; font-size: 12px; width: auto; height: auto; margin: 0;">\u663E\u793A</button>
            </div>
          </div>
        </div>
      </div>

      <div style="margin-top: 8px; height: 38px; flex-shrink: 0;">
        <button onclick="createDocument()" style="background-color: #1E90FF; width: 100%; height: 100%; font-size: 16px; font-weight: bold; margin: 0;">\u751F\u6210\u7AEF\u5230\u7AEF\u52A0\u5BC6\u94FE\u63A5 \u{1F517}</button>
      </div>

      <style>
        .editor-box {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          margin: 0;
          border-radius: 4px;
          box-sizing: border-box;
          overflow-y: auto;
        }
        #markdownText {
          background-color: var(--bg-color);
          color: var(--text-color);
          border: 1px solid var(--border-color);
          padding: 10px;
          resize: none;
        }
        @media (max-width: 768px) {
          .options-grid { grid-template-columns: 1fr; }
          .form-section > .form-group:first-child { flex: none; height: 40vh; min-height: 200px; max-height: 400px; }
          .editor-wrapper { min-height: auto; }
        }
      </style>

    </div>

    <div class="link-section" style="margin-top: 8px; flex-shrink: 0;">
      <div id="linkContainer" style="background-color: var(--code-bg-color); border: 1px solid var(--border-color); border-radius: 4px; padding: 8px; display: none; align-items: flex-start; gap: 6px; flex-wrap: wrap; min-height: 38px; box-sizing: border-box;">
        <h3 style="margin: 0; font-size: 14px; color: var(--text-color); flex-shrink: 0; line-height: 22px;">\u5206\u4EAB\u94FE\u63A5\uFF1A</h3>
        <p id="link" onclick="copyLink()" style="margin: 0; word-wrap: break-word; color: var(--link-color); cursor: pointer; flex: 1; min-width: 0; line-height: 22px; font-size: 14px;"></p>
      </div>
    </div>

    <div class="notification" id="notification">\u2705 \u94FE\u63A5\u5DF2\u590D\u5236\u5230\u526A\u8D34\u677F</div>

    <div style="margin-top: auto; text-align: center; font-size: 14px; color: var(--text-color); opacity: 0.8; padding-top: 10px; border-top: 1px solid var(--border-color);">
      <p style="margin: 0;">\u79D8\u5BC6\u6587\u6863 - \u6781\u7B80\u3001<a href="https://github.com/fzxx/Cloudflare-Worker-Secret-doc" target="_blank" rel="noopener noreferrer" style="color: var(--link-color); text-decoration: none;">\u5F00\u6E90</a>\u7AEF\u5230\u7AEF\u52A0\u5BC6\u7684\u9605\u540E\u5373\u711A\u6587\u6863\u3002 | \xA9 \u98CE\u4E4B\u6687\u60F3 | v1.5</p>
    </div>
  `, "getHomePageContent");
function renderHTML(markdown = "", isDocPage = false, remainingViews = 0, isError = false, remainingTime = 0, docId = "", usePasswordEncryption = false) {
  const commonFunctions = getCommonFunctions();
  const docPageFunctions = getDocPageFunctions(markdown, isError, remainingTime, remainingViews, docId, usePasswordEncryption);
  const homePageFunctions = getHomePageFunctions();
  const pageContent = isDocPage ? getDocPageContent(markdown, isError, remainingTime, remainingViews, docId, usePasswordEncryption) : getHomePageContent();
  const pageFunctions = isDocPage ? docPageFunctions : homePageFunctions;
  return `<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>\u79D8\u5BC6\u6587\u6863 - Cloudflare Worker Secret doc</title>
  <meta name="description" content="\u79D8\u5BC6\u6587\u6863 - \u7AEF\u5230\u7AEF\u52A0\u5BC6\u7684\u9605\u540E\u5373\u711A\u6587\u6863\u3002 | Secret Document - End-to-End Encrypted Self-Destructing Document.">
  <meta name="keywords" content="\u9605\u540E\u5373\u711A, \u6587\u672C\u52A0\u5BC6, \u804A\u5929, \u5F00\u6E90, \u5B89\u5168, \u52A0\u5BC6, \u7AEF\u5230\u7AEF, \u5BC6\u6587">
  <link rel="icon" type="image/png" href="data:image/x-icon;base64,AAABAAEAEBAAAAEAIABoBAAAFgAAACgAAAAQAAAAIAAAAAEAIAAAAAAAQAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAPa3/ED6m/1NAnP9VQZH/VUOG/1VEff9ITnr1AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADy0/5s+q///P6D//0GV//9Civ//RID//5KCsIL0kE9V/pNHVf6UR1X+lEdV/pNHRv2SRgEAAAAAAAAAAAAAAAA7u/+pPbL//zCR5v8aZ7//PYz3/0OG//+7hoX//ZJI//6USP/+lEj//pRI//6USP/+k0dFAAAAAAAAAAAAAAAAOsL/qTy5//8ZcsD/AEaU/y+C4v9Cjf//uoiG//2TSP/+lEj//pRI//6USP/+lEj//pRHVQAAAAAAAAAAAAAAADnJ/6k7wP//Oa/4/y6R4/8/n/7/QZT//7mNh//8mUv//ppL//6aSv/+mUr//phK//6YSVUAAAAAAAAAAAAAAAA4zf5zOsf//Du8//89sf//Pqb//0qc9f/am23//aFO//6hTv/+oE7//qBN//6fTf/+nk1VAAAAAAAAAAAAAAAAAAAAAFfB4lmKsrT/8JVT/1ep5v/7pVL//alS//6oUf/+qFH//qdR//6mUf/+plD//qVQVQAAAAAAAAAAAAAAAAAAAADHsYBUb7/P/1S55/+jsqT//bBV//6wVf/9r1X//a1U//2sVP/9rFT//axT//2rU1UAAAAAAAAAAAAAAAAAAAAA+bhdU/65Wf/+uFn//rhZ//63Wf/+tlj/+7FX//mrVv/4p1b/96dV//mpVv/6q1VWAAAAAAAAAAAAAAAAAAAAAP7AXVP/wF3//8Bc//+/XP//vlz//btb//mwWf/1p1j/86FX//KfVv/zoFb/9qteVgAAAAAAAAAAAAAAAAAAAAD/x2BT/8dg///GYP//xl///8Vf//y+Xv/4uWn//tyt//7hsf/95K3/++WmxffIhQ0AAAAAAAAAAAAAAAAAAAAA/85jU//OY///zWP//81j///MYv/8xGH/+cR5//3jrv/85qr/++mmxfvopw0AAAAAAAAAAAAAAAAAAAAAAAAAAP/VZlP/1Wb//9Rm///UZv//02b//c1k//nLef/76af/+uyjxfrqow0AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/22lR/9xq///baf//2mn//9pp//7XaP/51Xn/+e6gxfntoQ0AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgP8AAIADAACAAwAAgAMAAIADAACAAwAAwAMAAMADAADAAwAAwAMAAMADAADABwAAwA8AAMAfAADAPwAA//8AAA==">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.8.1/github-markdown.min.css">
  <link id="highlight-theme-light" rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.10.0/styles/github.min.css">
  <link id="highlight-theme-dark" rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.10.0/styles/github-dark.min.css" disabled>
  <script src="https://fastly.jsdelivr.net/npm/marked/marked.min.js"><\/script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/highlight.min.js"><\/script>
  <style>
    :root {
      --bg-color: #fff;
      --text-color: #24292e;
      --link-color: #0366d6;
      --border-color: #e1e4e8;
      --code-bg-color: #f6f8fa;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg-color: #0d1117;
        --text-color: #c9d1d9;
        --link-color: #58a6ff;
        --border-color: #30363d;
        --code-bg-color: #161b22;
      }
    }
    body {
      font-family: Arial, sans-serif;
      background-color: var(--bg-color);
      color: var(--text-color);
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
      overflow: hidden;
      visibility: hidden;
    }
    .container {
      background-color: var(--bg-color);
      padding: 20px;
      box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
      border-radius: 8px;
      width: 88%;
      height: 90%;
      max-height: 90%;
      max-width: 90%;
      border: 1px solid var(--border-color);
      display: flex;
      flex-direction: column;
      overflow: auto;
      position: relative;
    }
    @media (max-width: 768px) {
      body { overflow: auto; align-items: flex-start; padding: 10px 0; height: auto; min-height: 100vh; }
      .container { width: 92%; height: auto; min-height: 90vh; max-height: none; padding: 12px; margin: auto; }
    }
    @media (prefers-color-scheme: dark) {
      .container { box-shadow: 0 0 10px rgba(255, 255, 255, 0.1); }
    }
    textarea, input {
      background-color: var(--bg-color);
      color: var(--text-color);
      border: 1px solid var(--border-color);
      width: 100%;
      margin-top: 10px;
      border-radius: 4px;
      padding: 10px;
      box-sizing: border-box;
      resize: none;
    }
    textarea { height: 250px; }
    button {
      background-color: var(--link-color);
      color: #fff;
      border: none;
      padding: 10px;
      cursor: pointer;
      border-radius: 4px;
      width: 100%;
      margin-top: 5px;
    }
    button:hover { opacity: 0.8; }
    #link {
      margin-top: 20px;
      cursor: pointer;
      color: var(--link-color);
      word-wrap: break-word;
    }
    #link:hover { text-decoration: underline; }
    .markdown-body {
      overflow-y: auto;
      color: var(--text-color);
      padding-right: 10px;
      -webkit-overflow-scrolling: touch;
    }
    .markdown-body pre {
      background-color: var(--code-bg-color);
      position: relative;
    }
    .markdown-body pre:hover .copy-btn { opacity: 1; }
    .copy-btn {
      position: absolute;
      top: 4px;
      right: 8px;
      width: 50px;
      height: 24px;
      background-color: var(--code-bg-color);
      border: 1px solid var(--border-color);
      color: var(--text-color);
      border-radius: 4px;
      cursor: pointer;
      opacity: 0;
      transition: opacity 0.3s;
      font-size: 12px;
      display: flex;
      justify-content: center;
      align-items: center;
      transform: translateY(-6px);
    }
    .theme-toggle {
      position: absolute;
      top: 10px;
      right: 10px;
      cursor: pointer;
      z-index: 1000;
    }
    .theme-toggle input { display: none; }
    .theme-toggle label {
      display: block;
      width: 40px;
      height: 20px;
      background-color: #ccc;
      border-radius: 20px;
      position: relative;
      transition: background-color 0.3s;
    }
    .theme-toggle label:before {
      content: "\u2600\uFE0F";
      display: flex;
      justify-content: center;
      align-items: center;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background-color: #fff;
      position: absolute;
      top: 2px;
      left: 2px;
      transition: transform 0.3s;
      font-size: 10px;
    }
    .theme-toggle input:checked + label { background-color: #2196F3; }
    .theme-toggle input:checked + label:before {
      content: "\u{1F319}";
      transform: translateX(20px);
    }
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background-color: var(--bg-color); }
    ::-webkit-scrollbar-thumb { background-color: var(--border-color); border-radius: 3px; }
    ::-webkit-scrollbar-thumb:hover { background-color: #aaa; }
    .notification {
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background-color: var(--link-color);
      color: #fff;
      padding: 10px 20px;
      border-radius: 4px;
      display: none;
      z-index: 1000;
    }
    .form-group { margin-bottom: 15px; }
    .info-container {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 20px;
      padding: 10px;
      border-radius: 4px;
      background-color: var(--code-bg-color);
    }
    .info-container p { margin: 0; font-size: 14px; color: var(--text-color); }
    .info-container button { width: auto; padding: 5px 10px; margin-left: 10px; }
    #markdown-container { box-shadow: 0 0 0 1px #ccc; padding: 10px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="theme-toggle">
      <input type="checkbox" id="theme-toggle-checkbox">
      <label for="theme-toggle-checkbox"></label>
    </div>
    
    ${pageContent}
    
    <script>
      ${commonFunctions}
      ${pageFunctions}
      document.body.style.visibility = 'visible';
    <\/script>
  </div>
</body>
</html>`;
}
__name(renderHTML, "renderHTML");

async function createDocument(request, env) {
  const requestBody = await request.text();
  if (new Blob([requestBody]).size > 100 * 1024) {
    return new Response("", { status: 204, headers: { "Content-Type": "text/plain; charset=UTF-8" } });
  }
  const { markdown, views, expiration, usePasswordEncryption } = JSON.parse(requestBody);
  const errorMessage = validateInput(markdown, views, expiration);
  if (errorMessage) {
    return createJSONResponse({ error: errorMessage }, 400);
  }
  const viewsInt = processViews(views, Config.Max_times);
  const expirationMs = processExpiration(expiration, Config.Max_countdown);
  if (isNaN(viewsInt) || isNaN(expirationMs) || expirationMs <= 0) {
    return createJSONResponse({ error: "\u65E0\u6548\u7684\u53C2\u6570\u503C" }, 400);
  }
  const docId = await generateDocId(Config.Shareid_control);
  await env.Worker_Secret_doc.put(docId, JSON.stringify({ markdown, views: viewsInt, expiration: expirationMs, usePasswordEncryption }));
  const link = `${new URL(request.url).origin}/${Config.SharePath}/${generateDocIdWithCrc(docId)}`;
  return createJSONResponse({ link });
}
__name(createDocument, "createDocument");
async function getDocument(docIdWithCrc, env) {
  const docId = validateAndExtractDocId(docIdWithCrc);
  if (!docId) return createRedirectResponse();
  const value = await env.Worker_Secret_doc.get(docId);
  if (!value) {
    return createHTMLResponse(renderHTML(ERROR_MESSAGES.NOT_FOUND, true, 0, true, 0, ""));
  }
  const data = JSON.parse(value);
  if (isNaN(data.expiration) || data.expiration <= 0 || isNaN(data.views)) {
    await env.Worker_Secret_doc.delete(docId);
    return createHTMLResponse(renderHTML(ERROR_MESSAGES.INVALID_DATA, true, 0, true, 0, ""));
  }
  if (Date.now() > data.expiration) {
    await env.Worker_Secret_doc.delete(docId);
    return createHTMLResponse(renderHTML(ERROR_MESSAGES.NOT_FOUND, true, 0, true, 0, ""));
  }
  if (data.views !== 0 && data.views !== -1) {
    data.views -= 1;
    if (data.views <= 0) {
      await env.Worker_Secret_doc.delete(docId);
    } else {
      await env.Worker_Secret_doc.put(docId, JSON.stringify(data));
    }
  }
  const remainingTime = Math.max(0, data.expiration - Date.now());
  return createHTMLResponse(renderHTML(data.markdown, true, data.views, false, remainingTime, docIdWithCrc, data.usePasswordEncryption || false));
}
__name(getDocument, "getDocument");
async function deleteDocument(docIdWithCrc, env) {
  const docId = validateAndExtractDocId(docIdWithCrc);
  if (!docId) return createJSONResponse({ success: false, error: "Invalid document ID" });
  await env.Worker_Secret_doc.delete(docId);
  return createJSONResponse({ success: true });
}
__name(deleteDocument, "deleteDocument");

var homePageCache = null;
var homePageCacheTime = 0;
function getHomePage() {
  const now = Date.now();
  if (homePageCache && now - homePageCacheTime < Config.HomePageCacheDuration) {
    return createHTMLResponse(homePageCache, 200, Config.BrowserCacheDuration);
  }
  homePageCache = renderHTML();
  homePageCacheTime = now;
  return createHTMLResponse(homePageCache, 200, Config.BrowserCacheDuration);
}
__name(getHomePage, "getHomePage");

async function handleRequest(request, env) {
  const url = new URL(request.url);
  const { pathname } = url;
  if (request.method === "POST") {
    const requestClone = request.clone();
    if (!await verifyRequestSignature(requestClone)) {
      return createForbiddenResponse();
    }
    if (pathname === "/submit") return await createDocument(request, env);
    if (pathname.startsWith(`/${Config.DeletePath}/`)) {
      return await deleteDocument(pathname.replace(`/${Config.DeletePath}/`, ""), env);
    }
    return createForbiddenResponse();
  }
  if (request.method === "GET" && pathname.startsWith(`/${Config.SharePath}/`)) {
    return await getDocument(pathname.replace(`/${Config.SharePath}/`, ""), env);
  }
  if (request.method === "GET" && pathname === "/") {
    return getHomePage();
  }
  return createRedirectResponse();
}
__name(handleRequest, "handleRequest");
var index_default = {
  async fetch(request, env, ctx) {
    return await handleRequest(request, env);
  }
};
export {
  index_default as default
};