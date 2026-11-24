(function () {
  var header = document.querySelector("[data-site-header]");
  var toggle = document.querySelector("[data-nav-toggle]");
  var nav = document.querySelector("[data-nav]");
  if (!toggle || !nav) return;

  function setOpen(open) {
    nav.classList.toggle("is-open", open);
    if (header) header.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  }

  function syncScroll() {
    if (!header) return;
    header.classList.toggle("is-scrolled", window.scrollY > 24);
  }

  toggle.addEventListener("click", function () {
    setOpen(!nav.classList.contains("is-open"));
  });

  nav.querySelectorAll("a").forEach(function (link) {
    link.addEventListener("click", function () {
      setOpen(false);
    });
  });

  window.addEventListener("scroll", syncScroll, { passive: true });
  syncScroll();

  var sectionIds = ["about", "membership", "crew", "lineage", "voices", "programs", "first-wave", "scholarships", "contact"];
  var linkMap = {};
  nav.querySelectorAll(".nav-links a[href^='#']").forEach(function (link) {
    linkMap[link.getAttribute("href").slice(1)] = link;
  });

  function setActive(id) {
    Object.keys(linkMap).forEach(function (key) {
      linkMap[key].classList.toggle("is-active", key === id);
    });
  }

  if ("IntersectionObserver" in window) {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) setActive(entry.target.id);
        });
      },
      { rootMargin: "-35% 0px -55% 0px", threshold: 0.01 }
    );
    sectionIds.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) observer.observe(el);
    });
  }
})();

(function () {
  var form = document.getElementById("contact-form");
  if (!form) return;

  var statusEl = document.getElementById("contact-status");
  var submitBtn = form.querySelector(".contact-submit");
  var emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  var endpoint = "https://formsubmit.co/ajax/board@yatyasassociation.com";

  function fieldWrap(input) {
    return input.closest(".form-field");
  }

  function setError(name, message) {
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

  function clearStatus() {
    if (!statusEl) return;
    statusEl.hidden = true;
    statusEl.textContent = "";
    statusEl.classList.remove("is-success", "is-error");
  }

  function showStatus(message, ok) {
    if (!statusEl) return;
    statusEl.hidden = false;
    statusEl.classList.toggle("is-success", Boolean(ok));
    statusEl.classList.toggle("is-error", !ok);
    statusEl.textContent = message;
  }

  function validate() {
    var name = String(form.elements.name.value || "").trim();
    var email = String(form.elements.email.value || "").trim();
    var message = String(form.elements.message.value || "").trim();
    var ok = true;

    if (!name) {
      setError("name", "Please enter your name.");
      ok = false;
    } else {
      setError("name", "");
    }

    if (!email) {
      setError("email", "Please enter your email.");
      ok = false;
    } else if (!emailPattern.test(email)) {
      setError("email", "Please enter a valid email address.");
      ok = false;
    } else {
      setError("email", "");
    }

    if (!message) {
      setError("message", "Please enter a message.");
      ok = false;
    } else if (message.length < 10) {
      setError("message", "Please write at least a short message (10 characters).");
      ok = false;
    } else {
      setError("message", "");
    }

    return { ok: ok, name: name, email: email, message: message };
  }

  ["name", "email", "message"].forEach(function (name) {
    var input = form.elements[name];
    if (!input) return;
    input.addEventListener("input", function () {
      clearStatus();
      if (fieldWrap(input) && fieldWrap(input).classList.contains("is-invalid")) {
        validate();
      }
    });
  });

  function mailtoFallback(result) {
    var subject = encodeURIComponent("YAT-YAS Association contact — " + result.name);
    var body = encodeURIComponent(
      "Name: " + result.name + "\nEmail: " + result.email + "\n\n" + result.message
    );
    window.location.href =
      "mailto:board@yatyasassociation.com?subject=" + subject + "&body=" + body;
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    clearStatus();
    var result = validate();
    if (!result.ok) {
      var firstInvalid = form.querySelector(".is-invalid input, .is-invalid textarea");
      if (firstInvalid) firstInvalid.focus();
      return;
    }

    if (String(form.elements._gotcha && form.elements._gotcha.value || "").trim()) {
      showStatus("Thanks — your message was received.", true);
      form.reset();
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Sending…";
    }

    fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        name: result.name,
        email: result.email,
        message: result.message,
        _subject: "YAT-YAS Association contact — " + result.name,
        _template: "table",
        _replyto: result.email,
      }),
    })
      .then(function (res) {
        return res.json().catch(function () {
          return {};
        }).then(function (data) {
          return { ok: res.ok, data: data };
        });
      })
      .then(function (payload) {
        if (payload.ok || payload.data.success === "true" || payload.data.success === true) {
          form.reset();
          ["name", "email", "message"].forEach(function (name) {
            setError(name, "");
          });
          showStatus(
            "Thank you" +
              (result.name ? ", " + result.name.split(/\s+/)[0] : "") +
              ". Your message was sent to the Association board.",
            true
          );
          return;
        }
        throw new Error("send-failed");
      })
      .catch(function () {
        mailtoFallback(result);
        showStatus(
          "Opening your email app as a backup — you can also write board@yatyasassociation.com directly.",
          true
        );
      })
      .finally(function () {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = "Send message";
        }
      });
  });
})();
