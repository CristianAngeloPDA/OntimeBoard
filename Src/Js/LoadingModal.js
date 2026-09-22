/**
 * OntimeBoard - Modal de Processamento
 *
 * Módulo autossuficiente: injeta o próprio CSS e HTML no DOM e expõe
 * uma API simples para controlar as etapas do carregamento:
 *
 *   LoadingModal.show()          -> exibe o modal
 *   LoadingModal.setStage(n)     -> marca etapa n como ativa (1..4)
 *   LoadingModal.setProgress(p)  -> define o progresso (0..100)
 *   LoadingModal.hide()          -> esconde o modal
 *
 * As etapas são:
 *   1. Upload         (Arquivo recebido)
 *   2. Processamento  (Analisando dados...)
 *   3. Preparação     (Preparando gráficos...)
 *   4. Finalização    (Tudo pronto! Redirecionando...)
 */

(function () {
  "use strict";

  const STAGES = [
    { id: 1, label: "Upload",         detail: "Arquivo recebido",                      icon: "fa-cloud-upload-alt" },
    { id: 2, label: "Processamento",  detail: "Analisando dados...",                    icon: "fa-cogs" },
    { id: 3, label: "Preparação",     detail: "Preparando gráficos...",                 icon: "fa-chart-line" },
    { id: 4, label: "Finalização",    detail: "Tudo pronto! Redirecionando...",         icon: "fa-flag-checkered" },
  ];

  let modalEl = null;

  // ============================================
  // 1. CSS INJETADO
  // ============================================
  function injectCSS() {
    if (document.getElementById("loadingModalStyles")) return;

    const style = document.createElement("style");
    style.id = "loadingModalStyles";
    style.textContent = `
      .loading-modal-overlay {
        position: fixed;
        inset: 0;
        background: rgba(12, 22, 35, 0.55);
        backdrop-filter: blur(6px);
        -webkit-backdrop-filter: blur(6px);
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        opacity: 0;
        visibility: hidden;
        transition: opacity 0.3s ease, visibility 0.3s ease;
      }
      .loading-modal-overlay.visible {
        opacity: 1;
        visibility: visible;
      }

      .loading-modal {
        background: #ffffff;
        border-radius: 24px;
        padding: 36px 32px 28px;
        max-width: 470px;
        width: 100%;
        box-shadow: 0 24px 64px rgba(0, 20, 40, 0.25),
                    0 4px 12px rgba(0, 0, 0, 0.06);
        transform: translateY(14px) scale(0.98);
        transition: transform 0.35s cubic-bezier(0.2, 0.9, 0.3, 1);
      }
      .loading-modal-overlay.visible .loading-modal {
        transform: translateY(0) scale(1);
      }

      .loading-modal-header {
        text-align: center;
        margin-bottom: 24px;
      }
      .loading-spinner {
        width: 56px;
        height: 56px;
        margin: 0 auto 16px;
        border-radius: 50%;
        border: 4px solid #e3edfc;
        border-top-color: #2a7de1;
        animation: lmSpin 0.9s linear infinite;
      }
      @keyframes lmSpin { to { transform: rotate(360deg); } }

      .loading-modal-header h2 {
        font-size: 1.25rem;
        font-weight: 700;
        color: #0c1f32;
        margin-bottom: 8px;
      }
      .loading-modal-header p {
        font-size: 0.88rem;
        color: #6b7c8f;
        line-height: 1.55;
      }

      /* Barra de progresso */
      .loading-progress-track {
        width: 100%;
        height: 8px;
        background: #eef3f9;
        border-radius: 20px;
        overflow: hidden;
        margin-bottom: 24px;
      }
      .loading-progress-bar {
        height: 100%;
        width: 0%;
        border-radius: 20px;
        background: linear-gradient(90deg, #2a7de1 0%, #1a6bd0 100%);
        transition: width 0.5s cubic-bezier(0.2, 0.9, 0.3, 1);
        position: relative;
        overflow: hidden;
        box-shadow: 0 0 12px rgba(42, 125, 225, 0.45);
      }
      .loading-progress-bar::after {
        content: "";
        position: absolute;
        inset: 0;
        background: linear-gradient(
          90deg,
          transparent,
          rgba(255, 255, 255, 0.45),
          transparent
        );
        animation: lmShimmer 1.4s infinite;
      }
      @keyframes lmShimmer {
        0%   { transform: translateX(-100%); }
        100% { transform: translateX(100%); }
      }

      /* Lista de etapas */
      .loading-stages {
        list-style: none;
        padding: 0;
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .loading-stage {
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 10px 14px;
        border-radius: 12px;
        background: #f8fbfe;
        border: 1px solid #eef3f9;
        transition: all 0.3s ease;
        opacity: 0.55;
      }
      .loading-stage .stage-icon {
        width: 34px;
        height: 34px;
        border-radius: 50%;
        background: #e3edfc;
        color: #2a7de1;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.9rem;
        flex-shrink: 0;
        transition: all 0.3s ease;
      }
      .loading-stage .stage-text {
        display: flex;
        flex-direction: column;
        gap: 2px;
        flex: 1;
        min-width: 0;
      }
      .loading-stage .stage-title {
        font-size: 0.86rem;
        font-weight: 600;
        color: #1a2634;
      }
      .loading-stage .stage-detail {
        font-size: 0.76rem;
        color: #6b7c8f;
      }

      .loading-stage.active {
        opacity: 1;
        background: #eff6ff;
        border-color: #c9ddf7;
      }
      .loading-stage.active .stage-icon {
        background: #2a7de1;
        color: #fff;
        animation: lmPulse 1.3s ease-in-out infinite;
      }
      @keyframes lmPulse {
        0%, 100% { box-shadow: 0 0 0 0 rgba(42, 125, 225, 0.5); }
        50%      { box-shadow: 0 0 0 8px rgba(42, 125, 225, 0); }
      }

      .loading-stage.done {
        opacity: 1;
        background: #f0faf3;
        border-color: #c8e6d1;
      }
      .loading-stage.done .stage-icon {
        background: #388e3c;
        color: #fff;
        animation: none;
      }
      .loading-stage.done .stage-detail {
        color: #2e7d32;
      }
      .loading-stage.done .stage-icon i::before {
        /* Vira um "check" quando a etapa termina */
        content: "\\f00c";
        font-family: "Font Awesome 6 Free", "Font Awesome 5 Free", sans-serif;
        font-weight: 900;
      }

      @media (max-width: 480px) {
        .loading-modal { padding: 28px 20px 22px; }
        .loading-modal-header h2 { font-size: 1.1rem; }
        .loading-stage { padding: 9px 11px; gap: 11px; }
      }
    `;
    document.head.appendChild(style);
  }

  // ============================================
  // 2. CONSTRUÇÃO DO MODAL
  // ============================================
  function buildModal() {
    if (modalEl) return modalEl;

    const overlay = document.createElement("div");
    overlay.className = "loading-modal-overlay";
    overlay.id = "loadingModalOverlay";

    const stagesHTML = STAGES.map(
      (s) => `
        <li class="loading-stage" data-stage="${s.id}">
          <div class="stage-icon">
            <i class="fas ${s.icon}"></i>
          </div>
          <div class="stage-text">
            <span class="stage-title">${s.label}</span>
            <span class="stage-detail">${s.detail}</span>
          </div>
        </li>
      `,
    ).join("");

    overlay.innerHTML = `
      <div class="loading-modal" role="dialog" aria-modal="true" aria-labelledby="loadingModalTitle">
        <div class="loading-modal-header">
          <div class="loading-spinner"></div>
          <h2 id="loadingModalTitle">Processando arquivo...</h2>
          <p>
            Estamos analisando os dados e preparando seus gráficos.<br>
            Isso pode levar alguns segundos.
          </p>
        </div>

        <div class="loading-progress-track">
          <div class="loading-progress-bar" id="loadingProgressBar"></div>
        </div>

        <ul class="loading-stages" id="loadingStages">
          ${stagesHTML}
        </ul>
      </div>
    `;

    document.body.appendChild(overlay);
    modalEl = overlay;
    return overlay;
  }

  // ============================================
  // 3. CONTROLE DE ESTADO
  // ============================================
  function show() {
    injectCSS();
    const el = buildModal();
    setStage(1);
    setProgress(0);
    el.classList.add("visible");
    document.body.style.overflow = "hidden";
  }

  function hide() {
    if (modalEl) modalEl.classList.remove("visible");
    document.body.style.overflow = "";
  }

  function setStage(n) {
    if (!modalEl) return;
    modalEl.querySelectorAll(".loading-stage").forEach((item) => {
      const stageNum = parseInt(item.dataset.stage, 10);
      item.classList.remove("active", "done");
      if (stageNum < n) item.classList.add("done");
      else if (stageNum === n) item.classList.add("active");
    });
  }

  function setProgress(pct) {
    if (!modalEl) return;
    const clamped = Math.max(0, Math.min(100, pct));
    const bar = modalEl.querySelector("#loadingProgressBar");
    if (bar) bar.style.width = clamped + "%";
  }

  // ============================================
  // 4. API PÚBLICA
  // ============================================
  const LoadingModalAPI = {
    show,
    hide,
    setStage,
    setProgress,
  };

  window.OntimeBoard = window.OntimeBoard || {};
  window.OntimeBoard.LoadingModal = LoadingModalAPI;

  console.log("⏳ OntimeBoard - LoadingModal registrado");
})();