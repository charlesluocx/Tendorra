import "server-only";
import { simpleParser } from "mailparser";
import MsgReader from "@kenjiuno/msgreader";

export type ParsedEmailFile = {
  subject: string | null;
  from: string | null;
  receivedAt: string | null;
  body: string;
  internetMessageId: string | null;
};

// .msg files (Outlook's own binary format) start with the OLE/CFBF magic
// number — this is how a virtual file dragged straight from Outlook desktop
// is told apart from a plain-text .eml export (Gmail, or Outlook's "Save
// As .eml"), regardless of what extension made it through the browser.
const OLE_MAGIC = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);

export async function parseEmailFile(fileName: string, buffer: Buffer): Promise<ParsedEmailFile> {
  const looksLikeMsg = buffer.length >= 8 && buffer.subarray(0, 8).equals(OLE_MAGIC);
  const lowerName = fileName.toLowerCase();

  if (looksLikeMsg || lowerName.endsWith(".msg")) {
    return parseMsg(buffer);
  }
  return parseEml(buffer);
}

function parseMsg(buffer: Buffer): ParsedEmailFile {
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
  const reader = new MsgReader(arrayBuffer);
  const data = reader.getFileData();
  if (data.error) throw new Error(data.error);

  const from = data.senderSmtpAddress || data.senderEmail || data.senderName || null;
  const receivedAt = data.messageDeliveryTime ? new Date(data.messageDeliveryTime).toISOString() : null;

  return {
    subject: data.subject ?? null,
    from,
    receivedAt,
    body: data.body ?? "",
    internetMessageId: data.messageId ?? null,
  };
}

async function parseEml(buffer: Buffer): Promise<ParsedEmailFile> {
  const parsed = await simpleParser(buffer);
  const fromAddress = Array.isArray(parsed.from?.value) ? parsed.from.value[0]?.address : undefined;

  return {
    subject: parsed.subject ?? null,
    from: fromAddress ?? parsed.from?.text ?? null,
    receivedAt: parsed.date ? parsed.date.toISOString() : null,
    body: parsed.text ?? (parsed.html || ""),
    internetMessageId: parsed.messageId ?? null,
  };
}
