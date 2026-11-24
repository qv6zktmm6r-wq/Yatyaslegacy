(function () {
  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function setStatus(el, message, kind) {
    if (!el) return;
    el.hidden = !message;
    el.textContent = message || "";
    el.classList.toggle("is-success", kind === "ok");
    el.classList.toggle("is-error", kind === "err");
    el.classList.toggle("is-warn", kind === "warn");
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function fillFromObject(form, data, map) {
    if (!form || !data) return;
    Object.keys(map || {}).forEach(function (key) {
      var fieldName = map[key];
      if (!fieldName || data[key] == null || data[key] === "") return;
      var el = form.elements[fieldName];
      if (!el) return;
      var value = Array.isArray(data[key]) ? data[key].join(", ") : String(data[key]);
      el.value = value;
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }

  function renderCrewResult(box, data) {
    if (!box || !data) return;
    var chips = [
      data.unit && "Unit: " + data.unit,
      data.years && "Years: " + data.years,
      data.platform && "Platform: " + data.platform,
      data.duty_station && "Station: " + data.duty_station,
      data.deployment && "Deployment: " + data.deployment,
      data.schoolhouse && "Schoolhouse: " + data.schoolhouse,
    ].filter(Boolean);
    box.hidden = false;
    var chipHtml = chips.length
      ? '<ul class="ai-chip-row">' +
        chips
          .map(function (c) {
            return "<li>" + escapeHtml(c) + "</li>";
          })
          .join("") +
        "</ul>"
      : "";
    var note = data.clarifying_question
      ? '<p class="ai-result-note">' + escapeHtml(data.clarifying_question) + "</p>"
      : "";
    box.innerHTML =
      '<p class="ai-result-label">We read this as</p>' +
      chipHtml +
      '<p class="ai-result-body">' +
      escapeHtml(data.looking_for || data.query_summary || "") +
      "</p>" +
      note;
  }

  function assist(mode, text) {
    return fetch("/api/assist", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ mode: mode, text: text, company: "" }),
    }).then(function (res) {
      return res.json().catch(function () {
        return {};
      }).then(function (data) {
        if (!res.ok || !data.ok) {
          throw new Error(data.error || "Assist failed");
        }
        return data;
      });
    });
  }

  function bindCrew() {
    var form = $("#crew-ai-form");
    if (!form) return;
    var status = $("#crew-ai-status");
    var result = $("#crew-ai-result");
    var submitBtn = form.querySelector('[type="submit"]');
    var boardForm = $("#crew-board-form");

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var text = String(form.elements.story.value || "").trim();
      var name = String(form.elements.name.value || "").trim();
      var email = String(form.elements.email.value || "").trim();
      if (text.length < 12) {
        setStatus(status, "Tell us a bit more — unit, years, or who you’re looking for.", "err");
        return;
      }
      if (!name || !email) {
        setStatus(status, "Add your name and email so the board can follow up.", "err");
        return;
      }
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Structuring…";
      }
      setStatus(status, "Structuring your story…", "warn");
      assist("crew_parse", text)
        .then(function (payload) {
          var data = payload.data || {};
          renderCrewResult(result, data);
          if (boardForm) {
            boardForm.hidden = false;
            fillFromObject(
              boardForm,
              {
                name: name,
                email: email,
                looking_for: data.looking_for || text,
                looking_unit: data.unit || "",
                looking_years: data.years || "",
                looking_platform: data.platform || "",
                looking_station: data.duty_station || "",
                looking_deployment: data.deployment || "",
                looking_schoolhouse: data.schoolhouse || "",
                ai_summary: data.query_summary || "",
                ai_confidence: data.confidence || "",
                raw_story: text,
              },
              {
                name: "name",
                email: "email",
                looking_for: "looking_for",
                looking_unit: "looking_unit",
                looking_years: "looking_years",
                looking_platform: "looking_platform",
                looking_station: "looking_station",
                looking_deployment: "looking_deployment",
                looking_schoolhouse: "looking_schoolhouse",
                ai_summary: "ai_summary",
                ai_confidence: "ai_confidence",
                raw_story: "raw_story",
              }
            );
            boardForm.scrollIntoView({ behavior: "smooth", block: "start" });
          }
          setStatus(
            status,
            payload.provider === "fallback"
              ? "Structured from your story — review and send to the board."
              : "Review below, then send it for board follow-up.",
            payload.provider === "fallback" ? "warn" : "ok"
          );
        })
        .catch(function (err) {
          setStatus(status, err.message || "Could not structure your story.", "err");
        })
        .finally(function () {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = "Find my crew";
          }
        });
    });
  }

  function renderAssistOut(mode, out, data) {
    if (!out) return;
    out.hidden = false;
    if (mode === "scholarship_qa") {
      out.innerHTML =
        '<p class="ai-result-label">Guidance</p><p class="ai-result-body">' +
        escapeHtml(data.answer || "") +
        '</p><p class="ai-result-note">Likely eligible: ' +
        escapeHtml(data.likely_eligible || "unknown") +
        " · " +
        escapeHtml(data.next_step || "") +
        "</p>";
      return;
    }
    if (mode === "oral_assist") {
      var topicHtml = (data.topics || [])
        .map(function (t) {
          return "<li>" + escapeHtml(t) + "</li>";
        })
        .join("");
      var qHtml = "";
      if (data.interview_questions && data.interview_questions.length) {
        qHtml =
          '<ol class="ai-q-list">' +
          data.interview_questions
            .map(function (q) {
              return "<li>" + escapeHtml(q) + "</li>";
            })
            .join("") +
          "</ol>";
      }
      out.innerHTML =
        '<p class="ai-result-label">' +
        escapeHtml(data.suggested_title || "Suggested framing") +
        '</p><p class="ai-result-body">' +
        escapeHtml(data.summary || "") +
        '</p><ul class="ai-chip-row">' +
        topicHtml +
        "</ul>" +
        qHtml;
      return;
    }
    if (mode === "splash_assist") {
      out.innerHTML =
        '<p class="ai-result-label">Draft remembrance</p><p class="ai-result-body">' +
        escapeHtml(data.draft_remembrance || "") +
        "</p>";
      return;
    }
    if (mode === "legacy_assist") {
      out.innerHTML =
        '<p class="ai-result-label">Draft profile</p><p class="ai-result-body">' +
        escapeHtml(data.short_bio || "") +
        "</p>";
      return;
    }
    out.textContent = JSON.stringify(data, null, 2);
  }

  function bindAssistButton(btn) {
    var mode = btn.getAttribute("data-ai-mode");
    var sourceSel = btn.getAttribute("data-ai-source");
    var formSel = btn.getAttribute("data-ai-form");
    var statusSel = btn.getAttribute("data-ai-status");
    var mapRaw = btn.getAttribute("data-ai-map");
    var outSel = btn.getAttribute("data-ai-out");
    var map = {};
    try {
      map = JSON.parse(mapRaw || "{}");
    } catch (_) {}

    btn.addEventListener("click", function () {
      var source = $(sourceSel);
      var status = $(statusSel);
      var form = formSel ? $(formSel) : null;
      var out = outSel ? $(outSel) : null;
      var text = source ? String(source.value || "").trim() : "";
      if (text.length < 8) {
        setStatus(status, "Add a short note first.", "err");
        return;
      }
      btn.disabled = true;
      var label = btn.textContent;
      btn.textContent = "Working…";
      setStatus(status, "Drafting…", "warn");
      assist(mode, text)
        .then(function (payload) {
          var data = payload.data || {};
          fillFromObject(form, data, map);
          renderAssistOut(mode, out, data);
          setStatus(
            status,
            payload.provider === "fallback"
              ? payload.warning || "Draft ready (basic)."
              : "Draft ready — edit anything before sending.",
            payload.provider === "fallback" ? "warn" : "ok"
          );
        })
        .catch(function (err) {
          setStatus(status, err.message || "Could not draft that yet.", "err");
        })
        .finally(function () {
          btn.disabled = false;
          btn.textContent = label;
        });
    });
  }

  function bindContactRoute() {
    var form = $("#contact-form");
    if (!form || form.getAttribute("data-ai-route") !== "true") return;
    form.addEventListener(
      "submit",
      function (event) {
        if (form.getAttribute("data-ai-routed") === "1") return;
        var message = String((form.elements.message && form.elements.message.value) || "").trim();
        if (message.length < 10) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        assist("contact_route", message)
          .then(function (payload) {
            var data = payload.data || {};
            var hiddenCat = form.elements.category;
            if (!hiddenCat) {
              hiddenCat = document.createElement("input");
              hiddenCat.type = "hidden";
              hiddenCat.name = "category";
              form.appendChild(hiddenCat);
            }
            hiddenCat.value = data.category || "general";
            var hiddenSub = form.elements.ai_subject;
            if (!hiddenSub) {
              hiddenSub = document.createElement("input");
              hiddenSub.type = "hidden";
              hiddenSub.name = "ai_subject";
              form.appendChild(hiddenSub);
            }
            hiddenSub.value = data.subject_line || "";
            form.setAttribute("data-subject", data.subject_line || "YAT-YAS Association contact");
            form.setAttribute("data-ai-routed", "1");
            if (typeof form.requestSubmit === "function") form.requestSubmit();
            else form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
          })
          .catch(function () {
            form.setAttribute("data-ai-routed", "1");
            if (typeof form.requestSubmit === "function") form.requestSubmit();
            else form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
          });
      },
      true
    );
  }

  document.querySelectorAll("[data-ai-mode]").forEach(bindAssistButton);
  bindCrew();
  bindContactRoute();
})();
