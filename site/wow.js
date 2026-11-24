(function () {
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Scroll reveals
  var revealNodes = document.querySelectorAll("[data-reveal]");
  if (revealNodes.length) {
    if (reduceMotion || !("IntersectionObserver" in window)) {
      revealNodes.forEach(function (el) {
        el.classList.add("is-in");
      });
    } else {
      var revealObs = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add("is-in");
              revealObs.unobserve(entry.target);
            }
          });
        },
        { rootMargin: "0px 0px -12% 0px", threshold: 0.15 }
      );
      revealNodes.forEach(function (el) {
        revealObs.observe(el);
      });
    }
  }

  // Iron lineage track progress
  var lineage = document.getElementById("lineage");
  var progress = document.querySelector("[data-lineage-progress]");
  if (lineage && progress && !reduceMotion) {
    function syncLineage() {
      var rect = lineage.getBoundingClientRect();
      var view = window.innerHeight || 1;
      var start = view * 0.75;
      var end = view * 0.2;
      var raw = (start - rect.top) / (start - end + rect.height * 0.35);
      var pct = Math.max(0, Math.min(1, raw));
      progress.style.transform = "scaleY(" + pct + ")";
    }
    window.addEventListener("scroll", syncLineage, { passive: true });
    window.addEventListener("resize", syncLineage);
    syncLineage();
  } else if (progress) {
    progress.style.transform = "scaleY(1)";
  }

  // Unit chooser → Crew Finder
  var unitCopy = {
    any: "Say it in your own words. We pull out unit, years, and platform — you don’t fill a maze of fields.",
    "2d": "Looking for 2d Tracks — Camp Lejeune iron. Tell the story; we’ll structure the match.",
    "3d": "Looking for 3d Tracks — Pendleton iron. Tell the story; we’ll structure the match.",
    "4th": "Looking for 4th Tracks Reserve. Tell the story; we’ll structure the match.",
    other: "Alligator Marines across the lineage. Tell the story; we’ll structure the match.",
  };
  var chooser = document.querySelector("[data-unit-chooser]");
  var lede = document.querySelector("[data-crew-lede]");
  var ctas = document.querySelectorAll("[data-crew-cta], [data-crew-cta-secondary]");
  var selectedUnit = "any";

  function applyUnit(unit) {
    selectedUnit = unit;
    if (lede && unitCopy[unit]) lede.textContent = unitCopy[unit];
    if (chooser) {
      chooser.querySelectorAll("[data-unit]").forEach(function (btn) {
        var on = btn.getAttribute("data-unit") === unit;
        btn.classList.toggle("is-active", on);
        btn.setAttribute("aria-pressed", on ? "true" : "false");
      });
    }
    ctas.forEach(function (a) {
      try {
        var url = new URL(a.getAttribute("href"), window.location.origin);
        if (unit && unit !== "any") url.searchParams.set("unit", unit);
        else url.searchParams.delete("unit");
        a.setAttribute("href", url.pathname + url.search + url.hash);
      } catch (e) {
        /* ignore */
      }
    });
  }

  if (chooser) {
    chooser.addEventListener("click", function (event) {
      var btn = event.target.closest("[data-unit]");
      if (!btn) return;
      applyUnit(btn.getAttribute("data-unit") || "any");
    });
    applyUnit("any");
  }

  // First Wave roll board — real reserved/claimed from Hub
  var roll = document.querySelector("[data-fw-roll]");
  var statusEl = document.querySelector("[data-fw-status]");
  var HUB_STATUS = "https://hub.yatyasassociation.com/api/first-wave-waitlist";

  function pad(n) {
    return String(n).padStart(3, "0");
  }

  function renderRoll(claimed, reserved, tagCap, prefix) {
    if (!roll) return;
    var claimedSet = {};
    var reservedSet = {};
    (claimed || []).forEach(function (n) {
      claimedSet[Number(n)] = true;
    });
    (reserved || []).forEach(function (n) {
      reservedSet[Number(n)] = true;
    });
    var cap = tagCap || 100;
    var frag = document.createDocumentFragment();
    var claimedCount = 0;
    var openCount = 0;
    for (var i = 1; i <= cap; i++) {
      var plate = document.createElement("button");
      plate.type = "button";
      plate.className = "fw-plate";
      plate.setAttribute("role", "listitem");
      var tag = (prefix || "FW") + "-" + pad(i);
      var state = "open";
      if (claimedSet[i]) {
        state = "claimed";
        claimedCount += 1;
      } else if (reservedSet[i]) {
        state = "held";
      } else {
        openCount += 1;
      }
      plate.classList.add("is-" + state);
      plate.setAttribute("aria-label", tag + " — " + state);
      plate.title = tag + " — " + state;
      plate.textContent = pad(i);
      frag.appendChild(plate);
    }
    roll.innerHTML = "";
    roll.appendChild(frag);
    if (statusEl) {
      statusEl.textContent =
        claimedCount +
        " claimed · " +
        (reserved || []).length +
        " held · " +
        openCount +
        " open";
    }
  }

  function fallbackRoll() {
    renderRoll([], [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 13], 100, "FW");
    if (statusEl) {
      statusEl.textContent = "Roll board offline — showing held numbers only.";
    }
  }

  if (roll) {
    fetch(HUB_STATUS, { credentials: "omit" })
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        var reg = (data && data.registration) || {};
        if (!data || !data.ok) {
          fallbackRoll();
          return;
        }
        renderRoll(
          reg.claimed_numbers || [],
          reg.reserved_numbers || [],
          reg.tag_cap || 100,
          reg.tag_prefix || "FW"
        );
      })
      .catch(fallbackRoll);
  }
})();
