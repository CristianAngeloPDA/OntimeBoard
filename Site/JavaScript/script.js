/**
 * OntimeBoard - Scripts e Funcionalidades
 *
 * Responsabilidades:
 * - Orquestração entre Estrutura, Dados e Gráficos
 * - Atualização do dashboard (título, subtítulo, placeholders)
 * - Escuta dos eventos disparados pela Estrutura
 *
 * Recursos:
 * - filtro global de Tipo Dev (barra superior) — afeta gráficos E lista
 * - lista de cargas (DESCRIÇÃO DSD) abaixo dos gráficos
 * - filtros exclusivos da lista: Segmento, Sistema, Lançada e Falhas
 *   (NÃO afetam os gráficos; só filtram a lista)
 * - cada grupo de filtros tem seu PRÓPRIO botão de limpar
 * - FILTROS CASCATEADOS: os selects de Montadora (global) e de
 *   Sistema (da lista) só mostram opções presentes no Ontime atual
 * - etiqueta "Lançada" / "Não Lançada" em cada carga da lista
 * - CONFLITO DE SISTEMA: quando o Sistema global estiver ativo,
 *   o Sistema da lista é desabilitado (evita redundância)
 */

(function () {
  "use strict";

  console.log("⚡ OntimeBoard - Scripts carregados");
  console.log("SheetJS:", typeof XLSX);

  // ============================================
  // 1. REFERÊNCIAS DA ESTRUTURA
  // ============================================

  function waitForEstrutura(callback) {
    if (window.OntimeBoard && window.OntimeBoard.Estrutura) {
      callback(window.OntimeBoard.Estrutura);
    } else {
      setTimeout(() => waitForEstrutura(callback), 100);
    }
  }

  waitForEstrutura(function (Estrutura) {
    console.log("📦 Estrutura encontrada, inicializando scripts...");

    const DOM = Estrutura.getDOM();

    // ============================================
    // 1.1 UTILITÁRIO: normalização de texto
    // ============================================

    function normalizeText(value) {
      return String(value || "")
        .trim()
        .toUpperCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
    }

    // ============================================
    // 2. REFERÊNCIAS DOS ELEMENTOS DO DASHBOARD
    // ============================================

    const DashboardElements = {
      // Stats (5 cards)
      totalSales: document.getElementById("totalSales"),
      totalRevenue: document.getElementById("totalRevenue"),
      averageSale: document.getElementById("averageSale"),
      buscasAutomaticas: document.getElementById("buscasAutomaticas"),
      reprovadas: document.getElementById("reprovadas"),

      // Canvas dos gráficos
      barChart: document.getElementById("barChart"),
      pieChart: document.getElementById("pieChart"),
      lineChart: document.getElementById("lineChart"),

      // Placeholders
      barPlaceholder: document.getElementById("barPlaceholder"),
      piePlaceholder: document.getElementById("piePlaceholder"),
      linePlaceholder: document.getElementById("linePlaceholder"),

      // Títulos
      dashboardTitle: DOM.dashboardTitle,
      dashboardSubtitle: DOM.dashboardSubtitle,

      // Filtros globais
      filtersBar: document.getElementById("filtersBar"),
      filterOntime: document.getElementById("filterOntime"),
      filterMontadora: document.getElementById("filterMontadora"),
      filterTipoDev: document.getElementById("filterTipoDev"),
      filterSistema: document.getElementById("filterSistema"),
      btnClearFilters: document.getElementById("btnClearFilters"),
      filtersActiveBadge: document.getElementById("filtersActiveBadge"),

      // Filtros exclusivos da lista
      filterSegmento: document.getElementById("filterSegmento"),
      filterListSistema: document.getElementById("filterListSistema"),
      filterLancada: document.getElementById("filterLancada"),
      filterFalhas: document.getElementById("filterFalhas"),
      btnClearListFilters: document.getElementById("btnClearListFilters"),

      // Lista de cargas
      dsdListContainer: document.getElementById("dsdListContainer"),
      dsdListCount: document.getElementById("dsdListCount"),
      dsdListSubtitle: document.getElementById("dsdListSubtitle"),
    };

    // ============================================
    // 3. ESTADO DOS SCRIPTS
    // ============================================

    const ScriptState = {
      currentData: null,
      isProcessing: false,
      allRawData: [],
      filters: {
        // Globais — afetam gráficos e lista
        ontime: "",
        montadora: "",
        tipoDev: "",
        sistema: "",
        // Exclusivos da lista — NÃO afetam os gráficos
        segmento: "",
        listSistema: "",
        lancada: "",
        falhas: "",
      },
    };

    function resetGlobalFiltersState() {
      ScriptState.filters.ontime = "";
      ScriptState.filters.montadora = "";
      ScriptState.filters.tipoDev = "";
      ScriptState.filters.sistema = "";
    }

    function resetListFiltersState() {
      ScriptState.filters.segmento = "";
      ScriptState.filters.listSistema = "";
      ScriptState.filters.lancada = "";
      ScriptState.filters.falhas = "";
    }

    function resetAllFiltersState() {
      resetGlobalFiltersState();
      resetListFiltersState();
    }

    // ============================================
    // 4. FUNÇÕES DO DASHBOARD
    // ============================================

    function updateDashboardForFile(index) {
      const state = Estrutura.getState();
      if (index < 0 || index >= state.uploadedFiles.length) {
        console.log("[Dashboard] Nenhum arquivo selecionado");
        return;
      }

      const fileData = state.uploadedFiles[index];
      console.log(`[Dashboard] Atualizando para: ${fileData.name}`);

      if (DashboardElements.dashboardTitle) {
        DashboardElements.dashboardTitle.textContent = `📊 ${fileData.name}`;
      }
      if (DashboardElements.dashboardSubtitle) {
        DashboardElements.dashboardSubtitle.textContent = `Carregado em ${new Date().toLocaleString()} • ${(fileData.size / 1024).toFixed(1)} KB`;
      }

      showLoadingState();

      const Dados = window.OntimeBoard && window.OntimeBoard.Dados;
      const Graficos = window.OntimeBoard && window.OntimeBoard.Graficos;

      if (!Dados || !Graficos) {
        console.error(
          "[Dashboard] Módulos Dados/Graficos não encontrados. Verifique a ordem dos <script> no HTML.",
        );
        return;
      }

      ScriptState.isProcessing = true;

      Dados.processExcelFile(fileData)
        .then((processedData) => {
          ScriptState.allRawData = processedData.raw;
          resetAllFiltersState();

          populateFilters(ScriptState.allRawData);
          showFiltersBar();

          ScriptState.currentData = processedData;
          Graficos.updateStats(processedData);
          Graficos.renderCharts(processedData);

          renderDsdList(ScriptState.allRawData);

          console.log("[Dashboard] Gráficos renderizados com sucesso");
        })
        .catch((error) => {
          console.error("[Dashboard] Erro ao processar arquivo:", error);
          alert(
            `Não foi possível processar "${fileData.name}".\n\n${error.message || "Verifique se o arquivo segue o layout esperado."}`,
          );
          showPlaceholders(fileData.name);
          resetStats();
          hideFiltersBar();
          renderDsdList([]);
        })
        .finally(() => {
          ScriptState.isProcessing = false;
        });
    }

    // ============================================
    // 4.0.1 LISTA DE CARGAS (DESCRIÇÃO DSD)
    // ============================================

    function renderDsdList(rawData) {
      const container = DashboardElements.dsdListContainer;
      const countEl = DashboardElements.dsdListCount;
      const subtitleEl = DashboardElements.dsdListSubtitle;
      if (!container) return;

      const items = Array.isArray(rawData) ? rawData : [];

      if (countEl) countEl.textContent = items.length;

      if (subtitleEl) {
        subtitleEl.textContent = items.length
          ? `${items.length} carga${items.length !== 1 ? "s" : ""} encontrada${items.length !== 1 ? "s" : ""}`
          : "Nenhuma carga corresponde aos filtros aplicados";
      }

      if (items.length === 0) {
        container.innerHTML = `
          <div class="dsd-list-empty">
            <i class="fas fa-inbox"></i>
            <p>Nenhuma carga encontrada com os filtros atuais</p>
          </div>
        `;
        return;
      }

      const fragment = document.createDocumentFragment();

      items.forEach((row) => {
        const item = document.createElement("div");
        item.className = "dsd-list-item";

        const desc = document.createElement("div");
        desc.className = "dsd-list-item-desc";
        desc.textContent = row.descricao || "(sem descrição)";
        item.appendChild(desc);

        const meta = document.createElement("div");
        meta.className = "dsd-list-item-meta";

        const addBadge = (text, cls, icon) => {
          if (!text || text === "\\N") return;
          const b = document.createElement("span");
          b.className = "dsd-badge" + (cls ? " " + cls : "");
          if (icon) {
            const i = document.createElement("i");
            i.className = "fas " + icon;
            b.appendChild(i);
          }
          b.appendChild(document.createTextNode(text));
          meta.appendChild(b);
        };

        addBadge(row.tipoDev, "tipo", "fa-tag");
        addBadge(row.segmento, "segmento", "fa-layer-group");
        addBadge(row.montadora, "montadora", "fa-industry");
        addBadge(row.sistema, "sistema", "fa-cogs");
        addBadge(row.ontime, "ontime", "fa-calendar-alt");

        const falha = (row.falhas || "").toString().trim();
        if (falha && falha !== "\\N") {
          let cls = "falha-SF";
          if (falha === "CF=1") cls = "falha-CF1";
          else if (falha === "CF>1") cls = "falha-CFgt1";
          addBadge(falha, cls, "fa-exclamation-triangle");
        }

        // Etiqueta "Lançada" / "Não Lançada"
        const lancada = (row.lancada || "").toString().trim();
        if (lancada && lancada !== "\\N") {
          const norm = normalizeText(lancada);
          if (norm === "LANCADA") {
            addBadge(lancada, "lancada-sim", "fa-check-circle");
          } else if (norm === "NAO LANCADA") {
            addBadge(lancada, "lancada-nao", "fa-times-circle");
          } else {
            addBadge(lancada, "lancada-outro", "fa-upload");
          }
        }

        item.appendChild(meta);
        fragment.appendChild(item);
      });

      container.innerHTML = "";
      container.appendChild(fragment);
    }

    // ============================================
    // 4.1 FUNÇÕES DE FILTRO
    // ============================================

    function populateFilters(rawData) {
      const Dados = window.OntimeBoard.Dados;

      fillSelectOptions(
        DashboardElements.filterOntime,
        Dados.getDistinctValues(rawData, "ontime"),
        "Todos",
      );

      refreshMontadoraOptions();

      fillSelectOptions(
        DashboardElements.filterTipoDev,
        Dados.getDistinctValues(rawData, "tipoDev"),
        "Todos",
      );

      fillSelectOptions(
        DashboardElements.filterSegmento,
        Dados.getDistinctValues(rawData, "segmento"),
        "Todos",
      );

      refreshListSistemaOptions();

      fillSelectOptions(
        DashboardElements.filterLancada,
        Dados.getDistinctValues(rawData, "lancada"),
        "Todas",
      );

      fillSelectOptions(
        DashboardElements.filterFalhas,
        Dados.getDistinctValues(rawData, "falhas"),
        "Todas",
      );

      // Sincroniza o estado do select da lista (enabled/disabled)
      syncListSistemaDisabledState();
    }

    /**
     * Filtro cascateado — Montadora (global).
     */
    function refreshMontadoraOptions() {
      const Dados = window.OntimeBoard && window.OntimeBoard.Dados;
      if (!Dados || !DashboardElements.filterMontadora) return;

      const ontimeAtual = ScriptState.filters.ontime;

      const base = ontimeAtual
        ? ScriptState.allRawData.filter((r) => r.ontime === ontimeAtual)
        : ScriptState.allRawData;

      const montadoras = Dados.getDistinctValues(base, "montadora");
      const montadoraAtual = ScriptState.filters.montadora;

      fillSelectOptions(
        DashboardElements.filterMontadora,
        montadoras,
        "Todas",
      );

      if (montadoraAtual && montadoras.includes(montadoraAtual)) {
        DashboardElements.filterMontadora.value = montadoraAtual;
      } else {
        DashboardElements.filterMontadora.value = "";
        ScriptState.filters.montadora = "";
      }
    }

    /**
     * Filtro cascateado — Sistema (exclusivo da lista).
     */
    function refreshListSistemaOptions() {
      const Dados = window.OntimeBoard && window.OntimeBoard.Dados;
      if (!Dados || !DashboardElements.filterListSistema) return;

      const ontimeAtual = ScriptState.filters.ontime;

      const base = ontimeAtual
        ? ScriptState.allRawData.filter((r) => r.ontime === ontimeAtual)
        : ScriptState.allRawData;

      const sistemas = Dados.getDistinctValues(base, "sistema");
      const sistemaAtual = ScriptState.filters.listSistema;

      fillSelectOptions(
        DashboardElements.filterListSistema,
        sistemas,
        "Todos",
      );

      if (sistemaAtual && sistemas.includes(sistemaAtual)) {
        DashboardElements.filterListSistema.value = sistemaAtual;
      } else {
        DashboardElements.filterListSistema.value = "";
        ScriptState.filters.listSistema = "";
      }
    }

    /**
     * Sincroniza o estado do filtro "Sistema" da lista com o
     * filtro "Sistema" global.
     *
     * Regra: se o Sistema global estiver ativo, o Sistema da lista
     * é desabilitado e seu valor resetado (o global sobrepõe).
     */
    function syncListSistemaDisabledState() {
      const el = DashboardElements.filterListSistema;
      if (!el) return;

      const globalSistemaAtivo = !!ScriptState.filters.sistema;

      if (globalSistemaAtivo) {
        // Reseta o valor do filtro da lista e desabilita
        if (ScriptState.filters.listSistema) {
          ScriptState.filters.listSistema = "";
        }
        el.value = "";
        el.disabled = true;
        el.title =
          "Desabilitado — o filtro de Sistema da barra superior já está ativo";
      } else {
        el.disabled = false;
        el.title = "";
      }
    }

    function fillSelectOptions(selectEl, values, allLabel) {
      if (!selectEl) return;

      selectEl.innerHTML = "";

      const allOption = document.createElement("option");
      allOption.value = "";
      allOption.textContent = allLabel;
      selectEl.appendChild(allOption);

      values.forEach((value) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = value;
        selectEl.appendChild(option);
      });
    }

    function showFiltersBar() {
      if (DashboardElements.filtersBar) {
        DashboardElements.filtersBar.classList.add("visible");
      }
    }

    function hideFiltersBar() {
      if (DashboardElements.filtersBar) {
        DashboardElements.filtersBar.classList.remove("visible");
      }
    }

    function applyFilters() {
      const Dados = window.OntimeBoard.Dados;
      const Graficos = window.OntimeBoard.Graficos;
      if (!Dados || !Graficos) return;

      const {
        ontime,
        montadora,
        tipoDev,
        sistema,
        segmento,
        listSistema,
        lancada,
        falhas,
      } = ScriptState.filters;

      const sistemaNorm = normalizeText(sistema);
      const tipoDevNorm = normalizeText(tipoDev);
      const segmentoNorm = normalizeText(segmento);
      const listSistemaNorm = normalizeText(listSistema);
      const lancadaNorm = normalizeText(lancada);
      const falhasNorm = normalizeText(falhas);

      // Base com filtros globais
      const filteredRaw = ScriptState.allRawData.filter((r) => {
        const matchOntime = !ontime || r.ontime === ontime;
        const matchMontadora = !montadora || r.montadora === montadora;
        const matchTipoDev =
          !tipoDevNorm || normalizeText(r.tipoDev) === tipoDevNorm;
        const matchSistema =
          !sistemaNorm || normalizeText(r.sistema) === sistemaNorm;

        return matchOntime && matchMontadora && matchTipoDev && matchSistema;
      });

      // Lista — aplica filtros exclusivos também
      const listOnlyFiltered = filteredRaw.filter((r) => {
        const matchSegmento =
          !segmentoNorm || normalizeText(r.segmento) === segmentoNorm;
        const matchListSistema =
          !listSistemaNorm ||
          normalizeText(r.sistema) === listSistemaNorm;
        const matchLancada =
          !lancadaNorm || normalizeText(r.lancada) === lancadaNorm;
        const matchFalhas =
          !falhasNorm || normalizeText(r.falhas) === falhasNorm;

        return (
          matchSegmento &&
          matchListSistema &&
          matchLancada &&
          matchFalhas
        );
      });

      console.log(
        `[Filtros] Globais → ${filteredRaw.length} carga(s) | ` +
          `Lista → ${listOnlyFiltered.length} carga(s)`,
      );

      const filteredData = Dados.processData(filteredRaw);
      ScriptState.currentData = filteredData;

      Graficos.updateStats(filteredData);
      Graficos.renderCharts(filteredData);

      renderDsdList(listOnlyFiltered);

      const hasActiveFilter = !!(
        ontime ||
        montadora ||
        tipoDev ||
        sistema ||
        segmento ||
        listSistema ||
        lancada ||
        falhas
      );
      if (DashboardElements.filtersActiveBadge) {
        DashboardElements.filtersActiveBadge.classList.toggle(
          "visible",
          hasActiveFilter,
        );
      }
    }

    function clearGlobalFilters() {
      resetGlobalFiltersState();

      if (DashboardElements.filterOntime) {
        DashboardElements.filterOntime.value = "";
      }
      refreshMontadoraOptions();

      if (DashboardElements.filterTipoDev) {
        DashboardElements.filterTipoDev.value = "";
      }
      if (DashboardElements.filterSistema) {
        DashboardElements.filterSistema.value = "";
      }

      // Reabilita o filtro de Sistema da lista (global foi limpo)
      syncListSistemaDisabledState();

      applyFilters();
    }

    function clearListFilters() {
      resetListFiltersState();

      if (DashboardElements.filterSegmento) {
        DashboardElements.filterSegmento.value = "";
      }
      // Só limpa/atualiza o Sistema da lista se não estiver desabilitado
      if (DashboardElements.filterListSistema) {
        if (!DashboardElements.filterListSistema.disabled) {
          DashboardElements.filterListSistema.value = "";
        }
      }
      if (DashboardElements.filterLancada) {
        DashboardElements.filterLancada.value = "";
      }
      if (DashboardElements.filterFalhas) {
        DashboardElements.filterFalhas.value = "";
      }

      applyFilters();
    }

    // ----- Listeners dos filtros globais -----

    if (DashboardElements.filterOntime) {
      DashboardElements.filterOntime.addEventListener("change", function () {
        ScriptState.filters.ontime = this.value;
        refreshMontadoraOptions();
        refreshListSistemaOptions();
        syncListSistemaDisabledState();
        applyFilters();
      });
    }

    if (DashboardElements.filterMontadora) {
      DashboardElements.filterMontadora.addEventListener(
        "change",
        function () {
          ScriptState.filters.montadora = this.value;
          applyFilters();
        },
      );
    }

    if (DashboardElements.filterTipoDev) {
      DashboardElements.filterTipoDev.addEventListener(
        "change",
        function () {
          ScriptState.filters.tipoDev = this.value;
          applyFilters();
        },
      );
    }

    // Sistema global: ao mudar, o filtro da lista é
    // desabilitado/resetado ou reabilitado
    if (DashboardElements.filterSistema) {
      DashboardElements.filterSistema.addEventListener(
        "change",
        function () {
          ScriptState.filters.sistema = this.value;
          syncListSistemaDisabledState();
          applyFilters();
        },
      );
    }

    // ----- Listeners dos filtros exclusivos da lista -----

    if (DashboardElements.filterSegmento) {
      DashboardElements.filterSegmento.addEventListener(
        "change",
        function () {
          ScriptState.filters.segmento = this.value;
          applyFilters();
        },
      );
    }

    if (DashboardElements.filterListSistema) {
      DashboardElements.filterListSistema.addEventListener(
        "change",
        function () {
          // Se estiver desabilitado, não faz nada (defensivo)
          if (this.disabled) return;
          ScriptState.filters.listSistema = this.value;
          applyFilters();
        },
      );
    }

    if (DashboardElements.filterLancada) {
      DashboardElements.filterLancada.addEventListener(
        "change",
        function () {
          ScriptState.filters.lancada = this.value;
          applyFilters();
        },
      );
    }

    if (DashboardElements.filterFalhas) {
      DashboardElements.filterFalhas.addEventListener(
        "change",
        function () {
          ScriptState.filters.falhas = this.value;
          applyFilters();
        },
      );
    }

    if (DashboardElements.btnClearFilters) {
      DashboardElements.btnClearFilters.addEventListener(
        "click",
        function (e) {
          e.preventDefault();
          clearGlobalFilters();
        },
      );
    }

    if (DashboardElements.btnClearListFilters) {
      DashboardElements.btnClearListFilters.addEventListener(
        "click",
        function (e) {
          e.preventDefault();
          clearListFilters();
        },
      );
    }

    // ============================================
    // 4.2 FUNÇÕES DE UI
    // ============================================

    function showLoadingState() {
      const placeholders = document.querySelectorAll(".chart-placeholder");
      placeholders.forEach((placeholder) => {
        const p = placeholder.querySelector("p");
        const span = placeholder.querySelector("span");
        if (p) p.textContent = "Processando planilha...";
        if (span) span.textContent = "Isso leva apenas alguns instantes";
      });

      document.querySelectorAll(".chart-container").forEach((c) => {
        c.classList.remove("has-data");
      });

      hideFiltersBar();
      renderDsdList([]);
    }

    function showPlaceholders(fileName) {
      const placeholders = document.querySelectorAll(".chart-placeholder");
      placeholders.forEach((placeholder) => {
        const p = placeholder.querySelector("p");
        const span = placeholder.querySelector("span");
        if (p) p.textContent = `Aguardando dados de: ${fileName}`;
        if (span)
          span.textContent = "Processe o arquivo para visualizar os gráficos";
      });
    }

    function resetStats() {
      const stats = [
        DashboardElements.totalSales,
        DashboardElements.totalRevenue,
        DashboardElements.averageSale,
        DashboardElements.buscasAutomaticas,
        DashboardElements.reprovadas,
      ];

      stats.forEach((el) => {
        if (el) {
          el.textContent = "—";
          el.className = "stat-value empty";
        }
      });
    }

    // ============================================
    // 5. EVENT LISTENERS DOS SCRIPTS
    // ============================================

    document.addEventListener("fileSelected", function (e) {
      console.log("[Evento] Arquivo selecionado:", e.detail.file.name);
      updateDashboardForFile(e.detail.index);
    });

    document.addEventListener("fileUploaded", function (e) {
      console.log("[Evento] Arquivo enviado:", e.detail.file.name);
    });

    document.addEventListener("deleteFile", function (e) {
      console.log("[Evento] Excluindo arquivo:", e.detail.fileId);
    });

    // ============================================
    // 6. EXPOSIÇÃO DA API DE SCRIPTS
    // ============================================

    const ScriptsAPI = {
      updateDashboardForFile,
      showPlaceholders,
      resetStats,
      renderDsdList,

      getState: () => ({ ...ScriptState }),

      init: function () {
        console.log("✅ Scripts inicializados");
        return this;
      },
    };

    // ============================================
    // 7. EXPOSIÇÃO GLOBAL
    // ============================================

    window.OntimeBoard = window.OntimeBoard || {};
    window.OntimeBoard.Scripts = ScriptsAPI;

    ScriptsAPI.init();

    console.log("✅ OntimeBoard - Scripts finalizados!");
    console.log("📌 Use OntimeBoard.Scripts para acessar a API.");
    console.log(
      "📌 Use OntimeBoard.Estrutura para acessar a API de estrutura.",
    );
  });
})();