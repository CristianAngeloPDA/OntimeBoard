/**
 * OntimeBoard - Gráficos
 *
 * Responsabilidades:
 * - Estado das instâncias de gráficos (Chart.js)
 * - Renderização dos gráficos:
 *     - barChart  -> Cargas por Segmento (coluna)
 *     - pieChart  -> Cargas por Tipo Dev (pizza)
 *     - lineChart -> Falhas: CF=1 / CF>1 / SF (pizza)
 * - Atualização das estatísticas exibidas nos cards
 *
 * Cliques na legenda dos gráficos de pizza disparam o evento
 * `chartLegendToggle` — o main.js escuta e refiltra a lista DSD.
 */

(function () {
  "use strict";

  console.log("📈 OntimeBoard - Gráficos carregado");

  // ============================================
  // 0. REGISTRO DO PLUGIN DE DATALABELS
  // ============================================

  let _dataLabelsRegistered = false;

  function ensureDataLabelsRegistered() {
    if (_dataLabelsRegistered) return;

    if (typeof ChartDataLabels !== "undefined") {
      Chart.register(ChartDataLabels);
      _dataLabelsRegistered = true;
      console.log("🏷️  ChartDataLabels registrado");
    } else {
      console.warn(
        "⚠️  ChartDataLabels não encontrado. Verifique se o <script> do plugin foi incluído no HTML.",
      );
    }
  }

  // ============================================
  // 1. REFERÊNCIAS DOS ELEMENTOS DE ESTATÍSTICA
  // ============================================

  const StatsElements = {
    totalSales: document.getElementById("totalSales"),
    totalRevenue: document.getElementById("totalRevenue"),
    averageSale: document.getElementById("averageSale"),
    buscasAutomaticas: document.getElementById("buscasAutomaticas"),
    reprovadas: document.getElementById("reprovadas"),
  };

  // ============================================
  // 2. ESTADO DOS GRÁFICOS
  // ============================================

  const GraficosState = {
    chartInstances: {
      bar: null,
      pie: null,
      line: null,
    },
  };

  const CHART_COLORS = [
    "#2a7de1",
    "#388e3c",
    "#f57c00",
    "#c62828",
    "#7e57c2",
    "#00897b",
    "#d81b60",
    "#5c6bc0",
    "#8d6e63",
    "#546e7a",
  ];

  const FALHAS_COLORS = {
    "CF=1": "#f57c00",
    "CF>1": "#388e3c",
    SF: "#c62828",
  };

  // ============================================
  // 2.1 CONFIGURAÇÕES DE DATALABELS
  // ============================================

  const BAR_DATALABELS = {
    anchor: "end",
    align: "top",
    offset: 6,
    color: "#0c1f32",
    font: {
      weight: "700",
      size: 13,
      family: "Inter, sans-serif",
    },
    formatter: (value) => value,
  };

  const PIE_DATALABELS = {
    color: "#ffffff",
    font: {
      weight: "700",
      size: 14,
      family: "Inter, sans-serif",
    },
    anchor: "center",
    align: "center",
    textStrokeColor: "rgba(0, 0, 0, 0.35)",
    textStrokeWidth: 3,
    formatter: (value) => value,
    display: function (ctx) {
      const data = ctx.dataset.data || [];
      const total = data.reduce((a, b) => a + b, 0);
      if (!total) return false;
      const percent = (data[ctx.dataIndex] / total) * 100;
      return percent >= 5;
    },
  };

  // ============================================
  // 2.2 HANDLER DE CLIQUE NA LEGENDA
  // ============================================

  /**
   * Cria um handler para o clique na legenda de um gráfico de pizza.
   *
   * Usa `chart.toggleDataVisibility(index)` (API oficial do Chart.js v4
   * para pie/doughnut) em vez de manipular `item.hidden` diretamente.
   * Isso garante que o Chart.js redesenhe a legenda corretamente —
   * incluindo o efeito de texto riscado (strikethrough).
   *
   * @param {string} chartId - ID do <canvas> ("pieChart" ou "lineChart")
   */
  function createLegendOnClickHandler(chartId) {
    return function (e, legendItem, legend) {
      const chart = legend.chart;
      const index = legendItem.index;

      // API oficial: alterna a visibilidade da fatia
      chart.toggleDataVisibility(index);
      chart.update();

      // Lê o estado resultante direto do chart
      const isNowHidden = !chart.getDataVisibility(index);

      // Notifica o resto da aplicação
      document.dispatchEvent(
        new CustomEvent("chartLegendToggle", {
          detail: {
            chartId: chartId,
            label: legendItem.text,
            hidden: isNowHidden,
          },
        }),
      );
    };
  }

  // ============================================
  // 3. FUNÇÕES AUXILIARES
  // ============================================

  function objectToChartData(obj, colorMap) {
    const labels = Object.keys(obj);
    const values = labels.map((label) => obj[label]);
    const colors = labels.map(
      (label, i) =>
        (colorMap && colorMap[label]) || CHART_COLORS[i % CHART_COLORS.length],
    );
    return { labels, values, colors };
  }

  function destroyCharts() {
    Object.keys(GraficosState.chartInstances).forEach((key) => {
      if (GraficosState.chartInstances[key]) {
        GraficosState.chartInstances[key].destroy();
        GraficosState.chartInstances[key] = null;
      }
    });
  }

  function toggleChartContainer(canvasId, hasData) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const container = canvas.closest(".chart-container");
    if (container) container.classList.toggle("has-data", hasData);
  }

  // ============================================
  // 4. FUNÇÕES DE RENDERIZAÇÃO
  // ============================================

  function renderCharts(data) {
    ensureDataLabelsRegistered();

    console.log("[Chart.js] Renderizando gráficos:", data);

    destroyCharts();

    // ----- Gráfico de coluna: cargas por Segmento -----
    const barCanvas = document.getElementById("barChart");
    if (barCanvas) {
      const { labels, values, colors } = objectToChartData(data.porSegmento);
      const hasData = values.length > 0;

      if (hasData) {
        GraficosState.chartInstances.bar = new Chart(barCanvas, {
          type: "bar",
          data: {
            labels,
            datasets: [
              {
                label: "Cargas",
                data: values,
                backgroundColor: colors,
                borderRadius: 6,
                maxBarThickness: 60,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
              padding: { top: 24 },
            },
            plugins: {
              legend: { display: false },
              datalabels: BAR_DATALABELS,
            },
            scales: {
              y: {
                beginAtZero: true,
                ticks: { precision: 0 },
                grace: "10%",
              },
            },
          },
        });
      }
      toggleChartContainer("barChart", hasData);
    }

    // ----- Gráfico de pizza: cargas por Tipo Dev -----
    const pieCanvas = document.getElementById("pieChart");
    if (pieCanvas) {
      const { labels, values, colors } = objectToChartData(data.porTipoDev);
      const hasData = values.length > 0;

      if (hasData) {
        GraficosState.chartInstances.pie = new Chart(pieCanvas, {
          type: "pie",
          data: {
            labels,
            datasets: [{ data: values, backgroundColor: colors }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: "bottom",
                onClick: createLegendOnClickHandler("pieChart"),
              },
              datalabels: PIE_DATALABELS,
            },
          },
        });
      }
      toggleChartContainer("pieChart", hasData);
    }

    // ----- Gráfico de pizza: Falhas (CF=1 / CF>1 / SF) -----
    const lineCanvas = document.getElementById("lineChart");
    if (lineCanvas) {
      const { labels, values, colors } = objectToChartData(
        data.porFalhas,
        FALHAS_COLORS,
      );
      const hasData = values.some((v) => v > 0);

      if (hasData) {
        GraficosState.chartInstances.line = new Chart(lineCanvas, {
          type: "pie",
          data: {
            labels,
            datasets: [{ data: values, backgroundColor: colors }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: "bottom",
                onClick: createLegendOnClickHandler("lineChart"),
              },
              datalabels: PIE_DATALABELS,
            },
          },
        });
      }
      toggleChartContainer("lineChart", hasData);
    }
  }

  function updateStats(data) {
    console.log("[Stats] Atualizando estatísticas:", data);

    if (StatsElements.totalSales) {
      StatsElements.totalSales.textContent = data.totalCargas;
      StatsElements.totalSales.className = "stat-value";
    }

    if (StatsElements.totalRevenue) {
      StatsElements.totalRevenue.textContent = data.novosSistemas;
      StatsElements.totalRevenue.className = "stat-value";
    }

    if (StatsElements.averageSale) {
      StatsElements.averageSale.textContent = data.novasFuncoes;
      StatsElements.averageSale.className = "stat-value";
    }

    if (StatsElements.buscasAutomaticas) {
      StatsElements.buscasAutomaticas.textContent =
        data.buscasAutomaticas ?? 0;
      StatsElements.buscasAutomaticas.className = "stat-value";
    }

    if (StatsElements.reprovadas) {
      StatsElements.reprovadas.textContent = data.reprovadas ?? 0;
      StatsElements.reprovadas.className = "stat-value";
    }
  }

  // ============================================
  // 5. EXPOSIÇÃO DA API DE GRÁFICOS
  // ============================================

  const GraficosAPI = {
    renderCharts,
    updateStats,
    destroyCharts,

    getState: () => ({ ...GraficosState }),

    init: function () {
      console.log("✅ Gráficos inicializado");
      return this;
    },
  };

  // ============================================
  // 6. EXPOSIÇÃO GLOBAL
  // ============================================

  window.OntimeBoard = window.OntimeBoard || {};
  window.OntimeBoard.Graficos = GraficosAPI;

  GraficosAPI.init();

  console.log("✅ OntimeBoard - Gráficos finalizado!");
  console.log("📌 Use OntimeBoard.Graficos para acessar a API.");
})();