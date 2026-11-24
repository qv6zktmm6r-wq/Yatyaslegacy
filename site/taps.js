(function () {
  var audio = document.querySelector("[data-taps-audio]");
  var toggle = document.querySelector("[data-taps-toggle]");
  var statusEl = document.getElementById("taps-status");
  if (!audio || !toggle) return;

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  function setPlaying(playing) {
    toggle.setAttribute("aria-pressed", playing ? "true" : "false");
    toggle.textContent = playing ? "Pause Taps" : "Play Taps";
    if (statusEl) {
      statusEl.textContent = playing
        ? "Taps is playing."
        : "Taps plays only when you press Play — never automatically.";
    }
  }

  toggle.addEventListener("click", function () {
    if (audio.paused) {
      var playPromise = audio.play();
      if (playPromise && typeof playPromise.then === "function") {
        playPromise
          .then(function () {
            setPlaying(true);
          })
          .catch(function () {
            setPlaying(false);
            if (statusEl) {
              statusEl.textContent =
                "Could not start audio. Check device sound and try again.";
            }
          });
      } else {
        setPlaying(true);
      }
    } else {
      audio.pause();
      setPlaying(false);
    }
  });

  audio.addEventListener("ended", function () {
    setPlaying(false);
  });

  audio.addEventListener("pause", function () {
    if (audio.ended) return;
    setPlaying(false);
  });

  // Never autoplay, including after bfcache restore.
  window.addEventListener("pageshow", function () {
    audio.pause();
    audio.currentTime = 0;
    setPlaying(false);
  });

  if (reduceMotion.matches) {
    audio.preload = "none";
  }
})();
