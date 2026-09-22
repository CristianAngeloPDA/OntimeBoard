/**
 * OntimeBoard - Estrutura e Interface
 *
 * Responsabilidades:
 * - Controle do menu lateral (abrir/fechar)
 * - Gerenciamento do overlay
 * - Navegação entre páginas (index.html ↔ grafico.html)
 * - Persistência dos arquivos carregados (sessionStorage)
 * - Manipulação de elementos DOM
 * - Gerenciamento de arquivos no menu
 *
 * OTIMIZAÇÃO:
 * - Parseia o Excel na tela de upload e guarda `rawData` em cache.
 *   No dashboard, processExcelFile() detecta o cache e pula XLSX.read.
 *
 * VALIDAÇÃO:
 * - Modal de processamento (LoadingModal) durante o upload.
 * - Modal de erro (ErrorModal) quando a planilha é incompatível.
 * - MODAL DE AVISO quando:
 *     • o nome do arquivo já existe entre os carregados
 *     • o conteúdo é idêntico ao de algum arquivo já carregado
 *   Em ambos os casos, o arquivo NÃO é salvo e o usuário permanece
 *   na tela de upload.
 */

(function () {
  "use strict";

  console.log("🏗️ OntimeBoard - Estrutura carregada");

  // ============================================
  // 0. CONFIGURAÇÃO DE PÁGINAS E ARMAZENAMENTO
  // ============================================
  const PAGES = {
    UPLOAD: "index.html",
    DASHBOARD: "grafico.html",
  };

  const STORAGE_KEY_FILES = "ontimeboard_files";
  const STORAGE_KEY_SELECTED = "ontimeboard_selectedIndex";

  // ============================================
  // 1. REFERÊNCIAS DOS ELEMENTOS
  // ============================================
  const DOM = {
    hamburgerBtn: document.getElementById("hamburgerBtn"),
    sidebar: document.getElementById("sidebar"),
    overlay: document.getElementById("overlay"),
    uploadBtn: document.getElementById("uploadBtn"),
    fileInput: document.getElementById("fileInput"),
    uploadZone: document.getElementById("uploadZone"),
    menuItemsContainer: document.getElementById("menuItems"),
    fileCount: document.getElementById("fileCount"),
    totalFiles: document.getElementById("totalFiles"),
    totalSize: document.getElementById("totalSize"),
    uploadScreen: document.getElementById("uploadScreen"),
    dashboardScreen: document.getElementById("dashboardScreen"),
    btnUploadNew: document.getElementById("btnUploadNew"),
    dashboardTitle: document.getElementById("dashboardTitle"),
    dashboardSubtitle: document.getElementById("dashboardSubtitle"),
    fileSelectMessage: document.getElementById("fileSelectMessage"),
    menuHomeBtn: document.getElementById("menuHomeBtn"),
  };

  const isUploadPage = !!DOM.uploadScreen;
  const isDashboardPage = !!DOM.dashboardScreen;

  // ============================================
  // 2. ESTADO
  // ============================================
  const State = {
    uploadedFiles: [], // { id, name, size, rawData }
    totalFileSize: 0,
    selectedFileIndex: -1,
    fileIdCounter: 0,
    isMenuOpen: false,
  };

  // ============================================
  // 3. CONTROLE DO MENU
  // ============================================

  function openMenu() {
    DOM.sidebar.classList.add("open");
    DOM.overlay.classList.add("active");
    document.body.style.overflow = "hidden";
    State.isMenuOpen = true;
  }

  function closeMenu() {
    DOM.sidebar.classList.remove("open");
    DOM.overlay.classList.remove("active");
    document.body.style.overflow = "";
    State.isMenuOpen = false;
  }

  function toggleMenu() {
    if (State.isMenuOpen) closeMenu();
    else openMenu();
  }

  // ============================================
  // 4. NAVEGAÇÃO
  // ============================================

  function showUploadScreen() {
    if (!DOM.uploadScreen) return;
    DOM.uploadScreen.style.display = "flex";
    console.log("[Navegação] Tela de upload exibida");
  }

  function showDashboardScreen() {
    if (!DOM.dashboardScreen) return;
    DOM.dashboardScreen.style.display = "block";
    console.log("[Navegação] Dashboard exibido");
  }

  function goToHome() {
    if (isUploadPage) {
      const items = DOM.menuItemsContainer.querySelectorAll(".menu-item");
      items.forEach((item) => item.classList.remove("active"));
      State.selectedFileIndex = -1;
      if (State.isMenuOpen) closeMenu();
      return;
    }
    window.location.href = PAGES.UPLOAD;
  }

  // ============================================
  // 5. PERSISTÊNCIA (sessionStorage)
  // ============================================

  function saveFilesToStorage() {
    try {
      const filesToStore = State.uploadedFiles.map((f) => ({
        id: f.id,
        name: f.name,
        size: f.size,
        rawData: f.rawData || null,
      }));
      sessionStorage.setItem(STORAGE_KEY_FILES, JSON.stringify(filesToStore));
    } catch (error) {
      console.error("[Storage] Erro ao salvar arquivos:", error);
      alert(
        "Não foi possível salvar o arquivo (limite de armazenamento do navegador excedido).",
      );
    }
  }

  function loadFilesFromStorage() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY_FILES);
      if (!raw) return;

      const stored = JSON.parse(raw);
      if (!Array.isArray(stored) || stored.length === 0) return;

      State.uploadedFiles = stored;
      State.totalFileSize = stored.reduce((sum, f) => sum + f.size, 0);
      State.fileIdCounter = stored.reduce(
        (max, f) => Math.max(max, f.id),
        0,
      );

      stored.forEach((f) => addMenuItem(f.name, f.size, f.id));
      console.log(`[Storage] ${stored.length} arquivo(s) restaurado(s)`);
    } catch (error) {
      console.error("[Storage] Erro ao carregar arquivos:", error);
    }
  }

  function saveSelectedIndex(index) {
    sessionStorage.setItem(STORAGE_KEY_SELECTED, String(index));
  }

  function loadSelectedIndex() {
    const raw = sessionStorage.getItem(STORAGE_KEY_SELECTED);
    const parsed = parseInt(raw, 10);
    return Number.isNaN(parsed) ? -1 : parsed;
  }

  function fileToArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file);
    });
  }

  // ============================================
  // 6. GERENCIAMENTO DE ARQUIVOS NO MENU
  // ============================================

  function addMenuItem(fileName, fileSize, fileId) {
    const emptyState = DOM.menuItemsContainer.querySelector(".empty-state");
    if (emptyState) emptyState.remove();

    const item = document.createElement("div");
    item.className = "menu-item";
    item.setAttribute("data-file-id", fileId);
    item.setAttribute(
      "data-index",
      DOM.menuItemsContainer.querySelectorAll(".menu-item").length,
    );

    const itemContent = document.createElement("span");
    itemContent.innerHTML = `
      <i class="fas fa-file-excel"></i>
      <span>${fileName}</span>
      <span style="margin-left: auto; font-size: 0.7rem; color: #889bb0;">${(fileSize / 1024).toFixed(1)} KB</span>
    `;

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-btn";
    deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
    deleteBtn.title = "Excluir arquivo";
    deleteBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      const fileId = parseInt(item.getAttribute("data-file-id"));
      deleteFile(fileId);
    });

    item.appendChild(itemContent);
    item.appendChild(deleteBtn);

    item.addEventListener("click", function (e) {
      if (e.target.closest(".delete-btn")) return;
      const index = parseInt(this.getAttribute("data-index"));
      selectFile(index);
    });

    DOM.menuItemsContainer.appendChild(item);
    updateCounters();
  }

  function highlightAndSetSelected(index) {
    const items = DOM.menuItemsContainer.querySelectorAll(".menu-item");
    items.forEach((item) => item.classList.remove("active"));

    if (!items[index]) return;

    items[index].classList.add("active");
    State.selectedFileIndex = index;
    saveSelectedIndex(index);

    if (isDashboardPage) {
      showDashboardScreen();
      const selectEvent = new CustomEvent("fileSelected", {
        detail: {
          index: index,
          file: State.uploadedFiles[index],
        },
      });
      document.dispatchEvent(selectEvent);
    }
  }

  function selectFile(index) {
    highlightAndSetSelected(index);
    if (isUploadPage) {
      window.location.href = PAGES.DASHBOARD;
    }
  }

  function deleteFile(fileId) {
    let indexToDelete = -1;
    const items = DOM.menuItemsContainer.querySelectorAll(".menu-item");
    items.forEach((item, idx) => {
      if (parseInt(item.getAttribute("data-file-id")) === fileId) {
        indexToDelete = idx;
      }
    });

    if (indexToDelete === -1) return;

    const removedFile = State.uploadedFiles.splice(indexToDelete, 1)[0];
    State.totalFileSize -= removedFile.size;

    const itemToRemove = DOM.menuItemsContainer.querySelector(
      `[data-file-id="${fileId}"]`,
    );
    if (itemToRemove) itemToRemove.remove();

    reindexItems();
    updateCounters();
    saveFilesToStorage();

    if (State.uploadedFiles.length === 0) {
      showEmptyState();
      sessionStorage.removeItem(STORAGE_KEY_FILES);
      sessionStorage.removeItem(STORAGE_KEY_SELECTED);
      State.selectedFileIndex = -1;

      if (isDashboardPage) {
        window.location.href = PAGES.UPLOAD;
      } else {
        showUploadScreen();
      }
      return;
    }

    if (State.selectedFileIndex === indexToDelete) {
      highlightAndSetSelected(0);
    } else if (State.selectedFileIndex > indexToDelete) {
      State.selectedFileIndex--;
      const updatedItems =
        DOM.menuItemsContainer.querySelectorAll(".menu-item");
      updatedItems.forEach((item) => item.classList.remove("active"));
      if (updatedItems[State.selectedFileIndex]) {
        updatedItems[State.selectedFileIndex].classList.add("active");
      }
      saveSelectedIndex(State.selectedFileIndex);

      if (isDashboardPage) {
        const selectEvent = new CustomEvent("fileSelected", {
          detail: {
            index: State.selectedFileIndex,
            file: State.uploadedFiles[State.selectedFileIndex],
          },
        });
        document.dispatchEvent(selectEvent);
      }
    }
  }

  function reindexItems() {
    const items = DOM.menuItemsContainer.querySelectorAll(".menu-item");
    items.forEach((item, idx) => {
      item.setAttribute("data-index", idx);
    });
  }

  function showEmptyState() {
    if (DOM.menuItemsContainer.querySelector(".empty-state")) return;

    const emptyState = document.createElement("div");
    emptyState.className = "empty-state";
    emptyState.innerHTML = `
      <i class="fas fa-inbox"></i>
      <p>Nenhum arquivo carregado</p>
      <span>Importe um arquivo Excel para começar</span>
    `;
    DOM.menuItemsContainer.appendChild(emptyState);
  }

  function updateCounters() {
    const count = State.uploadedFiles.length;
    DOM.fileCount.textContent = `${count} arquivo${count !== 1 ? "s" : ""}`;
    DOM.totalFiles.textContent = count;
    DOM.totalSize.textContent = (State.totalFileSize / (1024 * 1024)).toFixed(
      1,
    );
  }

  // ============================================
  // 7. UPLOAD
  // ============================================

  function openFileSelector() {
    DOM.fileInput.click();
  }

  /**
   * Monta a lista de detalhes para o modal de erro de planilha
   * incompatível (colunas ausentes).
   */
  function buildErrorDetails(error) {
    const details = [];
    const detailsObj = error && error.details;
    const msg = String((error && error.message) || error || "");

    let missing = [];

    if (detailsObj && Array.isArray(detailsObj.missing)) {
      missing = detailsObj.missing;
    } else {
      const m = msg.match(/Colunas não encontradas na planilha:\s*(.+?)\./i);
      if (m && m[1]) {
        missing = m[1]
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      }
    }

    if (missing.length > 0) {
      details.push(`Colunas ausentes na planilha: ${missing.join(", ")}.`);
    }

    const Dados = window.OntimeBoard && window.OntimeBoard.Dados;
    if (Dados && typeof Dados.getExpectedColumns === "function") {
      const expected = Dados.getExpectedColumns();
      details.push(`Colunas necessárias: ${expected.join(", ")}.`);
    }

    if (details.length === 0) {
      if (/não contém dados suficientes/i.test(msg)) {
        details.push(
          "A planilha está vazia ou contém apenas a linha de cabeçalho.",
        );
      } else if (/não contém nenhuma aba/i.test(msg)) {
        details.push("O arquivo não possui nenhuma aba válida.");
      } else if (/Nenhuma linha de carga/i.test(msg)) {
        details.push(
          "A planilha foi lida, mas nenhuma linha possui a DESCRIÇÃO DSD preenchida.",
        );
      } else {
        details.push(
          "Confirme que o arquivo é a planilha de análise de cargas e que não está corrompido.",
        );
      }
    }

    return details;
  }

  /**
   * Compara dois arrays de linhas (rawData) e devolve `true` se
   * tiverem EXATAMENTE o mesmo conteúdo (mesmo número de linhas,
   * mesmas chaves e valores em cada linha).
   *
   * A comparação é resistente à ordem das linhas: dois arquivos
   * com as mesmas linhas em ordens diferentes são considerados
   * iguais.
   */
  function areContentsIdentical(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    if (a.length === 0) return false;

    const serialize = (arr) =>
      arr
        .map((row) => JSON.stringify(row, Object.keys(row).sort()))
        .sort()
        .join("\n");

    return serialize(a) === serialize(b);
  }

  /**
   * Exibe o modal avisando que o arquivo já existe.
   *
   * @param {string} fileName           nome do arquivo que foi tentado
   * @param {"name"|"content"} reason   motivo da rejeição
   * @param {string} [existingName]     nome do arquivo já carregado
   *                                    (usado quando reason = "content")
   */
  function showDuplicateWarning(fileName, reason, existingName) {
    const ErrorModal = window.OntimeBoard && window.OntimeBoard.ErrorModal;
    if (!ErrorModal) {
      alert("Este arquivo já foi carregado!");
      return;
    }

    const messageName =
      "Já existe um arquivo carregado com este mesmo nome. Para enviá-lo novamente, exclua o arquivo existente pelo menu lateral primeiro.";

    const messageContent =
      "O conteúdo desta planilha é idêntico ao de um arquivo já carregado no sistema. Para enviá-la novamente, exclua o arquivo existente pelo menu lateral primeiro.";

    const details = [];
    if (reason === "content" && existingName) {
      details.push(`Arquivo já carregado: ${existingName}`);
      details.push(`Arquivo que você tentou enviar: ${fileName}`);
    }

    ErrorModal.show({
      variant: "warning",
      title: "Arquivo já carregado",
      message: reason === "name" ? messageName : messageContent,
      fileName: fileName,
      details: details,
    });
  }

  /**
   * Processa o arquivo escolhido pelo usuário.
   *
   * Fluxo:
   *  1. Lê o ArrayBuffer
   *  2. Parseia a planilha (valida colunas obrigatórias)
   *  3. Valida se o conteúdo já não está carregado (duplicata)
   *  4. Se tudo OK → salva, mostra "Tudo pronto" e redireciona
   */
  async function processFile(file) {
    const fileId = ++State.fileIdCounter;

    const LoadingModal =
      window.OntimeBoard && window.OntimeBoard.LoadingModal;
    const ErrorModal = window.OntimeBoard && window.OntimeBoard.ErrorModal;

    const setStage = (n) => LoadingModal && LoadingModal.setStage(n);
    const setProgress = (p) => LoadingModal && LoadingModal.setProgress(p);
    const hideLoading = () => LoadingModal && LoadingModal.hide();

    const nextTick = (ms = 50) =>
      new Promise((resolve) => setTimeout(resolve, ms));

    // ===== ETAPA 1: Upload =====
    if (LoadingModal) {
      LoadingModal.show();
      setStage(1);
      setProgress(8);
    }
    await nextTick();

    // ===== ETAPA 2: leitura do arquivo =====
    let arrayBuffer;
    try {
      setStage(2);
      setProgress(28);
      await nextTick(20);

      arrayBuffer = await fileToArrayBuffer(file);
      setProgress(45);
    } catch (error) {
      console.error("[Upload] Erro ao ler arquivo:", error);
      hideLoading();

      if (ErrorModal) {
        ErrorModal.show({
          variant: "error",
          title: "Falha ao ler o arquivo",
          message:
            "Não foi possível acessar o conteúdo do arquivo selecionado. Verifique se ele não está corrompido ou protegido por senha.",
          fileName: file.name,
          details: [
            "Tente novamente salvar o arquivo no Excel e importar de novo.",
            "Se o problema persistir, verifique se o arquivo abre normalmente no Excel.",
          ],
        });
      } else {
        alert("Não foi possível ler o arquivo selecionado.");
      }
      return;
    }

    // ===== ETAPA 3: parse + validação (planilha compatível?) =====
    let rawData;
    try {
      await nextTick(20);
      setProgress(62);

      const Dados = window.OntimeBoard && window.OntimeBoard.Dados;
      if (!Dados || typeof Dados.parseExcelArrayBuffer !== "function") {
        throw new Error(
          "O módulo de leitura de planilha não está disponível. Recarregue a página e tente novamente.",
        );
      }

      const t0 = performance.now();
      rawData = Dados.parseExcelArrayBuffer(arrayBuffer);
      const t1 = performance.now();

      console.log(
        `[Upload] Pré-processado: ${rawData.length} linha(s) em ${(t1 - t0).toFixed(0)}ms`,
      );
      setProgress(78);
    } catch (error) {
      console.warn("[Upload] Planilha incompatível:", error.message);

      hideLoading();

      if (ErrorModal) {
        ErrorModal.show({
          variant: "error",
          title: "Planilha incompatível",
          message:
            "O arquivo enviado não segue o formato esperado pelo OntimeBoard. A planilha precisa conter todas as colunas listadas abaixo, com os nomes exatamente iguais aos do modelo (letras maiúsculas/minúsculas e acentos são ignorados).",
          fileName: file.name,
          details: buildErrorDetails(error),
        });
      } else {
        alert(`Planilha incompatível:\n\n${error.message}`);
      }
      return;
    }

    // ===== ETAPA 4: validação de CONTEÚDO duplicado =====
    await nextTick(20);
    setProgress(82);

    const duplicate = State.uploadedFiles.find((f) =>
      areContentsIdentical(f.rawData, rawData),
    );

    if (duplicate) {
      console.warn(
        `[Upload] Conteúdo idêntico ao arquivo já carregado: ${duplicate.name}`,
      );
      hideLoading();
      showDuplicateWarning(file.name, "content", duplicate.name);
      return;
    }

    // ===== ETAPA 5: salvar (só chega aqui se tudo deu certo) =====
    setStage(3);
    setProgress(90);
    await nextTick(20);

    const fileRecord = {
      id: fileId,
      name: file.name,
      size: file.size,
      rawData: rawData,
    };

    State.uploadedFiles.push(fileRecord);
    State.totalFileSize += file.size;
    addMenuItem(file.name, file.size, fileId);
    saveFilesToStorage();

    console.log(`[Upload] Arquivo processado: ${file.name}`);

    const uploadEvent = new CustomEvent("fileUploaded", {
      detail: {
        fileId: fileId,
        index: State.uploadedFiles.length - 1,
      },
    });
    document.dispatchEvent(uploadEvent);

    // ===== ETAPA 6: finalização + redirecionamento =====
    setStage(4);
    setProgress(100);
    await nextTick(700);

    const index = State.uploadedFiles.length - 1;
    selectFile(index);
  }

  function handleFileUpload(file) {
    const validTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
    ];

    if (!validTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls)$/i)) {
      alert("Por favor, selecione um arquivo Excel (.xlsx ou .xls)");
      return false;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert("Arquivo muito grande. Máximo permitido: 10MB");
      return false;
    }

    // Validação 1: nome do arquivo duplicado (rápida, antes de
    // sequer ler/parsear o arquivo)
    const nameExists = State.uploadedFiles.some(
      (f) => f.name === file.name,
    );
    if (nameExists) {
      console.log(`[Upload] Nome duplicado: ${file.name}`);
      showDuplicateWarning(file.name, "name");
      return false;
    }

    processFile(file);
    return true;
  }

  // ============================================
  // 8. API PÚBLICA
  // ============================================

  const EstruturaAPI = {
    openMenu,
    closeMenu,
    toggleMenu,
    isMenuOpen: () => State.isMenuOpen,

    showUploadScreen,
    showDashboardScreen,
    goToHome,

    addMenuItem,
    selectFile,
    deleteFile,
    reindexItems,
    showEmptyState,
    updateCounters,
    processFile,
    handleFileUpload,
    openFileSelector,

    getState: () => ({
      uploadedFiles: [...State.uploadedFiles],
      totalFileSize: State.totalFileSize,
      selectedFileIndex: State.selectedFileIndex,
      fileCount: State.uploadedFiles.length,
    }),

    getDOM: () => ({ ...DOM }),

    init: function () {
      loadFilesFromStorage();
      updateCounters();

      if (isDashboardPage) {
        if (State.uploadedFiles.length === 0) {
          window.location.href = PAGES.UPLOAD;
          return this;
        }

        const storedIndex = loadSelectedIndex();
        const indexToShow =
          storedIndex >= 0 && storedIndex < State.uploadedFiles.length
            ? storedIndex
            : 0;

        showDashboardScreen();
        highlightAndSetSelected(indexToShow);
      } else {
        showUploadScreen();
      }

      console.log("✅ Estrutura inicializada");
      return this;
    },
  };

  // ============================================
  // 9. EVENT LISTENERS
  // ============================================

  if (DOM.hamburgerBtn) {
    DOM.hamburgerBtn.addEventListener("click", function (e) {
      e.preventDefault();
      toggleMenu();
    });
  }

  if (DOM.overlay) {
    DOM.overlay.addEventListener("click", function (e) {
      e.preventDefault();
      if (State.isMenuOpen) closeMenu();
    });
  }

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && State.isMenuOpen) {
      closeMenu();
    }
  });

  if (DOM.uploadBtn) {
    DOM.uploadBtn.addEventListener("click", function (e) {
      e.preventDefault();
      openFileSelector();
    });
  }

  if (DOM.fileInput) {
    DOM.fileInput.addEventListener("change", function (e) {
      if (this.files && this.files.length > 0) {
        handleFileUpload(this.files[0]);
      }
      this.value = "";
    });
  }

  if (DOM.uploadZone) {
    DOM.uploadZone.addEventListener("click", function (e) {
      e.preventDefault();
      openFileSelector();
    });

    ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
      DOM.uploadZone.addEventListener(eventName, function (e) {
        e.preventDefault();
        e.stopPropagation();

        switch (eventName) {
          case "dragover":
            this.classList.add("dragover");
            break;
          case "dragleave":
            this.classList.remove("dragover");
            break;
          case "drop":
            this.classList.remove("dragover");
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
              handleFileUpload(e.dataTransfer.files[0]);
            }
            break;
        }
      });
    });
  }

  if (DOM.btnUploadNew) {
    DOM.btnUploadNew.addEventListener("click", function (e) {
      e.preventDefault();
      goToHome();
    });
  }

  if (DOM.menuHomeBtn) {
    DOM.menuHomeBtn.addEventListener("click", function (e) {
      e.preventDefault();
      goToHome();
    });
  }

  let resizeTimer;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (window.innerWidth > 768 && State.isMenuOpen) {
        closeMenu();
      }
    }, 250);
  });

  // ============================================
  // 10. EXPOSIÇÃO GLOBAL
  // ============================================

  window.OntimeBoard = window.OntimeBoard || {};
  window.OntimeBoard.Estrutura = EstruturaAPI;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      EstruturaAPI.init();
    });
  } else {
    setTimeout(function () {
      EstruturaAPI.init();
    }, 0);
  }

  console.log("✅ OntimeBoard - Estrutura finalizada!");
  console.log("📌 Use OntimeBoard.Estrutura para acessar a API.");
})();