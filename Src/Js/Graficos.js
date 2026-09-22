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
 * 🔥 NOVO: Usa o plugin chartjs-plugin-datalabels para exibir
 *    os valores permanentemente nos gráficos (sem precisar hover).
 */

(function () {
  "use strict";

  console.log("📈 OntimeBoard - Gráficos carregado");

  // ============================================
  // 0. REGISTRO DO PLUGIN DE DATALABELS
  // ============================================

  // Registra o plugin globalmente (idempotente — não dá erro se já
  // estiver registrado automaticamente pelo <script> no HTML).
  if (typeof ChartDataLabels !== "undefined") {
    Chart.register(ChartDataLabels);
    console.log("🏷️  ChartDataLabels registrado");
  } else {
    console.warn(
      "⚠️  ChartDataLabels não encontrado. Verifique se o <script> do plugin foi incluído no HTML.",
    );
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

  // Paleta padrão para séries com número variável de categorias
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

  // Cores fixas para o gráfico de falhas (mantém sentido: vermelho = pior)
  const FALHAS_COLORS = {
    "CF=1": "#f57c00",
    "CF>1": "#388e3c",
    SF: "#c62828",
  };

  // ============================================
  // 2.1 CONFIGURAÇÕES DE DATALABELS (🔥 NOVO)
  // ============================================

  /**
   * Configuração dos labels para o gráfico de BARRAS.
   * Mostra o valor acima de cada barra, em texto escuro bold.
   */
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

  /**
   * Configuração dos labels para os gráficos de PIZZA.
   * Mostra o valor no centro de cada fatia, em branco bold com
   * contorno sutil para garantir leitura sobre qualquer cor.
   */
  const PIE_DATALABELS = {
    color: "#ffffff",
    font: {
      weight: "700",
      size: 14,
      family: "Inter, sans-serif",
    },
    anchor: "center",
    align: "center",
    // Contorno para dar contraste sobre fatias claras
    textStrokeColor: "rgba(0, 0, 0, 0.35)",
    textStrokeWidth: 3,
    formatter: (value) => value,
    // Esconde o label em fatias muito pequenas (< 5%) para não sobrepor
    display: function (ctx) {
      const data = ctx.dataset.data || [];
      const total = data.reduce((a, b) => a + b, 0);
      if (!total) return false;
      const percent = (data[ctx.dataIndex] / total) * 100;
      return percent >= 5;
    },
  };

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

  /**
   * Alterna entre mostrar o canvas (com dado) ou o placeholder (sem dado)
   */
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
            // 🔥 Layout com espaço no topo para o label não cortar
            layout: {
              padding: { top: 24 },
            },
            plugins: {
              legend: { display: false },
              // 🔥 LABELS DE VALOR NO TOPO DAS BARRAS
              datalabels: BAR_DATALABELS,
            },
            scales: {
              y: {
                beginAtZero: true,
                ticks: { precision: 0 },
                // 🔥 Dá um "respiro" no eixo Y pra barra mais alta não encostar no topo
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
              legend: { position: "bottom" },
              // 🔥 LABELS DE VALOR DENTRO DAS FATIAS
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
              legend: { position: "bottom" },
              // 🔥 LABELS DE VALOR DENTRO DAS FATIAS
              datalabels: PIE_DATALABELS,
            },
          },
        });
      }
      toggleChartContainer("lineChart", hasData);
    }
  }

  /**
   * Atualiza os 5 cards de estatística no topo do dashboard
   */
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