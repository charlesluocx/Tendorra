"use client";

import PostalMime, { type Address } from "postal-mime";
import MsgReader from "@kenjiuno/msgreader";

/** Normalized email shape shared by .eml, .msg and pasted text. */
export type ParsedEmail = {
  subject: string;
  fromName: string | null;
  fromAddress: string | null;
  to: string[];
  cc: string[];
  sentAt: string | null; // ISO string
  bodyText: string;
  messageId: string | null;
  fileName: string | null;
  format: "eml" | "msg" | "text";
  attachments: { name: string; size: number | null }[];
};

const MAX_BODY_CHARS = 60_000;

export function htmlToText(html: string) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("style, script, head").forEach((n) => n.remove());
  doc.querySelectorAll("br").forEach((n) => n.replaceWith("\n"));
  doc.querySelectorAll("p, div, tr, li, h1, h2, h3, h4").forEach((n) => n.append("\n"));
  return (doc.body.textContent ?? "").replace(/\n{3,}/g, "\n\n").trim();
}

function clean(text: string) {
  return text.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").trim().slice(0, MAX_BODY_CHARS);
}

function flattenAddresses(list: Address[] | undefined): string[] {
  const out: string[] = [];
  for (const a of list ?? []) {
    if ("group" in a && a.group) {
      for (const m of a.group) out.push(m.address || m.name);
    } else if (a.address) {
      out.push(a.name ? `${a.name} <${a.address}>` : a.address);
    } else if (a.name) {
      out.push(a.name);
    }
  }
  return out;
}

function toIso(value: string | undefined | null) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

async function parseEml(file: File): Promise<ParsedEmail> {
  const email = await PostalMime.parse(await file.arrayBuffer());
  const from = email.from && "address" in email.from ? email.from : undefined;
  return {
    subject: email.subject?.trim() || "(no subject)",
    fromName: from?.name || null,
    fromAddress: from?.address || null,
    to: flattenAddresses(email.to),
    cc: flattenAddresses(email.cc),
    sentAt: toIso(email.date),
    bodyText: clean(email.text || (email.html ? htmlToText(email.html) : "")),
    messageId: email.messageId || null,
    fileName: file.name,
    format: "eml",
    attachments: email.attachments.map((a) => ({
      name: a.filename || "attachment",
      size: typeof a.content === "string" ? a.content.length : a.content.byteLength,
    })),
  };
}

function headerValue(headers: string | undefined, name: string) {
  if (!headers) return null;
  const m = headers.match(new RegExp(`^${name}:\\s*(.+(?:\\r?\\n[ \\t].+)*)`, "im"));
  return m ? m[1].replace(/\r?\n[ \t]+/g, " ").trim() : null;
}

async function parseMsg(file: File): Promise<ParsedEmail> {
  const reader = new MsgReader(await file.arrayBuffer());
  const data = reader.getFileData();
  const recipients = data.recipients ?? [];
  const fmt = (r: (typeof recipients)[number]) => {
    const addr = r.smtpAddress || r.email;
    return addr ? (r.name && r.name !== addr ? `${r.name} <${addr}>` : addr) : r.name || "";
  };
  const html = data.bodyHtml;
  return {
    subject: data.subject?.trim() || "(no subject)",
    fromName: data.senderName || null,
    fromAddress: data.senderSmtpAddress || data.senderEmail || null,
    to: recipients.filter((r) => r.recipType !== "cc" && r.recipType !== "bcc").map(fmt).filter(Boolean),
    cc: recipients.filter((r) => r.recipType === "cc").map(fmt).filter(Boolean),
    sentAt: toIso(data.clientSubmitTime || data.messageDeliveryTime || data.creationTime),
    bodyText: clean(data.body || (html ? htmlToText(html) : "")),
    messageId: headerValue(data.headers, "Message-ID"),
    fileName: file.name,
    format: "msg",
    attachments: (data.attachments ?? []).map((a) => ({
      name: a.fileName || a.name || "attachment",
      size: a.contentLength ?? null,
    })),
  };
}

/** Parse free text (pasted or dragged as text). Picks up Subject/From/Date lines if present. */
export function parseText(text: string): ParsedEmail {
  const grab = (label: string) => {
    const m = text.match(new RegExp(`^\\s*${label}\\s*:\\s*(.+)$`, "im"));
    return m ? m[1].trim() : null;
  };
  const from = grab("From");
  const fromMatch = from?.match(/^(.*?)\s*<([^>]+)>/);
  const firstLine = text.trim().split("\n")[0]?.slice(0, 140) || "Pasted email";
  return {
    subject: grab("Subject") || firstLine,
    fromName: fromMatch ? fromMatch[1].replace(/"/g, "").trim() || null : from,
    fromAddress: fromMatch ? fromMatch[2] : from?.includes("@") ? from : null,
    to: grab("To")?.split(/[;,]/).map((s) => s.trim()).filter(Boolean) ?? [],
    cc: grab("Cc")?.split(/[;,]/).map((s) => s.trim()).filter(Boolean) ?? [],
    sentAt: toIso(grab("Sent") || grab("Date")),
    bodyText: clean(text),
    messageId: null,
    fileName: null,
    format: "text",
    attachments: [],
  };
}

export function isEmailFile(file: File) {
  const n = file.name.toLowerCase();
  return n.endsWith(".eml") || n.endsWith(".msg") || file.type === "message/rfc822";
}

export async function parseEmailFile(file: File): Promise<ParsedEmail> {
  const n = file.name.toLowerCase();
  if (n.endsWith(".msg")) return parseMsg(file);
  if (n.endsWith(".eml") || file.type === "message/rfc822") return parseEml(file);
  if (n.endsWith(".txt")) return parseText(await file.text());
  throw new Error(`${file.name}: unsupported file type. Drop .msg, .eml or .txt files.`);
}
