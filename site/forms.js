(function () {
  var endpoint = "https://formsubmit.co/ajax/board@yatyasassociation.com";
  var firstWaveEndpoint =
    "https://hub.yatyasassociation.com/api/first-wave-waitlist";
  var emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function fieldWrap(input) {
    return input.closest(".form-field");
  }

  function setError(form, name, message) {
    var input = form.elements[name];
    if (!input || input.name === "_gotcha") return;
    var wrap = fieldWrap(input);
    var err = form.querySelector('[data-error-for="' + name + '"]');
    if (wrap) wrap.classList.toggle("is-invalid", Boolean(message));
    if (err) {
      err.hidden = !message;
      err.textContent = message || "";
    }
    if (message) input.setAttribute("aria-invalid", "true");
    else input.removeAttribute("aria-invalid");
  }

  function clearStatus(statusEl) {
    if (!statusEl) return;
    statusEl.hidden = true;
    statusEl.textContent = "";
    statusEl.classList.remove("is-success", "is-error");
  }

  function showStatus(statusEl, message, ok) {
    if (!statusEl) return;
    statusEl.hidden = false;
    statusEl.classList.toggle("is-success", Boolean(ok));
    statusEl.classList.toggle("is-error", !ok);
    statusEl.textContent = message;
  }

  function collectPayload(form) {
    var data = {};
    Array.prototype.forEach.call(form.elements, function (el) {
      if (!el.name || el.name === "_gotcha" || el.disabled) return;
      if ((el.type === "checkbox" || el.type === "radio") && !el.checked) return;
      var value = String(el.value || "").trim();
      if (!value) return;
      data[el.name] = value;
    });
    return data;
  }

  function validateForm(form) {
    var ok = true;
    var required = form.querySelectorAll("[required]");
    required.forEach(function (input) {
      var name = input.name;
      var value = String(input.value || "").trim();
      if (!value) {
        setError(form, name, "This field is required.");
        ok = false;
      } else if (input.type === "email" && !emailPattern.test(value)) {
        setError(form, name, "Please enter a valid email address.");
        ok = false;
      } else {
        setError(form, name, "");
      }
    });
    var email = form.elements.email;
    if (email && !email.required) {
      var ev = String(email.value || "").trim();
      if (ev && !emailPattern.test(ev)) {
        setError(form, "email", "Please enter a valid email address.");
        ok = false;
      }
    }
    return ok;
  }

  function mailtoFallback(subject, data) {
    var lines = Object.keys(data).map(function (key) {
      return key + ": " + data[key];
    });
    var body = encodeURIComponent(lines.join("\n"));
    window.location.href =
      "mailto:board@yatyasassociation.com?subject=" +
      encodeURIComponent(subject) +
      "&body=" +
      body;
  }

  function bindForm(form) {
    var subject =
      form.getAttribute("data-subject") || "YAT-YAS Association form submission";
    var statusEl =
      form.querySelector(".form-status") ||
      document.getElementById(form.id + "-status");
    var submitBtn = form.querySelector('[type="submit"]');
    var defaultLabel = submitBtn ? submitBtn.textContent : "";

    form.addEventListener("input", function (event) {
      var target = event.target;
      if (!target || !target.name) return;
      clearStatus(statusEl);
      if (fieldWrap(target) && fieldWrap(target).classList.contains("is-invalid")) {
        validateForm(form);
      }
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      clearStatus(statusEl);
      if (!validateForm(form)) {
        var firstInvalid = form.querySelector(
          ".is-invalid input, .is-invalid textarea, .is-invalid select"
        );
        if (firstInvalid) firstInvalid.focus();
        return;
      }

      if (String((form.elements._gotcha && form.elements._gotcha.value) || "").trim()) {
        showStatus(statusEl, "Thanks — your message was received.", true);
        form.reset();
        return;
      }

      var data = collectPayload(form);
      var name = data.name || "";
      data._subject = subject + (name ? " — " + name : "");
      data._template = "table";
      if (data.email) data._replyto = data.email;

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Sending…";
      }

      var isFirstWave = form.id === "first-wave-form";
      var postUrl = isFirstWave ? firstWaveEndpoint : endpoint;

      fetch(postUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(data),
      })
        .then(function (res) {
          return res
            .json()
            .catch(function () {
              return {};
            })
            .then(function (payload) {
              return { ok: res.ok, data: payload };
            });
        })
        .then(function (payload) {
          if (isFirstWave) {
            if (payload.data && payload.data.ok) {
              form.reset();
              Array.prototype.forEach.call(form.elements, function (el) {
                if (el.name) setError(form, el.name, "");
              });
              var seats =
                payload.data.registration &&
                payload.data.registration.seats_remaining;
              showStatus(
                statusEl,
                "Thank you" +
                  (name ? ", " + name.split(/\s+/)[0] : "") +
                  ". You’re on the First Wave waitlist. The Board will verify you and issue your number." +
                  (typeof seats === "number"
                    ? " About " + seats + " public seats remain."
                    : ""),
                true
              );
              return;
            }
            throw new Error(
              (payload.data && payload.data.error) || "send-failed"
            );
          }
          if (
            payload.ok ||
            payload.data.success === "true" ||
            payload.data.success === true
          ) {
            form.reset();
            Array.prototype.forEach.call(form.elements, function (el) {
              if (el.name) setError(form, el.name, "");
            });
            showStatus(
              statusEl,
              "Thank you" +
                (name ? ", " + name.split(/\s+/)[0] : "") +
                ". Your submission was sent to the Association board.",
              true
            );
            return;
          }
          throw new Error("send-failed");
        })
        .catch(function (err) {
          var msg = err && err.message ? String(err.message) : "";
          if (
            isFirstWave &&
            msg &&
            msg !== "send-failed" &&
            msg.indexOf("Failed to fetch") === -1 &&
            msg.indexOf("NetworkError") === -1
          ) {
            showStatus(statusEl, msg, false);
            return;
          }
          mailtoFallback(data._subject, data);
          showStatus(
            statusEl,
            "Opening your email app as a backup — you can also write board@yatyasassociation.com directly.",
            true
          );
        })
        .finally(function () {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = defaultLabel;
          }
        });
    });
  }

  function loadFirstWaveSeats() {
    var el = document.getElementById("fw-seat-status");
    if (!el) return;
    fetch(firstWaveEndpoint, { method: "GET", headers: { Accept: "application/json" } })
      .then(function (res) {
        return res.json();
      })
      .then(function (payload) {
        if (!payload || !payload.ok || !payload.registration) return;
        var reg = payload.registration;
        if (!reg.registrations_open) {
          el.hidden = false;
          el.textContent =
            (reg.wave_label || "First Wave") +
            " registrations are closed" +
            (reg.closed_reason ? " — " + reg.closed_reason : ".");
          return;
        }
        el.hidden = false;
        el.textContent =
          (reg.wave_label || "First Wave") +
          ": " +
          reg.seats_remaining +
          " public seats remaining (Board-held numbers reserved). Next public number " +
          (reg.tag_prefix || "FW") +
          "-" +
          String(reg.next_number || 0).padStart(3, "0") +
          ".";
      })
      .catch(function () {});
  }

  document.querySelectorAll("form[data-yat-form]").forEach(bindForm);
  loadFirstWaveSeats();

  var tabsRoot = document.querySelector("[data-crew-tabs]");
  if (tabsRoot) {
    var tabs = Array.prototype.slice.call(
      tabsRoot.querySelectorAll("[data-crew-tab]")
    );
    var panels = Array.prototype.slice.call(
      tabsRoot.querySelectorAll("[data-crew-panel]")
    );

    function activate(name, focusTab) {
      tabs.forEach(function (tab) {
        var on = tab.getAttribute("data-crew-tab") === name;
        tab.classList.toggle("is-active", on);
        tab.setAttribute("aria-selected", on ? "true" : "false");
        tab.tabIndex = on ? 0 : -1;
        if (on && focusTab) tab.focus();
      });
      panels.forEach(function (panel) {
        var on = panel.getAttribute("data-crew-panel") === name;
        panel.classList.toggle("is-active", on);
        if (on) panel.removeAttribute("hidden");
        else panel.setAttribute("hidden", "");
      });
    }

    tabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        activate(tab.getAttribute("data-crew-tab"), false);
      });
      tab.addEventListener("keydown", function (event) {
        var index = tabs.indexOf(tab);
        var next = index;
        if (event.key === "ArrowRight" || event.key === "ArrowDown") {
          next = (index + 1) % tabs.length;
        } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
          next = (index - 1 + tabs.length) % tabs.length;
        } else if (event.key === "Home") {
          next = 0;
        } else if (event.key === "End") {
          next = tabs.length - 1;
        } else {
          return;
        }
        event.preventDefault();
        activate(tabs[next].getAttribute("data-crew-tab"), true);
      });
    });
  }
})();
