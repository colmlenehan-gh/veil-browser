import * as cheerio from "cheerio";
import sanitize from "./generated/sanitize.cjs";
import iconv from "iconv-lite";
import postcss from "postcss";
import valueParser from "postcss-value-parser";
import { randomBytes } from "node:crypto";
import { sign } from "./security.js";
import { secureFetch, validURL, VeilError } from "./network.js";
export function decode(body, type = "") {
  const declared =
    type.match(/charset\s*=\s*["']?([^\s;"']+)/i)?.[1] ||
    body
      .subarray(0, 2048)
      .toString()
      .match(/charset\s*=\s*["']?([^\s;"'/>]+)/i)?.[1] ||
    "utf-8";
  return iconv.decode(
    body,
    iconv.encodingExists(declared) ? declared : "utf-8",
  );
}
export function absolute(value, base) {
  try {
    return validURL(new URL(value, base).href).href;
  } catch {
    return null;
  }
}
export function resourceURL(value, base, api, kind = "image", scope) {
  const url = absolute(value, base);
  return url ? `${api}/api/resource?t=${sign({ url, kind, scope })}` : "";
}
export function css(source, base, api, scope) {
  try {
    const root = postcss.parse(source, { map: false });
    root.walkAtRules((rule) => {
      if (
        rule.name.toLowerCase() !== "media" &&
        rule.name.toLowerCase() !== "supports" &&
        rule.name.toLowerCase() !== "font-face" &&
        rule.name.toLowerCase() !== "keyframes" &&
        rule.name.toLowerCase() !== "layer" &&
        rule.name.toLowerCase() !== "container"
      )
        rule.remove();
    });
    root.walkDecls((d) => {
      if (
        /behavior|binding/i.test(d.prop) ||
        /expression\s*\(/i.test(d.value)
      ) {
        d.remove();
        return;
      }
      const parsed = valueParser(d.value);
      parsed.walk((n) => {
        if (n.type === "function" && n.value.toLowerCase() === "url") {
          const raw = valueParser
            .stringify(n.nodes)
            .replace(/^["']|["']$/g, "");
          const kind = /^src$/i.test(d.prop) ? "font" : "image";
          n.nodes = [
            {
              type: "string",
              quote: '"',
              value: resourceURL(raw, base, api, kind, scope),
            },
          ];
        }
      });
      d.value = parsed.toString();
    });
    return root.toString().replace(/</g, "\\3c ");
  } catch {
    return "";
  }
}
export async function processHTML(
  source,
  url,
  api,
  { fetcher = secureFetch, mode = "html" } = {},
) {
  const $ = cheerio.load(source);
  let base = url;
  const supplied = $("base[href]").first().attr("href");
  if (supplied) base = absolute(supplied, url) || url;
  const title =
    $("title").first().text().trim().slice(0, 160) || new URL(url).hostname;
  const scope = new URL(url).origin;
  const styles = [];
  let budget = 600000;
  const styleDeadline = Date.now() + 8000;
  for (const link of $('link[rel="stylesheet"]').toArray().slice(0, 8)) {
    if (Date.now() >= styleDeadline) break;
    const href = absolute($(link).attr("href"), base);
    if (!href) continue;
    try {
      const r = await fetcher(href, {
        limit: Math.min(budget, 180000),
        timeout: Math.min(3000, Math.max(1, styleDeadline - Date.now())),
        accept: "text/css",
      });
      if (
        r.status === 200 &&
        String(r.headers["content-type"]).includes("text/css")
      ) {
        const text = decode(r.body, r.headers["content-type"]);
        budget -= r.body.length;
        styles.push(css(text, r.url, api, scope));
      }
      if (budget <= 0) break;
    } catch {}
  }
  $("style").each((_, el) =>
    styles.push(css($(el).html() || "", base, api, scope)),
  );
  $(
    "script,style,link,base,meta,iframe,frame,frameset,object,embed,svg,math,video,audio,source,track,canvas,template,noscript",
  ).remove();
  $("*").each((_, el) => {
    const e = $(el);
    for (const name of Object.keys(el.attribs || {})) {
      if (
        /^on/i.test(name) ||
        [
          "srcdoc",
          "srcset",
          "ping",
          "integrity",
          "nonce",
          "autofocus",
          "formaction",
          "formtarget",
          "target",
          "background",
          "contenteditable",
          "download",
        ].includes(name)
      )
        e.removeAttr(name);
    }
    if (e.attr("style"))
      e.attr(
        "style",
        css(`x{${e.attr("style")}}`, base, api, scope).replace(
          /^x\s*\{|\}$/g,
          "",
        ),
      );
  });
  $("img").each((_, el) => {
    const e = $(el);
    e.attr("src", resourceURL(e.attr("src"), base, api, "image", scope));
    e.attr("referrerpolicy", "no-referrer");
  });
  $("a,area").each((_, el) => {
    const e = $(el);
    const href = absolute(e.attr("href"), base);
    e.removeAttr("href");
    if (href) {
      e.attr("data-veil-url", href);
      e.attr("role", "link");
      e.attr("tabindex", "0");
    }
  });
  $("form").each((_, el) => {
    const e = $(el);
    const method = (e.attr("method") || "get").toLowerCase();
    const action = absolute(e.attr("action") || url, base);
    e.removeAttr("action");
    e.removeAttr("method");
    if (
      method === "get" &&
      action &&
      !e.find('input[type="password"],input[type="file"]').length
    )
      e.attr("data-veil-action", action);
    else {
      e.find("input,button,select,textarea").attr("disabled", "disabled");
      e.prepend(
        "<p>Veil: sign-in, uploads and non-GET forms are unavailable.</p>",
      );
    }
  });
  $('input[type="password"],input[type="file"]').attr("disabled", "disabled");
  const allowed = [
    ...sanitize.defaults.allowedTags,
    "img",
    "style",
    "html",
    "head",
    "body",
    "title",
    "form",
    "input",
    "button",
    "select",
    "option",
    "textarea",
    "label",
    "fieldset",
    "legend",
    "details",
    "summary",
  ];
  const clean = sanitize($("body").html() || "", {
    allowedTags: allowed,
    allowedAttributes: {
      "*": [
        "class",
        "id",
        "style",
        "title",
        "role",
        "tabindex",
        "aria-label",
        "data-veil-url",
        "data-veil-action",
      ],
      img: ["src", "alt", "width", "height", "referrerpolicy"],
      input: [
        "type",
        "name",
        "value",
        "placeholder",
        "checked",
        "disabled",
        "min",
        "max",
      ],
      button: ["type", "disabled", "name", "value"],
      select: ["name", "disabled", "multiple"],
      option: ["value", "selected"],
      textarea: ["name", "disabled", "rows", "cols"],
      label: ["for"],
      form: ["data-veil-action"],
    },
    allowedSchemes: ["https", "http"],
    allowVulnerableTags: true,
    parser: { decodeEntities: true },
  });
  const nonce = randomBytes(18).toString("base64");
  const channel = randomBytes(20).toString("hex");
  const bridge = `(()=>{
    const send=url=>parent.postMessage({type:'veil:navigate',channel:${JSON.stringify(channel)},url},'*');
    const submit=(form,button)=>{
      if(!form?.dataset.veilAction||!form.checkValidity())return;
      const url=new URL(form.dataset.veilAction),data=new FormData(form);
      if(button?.name)data.append(button.name,button.value);
      for(const[key,value]of data)if(typeof value==='string')url.searchParams.append(key,value);
      send(url.href);
    };
    document.addEventListener('click',event=>{
      const link=event.target.closest('[data-veil-url]');
      if(link){event.preventDefault();send(link.dataset.veilUrl);return;}
      const button=event.target.closest('button,input[type="submit"]');
      if(button?.form&&button.type==='submit'){event.preventDefault();submit(button.form,button);}
    });
    document.addEventListener('keydown',event=>{
      if(event.key!=='Enter')return;
      const link=event.target.closest('[data-veil-url]');
      if(link){event.preventDefault();send(link.dataset.veilUrl);return;}
      if(event.target.tagName==='INPUT'&&event.target.form){event.preventDefault();submit(event.target.form);}
    });
    document.addEventListener('submit',event=>{event.preventDefault();submit(event.target,event.submitter);});
  })();`;
  const csp = `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; img-src ${api}; font-src ${api}; connect-src 'none'; form-action 'none'; base-uri 'none'; object-src 'none'; frame-src 'none'`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><meta name="referrer" content="no-referrer"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{overflow-wrap:break-word}img{max-width:100%;height:auto}[data-veil-url]{cursor:pointer}a[data-veil-url]{color:LinkText;text-decoration:underline}${styles.join("\n")}</style></head><body>${clean}<script nonce="${nonce}">${bridge}</script></body></html>`;
  if (Buffer.byteLength(html) > 3000000)
    throw new VeilError("Processed document exceeds the size limit.", 413);
  return {
    html,
    title,
    url,
    channel,
    mode,
    notice:
      mode === "chromium"
        ? "JavaScript ran remotely. This is an inert snapshot; interactive web apps and sign-in are unsupported."
        : "HTML mode. Website scripts are disabled; JavaScript-dependent content may be missing.",
  };
}
