const STORAGE_KEY = "linkly-links";
const THEME_KEY = "linkly-theme";
const $ = (selector) => document.querySelector(selector);

let links = loadLinks();

function loadLinks() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch (error) {
    console.error("Unable to read saved links.", error);
    return [];
  }
}

function saveLinks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(links));
}

function makeSlug() {
  let slug;
  do slug = Math.random().toString(36).slice(2, 8);
  while (links.some((link) => link.slug === slug));
  return slug;
}

function shortUrl(slug) {
  return `${window.location.origin}${window.location.pathname}#/${slug}`;
}

function isExpired(link) {
  return link.expiresAt && Date.now() > link.expiresAt;
}

function formatDate(timestamp) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(timestamp);
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[character]));
}

function render() {
  const query = $("#searchInput").value.trim().toLowerCase();
  const visible = links.filter((link) => `${link.slug} ${link.destination}`.toLowerCase().includes(query));
  $("#totalLinks").textContent = links.length;
  $("#totalClicks").textContent = links.reduce((total, link) => total + link.clicks, 0);
  $("#activeLinks").textContent = links.filter((link) => !isExpired(link)).length;
  $("#emptyState").hidden = visible.length !== 0;
  $("#linksTableWrap").hidden = visible.length === 0;
  $("#linksBody").innerHTML = visible.map((link) => {
    const expired = isExpired(link);
    const destination = escapeHtml(link.destination);
    return `<tr>
      <td><div class="short-link"><span class="link-dot ${expired ? "expired" : ""}"></span><a href="${shortUrl(link.slug)}" data-slug="${link.slug}">${escapeHtml(link.slug)}</a>${expired ? '<span class="expired-label">Expired</span>' : ""}</div><small>${shortUrl(link.slug).replace(/^https?:\/\//, "")}</small></td>
      <td><span class="destination" title="${destination}">${destination}</span></td>
      <td>${formatDate(link.createdAt)}</td><td><strong>${link.clicks}</strong></td>
      <td><div class="row-actions"><button class="copy-button" data-copy="${shortUrl(link.slug)}" type="button" aria-label="Copy short link">Copy</button><button class="delete-button" data-delete="${link.id}" type="button" aria-label="Delete link">×</button></div></td>
    </tr>`;
  }).join("");
}

function showMessage(text, type = "error") {
  const message = $("#formMessage");
  message.textContent = text;
  message.className = `form-message ${type}`;
}

function showToast(text) {
  const toast = $("#toast");
  toast.textContent = text;
  toast.classList.add("visible");
  window.setTimeout(() => toast.classList.remove("visible"), 2400);
}

function handleShortLinkRedirect() {
  const slug = window.location.hash.match(/^#\/([^/]+)$/)?.[1];
  if (!slug) return;
  const record = links.find((link) => link.slug === slug);
  if (!record) return;
  if (isExpired(record)) {
    document.body.innerHTML = `<main class="redirect-message"><h1>Link expired</h1><p>This short link is no longer active.</p><a href="${window.location.pathname}">Create a new link</a></main>`;
    return;
  }
  record.clicks += 1;
  saveLinks();
  window.location.replace(record.destination);
}

$("#shortenForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const submitButton = event.target.querySelector('button[type="submit"]');
  if (submitButton.disabled) return;
  const rawUrl = $("#longUrl").value.trim();
  const slug = $("#customSlug").value.trim();
  let parsed;
  try { parsed = new URL(rawUrl); } catch { showMessage("Enter a valid URL, including https://."); return; }
  if (!["http:", "https:"].includes(parsed.protocol)) { showMessage("Only http:// and https:// links are supported."); return; }
  if (slug && !/^[A-Za-z0-9_-]+$/.test(slug)) { showMessage("Aliases can only use letters, numbers, hyphens, and underscores."); return; }
  if (slug && links.some((link) => link.slug.toLowerCase() === slug.toLowerCase())) { showMessage("That alias is already in use. Choose another one."); return; }
  const expiry = $("#expiry").value;
  links.unshift({ id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`, slug: slug || makeSlug(), destination: parsed.href, createdAt: Date.now(), expiresAt: expiry === "never" ? null : Date.now() + Number(expiry) * 86400000, clicks: 0 });
  submitButton.disabled = true;
  saveLinks(); render(); event.target.reset(); showMessage("Your short link is ready.", "success");
  submitButton.disabled = false;
  showToast("Short link created");
});

$("#linksBody").addEventListener("click", async (event) => {
  const copyButton = event.target.closest("[data-copy]");
  const deleteButton = event.target.closest("[data-delete]");
  if (copyButton) {
    try { await navigator.clipboard.writeText(copyButton.dataset.copy); showToast("Copied to clipboard"); } catch { showToast("Copy failed — select the link manually"); }
  }
  if (deleteButton) { links = links.filter((link) => link.id !== deleteButton.dataset.delete); saveLinks(); render(); showToast("Link deleted"); }
});

$("#linksBody").addEventListener("click", (event) => {
  const link = event.target.closest("[data-slug]");
  if (!link) return;
  const record = links.find((item) => item.slug === link.dataset.slug);
  if (record && !isExpired(record)) { record.clicks += 1; saveLinks(); }
});

$("#searchInput").addEventListener("input", render);
$("#clearAll").addEventListener("click", () => { if (links.length && confirm("Delete all saved links?")) { links = []; saveLinks(); render(); showToast("All links cleared"); } });
$("#themeToggle").addEventListener("click", () => { const dark = document.body.classList.toggle("dark"); localStorage.setItem(THEME_KEY, dark ? "dark" : "light"); $("#themeToggle").textContent = dark ? "☀" : "☾"; });
if (localStorage.getItem(THEME_KEY) === "dark") { document.body.classList.add("dark"); $("#themeToggle").textContent = "☀"; }
handleShortLinkRedirect();
render();
