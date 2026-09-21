/**
 * OntimeBoard - Dados
 *
 * Responsabilidades:
 * - Leitura do arquivo Excel (SheetJS)
 * - Processamento/transformação dos dados brutos extraídos da planilha
 *
 * Validação:
 * - Todas as colunas usadas pelos filtros, gráficos, cards e lista
 *   são OBRIGATÓRIAS. Se qualquer uma estiver ausente, o erro lista
 *   os nomes faltantes para o modal de erro exibir ao usuário.
 */

(function () {
  "use strict";

  console.log("📊 OntimeBoard - Dados carregado");

  // ============================================
  // 1. CONFIGURAÇÃO DAS COLUNAS ESPERADAS
  // ============================================

  const COLUMN_MAP = {
    "DESCRIÇÃO DSD": "descricao",
    "TIPO DEV": "tipoDev",
    SEGMENTO: "segmento",
    SISTEMA: "sistema",
    MONTADORA: "montadora",
    BANCADA: "bancada",
    CAMPO: "campo",
    ESTRUTURA: "estrutura",
    FALHAS: "falhas",
    APROVADA: "aprovada",
    ONTIME: "ontime",
    LANÇADA: "lancada",
  };

  // Todas as colunas que o app realmente lê (filtros, gráficos,
  // cards e lista). Se qualquer uma faltar, a planilha é rejeitada.
  const REQUIRED_COLUMNS = [
    "descricao", // DESCRIÇÃO DSD  -> lista de cargas
    "tipoDev",   // TIPO DEV       -> filtros, gráficos, cards
    "segmento",  // SEGMENTO       -> filtros, gráficos
    "sistema",   // SISTEMA        -> filtros
    "montadora", // MONTADORA      -> filtros
    "falhas",    // FALHAS         -> filtro, gráfico de falhas
    "aprovada",  // APROVADA       -> card "Reprovadas"
    "ontime",    // ONTIME         -> filtro
  ];

  // ============================================
  // 2. PARSING DO EXCEL
  // ============================================

  function normalizeHeader(h) {
    return String(h || "")
      .trim()
      .toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  /**
   * Dado o nome interno de uma coluna (ex.: "descricao"),
   * devolve o nome legível do cabeçalho (ex.: "DESCRIÇÃO DSD").
   */
  function keyToSheetName(key) {
    const found = Object.keys(COLUMN_MAP).find(
      (sheetName) => COLUMN_MAP[sheetName] === key,
    );
    return found || key;
  }

  /**
   * Converte um workbook SheetJS já lido em um array de objetos.
   * Lança Error com `.code = "INCOMPATIBLE_SHEET"` e `.details`
   * quando a planilha não tem todas as colunas obrigatórias.
   */
  function _workbookToJsonData(workbook) {
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      const err = new Error("A planilha não contém nenhuma aba.");
      err.code = "INCOMPATIBLE_SHEET";
      err.details = { missing: [] };
      throw err;
    }
    const sheet = workbook.Sheets[sheetName];

    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: "",
    });

    if (!rows || rows.length < 2) {
      const err = new Error("A planilha não contém dados suficientes.");
      err.code = "INCOMPATIBLE_SHEET";
      err.details = { missing: [] };
      throw err;
    }

    const headerRowNormalized = rows[0].map(normalizeHeader);
    const dataRows = rows.slice(1);

    const colIndex = {};
    Object.keys(COLUMN_MAP).forEach((sheetColumnName) => {
      colIndex[COLUMN_MAP[sheetColumnName]] = headerRowNormalized.indexOf(
        normalizeHeader(sheetColumnName),
      );
    });

    // Valida TODAS as colunas exigidas
    const missing = REQUIRED_COLUMNS.filter((key) => colIndex[key] === -1);

    if (missing.length > 0) {
      const missingSheetNames = missing.map(keyToSheetName);
      const err = new Error(
        `Colunas não encontradas na planilha: ${missingSheetNames.join(", ")}. Verifique se o arquivo segue o layout esperado (mesmos nomes de cabeçalho da planilha modelo).`,
      );
      err.code = "INCOMPATIBLE_SHEET";
      err.details = {
        missing: missingSheetNames,
      };
      throw err;
    }

    const parsed = dataRows
      .map((row) => {
        const record = {};
        Object.keys(colIndex).forEach((key) => {
          const idx = colIndex[key];
          record[key] = idx >= 0 ? String(row[idx] ?? "").trim() : "";
        });
        return record;
      })
      .filter((record) => record.descricao !== "");

    if (parsed.length === 0) {
      const err = new Error(
        "Nenhuma linha de carga foi encontrada na planilha.",
      );
      err.code = "INCOMPATIBLE_SHEET";
      err.details = { missing: [] };
      throw err;
    }

    return parsed;
  }

  function parseExcelArrayBuffer(arrayBuffer) {
    if (!arrayBuffer) {
      throw new Error("ArrayBuffer inválido.");
    }
    const workbook = XLSX.read(arrayBuffer, {
      type: "array",
      dense: true,
    });
    return _workbookToJsonData(workbook);
  }

  // ============================================
  // 3. PROCESSAMENTO PRINCIPAL
  // ============================================

  function processExcelFile(fileRecord) {
    return new Promise((resolve, reject) => {
      try {
        if (!fileRecord) {
          throw new Error("Arquivo inválido: conteúdo não encontrado.");
        }

        let jsonData;

        if (Array.isArray(fileRecord.rawData) && fileRecord.rawData.length > 0) {
          console.log(
            `[SheetJS] Cache hit — usando ${fileRecord.rawData.length} linha(s) já parseada(s)`,
          );
          jsonData = fileRecord.rawData;
        } else {
          throw new Error("Arquivo sem conteúdo (rawData ausente).");
        }

        resolve(processData(jsonData));
      } catch (error) {
        console.error("[SheetJS] Erro ao processar arquivo:", error);
        reject(error);
      }
    });
  }

  function processData(rawData) {
    console.log("[Processar] Linhas recebidas:", rawData.length);

    const normalize = (value) => (value || "").toString().trim().toUpperCase();

    const totalCargas = rawData.length;

    const novosSistemas = rawData.filter(
      (r) => normalize(r.tipoDev) === "NOVO",
    ).length;

    const novasFuncoes = rawData.filter((r) => {
      const v = normalize(r.tipoDev);
      return v === "ACRESCIMO" || v === "ACRÉSCIMO";
    }).length;

    const buscasAutomaticas = rawData.filter(
      (r) => normalize(r.tipoDev) === "BUSCA AUTOMATICA",
    ).length;

    const reprovadas = rawData.filter(
      (r) => normalize(r.aprovada) === "REPROVADA",
    ).length;

    function countBy(field) {
      const counts = {};
      rawData.forEach((r) => {
        const key = (r[field] || "").toString().trim();
        if (!key || key === "\\N") return;
        counts[key] = (counts[key] || 0) + 1;
      });
      return counts;
    }

    const porSegmento = countBy("segmento");
    const porTipoDev = countBy("tipoDev");

    const porFalhas = { "CF=1": 0, "CF>1": 0, SF: 0 };
    rawData.forEach((r) => {
      const key = normalize(r.falhas);
      if (key === "CF=1") porFalhas["CF=1"]++;
      else if (key === "CF>1") porFalhas["CF>1"]++;
      else if (key === "SF") porFalhas.SF++;
    });

    return {
      totalCargas,
      novosSistemas,
      novasFuncoes,
      buscasAutomaticas,
      reprovadas,
      porSegmento,
      porTipoDev,
      porFalhas,
      raw: rawData,
    };
  }

  function getDistinctValues(rawData, field) {
    const set = new Set();
    (rawData || []).forEach((r) => {
      const value = (r[field] || "").toString().trim();
      if (value && value !== "\\N") set.add(value);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }

  // ============================================
  // 4. EXPOSIÇÃO DA API
  // ============================================

  const DadosAPI = {
    processExcelFile,
    processData,
    getDistinctValues,
    parseExcelArrayBuffer,

    /** Devolve a lista de colunas esperadas (nomes do cabeçalho) */
    getExpectedColumns: function () {
      return REQUIRED_COLUMNS.map(keyToSheetName);
    },

    init: function () {
      console.log("✅ Dados inicializado");
      return this;
    },
  };

  window.OntimeBoard = window.OntimeBoard || {};
  window.OntimeBoard.Dados = DadosAPI;

  DadosAPI.init();

  console.log("✅ OntimeBoard - Dados finalizado!");
  console.log("📌 Use OntimeBoard.Dados para acessar a API.");
})();