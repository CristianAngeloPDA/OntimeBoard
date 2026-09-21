/**
 * OntimeBoard - Scripts e Funcionalidades
 *
 * Responsabilidades:
 * - Orquestração entre Estrutura, Dados e Gráficos
 * - Atualização do dashboard (título, subtítulo, placeholders)
 * - Escuta dos eventos disparados pela Estrutura
 *
 * 🔥 NOVO:
 * - filtro global de Tipo Dev (barra superior) — afeta gráficos E lista
 * - lista de cargas (DESCRIÇÃO DSD) abaixo dos gráficos
 * - filtros exclusivos da lista: Segmento, Sistema e Falhas
 *   (NÃO afetam os gráficos; só filtram a lista)
 * - cada grupo de filtros tem seu PRÓPRIO botão de limpar
 * - FILTROS CASCATEADOS: os selects de Montadora (global) e de
 *   Sistema (da lista) só mostram opções presentes no Ontime atual
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

      // Filtros globais (afetam gráficos + cards + lista)
      filtersBar: document.getElementById("filtersBar"),
      filterOntime: document.getElementById("filterOntime"),
      filterMontadora: document.getElementById("filterMontadora"),
      filterTipoDev: document.getElementById("filterTipoDev"),
      filterSistema: document.getElementById("filterSistema"),
      btnClearFilters: document.getElementById("btnClearFilters"),
      filtersActiveBadge: document.getElementById("filtersActiveBadge"),

      // 🔥 Filtros exclusivos da lista (NÃO afetam gráficos)
      filterSegmento: document.getElementById("filterSegmento"),
      filterListSistema: document.getElementById("filterListSistema"),
      filterFalhas: document.getElementById("filterFalhas"),
      btnClearListFilters: document.getElementById("btnClearListFilters"),

      // Lista de cargas (Descrição DSD)
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
        // 🔥 Exclusivos da lista — NÃO afetam os gráficos
        segmento: "",
        listSistema: "",
        falhas: "",
      },
    };

    /** Reseta APENAS os 4 filtros globais */
    function resetGlobalFiltersState() {
      ScriptState.filters.ontime = "";
      ScriptState.filters.montadora = "";
      ScriptState.filters.tipoDev = "";
      ScriptState.filters.sistema = "";
    }

    /** Reseta APENAS os 3 filtros exclusivos da lista */
    function resetListFiltersState() {
      ScriptState.filters.segmento = "";
      ScriptState.filters.listSistema = "";
      ScriptState.filters.falhas = "";
    }

    /** Reseta tudo (usado ao trocar de arquivo) */
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

          // Lista completa (sem filtros)
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

        item.appendChild(meta);
        fragment.appendChild(item);
      });

      container.innerHTML = "";
      container.appendChild(fragment);
    }

    // ============================================
    // 4.1 FUNÇÕES DE FILTRO
    // ============================================

    /**
     * Preenche todos os selects do dashboard.
     *
     * Ontime, Tipo Dev (global), Segmento e Falhas são preenchidos
     * com TODOS os valores do arquivo.
     *
     * Montadora (global) e Sistema (lista) NÃO são preenchidos
     * aqui — eles cascateiam do Ontime e são populados por
     * `refreshMontadoraOptions()` e `refreshListSistemaOptions()`.
     */
    function populateFilters(rawData) {
      const Dados = window.OntimeBoard.Dados;

      // ---- Ontime (todos os valores) ----
      fillSelectOptions(
        DashboardElements.filterOntime,
        Dados.getDistinctValues(rawData, "ontime"),
        "Todos",
      );

      // ---- Montadora (cascateada do Ontime) ----
      refreshMontadoraOptions();

      // ---- Tipo Dev global (todos os valores) ----
      fillSelectOptions(
        DashboardElements.filterTipoDev,
        Dados.getDistinctValues(rawData, "tipoDev"),
        "Todos",
      );

      // ---- Filtros exclusivos da lista ----
      fillSelectOptions(
        DashboardElements.filterSegmento,
        Dados.getDistinctValues(rawData, "segmento"),
        "Todos",
      );

      // Sistema da lista (cascateado do Ontime)
      refreshListSistemaOptions();

      fillSelectOptions(
        DashboardElements.filterFalhas,
        Dados.getDistinctValues(rawData, "falhas"),
        "Todas",
      );
    }

    /**
     * 🔥 FILTRO CASCATEADO — Montadora (global)
     *
     * Repopula o select de Montadora com apenas as montadoras que
     * existem no Ontime atualmente selecionado.
     *
     * Regras:
     *  - Ontime = "" (Todos) → mostra todas as montadoras do arquivo
     *  - Ontime = "JULHO"    → mostra só as montadoras que têm
     *                          pelo menos uma linha em JULHO
     *  - Se a montadora previamente selecionada não existir mais na
     *    nova lista, reseta para "Todas" (evita filtro "fantasma")
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
     * 🔥 FILTRO CASCATEADO — Sistema (exclusivo da lista)
     *
     * Repopula o select de Sistema da lista com apenas os sistemas
     * presentes no Ontime atualmente selecionado.
     *
     * Mesma lógica de `refreshMontadoraOptions()`, mas aplicada ao
     * select `filterListSistema` (que só afeta a lista).
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

    /**
     * Aplica os filtros ativos sobre o dataset completo.
     *
     * - Os 4 filtros GLOBAIS (Ontime, Montadora, TipoDev, Sistema)
     *   afetam os gráficos E a lista.
     * - Os 3 filtros EXCLUSIVOS DA LISTA (Segmento, Sistema, Falhas)
     *   afetam SOMENTE a lista.
     */
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
        falhas,
      } = ScriptState.filters;

      const sistemaNorm = normalizeText(sistema);
      const tipoDevNorm = normalizeText(tipoDev);
      const segmentoNorm = normalizeText(segmento);
      const listSistemaNorm = normalizeText(listSistema);
      const falhasNorm = normalizeText(falhas);

      // 1) Base com filtros GLOBAIS (usada pelos gráficos e como ponto
      //    de partida para a lista)
      const filteredRaw = ScriptState.allRawData.filter((r) => {
        const matchOntime = !ontime || r.ontime === ontime;
        const matchMontadora = !montadora || r.montadora === montadora;
        const matchTipoDev =
          !tipoDevNorm || normalizeText(r.tipoDev) === tipoDevNorm;
        const matchSistema =
          !sistemaNorm || normalizeText(r.sistema) === sistemaNorm;

        return matchOntime && matchMontadora && matchTipoDev && matchSistema;
      });

      // 2) Lista — aplica também os filtros exclusivos
      const listOnlyFiltered = filteredRaw.filter((r) => {
        const matchSegmento =
          !segmentoNorm || normalizeText(r.segmento) === segmentoNorm;
        const matchListSistema =
          !listSistemaNorm ||
          normalizeText(r.sistema) === listSistemaNorm;
        const matchFalhas =
          !falhasNorm || normalizeText(r.falhas) === falhasNorm;

        return matchSegmento && matchListSistema && matchFalhas;
      });

      console.log(
        `[Filtros] Globais → ${filteredRaw.length} carga(s) | ` +
          `Lista (com segmento/sistema/falhas) → ${listOnlyFiltered.length} carga(s)`,
      );

      // ---- Gráficos e cards usam a base SEM os filtros exclusivos ----
      const filteredData = Dados.processData(filteredRaw);
      ScriptState.currentData = filteredData;

      Graficos.updateStats(filteredData);
      Graficos.renderCharts(filteredData);

      // ---- Lista usa a base COM todos os filtros ----
      renderDsdList(listOnlyFiltered);

      const hasActiveFilter = !!(
        ontime ||
        montadora ||
        tipoDev ||
        sistema ||
        segmento ||
        listSistema ||
        falhas
      );
      if (DashboardElements.filtersActiveBadge) {
        DashboardElements.filtersActiveBadge.classList.toggle(
          "visible",
          hasActiveFilter,
        );
      }
    }

    /**
     * 🔥 Botão principal ("Limpar filtros" da barra superior):
     * reseta APENAS os 4 filtros globais. Os filtros exclusivos
     * da lista permanecem intactos.
     *
     * ⚠️ Também repopula as montadoras (voltam todas).
     */
    function clearGlobalFilters() {
      resetGlobalFiltersState();

      if (DashboardElements.filterOntime) {
        DashboardElements.filterOntime.value = "";
      }
      // Repopula montadoras com TODAS (Ontime = "Todos")
      refreshMontadoraOptions();

      if (DashboardElements.filterTipoDev) {
        DashboardElements.filterTipoDev.value = "";
      }
      if (DashboardElements.filterSistema) {
        DashboardElements.filterSistema.value = "";
      }

      applyFilters();
    }

    /**
     * 🔥 Botão da lista ("Limpar" ao lado dos filtros exclusivos):
     * reseta APENAS os filtros exclusivos da lista (Segmento,
     * Sistema e Falhas). Os filtros globais permanecem intactos.
     */
    function clearListFilters() {
      resetListFiltersState();

      if (DashboardElements.filterSegmento) {
        DashboardElements.filterSegmento.value = "";
      }
      if (DashboardElements.filterListSistema) {
        DashboardElements.filterListSistema.value = "";
      }
      if (DashboardElements.filterFalhas) {
        DashboardElements.filterFalhas.value = "";
      }

      applyFilters();
    }

    // ----- Listeners dos filtros globais -----

    // 🔥 Ontime: além de atualizar o filtro, repopula Montadora
    //    (global) e Sistema (da lista) — ambos cascateiam do Ontime.
    if (DashboardElements.filterOntime) {
      DashboardElements.filterOntime.addEventListener("change", function () {
        ScriptState.filters.ontime = this.value;

        // Repopula as opções cascateadas ANTES de aplicar os filtros
        refreshMontadoraOptions();
        refreshListSistemaOptions();

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

    if (DashboardElements.filterSistema) {
      DashboardElements.filterSistema.addEventListener(
        "change",
        function () {
          ScriptState.filters.sistema = this.value;
          applyFilters();
        },
      );
    }

    // ----- 🔥 Listeners dos filtros exclusivos da lista -----

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
          ScriptState.filters.listSistema = this.value;
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

    // ----- Botão "Limpar filtros" (globais) -----
    if (DashboardElements.btnClearFilters) {
      DashboardElements.btnClearFilters.addEventListener(
        "click",
        function (e) {
          e.preventDefault();
          clearGlobalFilters();
        },
      );
    }

    // ----- 🔥 Botão "Limpar" (filtros da lista) -----
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