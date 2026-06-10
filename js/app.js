/**
 * @file app.js
 * @description Lógica principal do site público.
 *              Renderiza tabela de serviços e FAQ a partir da API.
 *              Toggle de tema dark/light persistido em localStorage.
 */

/* eslint-disable no-undef */

(() => {
  'use strict';

  // ─── DOM refs ────────────────────────────────────────────

  /** @type {Object<string, HTMLElement|null>} */
  const dom = {
    themeToggle: document.getElementById('themeToggle'),
    themeIcon: document.getElementById('themeIcon'),
    tabelaLoading: document.getElementById('tabelaLoading'),
    tabelaError: document.getElementById('tabelaError'),
    tabelaErrorMsg: document.getElementById('tabelaErrorMsg'),
    tabelaRetry: document.getElementById('tabelaRetry'),
    tabelaContent: document.getElementById('tabelaContent'),
    tableHead: document.getElementById('tableHead'),
    tableBody: document.getElementById('tableBody'),
    scrollHint: document.getElementById('scrollHint'),
    faqLoading: document.getElementById('faqLoading'),
    faqError: document.getElementById('faqError'),
    faqErrorMsg: document.getElementById('faqErrorMsg'),
    faqRetry: document.getElementById('faqRetry'),
    faqList: document.getElementById('faqList'),
  };

  // ─── Tema ────────────────────────────────────────────────

  const THEME_KEY = 'mediquo-theme';
  const ICON_SUN = '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>';
  const ICON_MOON = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';

  /**
   * Aplica o tema e atualiza o ícone.
   * @param {'dark'|'light'} theme - Tema a aplicar.
   * @returns {void}
   */
  const applyTheme = (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    if (dom.themeIcon) {
      dom.themeIcon.innerHTML = theme === 'dark' ? ICON_SUN : ICON_MOON;
    }
  };

  /**
   * Inicializa o tema a partir do localStorage ou preferência do sistema.
   * @returns {void}
   */
  const initTheme = () => {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark') {
      applyTheme(saved);
      return;
    }

    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(prefersDark ? 'dark' : 'light');
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

  // ─── Helpers ─────────────────────────────────────────────

  /**
   * Escapa HTML para prevenir XSS ao inserir conteúdo dinâmico.
   * @param {string} str - String a escapar.
   * @returns {string} String segura para innerHTML.
   */
  const escapeHtml = (str) => {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  };

  /**
   * Formata o valor de uma célula da tabela.
   * "Sim" e "Não" viram badges coloridos.
   * @param {string} value - Valor da célula.
   * @returns {string} HTML formatado.
   */
  const formatCellValue = (value) => {
    const lower = value.toLowerCase().trim();
    if (lower === 'sim') return '<span class="badge badge-sim">Sim</span>';
    if (lower === 'não' || lower === 'nao') return '<span class="badge badge-nao">Não</span>';
    return escapeHtml(value);
  };

  // ─── Renderização: Tabela ────────────────────────────────

  /**
   * Renderiza a tabela de serviços no DOM.
   * @param {Object} data - Dados da tabela retornados pela API.
   * @param {string[]} data.headerPlantao - Headers do grupo Plantão.
   * @param {string[]} data.headerAgendamento - Headers do grupo Agendamento.
   * @param {Array<{campo: string, servicos: Object<string, string>}>} data.tabela - Linhas.
   * @returns {void}
   */
  const renderTabela = (data) => {
    if (!dom.tableHead || !dom.tableBody) return;

    const { headerPlantao, headerAgendamento, tabela } = data;
    const allHeaders = [...headerPlantao, ...headerAgendamento];

    // Grupo headers
    let groupRow = '<tr><th class="group-header"></th>';
    if (headerPlantao.length > 0) {
      groupRow += `<th class="group-header" colspan="${headerPlantao.length}">Plantão</th>`;
    }
    if (headerAgendamento.length > 0) {
      groupRow += `<th class="group-header" colspan="${headerAgendamento.length}">Agendamento</th>`;
    }
    groupRow += '</tr>';

    // Service headers
    let headerRow = '<tr><th></th>';
    allHeaders.forEach((h) => {
      headerRow += `<th>${escapeHtml(h)}</th>`;
    });
    headerRow += '</tr>';

    dom.tableHead.innerHTML = groupRow + headerRow;

    // Body
    let bodyHtml = '';
    tabela.forEach((row) => {
      bodyHtml += '<tr>';
      bodyHtml += `<td>${escapeHtml(row.campo)}</td>`;
      allHeaders.forEach((h) => {
        const val = row.servicos[h] || '';
        bodyHtml += `<td>${formatCellValue(val)}</td>`;
      });
      bodyHtml += '</tr>';
    });

    dom.tableBody.innerHTML = bodyHtml;

    // Show/hide
    if (dom.tabelaLoading) dom.tabelaLoading.style.display = 'none';
    if (dom.tabelaError) dom.tabelaError.style.display = 'none';
    if (dom.tabelaContent) dom.tabelaContent.style.display = '';

    // Scroll hint: show only if table overflows
    if (dom.scrollHint) {
      const wrapper = dom.tabelaContent.querySelector('.table-wrapper');
      if (wrapper && wrapper.scrollWidth > wrapper.clientWidth) {
        dom.scrollHint.style.display = 'flex';
      } else {
        dom.scrollHint.style.display = 'none';
      }
    }
  };

  // ─── Renderização: FAQ ───────────────────────────────────

  /**
   * Renderiza os itens de FAQ como accordion (<details>).
   * @param {Array<{ordem: number, pergunta: string, resposta: string}>} faq - Itens.
   * @returns {void}
   */
  const renderFaq = (faq) => {
    if (!dom.faqList) return;

    const chevronSvg = '<svg class="faq-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';

    let html = '';
    faq.forEach((item) => {
      html += `<details class="faq-item">
        <summary class="faq-question">
          <span>${escapeHtml(item.pergunta)}</span>
          ${chevronSvg}
        </summary>
        <div class="faq-answer">${escapeHtml(item.resposta)}</div>
      </details>`;
    });

    dom.faqList.innerHTML = html;

    // Show/hide
    if (dom.faqLoading) dom.faqLoading.style.display = 'none';
    if (dom.faqError) dom.faqError.style.display = 'none';
    dom.faqList.style.display = '';
  };

  // ─── Estado de erro ──────────────────────────────────────

  /**
   * Mostra o estado de erro para a tabela.
   * @param {string} msg - Mensagem de erro segura.
   * @returns {void}
   */
  const showTabelaError = (msg) => {
    if (dom.tabelaLoading) dom.tabelaLoading.style.display = 'none';
    if (dom.tabelaContent) dom.tabelaContent.style.display = 'none';
    if (dom.tabelaErrorMsg) dom.tabelaErrorMsg.textContent = msg;
    if (dom.tabelaError) dom.tabelaError.style.display = '';
  };

  /**
   * Mostra o estado de erro para o FAQ.
   * @param {string} msg - Mensagem de erro segura.
   * @returns {void}
   */
  const showFaqError = (msg) => {
    if (dom.faqLoading) dom.faqLoading.style.display = 'none';
    if (dom.faqList) dom.faqList.style.display = 'none';
    if (dom.faqErrorMsg) dom.faqErrorMsg.textContent = msg;
    if (dom.faqError) dom.faqError.style.display = '';
  };

  // ─── Carregamento ────────────────────────────────────────

  /**
   * Carrega todos os dados do site via SWR.
   * @returns {void}
   */
  const loadData = () => {
    if (dom.tabelaLoading) dom.tabelaLoading.style.display = '';
    if (dom.tabelaError) dom.tabelaError.style.display = 'none';
    if (dom.faqLoading) dom.faqLoading.style.display = '';
    if (dom.faqError) dom.faqError.style.display = 'none';

    fetchSWR(
      'getData',
      (data) => {
        renderTabela(data);
        renderFaq(data.faq);
      },
      (data) => {
        renderTabela(data);
        renderFaq(data.faq);
      },
      (err) => {
        const msg = 'Não foi possível carregar os dados. Verifique sua conexão.';
        showTabelaError(msg);
        showFaqError(msg);
        console.error('[app] Erro ao carregar dados:', err.message);
      },
    );
  };

  // ─── Event Listeners ─────────────────────────────────────

  if (dom.tabelaRetry) {
    dom.tabelaRetry.addEventListener('click', loadData);
  }
  if (dom.faqRetry) {
    dom.faqRetry.addEventListener('click', loadData);
  }

  // ─── Init ────────────────────────────────────────────────

  loadData();
})();
