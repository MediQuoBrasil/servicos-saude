/**
 * @file admin.js
 * @description Lógica do painel administrativo.
 *              Google Identity Services (GIS) para login.
 *              CRUD de tabela e FAQ via API autenticada.
 */

/* eslint-disable no-undef */

(() => {
  'use strict';

  /** @type {string} Client ID do Google Cloud — DEVE coincidir com Config.gs */
  const CLIENT_ID = 'COLE_O_CLIENT_ID_AQUI.apps.googleusercontent.com';

  // ─── State ───────────────────────────────────────────────

  /** @type {{ token: string|null, email: string|null, tabela: Object|null, faq: Array|null }} */
  const state = {
    token: null,
    email: null,
    tabela: null,
    faq: null,
  };

  // ─── DOM ─────────────────────────────────────────────────

  const dom = {
    loginSection: document.getElementById('loginSection'),
    adminPanel: document.getElementById('adminPanel'),
    adminUser: document.getElementById('adminUser'),
    logoutBtn: document.getElementById('logoutBtn'),
    toast: document.getElementById('toast'),
    themeToggle: document.getElementById('themeToggle'),
    themeIcon: document.getElementById('themeIcon'),
    tabs: document.querySelectorAll('.admin-tab'),
    tabTabela: document.getElementById('tabTabela'),
    tabFaq: document.getElementById('tabFaq'),
    adminTabelaLoading: document.getElementById('adminTabelaLoading'),
    adminTabelaContent: document.getElementById('adminTabelaContent'),
    editTableHead: document.getElementById('editTableHead'),
    editTableBody: document.getElementById('editTableBody'),
    adminFaqLoading: document.getElementById('adminFaqLoading'),
    adminFaqContent: document.getElementById('adminFaqContent'),
    faqEditList: document.getElementById('faqEditList'),
    addFaqBtn: document.getElementById('addFaqBtn'),
  };

  // ─── Theme (reutiliza lógica do app.js) ──────────────────

  const THEME_KEY = 'mediquo-theme';

  const applyTheme = (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    if (dom.themeIcon) {
      dom.themeIcon.innerHTML = theme === 'dark'
        ? '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>'
        : '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
    }
  };

  const initTheme = () => {
    const saved = localStorage.getItem(THEME_KEY);
    applyTheme(saved === 'light' ? 'light' : 'dark');
  };

  if (dom.themeToggle) {
    dom.themeToggle.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'dark';
      const next = current === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      localStorage.setItem(THEME_KEY, next);
    });
  }

  initTheme();

  // ─── Toast ───────────────────────────────────────────────

  /** @type {number|null} */
  let toastTimer = null;

  /**
   * Mostra uma notificação toast.
   * @param {string} msg - Mensagem.
   * @param {'success'|'error'} type - Tipo visual.
   * @returns {void}
   */
  const showToast = (msg, type = 'success') => {
    if (!dom.toast) return;
    if (toastTimer) clearTimeout(toastTimer);
    dom.toast.textContent = msg;
    dom.toast.className = `toast toast-${type} visible`;
    toastTimer = setTimeout(() => {
      dom.toast.classList.remove('visible');
    }, 3000);
  };

  // ─── HTML Escape ─────────────────────────────────────────

  const escapeHtml = (str) => {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  };

  // ─── Auth: Google Identity Services ──────────────────────

  /**
   * Callback chamado pelo GIS após login bem-sucedido.
   * @param {Object} response - Resposta do Google com credential (ID Token).
   * @returns {void}
   */
  const handleCredentialResponse = (response) => {
    state.token = response.credential;

    try {
      const payload = JSON.parse(atob(response.credential.split('.')[1]));
      state.email = payload.email || 'Admin';
    } catch (err) {
      state.email = 'Admin';
    }

    if (dom.loginSection) dom.loginSection.style.display = 'none';
    if (dom.adminPanel) dom.adminPanel.style.display = '';
    if (dom.adminUser) dom.adminUser.textContent = state.email;

    loadAdminData();
  };

  /**
   * Inicializa o botão de login via GIS.
   * Aguarda o script do Google carregar.
   * @returns {void}
   */
  const initGoogleLogin = () => {
    const waitForGoogle = setInterval(() => {
      if (typeof google !== 'undefined' && google.accounts) {
        clearInterval(waitForGoogle);

        google.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: handleCredentialResponse,
          auto_select: false,
          ux_mode: 'popup',
        });

        google.accounts.id.renderButton(
          document.getElementById('googleLoginBtn'),
          {
            type: 'standard',
            theme: 'outline',
            size: 'large',
            text: 'signin_with',
            shape: 'rectangular',
            locale: 'pt-BR',
          },
        );
      }
    }, 100);
  };

  if (dom.logoutBtn) {
    dom.logoutBtn.addEventListener('click', () => {
      state.token = null;
      state.email = null;
      if (dom.adminPanel) dom.adminPanel.style.display = 'none';
      if (dom.loginSection) dom.loginSection.style.display = '';
      if (typeof google !== 'undefined' && google.accounts) {
        google.accounts.id.disableAutoSelect();
      }
    });
  }

  // ─── Tabs ────────────────────────────────────────────────

  dom.tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      dom.tabs.forEach((t) => { t.classList.remove('active'); });
      tab.classList.add('active');

      const target = tab.getAttribute('data-tab');
      if (dom.tabTabela) dom.tabTabela.style.display = target === 'tabela' ? '' : 'none';
      if (dom.tabFaq) dom.tabFaq.style.display = target === 'faq' ? '' : 'none';
    });
  });

  // ─── Load Data ───────────────────────────────────────────

  /**
   * Carrega dados para edição.
   * @returns {void}
   */
  const loadAdminData = () => {
    loadTabelaForEdit();
    loadFaqForEdit();
  };

  // ─── Tabela Edit ─────────────────────────────────────────

  const loadTabelaForEdit = () => {
    if (dom.adminTabelaLoading) dom.adminTabelaLoading.style.display = '';
    if (dom.adminTabelaContent) dom.adminTabelaContent.style.display = 'none';

    fetchSWR(
      'getTabela',
      (data) => { renderTabelaEdit(data); },
      (data) => { state.tabela = data; renderTabelaEdit(data); },
      (err) => {
        if (dom.adminTabelaLoading) dom.adminTabelaLoading.style.display = 'none';
        showToast('Erro ao carregar tabela: ' + err.message, 'error');
      },
    );
  };

  /**
   * Renderiza a tabela editável.
   * @param {Object} data - Dados da tabela.
   * @returns {void}
   */
  const renderTabelaEdit = (data) => {
    if (!dom.editTableHead || !dom.editTableBody) return;
    state.tabela = data;

    const allHeaders = [...(data.headerPlantao || []), ...(data.headerAgendamento || [])];

    let headHtml = '<tr><th>Campo</th>';
    allHeaders.forEach((h) => { headHtml += `<th>${escapeHtml(h)}</th>`; });
    headHtml += '</tr>';
    dom.editTableHead.innerHTML = headHtml;

    let bodyHtml = '';
    (data.rows || []).forEach((row, rowIdx) => {
      bodyHtml += '<tr>';
      bodyHtml += `<td style="font-weight:600;">${escapeHtml(row.campo)}</td>`;
      allHeaders.forEach((h, colIdx) => {
        const val = row.servicos[h] || '';
        bodyHtml += `<td><textarea class="edit-cell" data-row="${rowIdx + 2}" data-col="${colIdx + 1}" rows="2">${escapeHtml(val)}</textarea></td>`;
      });
      bodyHtml += '</tr>';
    });

    dom.editTableBody.innerHTML = bodyHtml;

    // Event: blur on cell → save
    dom.editTableBody.querySelectorAll('.edit-cell').forEach((cell) => {
      /** @type {string} */
      let originalValue = cell.value;

      cell.addEventListener('input', () => {
        cell.classList.toggle('dirty', cell.value !== originalValue);
      });

      cell.addEventListener('blur', async () => {
        if (cell.value === originalValue) return;

        const row = Number(cell.getAttribute('data-row'));
        const col = Number(cell.getAttribute('data-col'));

        try {
          await adminPost('updateTabela', { row, col, value: cell.value }, state.token);
          originalValue = cell.value;
          cell.classList.remove('dirty');
          showToast('Célula atualizada');
        } catch (err) {
          showToast('Erro ao salvar: ' + err.message, 'error');
        }
      });
    });

    if (dom.adminTabelaLoading) dom.adminTabelaLoading.style.display = 'none';
    if (dom.adminTabelaContent) dom.adminTabelaContent.style.display = '';
  };

  // ─── FAQ Edit ────────────────────────────────────────────

  const loadFaqForEdit = () => {
    if (dom.adminFaqLoading) dom.adminFaqLoading.style.display = '';
    if (dom.adminFaqContent) dom.adminFaqContent.style.display = 'none';

    fetchSWR(
      'getFaq',
      (data) => { renderFaqEdit(data.faq); },
      (data) => { state.faq = data.faq; renderFaqEdit(data.faq); },
      (err) => {
        if (dom.adminFaqLoading) dom.adminFaqLoading.style.display = 'none';
        showToast('Erro ao carregar FAQ: ' + err.message, 'error');
      },
    );
  };

  /**
   * Renderiza os cards de edição do FAQ.
   * @param {Array<{ordem: number, pergunta: string, resposta: string}>} faq - Itens.
   * @returns {void}
   */
  const renderFaqEdit = (faq) => {
    if (!dom.faqEditList) return;
    state.faq = faq;

    let html = '';
    faq.forEach((item, idx) => {
      html += `
        <div class="faq-edit-card" data-idx="${idx}">
          <div class="faq-edit-field">
            <label class="faq-edit-label">Ordem</label>
            <input class="faq-edit-input faq-ordem" type="number" value="${item.ordem}" style="max-width:100px;">
          </div>
          <div class="faq-edit-field">
            <label class="faq-edit-label">Pergunta</label>
            <input class="faq-edit-input faq-pergunta" type="text" value="${escapeHtml(item.pergunta)}">
          </div>
          <div class="faq-edit-field">
            <label class="faq-edit-label">Resposta</label>
            <textarea class="faq-edit-textarea faq-resposta" rows="4">${escapeHtml(item.resposta)}</textarea>
          </div>
          <div class="faq-edit-actions">
            <button class="btn-sm btn-delete faq-delete-btn" data-idx="${idx}">Excluir</button>
            <button class="btn-sm btn-save faq-save-btn" data-idx="${idx}">Salvar</button>
          </div>
        </div>`;
    });

    dom.faqEditList.innerHTML = html;

    // Save handlers
    dom.faqEditList.querySelectorAll('.faq-save-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const idx = Number(btn.getAttribute('data-idx'));
        const card = dom.faqEditList.querySelector(`[data-idx="${idx}"]`);
        if (!card) return;

        const ordem = Number(card.querySelector('.faq-ordem').value) || idx;
        const pergunta = card.querySelector('.faq-pergunta').value.trim();
        const resposta = card.querySelector('.faq-resposta').value.trim();

        if (!pergunta || !resposta) {
          showToast('Preencha pergunta e resposta.', 'error');
          return;
        }

        btn.disabled = true;
        try {
          await adminPost('saveFaqItem', { rowIndex: idx, ordem, pergunta, resposta }, state.token);
          showToast('FAQ atualizado');
          loadFaqForEdit();
        } catch (err) {
          showToast('Erro: ' + err.message, 'error');
        } finally {
          btn.disabled = false;
        }
      });
    });

    // Delete handlers
    dom.faqEditList.querySelectorAll('.faq-delete-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const idx = Number(btn.getAttribute('data-idx'));
        const confirmed = confirm('Excluir esta pergunta do FAQ?');
        if (!confirmed) return;

        btn.disabled = true;
        try {
          await adminPost('deleteFaqItem', { rowIndex: idx }, state.token);
          showToast('FAQ removido');
          loadFaqForEdit();
        } catch (err) {
          showToast('Erro: ' + err.message, 'error');
        } finally {
          btn.disabled = false;
        }
      });
    });

    if (dom.adminFaqLoading) dom.adminFaqLoading.style.display = 'none';
    if (dom.adminFaqContent) dom.adminFaqContent.style.display = '';
  };

  // ─── Add FAQ ─────────────────────────────────────────────

  if (dom.addFaqBtn) {
    dom.addFaqBtn.addEventListener('click', async () => {
      const pergunta = prompt('Digite a pergunta:');
      if (!pergunta || !pergunta.trim()) return;

      const resposta = prompt('Digite a resposta:');
      if (!resposta || !resposta.trim()) return;

      dom.addFaqBtn.disabled = true;
      try {
        const ordem = (state.faq || []).length + 1;
        await adminPost('saveFaqItem', { ordem, pergunta: pergunta.trim(), resposta: resposta.trim() }, state.token);
        showToast('Pergunta adicionada');
        loadFaqForEdit();
      } catch (err) {
        showToast('Erro: ' + err.message, 'error');
      } finally {
        dom.addFaqBtn.disabled = false;
      }
    });
  }

  // ─── Init ────────────────────────────────────────────────

  initGoogleLogin();
})();
