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

  function setHidden(form, name, value) {
    if (!form.elements[name]) return;
    form.elements[name].value = value == null ? "" : String(value);
  }

  function renderCrewMatches(box, payload) {
    if (!box) return;
    var matches = (payload && payload.matches) || [];
    if (!matches.length) {
      if (payload && payload.intent === "list") {
        var seeking = Number(payload.seeking_count || 0);
        box.hidden = false;
        box.innerHTML =
          '<p class="ai-result-label">You’re on the wall for matching</p>' +
          '<p class="ai-result-body">Listed privately. ' +
          (seeking
            ? seeking +
              " open find request" +
              (seeking === 1 ? "" : "s") +
              " are waiting — the Board introduces with consent."
            : "When someone looks for your unit/years/platform, the Board can introduce you with consent.") +
          "</p>";
        return;
      }
      box.hidden = false;
      box.innerHTML =
        '<p class="ai-result-label">No live match yet</p>' +
        '<p class="ai-result-body">Your request is with the Board. As more crew list themselves, matching runs live — introductions stay private until both sides agree.</p>';
      return;
    }
    var cards = matches
      .map(function (m) {
        var meta = [m.unit, m.years, m.platform, m.station]
          .filter(Boolean)
          .join(" · ");
        var overlap = (m.overlap || []).join(", ");
        return (
          '<li class="crew-match-card">' +
          '<p class="crew-match-name">' +
          escapeHtml(m.display_name) +
          "</p>" +
          (meta
            ? '<p class="crew-match-meta">' + escapeHtml(meta) + "</p>"
            : "") +
          (overlap
            ? '<p class="crew-match-overlap">Overlap: ' +
              escapeHtml(overlap) +
              "</p>"
            : "") +
          "</li>"
        );
      })
      .join("");
    box.hidden = false;
    box.innerHTML =
      '<p class="ai-result-label">Possible crew matches</p>' +
      '<ul class="crew-match-list" role="list">' +
      cards +
      "</ul>" +
      '<p class="ai-result-note">Emails stay private. The Board will introduce you if both sides want the reconnect.</p>';
  }

  function sendCrewToHub(payload) {
    return fetch("https://hub.yatyasassociation.com/api/crew-finder", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      credentials: "omit",
      cache: "no-store",
      body: JSON.stringify(payload),
    }).then(function (res) {
      return res
        .json()
        .catch(function () {
          return {};
        })
        .then(function (data) {
          if (res.ok && data && data.ok) return data;
          throw new Error((data && data.error) || "crew-hub-failed");
        });
    });
  }

  function notifyBoardFormSubmit(payload) {
    return fetch("https://formsubmit.co/ajax/board@yatyasassociation.com", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    }).then(function (res) {
      return res
        .json()
        .catch(function () {
          return {};
        })
        .then(function (data) {
          if (
            res.ok ||
            data.success === "true" ||
            data.success === true
          ) {
            return data;
          }
          throw new Error("send-failed");
        });
    });
  }

  function bindCrew() {
    var form = $("#crew-finder-form") || $("#crew-ai-form");
    if (!form) return;
    var status = $("#crew-finder-status") || $("#crew-ai-status");
    var result = $("#crew-ai-result");
    var submitBtn = form.querySelector('[type="submit"]') || $("#crew-submit-btn");
    var intentGroup = document.querySelector("[data-crew-intent]");
    var heading = $("#crew-form-heading");
    var lede = $("#crew-form-lede");
    var storyLabel = $("#crew-story-label");
    var storyField = $("#crew-story");
    var intentValue = $("#crew-intent-value");
    var currentIntent = "find";

    var copy = {
      find: {
        heading: "Who are you looking for?",
        lede:
          'Example: <em>“Looking for 3d Tracks guys from 2010–2014 on AAVs at Pendleton — especially motor-T shop.”</em>',
        storyLabel: "Your story",
        placeholder:
          "Unit, years, platform, station, deployment, who you hope to find…",
        button: "Find my crew",
        sending: "Matching against listed crew…",
        thanks:
          ". Live matching ran. The Board still handles introductions privately.",
        subject: "YAT-YAS Crew Finder match",
        shortErr: "Tell us a bit more — unit, years, or who you’re looking for.",
      },
      list: {
        heading: "Add yourself to Crew Finder",
        lede:
          "Tell us where you served so others looking for that crew can be matched live — introductions stay private until you both agree.",
        storyLabel: "About your service",
        placeholder:
          "Unit, years, platform, station, deployment, billet — how others might remember you…",
        button: "Add me to Crew Finder",
        sending: "Listing you for live matching…",
        thanks:
          ". You’re listed for live matching. The Board only reconnects with consent.",
        subject: "YAT-YAS Crew Finder listing",
        shortErr: "Tell us a bit more — unit, years, platform, or where you served.",
      },
    };

    function applyIntent(intent) {
      currentIntent = intent === "list" ? "list" : "find";
      var c = copy[currentIntent];
      if (intentValue) intentValue.value = currentIntent;
      if (heading) heading.textContent = c.heading;
      if (lede) lede.innerHTML = c.lede;
      if (storyLabel) storyLabel.textContent = c.storyLabel;
      if (storyField) storyField.placeholder = c.placeholder;
      if (submitBtn) submitBtn.textContent = c.button;
      if (intentGroup) {
        intentGroup.querySelectorAll("[data-intent]").forEach(function (btn) {
          var on = btn.getAttribute("data-intent") === currentIntent;
          btn.classList.toggle("is-active", on);
          btn.setAttribute("aria-pressed", on ? "true" : "false");
        });
      }
    }

    if (intentGroup) {
      intentGroup.addEventListener("click", function (event) {
        var btn = event.target.closest("[data-intent]");
        if (!btn) return;
        applyIntent(btn.getAttribute("data-intent") || "find");
      });
    }

    var params = new URLSearchParams(window.location.search);
    if (params.get("intent") === "list") applyIntent("list");
    else applyIntent("find");

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var c = copy[currentIntent];
      var text = String(form.elements.story.value || "").trim();
      var name = String(form.elements.name.value || "").trim();
      var email = String(form.elements.email.value || "").trim();
      var preferredUnit = String(
        (form.elements.preferred_unit && form.elements.preferred_unit.value) || ""
      ).trim();
      if (text.length < 12) {
        setStatus(status, c.shortErr, "err");
        return;
      }
      if (!name || !email) {
        setStatus(status, "Add your name and email so the board can follow up.", "err");
        return;
      }
      if (String((form.elements._gotcha && form.elements._gotcha.value) || "").trim()) {
        setStatus(status, "Thanks — your message was received.", "ok");
        form.reset();
        applyIntent(currentIntent);
        return;
      }
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Sending…";
      }
      setStatus(status, c.sending, "warn");

      var parsed = {};
      assist("crew_parse", text)
        .then(function (payload) {
          parsed = payload.data || {};
          if (result) renderCrewResult(result, parsed);
        })
        .catch(function () {
          parsed = {};
        })
        .then(function () {
          var lookingFor = parsed.looking_for || text;
          var unit = parsed.unit || preferredUnit || "";
          setHidden(form, "raw_story", text);
          setHidden(form, "looking_for", lookingFor);
          setHidden(form, "looking_unit", unit);
          setHidden(form, "looking_years", parsed.years || "");
          setHidden(form, "looking_platform", parsed.platform || "");
          setHidden(form, "looking_station", parsed.duty_station || "");
          setHidden(form, "looking_deployment", parsed.deployment || "");
          setHidden(form, "looking_schoolhouse", parsed.schoolhouse || "");
          setHidden(form, "ai_summary", parsed.query_summary || "");
          setHidden(form, "ai_confidence", parsed.confidence || "");
          setHidden(form, "crew_intent", currentIntent);

          var hubPayload = {
            name: name,
            email: email,
            story: text,
            raw_story: text,
            crew_intent: currentIntent,
            looking_for: lookingFor,
            looking_unit: unit,
            looking_years: parsed.years || "",
            looking_platform: parsed.platform || "",
            looking_station: parsed.duty_station || "",
            looking_deployment: parsed.deployment || "",
            looking_schoolhouse: parsed.schoolhouse || "",
            preferred_unit: preferredUnit,
            ai_summary: parsed.query_summary || "",
            ai_confidence: parsed.confidence || "",
            _gotcha:
              (form.elements._gotcha && form.elements._gotcha.value) || "",
          };

          return sendCrewToHub(hubPayload).then(function (hubResult) {
            notifyBoardFormSubmit({
              name: name,
              email: email,
              story: text,
              crew_intent: currentIntent,
              looking_for: lookingFor,
              looking_unit: unit,
              looking_years: parsed.years || "",
              looking_platform: parsed.platform || "",
              looking_station: parsed.duty_station || "",
              preferred_unit: preferredUnit,
              ai_summary: parsed.query_summary || "",
              match_count: (hubResult.matches || []).length,
              _subject: c.subject + " — " + name,
              _template: "table",
              _replyto: email,
            }).catch(function () {
              /* Hub is source of truth; FormSubmit is a Board notify only. */
            });
            return hubResult;
          });
        })
        .then(function (hubResult) {
          form.reset();
          applyIntent(currentIntent);
          renderCrewMatches(result, hubResult || {});
          setStatus(
            status,
            "Thank you" +
              (name ? ", " + name.split(/\s+/)[0] : "") +
              c.thanks,
            "ok"
          );
        })
        .catch(function () {
          var body =
            "Intent: " +
            currentIntent +
            "\nName: " +
            name +
            "\nEmail: " +
            email +
            "\n\nStory:\n" +
            text;
          window.location.href =
            "mailto:board@yatyasassociation.com?subject=" +
            encodeURIComponent(c.subject + " — " + name) +
            "&body=" +
            encodeURIComponent(body);
          setStatus(
            status,
            "Opening your email app as a backup — you can also write board@yatyasassociation.com directly.",
            "ok"
          );
        })
        .finally(function () {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = c.button;
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
