import { DEFAULT_API_ORIGIN } from "./config.js";
const $ = (id) => document.getElementById(id);
const read = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
};
const write = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
};
let settings = read("veil:settings", {
  mode: "html",
  engine: "brave",
  backend: "",
});
let bookmarks = read("veil:bookmarks", []);
let accessKey = "";
let browserSession = null;
async function credentials(signal) {
  if (accessKey) return accessKey;
  if (["localhost", "127.0.0.1"].includes(location.hostname)) return "";
  const origin = backend();
  if (browserSession?.origin === origin && browserSession.expires > Date.now())
    return browserSession.token;
  const response = await fetch(origin + "/api/session", {
    method: "POST",
    credentials: "omit",
    cache: "no-store",
    referrerPolicy: "no-referrer",
    signal,
  });
  const data = await response.json();
  if (!response.ok)
    throw Error(data.error || "The browser service is not ready yet.");
  browserSession = {
    origin,
    token: data.token,
    expires: Date.now() + data.expiresIn * 1000 - 30000,
  };
  return data.token;
}
let active;
const tabs = [];
function current() {
  return tabs.find((t) => t.id === active);
}
function newTab(privateMode = false) {
  const t = {
    id: crypto.randomUUID(),
    private: privateMode,
    history: [{ url: "", title: "New tab" }],
    index: 0,
    generation: 0,
    loading: false,
  };
  tabs.push(t);
  active = t.id;
  paint();
}
function item(t = current()) {
  return t.history[t.index];
}
function closeTab(id) {
  const t = tabs.find((x) => x.id === id);
  t?.controller?.abort();
  const index = tabs.findIndex((t) => t.id === id);
  tabs.splice(index, 1);
  if (!tabs.length) newTab();
  else {
    if (active === id) active = tabs[Math.max(0, index - 1)].id;
    paint();
  }
}
function normalise(text) {
  text = text.trim();
  if (!text) return "";
  try {
    if (/^https?:\/\//i.test(text)) return new URL(text).href;
    if (!/\s/.test(text) && /^(localhost|[^/]+\.[^/]+)/.test(text))
      return new URL("https://" + text).href;
  } catch {}
  const engines = {
    brave: "https://search.brave.com/search?q=",
    bing: "https://www.bing.com/search?q=",
    duckduckgo: "https://html.duckduckgo.com/html/?q=",
  };
  return (engines[settings.engine] || engines.brave) + encodeURIComponent(text);
}
function backend() {
  if (
    !settings.backend &&
    ["localhost", "127.0.0.1"].includes(location.hostname)
  )
    return location.origin;
  const configured = settings.backend || DEFAULT_API_ORIGIN;
  try {
    const u = new URL(configured);
    if (
      u.pathname !== "/" ||
      u.search ||
      u.hash ||
      u.username ||
      u.password ||
      !(
        u.protocol === "https:" ||
        (u.protocol === "http:" &&
          ["localhost", "127.0.0.1"].includes(u.hostname))
      )
    )
      throw 0;
    return u.origin;
  } catch {
    throw Error(
      "The backend is not connected. Open Settings and set the deployed backend origin.",
    );
  }
}
async function load(t, entry) {
  t.controller?.abort();
  const controller = new AbortController();
  t.controller = controller;
  const gen = ++t.generation;
  t.loading = true;
  t.error = "";
  if (active === t.id) paint();
  const timer = setTimeout(() => controller.abort(), 58000);
  try {
    const token = await credentials(controller.signal);
    const response = await fetch(backend() + "/api/browse", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: "Bearer " + token } : {}),
      },
      body: JSON.stringify({ url: entry.url, mode: settings.mode }),
      signal: controller.signal,
      credentials: "omit",
      cache: "no-store",
      referrerPolicy: "no-referrer",
    });
    const data = await response.json();
    if (!response.ok) throw Error(data.error || "Remote retrieval failed.");
    if (gen !== t.generation) return;
    Object.assign(entry, { url: data.url, title: data.title, document: data });
  } catch (e) {
    if (gen !== t.generation) return;
    t.error =
      e.name === "AbortError"
        ? "Retrieval timed out or was cancelled."
        : e.message;
  } finally {
    clearTimeout(timer);
    if (gen === t.generation) {
      t.loading = false;
      if (active === t.id) paint();
    }
  }
}
function navigate(value) {
  const url = normalise(value);
  if (!url) return;
  const t = current();
  t.history.splice(t.index + 1);
  const entry = { url, title: new URL(url).hostname };
  t.history.push(entry);
  t.index++;
  load(t, entry);
}
function go(delta) {
  const t = current();
  const next = t.index + delta;
  if (next < 0 || next >= t.history.length) return;
  t.controller?.abort();
  ++t.generation;
  t.loading = false;
  t.error = "";
  t.index = next;
  paint();
  if (item().url && !item().document) load(t, item());
}
function goHome() {
  const t = current();
  t.controller?.abort();
  ++t.generation;
  t.loading = false;
  t.error = "";
  t.history.splice(t.index + 1);
  t.history.push({ url: "", title: "New tab" });
  t.index++;
  paint();
}
let renderedEntry = null;
function paint() {
  const t = current(),
    entry = item();
  $("tabs").replaceChildren();
  for (const tab of tabs) {
    const node = document.createElement("div");
    node.className =
      "tab" +
      (tab.id === active ? " active" : "") +
      (tab.private ? " private" : "");
    node.setAttribute("role", "tab");
    node.setAttribute("aria-selected", String(tab.id === active));
    node.tabIndex = tab.id === active ? 0 : -1;
    const label = document.createElement("span");
    label.className = "label";
    label.textContent = (tab.private ? "◈ " : "") + item(tab).title;
    const close = document.createElement("button");
    close.textContent = "×";
    close.setAttribute("aria-label", "Close " + item(tab).title);
    close.onclick = (e) => {
      e.stopPropagation();
      closeTab(tab.id);
    };
    node.append(label, close);
    const select = () => {
      active = tab.id;
      paint();
    };
    node.onclick = select;
    node.onkeydown = (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        select();
      }
    };
    $("tabs").append(node);
  }
  $("address").value = entry.url;
  $("privatebadge").hidden = !t.private;
  $("back").disabled = t.index === 0;
  $("forward").disabled = t.index === t.history.length - 1;
  $("reload").disabled = !entry.url;
  $("bookmark").disabled = !entry.url || t.private;
  $("bookmark").textContent = bookmarks.some((b) => b.url === entry.url)
    ? "★"
    : "☆";
  $("progress").classList.toggle("loading", t.loading);
  const hasPage = !!entry.document && !t.error;
  $("start").hidden = !!entry.url;
  $("page").hidden = !hasPage;
  $("error").hidden = !t.error;
  $("errormessage").textContent = t.error;
  if (hasPage) {
    if (renderedEntry !== entry.document) {
      const viewport = document.createElement("iframe");
      viewport.id = "page";
      viewport.title = "Remotely retrieved webpage";
      viewport.setAttribute("sandbox", "allow-scripts");
      viewport.referrerPolicy = "no-referrer";
      viewport.srcdoc = entry.document.html;
      $("page").replaceWith(viewport);
      renderedEntry = entry.document;
    }
  } else {
    if (renderedEntry) {
      $("page").srcdoc = "";
      renderedEntry = null;
    }
  }
  $("status").textContent = t.loading
    ? "Retrieving remotely…"
    : t.error
      ? "Retrieval failed"
      : entry.document?.notice ||
        (!settings.backend &&
        !DEFAULT_API_ORIGIN &&
        !["localhost", "127.0.0.1"].includes(location.hostname)
          ? "Backend not connected · Configure in Settings"
          : t.private
            ? "Private tab · Memory only"
            : "Ready to explore");
  $("modebadge").textContent =
    (t.private ? "PRIVATE · " : "") +
    (entry.document?.mode === "chromium"
      ? "Remote Chromium snapshot"
      : "HTML · Scripts disabled");
  document.title = (entry.url ? entry.title + " · " : "") + "Veil Browser";
}
window.addEventListener("message", (e) => {
  const doc = item().document;
  if (
    e.source !== $("page").contentWindow ||
    e.data?.type !== "veil:navigate" ||
    !doc ||
    e.data.channel !== doc.channel
  )
    return;
  try {
    const url = new URL(e.data.url);
    if (["https:", "http:"].includes(url.protocol)) navigate(url.href);
  } catch {}
});
$("addressform").onsubmit = (e) => {
  e.preventDefault();
  navigate($("address").value);
};
$("homesearch").onsubmit = (e) => {
  e.preventDefault();
  navigate($("query").value);
};
document
  .querySelectorAll("[data-url]")
  .forEach((b) => (b.onclick = () => navigate(b.dataset.url)));
$("back").onclick = () => go(-1);
$("forward").onclick = () => go(1);
$("reload").onclick = () => load(current(), item());
$("home").onclick = goHome;
$("errorhome").onclick = goHome;
$("retry").onclick = () => load(current(), item());
$("newtab").onclick = () => newTab();
$("private").onclick = () => newTab(true);
$("privacy").onclick = () => $("privacydialog").showModal();
$("settings").onclick = () => {
  for (const key of ["mode", "engine", "backend"])
    $(key).value =
      settings[key] || (key === "backend" ? DEFAULT_API_ORIGIN : "");
  $("accesskey").value = accessKey;
  $("settingsdialog").showModal();
};
$("save").onclick = () => {
  const candidate = $("backend").value.trim();
  const previous = settings;
  settings = {
    mode: $("mode").value,
    engine: $("engine").value,
    backend: candidate,
  };
  try {
    backend();
  } catch (e) {
    settings = previous;
    $("configmessage").textContent = e.message;
    return;
  }
  accessKey = $("accesskey").value;
  write("veil:settings", settings);
  $("settingsdialog").close();
};
$("bookmark").onclick = () => {
  const t = current(),
    entry = item();
  if (t.private || !entry.url) return;
  const existing = bookmarks.findIndex((b) => b.url === entry.url);
  if (existing >= 0) bookmarks.splice(existing, 1);
  else bookmarks.push({ url: entry.url, title: entry.title });
  write("veil:bookmarks", bookmarks);
  paint();
};
function bookmarkList() {
  $("bookmarklist").replaceChildren();
  if (!bookmarks.length) $("bookmarklist").textContent = "No bookmarks yet.";
  for (const b of bookmarks) {
    const row = document.createElement("div");
    row.className = "bookmarkrow";
    const open = document.createElement("button");
    open.textContent = b.title;
    const small = document.createElement("small");
    small.textContent = new URL(b.url).hostname;
    open.append(small);
    open.onclick = () => {
      $("bookmarkdialog").close();
      navigate(b.url);
    };
    const remove = document.createElement("button");
    remove.textContent = "×";
    remove.setAttribute("aria-label", "Remove " + b.title);
    remove.onclick = () => {
      bookmarks = bookmarks.filter((x) => x !== b);
      write("veil:bookmarks", bookmarks);
      bookmarkList();
      paint();
    };
    row.append(open, remove);
    $("bookmarklist").append(row);
  }
}
$("bookmarks").onclick = () => {
  bookmarkList();
  $("bookmarkdialog").showModal();
};
document.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === "l") {
    e.preventDefault();
    $("address").focus();
    $("address").select();
  }
});
newTab();
