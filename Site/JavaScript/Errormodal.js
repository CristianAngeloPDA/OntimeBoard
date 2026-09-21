/**
 * OntimeBoard - Modal de Erro
 *
 * Módulo autossuficiente: injeta o próprio CSS e HTML e expõe
 * uma API simples para exibir erros fatais (ex.: planilha
 * incompatível) de forma clara e amigável.
 *
 * Uso:
 *   ErrorModal.show({
 *     title:    "Planilha incompatível",
 *     message:  "O arquivo não segue o formato esperado.",
 *     fileName: "carga.xlsx",           // opcional
 *     details:  ["Coluna A ausente", "Coluna B ausente"] // opcional
 *   });
 *
 *   ErrorModal.hide();
 */

(function () {
  "use strict";

  let modalEl = null;
  let keydownBound = false;

  // ============================================
  // 1. CSS INJETADO
  // ============================================
  function injectCSS() {
    if (document.getElementById("errorModalStyles")) return;

    const style = document.createElement("style");
    style.id = "errorModalStyles";
    style.textContent = `
      .error-modal-overlay {
        position: fixed;
        inset: 0;
        background: rgba(12, 22, 35, 0.55);
        backdrop-filter: blur(6px);
        -webkit-backdrop-filter: blur(6px);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        opacity: 0;
        visibility: hidden;
        transition: opacity 0.3s ease, visibility 0.3s ease;
      }
      .error-modal-overlay.visible {
        opacity: 1;
        visibility: visible;
      }

      .error-modal {
        background: #ffffff;
        border-radius: 24px;
        padding: 36px 32px 28px;
        max-width: 520px;
        width: 100%;
        box-shadow:
          0 24px 64px rgba(0, 20, 40, 0.28),
          0 4px 12px rgba(0, 0, 0, 0.06);
        transform: translateY(14px) scale(0.98);
        transition: transform 0.35s cubic-bezier(0.2, 0.9, 0.3, 1);
        text-align: center;
        border-top: 4px solid #c62828;
      }
      .error-modal-overlay.visible .error-modal {
        transform: translateY(0) scale(1);
      }

      .error-modal-icon {
        width: 72px;
        height: 72px;
        margin: 0 auto 18px;
        border-radius: 50%;
        background: #fdecea;
        color: #c62828;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 2rem;
        animation: emShake 0.55s cubic-bezier(0.36, 0.07, 0.19, 0.97);
      }
      @keyframes emShake {
        10%, 90% { transform: translateX(-2px); }
        20%, 80% { transform: translateX(4px); }
        30%, 50%, 70% { transform: translateX(-6px); }
        40%, 60% { transform: translateX(6px); }
      }

      .error-modal-title {
        font-size: 1.35rem;
        font-weight: 700;
        color: #0c1f32;
        margin-bottom: 10px;
        letter-spacing: -0.2px;
      }

      .error-modal-message {
        font-size: 0.92rem;
        line-height: 1.6;
        color: #4f657b;
        margin-bottom: 16px;
      }

      .error-modal-file {
        display: inline-block;
        font-size: 0.82rem;
        color: #7a4a45;
        background: #fdecea;
        border: 1px solid #f3c6c6;
        padding: 6px 14px;
        border-radius: 20px;
        margin-bottom: 16px;
        max-width: 100%;
        word-break: break-word;
      }

      .error-modal-details {
        list-style: none;
        padding: 0;
        margin: 0 0 20px 0;
        text-align: left;
        background: #fafdff;
        border: 1px solid #eef3f9;
        border-radius: 12px;
        padding: 14px 18px;
      }

      .error-modal-details li {
        font-size: 0.85rem;
        line-height: 1.55;
        color: #1f3347;
        padding-left: 22px;
        position: relative;
        margin-bottom: 6px;
      }

      .error-modal-details li:last-child {
        margin-bottom: 0;
      }

      .error-modal-details li::before {
        content: "\\f111";
        font-family: "Font Awesome 6 Free", "Font Awesome 5 Free", sans-serif;
        font-weight: 900;
        font-size: 0.5rem;
        color: #c62828;
        position: absolute;
        left: 4px;
        top: 7px;
      }

      .error-modal-btn {
        background: #1f3a5f;
        color: #ffffff;
        border: none;
        font-family: "Inter", sans-serif;
        font-weight: 600;
        font-size: 0.95rem;
        padding: 12px 36px;
        border-radius: 60px;
        cursor: pointer;
        transition: 0.15s;
        box-shadow: 0 4px 10px rgba(20, 50, 90, 0.15);
      }

      .error-modal-btn:hover {
        background: #143152;
        transform: scale(1.02);
        box-shadow: 0 8px 18px rgba(20, 50, 90, 0.2);
      }

      .error-modal-btn:active {
        transform: scale(0.98);
      }

      .error-modal-btn:focus {
        outline: 2px solid #2a7de1;
        outline-offset: 3px;
      }

      @media (max-width: 480px) {
        .error-modal {
          padding: 28px 20px 22px;
        }
        .error-modal-icon {
          width: 60px;
          height: 60px;
          font-size: 1.7rem;
        }
        .error-modal-title {
          font-size: 1.15rem;
        }
        .error-modal-message {
          font-size: 0.85rem;
        }
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
    overlay.className = "error-modal-overlay";
    overlay.id = "errorModalOverlay";

    overlay.innerHTML = `
      <div class="error-modal" role="alertdialog" aria-modal="true" aria-labelledby="errorModalTitle">
        <div class="error-modal-icon">
          <i class="fas fa-exclamation-triangle"></i>
        </div>
        <h2 class="error-modal-title" id="errorModalTitle">Planilha incompatível</h2>
        <p class="error-modal-message" id="errorModalMessage"></p>
        <div class="error-modal-file" id="errorModalFile"></div>
        <ul class="error-modal-details" id="errorModalDetails"></ul>
        <button class="error-modal-btn" id="errorModalBtn" type="button">
          Entendi
        </button>
      </div>
    `;

    document.body.appendChild(overlay);
    modalEl = overlay;

    overlay
      .querySelector("#errorModalBtn")
      .addEventListener("click", function (e) {
        e.preventDefault();
        hide();
      });

    // Fecha ao clicar fora
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) hide();
    });

    // Fecha com ESC
    if (!keydownBound) {
      document.addEventListener("keydown", function (e) {
        if (
          e.key === "Escape" &&
          modalEl &&
          modalEl.classList.contains("visible")
        ) {
          hide();
        }
      });
      keydownBound = true;
    }

    return overlay;
  }

  // ============================================
  // 3. API PÚBLICA
  // ============================================
  function show(opts) {
    opts = opts || {};
    injectCSS();
    const el = buildModal();

    const titleEl = el.querySelector("#errorModalTitle");
    const msgEl = el.querySelector("#errorModalMessage");
    const fileEl = el.querySelector("#errorModalFile");
    const detEl = el.querySelector("#errorModalDetails");

    titleEl.textContent = opts.title || "Planilha incompatível";

    msgEl.textContent =
      opts.message ||
      "Não foi possível ler o arquivo. Verifique se o formato está correto e tente novamente.";

    if (opts.fileName) {
      fileEl.innerHTML = `<i class="fas fa-file-excel"></i> ${escapeHtml(
        opts.fileName,
      )}`;
      fileEl.style.display = "inline-block";
    } else {
      fileEl.style.display = "none";
    }

    if (Array.isArray(opts.details) && opts.details.length > 0) {
      detEl.innerHTML = opts.details
        .map((d) => `<li>${escapeHtml(d)}</li>`)
        .join("");
      detEl.style.display = "block";
    } else {
      detEl.innerHTML = "";
      detEl.style.display = "none";
    }

    el.classList.add("visible");
    document.body.style.overflow = "hidden";

    // Foca o botão (acessibilidade)
    setTimeout(function () {
      const btn = el.querySelector("#errorModalBtn");
      if (btn) btn.focus();
    }, 120);
  }

  function hide() {
    if (modalEl) modalEl.classList.remove("visible");
    document.body.style.overflow = "";
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  const ErrorModalAPI = { show, hide };

  window.OntimeBoard = window.OntimeBoard || {};
  window.OntimeBoard.ErrorModal = ErrorModalAPI;

  console.log("🚨 OntimeBoard - ErrorModal registrado");
})();