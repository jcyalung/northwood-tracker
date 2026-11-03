// Copies text to the clipboard. The Clipboard API only exists on HTTPS (or
// localhost), and the app is served over plain http://northwood.local, so
// this falls back to the older copy command there. Returns whether it worked.
export async function copyText(text: string): Promise<boolean> {
  if (window.isSecureContext && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Blocked (e.g. permissions): try the fallback.
    }
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  // Off-screen, and big enough text that iOS doesn't zoom in.
  textarea.style.cssText =
    "position:fixed;top:0;left:-9999px;opacity:0;font-size:16px";
  document.body.appendChild(textarea);
  const focused = document.activeElement as HTMLElement | null;
  textarea.select();
  textarea.setSelectionRange(0, text.length);
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  textarea.remove();
  focused?.focus();
  return ok;
}
