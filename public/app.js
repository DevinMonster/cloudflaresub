const form = document.getElementById('generator-form');
const submitBtn = document.getElementById('submitBtn');
const fillDemoBtn = document.getElementById('fillDemoBtn');
const resultSection = document.getElementById('resultSection');
const warningBox = document.getElementById('warningBox');
const previewBody = document.getElementById('previewBody');

const autoUrl = document.getElementById('autoUrl');
const rawUrl = document.getElementById('rawUrl');
const clashUrl = document.getElementById('clashUrl');
const surgeUrl = document.getElementById('surgeUrl');
const emptyState = document.getElementById('emptyState');

const qrModal = document.getElementById('qrModal');
const qrCanvas = document.getElementById('qrCanvas');
const qrText = document.getElementById('qrText');
const closeQrModal = document.getElementById('closeQrModal');

const demoVmess = [
  'vmess://ewogICJ2IjogIjIiLAogICJwcyI6ICJkZW1vLXdzLXRscyIsCiAgImFkZCI6ICJlZGdlLmV4YW1wbGUuY29tIiwKICAicG9ydCI6ICI0NDMiLAogICJpZCI6ICIwMDAwMDAwMC0wMDAwLTQwMDAtODAwMC0wMDAwMDAwMDAwMDEiLAogICJzY3kiOiAiYXV0byIsCiAgIm5ldCI6ICJ3cyIsCiAgInRscyI6ICJ0bHMiLAogICJwYXRoIjogIi93cyIsCiAgImhvc3QiOiAiZWRnZS5leGFtcGxlLmNvbSIsCiAgInNuaSI6ICJlZGdlLmV4YW1wbGUuY29tIiwKICAiZnAiOiAiY2hyb21lIiwKICAiYWxwbiI6ICJoMixodHRwLzEuMSIKfQ=='
].join('\n');

const demoIps = [
  '104.16.1.2#HK-01',
  '104.17.2.3#HK-02',
  '104.18.3.4:2053#US-Edge'
].join('\n');

fillDemoBtn.addEventListener('click', () => {
  document.getElementById('nodeLinks').value = demoVmess;
  document.getElementById('preferredIps').value = demoIps;
  document.getElementById('namePrefix').value = 'CF';
  document.getElementById('keepOriginalHost').checked = true;
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  warningBox.classList.add('hidden');
  previewBody.innerHTML = '';

  const payload = {
    nodeLinks: document.getElementById('nodeLinks').value,
    preferredIps: document.getElementById('preferredIps').value,
    namePrefix: document.getElementById('namePrefix').value,
    keepOriginalHost: document.getElementById('keepOriginalHost').checked,
  };

  submitBtn.disabled = true;
  submitBtn.textContent = '生成中...';

  try {
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok || !data.ok) {
      throw new Error(data.error || '生成失败');
    }

    autoUrl.value = data.urls.auto;
    rawUrl.value = data.urls.raw;
    document.getElementById('rocketUrl').value = data.urls.raw;
    clashUrl.value = data.urls.clash;
    surgeUrl.value = data.urls.surge;

    saveTokenFromUrls(data.urls);
    loadHistory();

    emptyState.classList.add('hidden');

    document.getElementById('statInputNodes').textContent = data.counts.inputNodes;
    document.getElementById('statEndpoints').textContent = data.counts.preferredEndpoints;
    document.getElementById('statOutputNodes').textContent = data.counts.outputNodes;

    previewBody.innerHTML = data.preview
      .map(
        (item) => `
          <tr>
            <td>${escapeHtml(item.name)}</td>
            <td>${escapeHtml(item.type)}</td>
            <td>${escapeHtml(item.server)}</td>
            <td>${escapeHtml(String(item.port))}</td>
            <td>${escapeHtml(item.host || '-')}</td>
            <td>${escapeHtml(item.sni || '-')}</td>
          </tr>`,
      )
      .join('');

    if (Array.isArray(data.warnings) && data.warnings.length) {
      warningBox.textContent = data.warnings.join('\n');
      warningBox.classList.remove('hidden');
    }

    resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) {
    warningBox.textContent = error.message || '请求失败';
    warningBox.classList.remove('hidden');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = '生成订阅';
  }
});

document.addEventListener('click', async (event) => {
  const copyButton = event.target.closest('[data-copy-target]');
  if (copyButton) {
    const input = document.getElementById(copyButton.dataset.copyTarget);
    if (!input?.value) {
      return;
    }
    try {
      await navigator.clipboard.writeText(input.value);
      const originalText = copyButton.textContent;
      copyButton.textContent = '已复制';
      setTimeout(() => {
        copyButton.textContent = originalText;
      }, 1200);
    } catch {
      input.select();
      document.execCommand('copy');
    }
    return;
  }

  const qrButton = event.target.closest('[data-qrcode-target]');
  if (qrButton) {
    warningBox.classList.add('hidden');

    const input = document.getElementById(qrButton.dataset.qrcodeTarget);
    if (!input?.value) {
      warningBox.textContent = '请先生成订阅链接，再显示二维码。';
      warningBox.classList.remove('hidden');
      return;
    }

    if (!window.QRCode) {
      warningBox.textContent = '二维码组件加载失败，请刷新页面后重试。';
      warningBox.classList.remove('hidden');
      return;
    }

    qrCanvas.innerHTML = '';
    qrText.textContent = input.value;
    qrModal.classList.remove('hidden');
    qrModal.setAttribute('aria-hidden', 'false');

    new window.QRCode(qrCanvas, {
      text: input.value,
      width: 220,
      height: 220,
      correctLevel: window.QRCode.CorrectLevel.M,
    });
    return;
  }

  if (event.target.closest('[data-close-modal="true"]')) {
    closeQrDialog();
  }
});

closeQrModal.addEventListener('click', closeQrDialog);

function closeQrDialog() {
  qrModal.classList.add('hidden');
  qrModal.setAttribute('aria-hidden', 'true');
  qrCanvas.innerHTML = '';
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/* ==================== 历史记录 ==================== */

const historyList = document.getElementById('historyList');
const historyEmpty = document.getElementById('historyEmpty');
const historyWarning = document.getElementById('historyWarning');
const refreshHistoryBtn = document.getElementById('refreshHistoryBtn');

const HISTORY_TOKEN_KEY = 'subAccessToken';
const FORMAT_LABELS = {
  auto: '自动识别',
  raw: 'Raw / V2rayN',
  clash: 'Clash',
  surge: 'Surge',
};
const PROTOCOL_ORDER = ['vmess', 'vless', 'trojan'];

function getToken() {
  try {
    return localStorage.getItem(HISTORY_TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

function saveTokenFromUrls(urls) {
  if (!urls?.auto) return;
  try {
    const token = new URL(urls.auto).searchParams.get('token');
    if (token) {
      localStorage.setItem(HISTORY_TOKEN_KEY, token);
    }
  } catch {
    // ignore
  }
}

function tokenSuffix() {
  const token = getToken();
  return token ? `?token=${encodeURIComponent(token)}` : '';
}

function subUrlFor(id, target) {
  const base = `${location.origin}/sub/${id}`;
  const query = target && target !== 'auto' ? `target=${target}` : '';
  const token = getToken();
  const parts = [query, token ? `token=${encodeURIComponent(token)}` : ''].filter(Boolean);
  return parts.length ? `${base}?${parts.join('&')}` : base;
}

function formatTime(iso) {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('zh-CN', { hour12: false });
}

function protocolText(protocols) {
  if (!protocols || typeof protocols !== 'object') return '';
  const entries = Object.entries(protocols).sort((a, b) => {
    const ia = PROTOCOL_ORDER.indexOf(a[0]);
    const ib = PROTOCOL_ORDER.indexOf(b[0]);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
  return entries.map(([type, count]) => `${type}×${count}`).join(' / ');
}

function showHistoryWarning(message) {
  historyWarning.textContent = message;
  historyWarning.classList.remove('hidden');
}

function hideHistoryWarning() {
  historyWarning.classList.add('hidden');
}

async function loadHistory() {
  try {
    const response = await fetch('/api/history');
    const data = await response.json();
    if (!response.ok || !data.ok) {
      throw new Error(data.error || '加载历史失败');
    }
    renderHistory(Array.isArray(data.items) ? data.items : []);
    hideHistoryWarning();
  } catch (error) {
    historyEmpty.textContent = `历史记录加载失败：${error.message}`;
    historyEmpty.classList.remove('hidden');
  }
}

function renderHistory(items) {
  historyList.innerHTML = '';

  if (!items.length) {
    historyEmpty.textContent = '还没有生成过订阅。在下方表单生成订阅后，会自动出现在这里。';
    historyEmpty.classList.remove('hidden');
    return;
  }

  historyEmpty.classList.add('hidden');

  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recent = [];
  const older = [];
  items.forEach((item) => {
    const created = new Date(item.createdAt || 0).getTime();
    (created >= cutoff ? recent : older).push(item);
  });

  recent.forEach((item) => historyList.insertAdjacentHTML('beforeend', renderItem(item)));

  if (older.length) {
    const inner = older.map((item) => renderItem(item)).join('');
    historyList.insertAdjacentHTML(
      'beforeend',
      `<details class="history-older"><summary>30 天前（${older.length} 条）</summary>${inner}</details>`,
    );
  }
}

function renderItem(item) {
  const id = escapeHtml(item.id);
  const legacy = !item.hasInputs;
  const protocols = protocolText(item.protocols);
  const updatedBadge =
    item.updatedAt && item.updatedAt !== item.createdAt
      ? `<span class="history-updated">已更新 · ${escapeHtml(formatTime(item.updatedAt))}</span>`
      : '';
  const legacyBadge = legacy ? '<span class="history-legacy">旧格式 · 不可编辑</span>' : '';
  const protocolTags = protocols
    ? `<span class="proto-tag">${escapeHtml(protocols)}</span>`
    : '';
  const countTag = Number.isFinite(item.outputNodes)
    ? `<span class="history-count">${item.outputNodes} 节点</span>`
    : '';

  return `
    <article class="history-item" data-id="${id}">
      <div class="history-item-head">
        <div class="history-meta">
          <span class="history-time">${escapeHtml(formatTime(item.createdAt))}</span>
          ${updatedBadge}
          ${legacyBadge}
        </div>
        <div class="history-badges">${protocolTags}${countTag}</div>
      </div>
      <div class="history-link-row">
        <select class="history-format" data-history-action="format" data-id="${id}">
          ${Object.entries(FORMAT_LABELS)
            .map(([value, label]) => `<option value="${value}">${label}</option>`)
            .join('')}
        </select>
        <input id="historyUrl-${id}" readonly value="${escapeHtml(subUrlFor(item.id, 'auto'))}">
        <button type="button" class="secondary small" data-copy-target="historyUrl-${id}">复制</button>
        <button type="button" class="secondary small" data-qrcode-target="historyUrl-${id}">二维码</button>
      </div>
      <div class="history-item-actions">
        <button type="button" class="secondary small" data-history-action="edit" data-id="${id}" ${legacy ? 'disabled title="旧格式记录不支持编辑"' : ''}>编辑</button>
        <button type="button" class="secondary small danger" data-history-action="delete" data-id="${id}">删除</button>
      </div>
      <div class="history-edit hidden">
        <div>
          <label>节点链接</label>
          <textarea rows="6" class="history-edit-nodes" placeholder="vmess:// / vless:// / trojan://，一行一个"></textarea>
        </div>
        <div>
          <label>优选 IP / 域名</label>
          <textarea rows="4" class="history-edit-endpoints" placeholder="host[:port][#备注]，一行一个"></textarea>
        </div>
        <div class="history-edit-options">
          <div>
            <label>备注前缀（可选）</label>
            <input type="text" class="history-edit-prefix" placeholder="例如 CF">
          </div>
          <div class="checkbox-wrap">
            <input type="checkbox" class="history-edit-keephost" checked>
            <label>保留原节点 Host / SNI</label>
          </div>
        </div>
        <div class="actions">
          <button type="button" class="small" data-history-action="save" data-id="${id}">保存更新</button>
          <button type="button" class="secondary small" data-history-action="cancel" data-id="${id}">取消</button>
        </div>
      </div>
    </article>`;
}

function itemElement(id) {
  return historyList.querySelector(`.history-item[data-id="${CSS.escape(id)}"]`);
}

async function openEditor(id) {
  const item = itemElement(id);
  if (!item) return;
  const editor = item.querySelector('.history-edit');
  try {
    const response = await fetch(`/api/sub/${encodeURIComponent(id)}/input${tokenSuffix()}`);
    const data = await response.json();
    if (!response.ok || !data.ok) {
      throw new Error(data.error || '加载订阅内容失败');
    }
    item.querySelector('.history-edit-nodes').value = data.inputs.nodeLinks || '';
    item.querySelector('.history-edit-endpoints').value = data.inputs.preferredIps || '';
    item.querySelector('.history-edit-prefix').value = data.options.namePrefix || '';
    item.querySelector('.history-edit-keephost').checked = data.options.keepOriginalHost !== false;
    editor.classList.remove('hidden');
    hideHistoryWarning();
  } catch (error) {
    showHistoryWarning(`编辑加载失败：${error.message}`);
  }
}

async function saveEditor(id) {
  const item = itemElement(id);
  if (!item) return;
  const payload = {
    nodeLinks: item.querySelector('.history-edit-nodes').value,
    preferredIps: item.querySelector('.history-edit-endpoints').value,
    namePrefix: item.querySelector('.history-edit-prefix').value.trim(),
    keepOriginalHost: item.querySelector('.history-edit-keephost').checked,
  };

  try {
    const response = await fetch(`/api/sub/${encodeURIComponent(id)}${tokenSuffix()}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok || !data.ok) {
      throw new Error(data.error || '保存失败');
    }
    await loadHistory();
  } catch (error) {
    showHistoryWarning(`保存失败：${error.message}`);
  }
}

async function deleteItem(id) {
  if (!window.confirm(`确定删除订阅 ${id}？删除后所有客户端的订阅链接将立即失效。`)) {
    return;
  }
  try {
    const response = await fetch(`/api/sub/${encodeURIComponent(id)}${tokenSuffix()}`, {
      method: 'DELETE',
    });
    const data = await response.json();
    if (!response.ok || !data.ok) {
      throw new Error(data.error || '删除失败');
    }
    await loadHistory();
  } catch (error) {
    showHistoryWarning(`删除失败：${error.message}`);
  }
}

document.addEventListener('click', (event) => {
  const actionEl = event.target.closest('[data-history-action]');
  if (!actionEl) return;
  const action = actionEl.dataset.historyAction;
  const id = actionEl.dataset.id;

  if (action === 'edit') {
    openEditor(id);
    return;
  }
  if (action === 'save') {
    saveEditor(id);
    return;
  }
  if (action === 'cancel') {
    itemElement(id)?.querySelector('.history-edit')?.classList.add('hidden');
    return;
  }
  if (action === 'delete') {
    deleteItem(id);
  }
});

document.addEventListener('change', (event) => {
  const formatEl = event.target.closest('select[data-history-action="format"]');
  if (!formatEl) return;
  const item = itemElement(formatEl.dataset.id);
  const input = item?.querySelector('input[readonly]');
  if (input) {
    input.value = subUrlFor(formatEl.dataset.id, formatEl.value);
  }
});

refreshHistoryBtn.addEventListener('click', loadHistory);

loadHistory();
