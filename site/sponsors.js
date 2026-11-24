(function () {
  var stage = document.querySelector("[data-sponsors-stage]");
  var grid = document.querySelector("[data-sponsors-grid]");
  var statusEl = document.querySelector("[data-sponsors-status]");
  if (!stage || !grid) return;

  var HUB = "https://hub.yatyasassociation.com/api/sponsors";
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderEmpty() {
    stage.classList.add("is-empty");
    stage.classList.remove("is-live");
    if (statusEl) {
      statusEl.hidden = false;
      statusEl.innerHTML =
        'Founding sponsors will take formation here. <a href="sponsor.html">Organizations — inquire</a>.';
    }
    grid.innerHTML = "";
  }

  function renderSponsors(sponsors) {
    if (!sponsors || !sponsors.length) {
      renderEmpty();
      return;
    }
    stage.classList.remove("is-empty");
    stage.classList.add("is-live");
    if (statusEl) {
      statusEl.hidden = true;
      statusEl.textContent = "";
    }
    var frag = document.createDocumentFragment();
    sponsors.forEach(function (sponsor, index) {
      var li = document.createElement("li");
      li.className = "sponsor-mark";
      li.style.setProperty("--sponsor-i", String(index));
      if (!reduceMotion) li.setAttribute("data-reveal", "");
      var name = escapeHtml(sponsor.organization_name || "Sponsor");
      var logo = escapeHtml(sponsor.logo_url || "");
      var href = String(sponsor.website_url || "").trim();
      var inner =
        '<span class="sponsor-mark-glow" aria-hidden="true"></span>' +
        '<img src="' +
        logo +
        '" alt="' +
        name +
        '" loading="lazy" decoding="async" />' +
        '<span class="sponsor-mark-name">' +
        name +
        "</span>";
      if (href && /^https?:\/\//i.test(href)) {
        li.innerHTML =
          '<a class="sponsor-mark-link" href="' +
          escapeHtml(href) +
          '" target="_blank" rel="noopener noreferrer">' +
          inner +
          "</a>";
      } else {
        li.innerHTML = '<div class="sponsor-mark-link">' + inner + "</div>";
      }
      frag.appendChild(li);
    });
    grid.innerHTML = "";
    grid.appendChild(frag);

    if (!reduceMotion && "IntersectionObserver" in window) {
      var obs = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add("is-in");
              obs.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.2, rootMargin: "0px 0px -8% 0px" }
      );
      grid.querySelectorAll("[data-reveal]").forEach(function (el) {
        obs.observe(el);
      });
    } else {
      grid.querySelectorAll(".sponsor-mark").forEach(function (el) {
        el.classList.add("is-in");
      });
    }
  }

  function loadSponsors() {
    fetch(HUB + "?t=" + Date.now(), {
      credentials: "omit",
      cache: "no-store",
      headers: { Accept: "application/json" },
    })
      .then(function (res) {
        return res.json();
      })
      .then(function (payload) {
        if (!payload || !payload.ok) {
          renderEmpty();
          return;
        }
        renderSponsors(payload.sponsors || []);
      })
      .catch(renderEmpty);
  }

  loadSponsors();
  setInterval(loadSponsors, 60000);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") loadSponsors();
  });
})();
