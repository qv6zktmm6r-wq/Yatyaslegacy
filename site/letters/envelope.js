(function () {
  var scene = document.getElementById("scene");
  var envelope = document.getElementById("envelope");
  var letterStage = document.getElementById("letterStage");
  var again = document.getElementById("again");
  if (!scene || !envelope || !letterStage) return;

  function openInvite() {
    if (scene.classList.contains("is-open")) return;
    scene.classList.add("is-open");
    document.body.classList.add("invite-open");
    letterStage.setAttribute("aria-hidden", "false");
    envelope.setAttribute("aria-expanded", "true");
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function closeInvite() {
    scene.classList.remove("is-open");
    document.body.classList.remove("invite-open");
    letterStage.setAttribute("aria-hidden", "true");
    envelope.setAttribute("aria-expanded", "false");
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  envelope.addEventListener("click", openInvite);
  envelope.addEventListener("keydown", function (e) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openInvite();
    }
  });

  if (again) again.addEventListener("click", closeInvite);
})();
