(function () {
  var stage = document.querySelector("[data-sponsors-stage]");
  var grid = document.querySelector("[data-sponsors-grid]");
  var ghosts = document.querySelector("[data-sponsors-ghosts]");
  var statusEl = document.querySelector("[data-sponsors-status]");
  var countEl = document.querySelector("[data-sponsors-count]");
  if (!stage || !grid) return;

  var HUB = "https://hub.yatyasassociation.com/api/sponsors";
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var GHOST_SLOTS = 8;

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function setCount(n) {
    if (!countEl) return;
    countEl.textContent = n > 0 ? String(n).padStart(2, "0") + " MARKS" : "AWAITING";
  }

  function buildGhosts() {
    if (!ghosts) return;
    ghosts.innerHTML = "";
    var frag = document.createDocumentFragment();
    for (var i = 0; i < GHOST_SLOTS; i++) {
      var li = document.createElement("li");
      li.className = "sponsor-ghost";
      li.style.setProperty("--ghost-i", String(i));
      li.innerHTML =
        '<span class="sponsor-ghost-plate"></span>' +
        '<span class="sponsor-ghost-label">SLOT ' +
        String(i + 1).padStart(2, "0") +
        "</span>";
      frag.appendChild(li);
    }
    ghosts.appendChild(frag);
  }

  function renderEmpty() {
    stage.classList.add("is-empty");
    stage.classList.remove("is-live");
    setCount(0);
    if (statusEl) {
      statusEl.hidden = false;
      statusEl.innerHTML =
        '<span class="sponsors-status-kicker">Formation open</span>' +
        "Founding sponsors will take these plates — and every sponsor is invited to the annual muster. " +
        '<a href="sponsor.html">Organizations — inquire</a>.';
    }
    grid.innerHTML = "";
    buildGhosts();
  }

  function revealMarks(nodes) {
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
        { threshold: 0.15, rootMargin: "0px 0px -6% 0px" }
      );
      nodes.forEach(function (el) {
        obs.observe(el);
      });
    } else {
      nodes.forEach(function (el) {
        el.classList.add("is-in");
      });
    }
  }

  function renderSponsors(sponsors) {
    if (!sponsors || !sponsors.length) {
      renderEmpty();
      return;
    }
    stage.classList.remove("is-empty");
    stage.classList.add("is-live");
    setCount(sponsors.length);
    if (statusEl) {
      statusEl.hidden = true;
      statusEl.textContent = "";
    }
    if (ghosts) ghosts.innerHTML = "";

    var frag = document.createDocumentFragment();
    sponsors.forEach(function (sponsor, index) {
      var li = document.createElement("li");
      li.className = "sponsor-mark";
      li.style.setProperty("--sponsor-i", String(index));
      li.style.setProperty("--sponsor-tilt", ((index % 5) - 2) * 0.55 + "deg");
      if (!reduceMotion) li.setAttribute("data-reveal", "");
      var name = escapeHtml(sponsor.organization_name || "Sponsor");
      var logo = escapeHtml(sponsor.logo_url || "");
      var href = String(sponsor.website_url || "").trim();
      var inner =
        '<span class="sponsor-mark-glow" aria-hidden="true"></span>' +
        '<span class="sponsor-mark-frame" aria-hidden="true"></span>' +
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
    revealMarks(grid.querySelectorAll(".sponsor-mark"));
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

  buildGhosts();
  loadSponsors();
  setInterval(loadSponsors, 60000);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") loadSponsors();
  });
})();
