// Expand/collapse project rows (one open at a time)
const rows = document.querySelectorAll(".index__row");
rows.forEach((row) => {
  const toggle = (e) => {
    if (e.target.closest("a")) return; // let detail links work normally
    const wasOpen = row.classList.contains("open");
    rows.forEach((r) => r.classList.remove("open"));
    if (!wasOpen) row.classList.add("open");
  };
  row.addEventListener("click", toggle);
  row.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggle(e);
    }
  });
});

// Copy email on click (still a mailto link if clipboard fails)
const emailLink = document.getElementById("copyEmail");
const copyLabel = emailLink.querySelector(".contact__copy");
emailLink.addEventListener("click", (e) => {
  if (!navigator.clipboard) return; // fall through to mailto
  e.preventDefault();
  navigator.clipboard.writeText(emailLink.dataset.email).then(() => {
    copyLabel.textContent = "— copied ✓";
    setTimeout(() => (copyLabel.textContent = "— click to copy"), 1800);
  });
});

// Local time in the status line
const timeEl = document.getElementById("localTime");
const renderTime = () => {
  timeEl.textContent = new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
};
renderTime();
setInterval(renderTime, 30_000);

// Footer year
document.getElementById("year").textContent = new Date().getFullYear();
