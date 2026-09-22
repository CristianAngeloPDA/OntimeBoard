/**
 * OntimeBoard - Main Scripts
 *
 * Recursos:
 * - filtros globais + filtros exclusivos da lista
 * - filtros cascateados (Montadora depende de Ontime + Tipo Dev)
 * - etiqueta "Lançada" / "Não Lançada" e "Não informado" (falhas = \N)
 * - cliques na legenda dos gráficos de pizza filtram TODOS os gráficos,
 *   cards e lista DSD (comportamento de filtro global)
 * - Se TODAS as fatias de um gráfico forem ocultadas → mostra "sem
 *   resultados" em todos os gráficos
 * - Botões "Limpar filtros" / "Limpar" RESTAURAM os itens ocultados
 *   clicando na legenda
 */

(function () {
  "use strict";

  console.log("⚡ OntimeBoard - Scripts carregados");
  console.log("SheetJS:", typeof XLSX);

  // ============================================
  // 0. ESTADO DOS ITENS ESCONDIDOS NOS GRÁFICOS
  // ============================================

  /**
   * Valores ocultados clicando na legenda de cada gráfico.
   *
   * Esses valores são aplicados como filtro em:
   *   - Cards
   *   - Gráficos que não sejam o próprio (ex.: ocultar em Tipo Dev
   *     afeta o gráfico de Segmento e o de Falhas, mas NÃO o de Tipo Dev
   *     — que precisa manter a fatia para mostrar o strikethrough)
   *   - Lista DSD
   */
  const hiddenChartValues = {
    pieChart: new Set(),
    lineChart: new Set(),
  };

  function resetHiddenChartValues() {
    hiddenChartValues.pieChart.clear();
    hiddenChartValues.lineChart.clear();
  }

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
      totalSales: document.getElementById("totalSales"),
      totalRevenue: document.getElementById("totalRevenue"),
      averageSale: document.getElementById("averageSale"),
      buscasAutomaticas: document.getElementById("buscasAutomaticas"),
      reprovadas: document.getElementById("reprovadas"),

      barChart: document.getElementById("barChart"),
      pieChart: document.getElementById("pieChart"),
      lineChart: document.getElementById("lineChart"),

      barPlaceholder: document.getElementById("barPlaceholder"),
      piePlaceholder: document.getElementById("piePlaceholder"),
      linePlaceholder: document.getElementById("linePlaceholder"),

      dashboardTitle: DOM.dashboardTitle,
      dashboardSubtitle: DOM.dashboardSubtitle,

      filtersBar: document.getElementById("filtersBar"),
      filterOntime: document.getElementById("filterOntime"),
      filterTipoDev: document.getElementById("filterTipoDev"),
      filterMontadora: document.getElementById("filterMontadora"),
      filterSistema: document.getElementById("filterSistema"),
      btnClearFilters: document.getElementById("btnClearFilters"),
      filtersActiveBadge: document.getElementById("filtersActiveBadge"),

      filterSegmento: document.getElementById("filterSegmento"),
      filterListSistema: document.getElementById("filterListSistema"),
      filterLancada: document.getElementById("filterLancada"),
      filterFalhas: document.getElementById("filterFalhas"),
      btnClearListFilters: document.getElementById("btnClearListFilters"),

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
      /** Dataset após aplicar APENAS os filtros de select (não os da legenda) */
      filteredBySelects: [],
      filters: {
        ontime: "",
        tipoDev: "",
        montadora: "",
        sistema: "",
        segmento: "",
        listSistema: "",
        lancada: "",
        falhas: "",
      },
    };

    function resetGlobalFiltersState() {
      ScriptState.filters.ontime = "";
      ScriptState.filters.tipoDev = "";
      ScriptState.filters.montadora = "";
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

      resetHiddenChartValues();

      Dados.processExcelFile(fileData)
        .then((processedData) => {
          ScriptState.allRawData = processedData.raw;
          resetAllFiltersState();

          populateFilters(ScriptState.allRawData);
          showFiltersBar();

          // Aplica todos os filtros (nenhum ativo no início)
          applyFilters();

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
          if (!text) return;
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

        // Falhas — com tratamento especial para "\N"
        const falha = (row.falhas || "").toString().trim();
        if (falha && falha !== "\\N") {
          let cls = "falha-SF";
          if (falha === "CF=1") cls = "falha-CF1";
          else if (falha === "CF>1") cls = "falha-CFgt1";
          addBadge(falha, cls, "fa-exclamation-triangle");
        } else {
          addBadge("Não informado", "falha-vazio", "fa-exclamation-triangle");
        }

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

      fillSelectOptions(
        DashboardElements.filterTipoDev,
        Dados.getDistinctValues(rawData, "tipoDev"),
        "Todos",
      );

      refreshMontadoraOptions();

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

      syncListSistemaDisabledState();
    }

    function refreshMontadoraOptions() {
      const Dados = window.OntimeBoard && window.OntimeBoard.Dados;
      if (!Dados || !DashboardElements.filterMontadora) return;

      const ontimeAtual = ScriptState.filters.ontime;
      const tipoDevAtual = ScriptState.filters.tipoDev;
      const tipoDevNorm = normalizeText(tipoDevAtual);

      const base = ScriptState.allRawData.filter((r) => {
        const matchOntime = !ontimeAtual || r.ontime === ontimeAtual;
        const matchTipoDev =
          !tipoDevNorm || normalizeText(r.tipoDev) === tipoDevNorm;
        return matchOntime && matchTipoDev;
      });

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

    function syncListSistemaDisabledState() {
      const el = DashboardElements.filterListSistema;
      if (!el) return;

      const globalSistemaAtivo = !!ScriptState.filters.sistema;

      if (globalSistemaAtivo) {
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

    /**
     * Calcula o dataset filtrado APENAS pelos selects e atualiza o
     * badge de filtros ativos. Depois delega para `recomputeDashboard()`
     * que faz o resto (gráficos, cards, lista, placeholders).
     */
    function applyFilters() {
      const {
        ontime,
        tipoDev,
        montadora,
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

      const filteredBySelects = ScriptState.allRawData.filter((r) => {
        const matchOntime = !ontime || r.ontime === ontime;
        const matchTipoDev =
          !tipoDevNorm || normalizeText(r.tipoDev) === tipoDevNorm;
        const matchMontadora = !montadora || r.montadora === montadora;
        const matchSistema =
          !sistemaNorm || normalizeText(r.sistema) === sistemaNorm;
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
          matchOntime &&
          matchTipoDev &&
          matchMontadora &&
          matchSistema &&
          matchSegmento &&
          matchListSistema &&
          matchLancada &&
          matchFalhas
        );
      });

      console.log(
        `[Filtros] Selects → ${filteredBySelects.length} carga(s) | ` +
          `Legendas ocultas → pieChart=${hiddenChartValues.pieChart.size} lineChart=${hiddenChartValues.lineChart.size}`,
      );

      ScriptState.filteredBySelects = filteredBySelects;

      // Badge de filtros ativos considera só os selects
      const hasActiveFilter = !!(
        ontime ||
        tipoDev ||
        montadora ||
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

      recomputeDashboard();
    }

    /**
     * Recalcula tudo (cards, gráficos, lista) considerando:
     *   - O dataset já filtrado pelos selects (`ScriptState.filteredBySelects`)
     *   - Os itens ocultados clicando na legenda (`hiddenChartValues`)
     *
     * Regras:
     *   - barChart (Segmento)  → exclui tanto tipoDev ocultos quanto falhas ocultas
     *   - pieChart (Tipo Dev)  → exclui apenas falhas ocultas
     *                            (mantém os tipoDev ocultos para poder
     *                             desenhar o strikethrough na legenda)
     *   - lineChart (Falhas)   → exclui apenas tipoDev ocultos
     *   - Cards e lista DSD    → usam a base mais restritiva (como barChart)
     *
     * Se TODAS as fatias de pieChart OU de lineChart estiverem ocultas,
     * todo o dashboard é zerado e mostra "sem resultados".
     */
    function recomputeDashboard() {
      const Dados = window.OntimeBoard.Dados;
      const Graficos = window.OntimeBoard.Graficos;
      if (!Dados || !Graficos) return;

      const filteredRaw = ScriptState.filteredBySelects || [];

      // ---- Detecta "todas as fatias ocultas" ----
      const uniqueTipoDev = Array.from(
        new Set(
          filteredRaw
            .map((r) => (r.tipoDev || "").toString().trim())
            .filter(Boolean),
        ),
      );

      const uniqueFalhas = Array.from(
        new Set(
          filteredRaw
            .map((r) => (r.falhas || "").toString().trim())
            .filter(Boolean),
        ),
      );

      const allPieHidden =
        uniqueTipoDev.length > 0 &&
        uniqueTipoDev.every((v) => hiddenChartValues.pieChart.has(v));

      const allLineHidden =
        uniqueFalhas.length > 0 &&
        uniqueFalhas.every((v) => hiddenChartValues.lineChart.has(v));

      const noResults =
        filteredRaw.length === 0 || allPieHidden || allLineHidden;

      if (noResults) {
        console.log("[Dashboard] Sem resultados — zerando tudo");

        resetStats();

        // Renderiza gráficos vazios para acionar os placeholders
        Graficos.renderCharts({
          porSegmento: {},
          porTipoDev: {},
          porFalhas: { "CF=1": 0, "CF>1": 0, SF: 0 },
        });

        refreshChartPlaceholders(false);
        renderDsdList([]);
        return;
      }

      // ---- Calcula bases para cada gráfico ----
      const barBase = filteredRaw.filter(
        (r) =>
          !hiddenChartValues.pieChart.has(r.tipoDev) &&
          !hiddenChartValues.lineChart.has(r.falhas),
      );

      const pieBase = filteredRaw.filter(
        (r) => !hiddenChartValues.lineChart.has(r.falhas),
      );

      const lineBase = filteredRaw.filter(
        (r) => !hiddenChartValues.pieChart.has(r.tipoDev),
      );

      // ---- Processa cada base ----
      const barProcessed = Dados.processData(barBase);
      const pieProcessed = Dados.processData(pieBase);
      const lineProcessed = Dados.processData(lineBase);

      // ---- Atualiza cards (usa a base mais restritiva) ----
      Graficos.updateStats(barProcessed);

      // ---- Renderiza gráficos com as bases específicas ----
      Graficos.renderCharts({
        porSegmento: barProcessed.porSegmento,
        porTipoDev: pieProcessed.porTipoDev,
        porFalhas: lineProcessed.porFalhas,
      });

      // ---- Reaplica o estado "hidden" nos gráficos recém-criados ----
      applyChartHiddenState();

      // ---- Atualiza placeholders (para gráficos específicos vazios) ----
      refreshChartPlaceholders(barBase.length > 0);

      // ---- Renderiza a lista DSD ----
      renderDsdList(barBase);
    }

    function clearGlobalFilters() {
      resetGlobalFiltersState();
      resetHiddenChartValues();

      if (DashboardElements.filterOntime) {
        DashboardElements.filterOntime.value = "";
      }
      if (DashboardElements.filterTipoDev) {
        DashboardElements.filterTipoDev.value = "";
      }
      if (DashboardElements.filterMontadora) {
        DashboardElements.filterMontadora.value = "";
      }
      if (DashboardElements.filterSistema) {
        DashboardElements.filterSistema.value = "";
      }

      refreshMontadoraOptions();
      syncListSistemaDisabledState();
      applyFilters();
    }

    function clearListFilters() {
      resetListFiltersState();
      resetHiddenChartValues();

      if (DashboardElements.filterSegmento) {
        DashboardElements.filterSegmento.value = "";
      }
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

    if (DashboardElements.filterTipoDev) {
      DashboardElements.filterTipoDev.addEventListener(
        "change",
        function () {
          ScriptState.filters.tipoDev = this.value;
          refreshMontadoraOptions();
          applyFilters();
        },
      );
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
    // 4.1.5 INTERATIVIDADE DA LEGENDA DOS GRÁFICOS
    // ============================================

    /**
     * Reaplica o estado "hidden" nos gráficos recém-criados.
     *
     * Chamado depois de `Graficos.renderCharts()` — como o render
     * destrói e recria cada gráfico, precisamos reaplicar o
     * `toggleDataVisibility` para que o strikethrough na legenda
     * e as fatias ocultas sejam mantidas.
     */
    function applyChartHiddenState() {
      const Graficos = window.OntimeBoard && window.OntimeBoard.Graficos;
      if (!Graficos) return;

      const state = Graficos.getState();

      const applyToChart = (chart, hiddenSet) => {
        if (!chart) return;
        if (hiddenSet.size === 0) return;

        const labels = chart.data.labels || [];
        let anyToggled = false;

        labels.forEach((label, index) => {
          if (hiddenSet.has(label)) {
            chart.toggleDataVisibility(index);
            anyToggled = true;
          }
        });

        if (anyToggled) chart.update();
      };

      applyToChart(state.chartInstances.pie, hiddenChartValues.pieChart);
      applyToChart(state.chartInstances.line, hiddenChartValues.lineChart);
    }

    /**
     * Escuta os cliques na legenda disparados pelo Graficos.js.
     *
     * Atualiza os sets de valores ocultos e RECALCULA todo o dashboard
     * (cards, gráficos, lista) para refletir a exclusão.
     */
    document.addEventListener("chartLegendToggle", function (e) {
      const { chartId, label, hidden } = e.detail;

      if (chartId === "pieChart") {
        if (hidden) hiddenChartValues.pieChart.add(label);
        else hiddenChartValues.pieChart.delete(label);
      } else if (chartId === "lineChart") {
        if (hidden) hiddenChartValues.lineChart.add(label);
        else hiddenChartValues.lineChart.delete(label);
      }

      console.log(
        `[Gráfico] ${chartId} → "${label}" ${hidden ? "oculto" : "visível"}`,
      );

      recomputeDashboard();
    });

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

    function refreshChartPlaceholders(hasResults) {
      const containers = document.querySelectorAll(".chart-container");

      containers.forEach((container) => {
        if (container.classList.contains("has-data")) return;

        const placeholder = container.querySelector(".chart-placeholder");
        if (!placeholder) return;

        const p = placeholder.querySelector("p");
        const span = placeholder.querySelector("span");

        if (!hasResults) {
          if (p) p.textContent = "Nenhum resultado encontrado";
          if (span) {
            span.textContent = "Nenhuma carga corresponde aos filtros aplicados";
          }
        } else {
          if (p) p.textContent = "Sem dados para exibir";
          if (span) {
            span.textContent = "A planilha não contém dados desta categoria";
          }
        }
      });
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