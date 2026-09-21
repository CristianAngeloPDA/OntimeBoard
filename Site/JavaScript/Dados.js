/**
 * OntimeBoard - Dados
 *
 * Responsabilidades:
 * - Leitura do arquivo Excel (SheetJS)
 * - Processamento/transformação dos dados brutos extraídos da planilha
 *
 * 🔥 OTIMIZAÇÃO:
 * - parseExcelArrayBuffer() -> parseia do ArrayBuffer (mais rápido que base64)
 * - parseExcelBase64()      -> fallback para arquivos antigos em sessionStorage
 * - processExcelFile()      -> usa cache (rawData) quando disponível,
 *                              evitando re-parse a cada reload
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

  // ============================================
  // 2. PARSING DO EXCEL (compartilhado)
  // ============================================

  /**
   * Normaliza texto de cabeçalho (tolerante a caixa, espaços e acentos)
   */
  function normalizeHeader(h) {
    return String(h || "")
      .trim()
      .toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  /**
   * Converte um workbook SheetJS já lido em um array de objetos
   * { descricao, tipoDev, segmento, sistema, ... }
   *
   * @param {Object} workbook - resultado de XLSX.read()
   * @returns {Array<Object>} linhas parseadas
   */
  function _workbookToJsonData(workbook) {
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      throw new Error("A planilha não contém nenhuma aba.");
    }
    const sheet = workbook.Sheets[sheetName];

    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: "",
    });

    if (!rows || rows.length < 2) {
      throw new Error("A planilha não contém dados suficientes.");
    }

    const headerRowNormalized = rows[0].map(normalizeHeader);
    const dataRows = rows.slice(1);

    // Mapeia cada coluna esperada ao índice real na planilha
    const colIndex = {};
    Object.keys(COLUMN_MAP).forEach((sheetColumnName) => {
      colIndex[COLUMN_MAP[sheetColumnName]] = headerRowNormalized.indexOf(
        normalizeHeader(sheetColumnName),
      );
    });

    // Valida colunas obrigatórias
    const REQUIRED_COLUMNS = ["descricao", "tipoDev", "segmento", "falhas"];
    const missing = REQUIRED_COLUMNS.filter((key) => colIndex[key] === -1);
    if (missing.length > 0) {
      const missingNames = Object.keys(COLUMN_MAP).filter((name) =>
        missing.includes(COLUMN_MAP[name]),
      );
      throw new Error(
        `Colunas não encontradas na planilha: ${missingNames.join(", ")}. Verifique se o arquivo segue o layout esperado (mesmos nomes de cabeçalho da planilha modelo).`,
      );
    }

    return dataRows
      .map((row) => {
        const record = {};
        Object.keys(colIndex).forEach((key) => {
          const idx = colIndex[key];
          record[key] = idx >= 0 ? String(row[idx] ?? "").trim() : "";
        });
        return record;
      })
      .filter((record) => record.descricao !== "");
  }

  /**
   * 🔥 OTIMIZAÇÃO: parseia Excel a partir de ArrayBuffer.
   * Caminho preferido — evita todo o overhead de base64.
   *
   * @param {ArrayBuffer} arrayBuffer
   * @returns {Array<Object>} linhas parseadas
   */
  function parseExcelArrayBuffer(arrayBuffer) {
    if (!arrayBuffer) {
      throw new Error("ArrayBuffer inválido.");
    }
    const workbook = XLSX.read(arrayBuffer, {
      type: "array",
      dense: true, // 🔥 mais rápido e menor uso de memória
    });
    return _workbookToJsonData(workbook);
  }

  /**
   * Fallback: parseia Excel a partir de base64.
   * Usado apenas para arquivos antigos que já estão em sessionStorage.
   *
   * @param {string} base64
   * @returns {Array<Object>} linhas parseadas
   */
  function parseExcelBase64(base64) {
    if (!base64) {
      throw new Error("base64 inválido.");
    }
    const workbook = XLSX.read(base64, {
      type: "base64",
      dense: true,
    });
    return _workbookToJsonData(workbook);
  }

  // ============================================
  // 3. PROCESSAMENTO PRINCIPAL
  // ============================================

  /**
   * Lê o arquivo Excel e retorna os dados processados.
   *
   * 🔥 OTIMIZAÇÃO: se `fileRecord.rawData` já existir (foi pré-processado
   * na tela de upload), pula o XLSX.read completamente.
   *
   * @param {{name: string, base64?: string, rawData?: Array}} fileRecord
   * @returns {Promise<Object>}
   */
  function processExcelFile(fileRecord) {
    return new Promise((resolve, reject) => {
      try {
        if (!fileRecord) {
          throw new Error("Arquivo inválido: conteúdo não encontrado.");
        }

        let jsonData;

        // 🔥 CACHE HIT: pula XLSX.read inteiro
        if (Array.isArray(fileRecord.rawData) && fileRecord.rawData.length > 0) {
          console.log(
            `[SheetJS] ⚡ Cache hit — usando ${fileRecord.rawData.length} linha(s) já parseada(s)`,
          );
          jsonData = fileRecord.rawData;
        } else if (fileRecord.base64) {
          // Fallback: arquivo antigo sem cache
          console.log("[SheetJS] Cache miss — parseando base64 (fallback)");
          jsonData = parseExcelBase64(fileRecord.base64);
        } else {
          throw new Error("Arquivo sem conteúdo (nem rawData nem base64).");
        }

        resolve(processData(jsonData));
      } catch (error) {
        console.error("[SheetJS] Erro ao processar arquivo:", error);
        reject(error);
      }
    });
  }

  /**
   * Processa os dados brutos e devolve totais + contagens para os gráficos.
   */
  function processData(rawData) {
    console.log("[Processar] Linhas recebidas:", rawData.length);

    const normalize = (value) => (value || "").toString().trim().toUpperCase();

    // ----- Cards -----
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

    // ----- Contagem genérica por valor de uma coluna -----
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

  /**
   * Retorna valores únicos (não vazios, ordenados) de uma coluna.
   */
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
    parseExcelArrayBuffer, // 🔥 NOVO — usado pela Estrutura
    parseExcelBase64, // 🔥 NOVO — fallback

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