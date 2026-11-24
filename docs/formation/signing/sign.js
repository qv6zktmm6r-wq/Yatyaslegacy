(function () {
  const STORAGE_KEY = document.body.dataset.storageKey || "yatyas-signing";

  function normalize(value) {
    return String(value || "")
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();
  }

  function todayISO() {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${mm}-${dd}`;
  }

  function load() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    } catch {
      return {};
    }
  }

  function save(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function updateBlock(block) {
    const input = block.querySelector(".typed-signature");
    const date = block.querySelector(".date-field");
    const status = block.querySelector(".status-pill");
    const expected = normalize(input.dataset.expected);
    const value = normalize(input.value);
    const ok = value.length > 0 && value === expected;

    input.classList.toggle("is-valid", ok);
    input.classList.toggle("is-invalid", value.length > 0 && !ok);

    if (!value) {
      status.textContent = "Type full legal name to sign";
      status.className = "status-pill";
    } else if (ok) {
      status.textContent = "Digital signature captured";
      status.className = "status-pill ok";
      if (!date.value) date.value = todayISO();
    } else {
      status.textContent = "Name must match exactly: " + input.dataset.expected;
      status.className = "status-pill bad";
    }

    return ok;
  }

  function persistAll() {
    const state = {};
    document.querySelectorAll(".sign-block[data-signer]").forEach((block) => {
      const id = block.dataset.signer;
      const input = block.querySelector(".typed-signature");
      const date = block.querySelector(".date-field");
      state[id] = { name: input.value, date: date.value, valid: updateBlock(block) };
    });
    save(state);
    refreshSummary();
  }

  function restore() {
    const state = load();
    document.querySelectorAll(".sign-block[data-signer]").forEach((block) => {
      const saved = state[block.dataset.signer];
      if (!saved) return;
      block.querySelector(".typed-signature").value = saved.name || "";
      block.querySelector(".date-field").value = saved.date || "";
      updateBlock(block);
    });
    refreshSummary();
  }

  function refreshSummary() {
    const pills = [...document.querySelectorAll(".sign-block[data-signer] .status-pill")];
    const done = pills.filter((p) => p.classList.contains("ok")).length;
    const total = pills.length;
    const el = document.querySelector("[data-sign-summary]");
    if (el) el.textContent = `${done} of ${total} signatures complete`;
  }

  function clearAll() {
    if (!confirm("Clear all typed signatures on this document?")) return;
    localStorage.removeItem(STORAGE_KEY);
    document.querySelectorAll(".typed-signature, .date-field").forEach((el) => {
      el.value = "";
    });
    document.querySelectorAll(".sign-block[data-signer]").forEach(updateBlock);
    refreshSummary();
  }

  document.querySelectorAll(".sign-block[data-signer]").forEach((block) => {
    block.querySelector(".typed-signature").addEventListener("input", persistAll);
    block.querySelector(".date-field").addEventListener("input", persistAll);
  });

  document.querySelector("[data-action='print']")?.addEventListener("click", () => window.print());
  document.querySelector("[data-action='clear']")?.addEventListener("click", clearAll);

  restore();
})();
