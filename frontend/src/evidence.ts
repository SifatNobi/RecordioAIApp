import { Commitment, Record } from "@/src/api";

function esc(s: string): string {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const SECTIONS: { key: keyof Record; label: string }[] = [
  { key: "promises", label: "Promises" },
  { key: "prices_or_fees", label: "Prices & Fees" },
  { key: "dates_or_deadlines", label: "Dates & Deadlines" },
  { key: "warranties_or_disclosures", label: "Warranties & Disclosures" },
  { key: "cancellations_or_changes", label: "Cancellations & Changes" },
];

export function buildEvidenceHtml(record: Record, verified: boolean): string {
  const generated = new Date().toLocaleString();

  const commitmentBlocks = SECTIONS.map((s) => {
    const items = (record[s.key] as Commitment[]) || [];
    if (items.length === 0) return "";
    const rows = items
      .map(
        (c) => `
        <div class="commit">
          <div class="cat">${esc(c.category || s.label)}${c.speaker ? ` &middot; <span class="sp">${esc(c.speaker)}</span>` : ""}</div>
          <div class="ctext">${esc(c.commitment)}</div>
          ${c.quote ? `<div class="quote">&ldquo;${esc(c.quote)}&rdquo;</div>` : ""}
        </div>`,
      )
      .join("");
    return `<h3>${s.label}</h3>${rows}`;
  }).join("");

  const anyCommit = SECTIONS.some((s) => ((record[s.key] as Commitment[]) || []).length > 0);

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #111827; padding: 40px; line-height: 1.5; }
  .header { border-bottom: 3px solid #4F46E5; padding-bottom: 16px; margin-bottom: 24px; }
  .brand { font-size: 22px; font-weight: 700; color: #111827; }
  .tag { color: #6B7280; font-size: 12px; letter-spacing: 1px; text-transform: uppercase; }
  .status { display: inline-block; padding: 6px 12px; border-radius: 6px; font-weight: 600; font-size: 13px;
            background: ${verified ? "#ECFDF5" : "#FEF2F2"}; color: ${verified ? "#059669" : "#DC2626"};
            border: 1px solid ${verified ? "#059669" : "#DC2626"}; }
  h2 { font-size: 12px; letter-spacing: 1px; text-transform: uppercase; color: #6B7280; margin: 28px 0 8px; }
  h3 { font-size: 14px; color: #4338CA; margin: 16px 0 6px; }
  .meta { width: 100%; border-collapse: collapse; }
  .meta td { padding: 6px 0; font-size: 13px; border-bottom: 1px solid #F3F4F6; }
  .meta td.k { color: #6B7280; width: 40%; }
  .meta td.v { color: #111827; font-weight: 600; }
  .summary { font-size: 15px; color: #111827; background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 8px; padding: 14px; }
  .commit { border: 1px solid #E5E7EB; border-radius: 8px; padding: 12px; margin-bottom: 10px; }
  .cat { font-size: 11px; text-transform: uppercase; letter-spacing: .5px; color: #4338CA; font-weight: 700; }
  .sp { color: #6B7280; font-weight: 400; }
  .ctext { font-size: 14px; font-weight: 600; margin: 4px 0; }
  .quote { font-style: italic; color: #374151; font-size: 13px; border-left: 3px solid #4F46E5; padding-left: 10px; margin-top: 6px; }
  .mono { font-family: "SFMono-Regular", Menlo, Consolas, monospace; font-size: 12px; word-break: break-all;
          background: #F3F4F6; border: 1px solid #E5E7EB; border-radius: 6px; padding: 10px; }
  .transcript { font-family: "SFMono-Regular", Menlo, Consolas, monospace; font-size: 12px; white-space: pre-wrap;
                background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 8px; padding: 14px; }
  .footer { margin-top: 32px; padding-top: 14px; border-top: 1px solid #E5E7EB; color: #6B7280; font-size: 11px; }
</style></head>
<body>
  <div class="header">
    <div class="brand">RecordioAI &mdash; Evidence Package</div>
    <div class="tag">Prove What Your AI Promised</div>
  </div>

  <div class="status">${verified ? "\u2713 Record integrity verified" : "\u26A0 Record integrity mismatch"}</div>

  <h2>Record</h2>
  <table class="meta">
    <tr><td class="k">Record ID</td><td class="v">${esc(record.record_id)}</td></tr>
    <tr><td class="k">Created</td><td class="v">${esc(new Date(record.created_at).toLocaleString())}</td></tr>
    <tr><td class="k">Capture Method</td><td class="v">${esc(record.capture_method)}</td></tr>
    <tr><td class="k">Agent</td><td class="v">${esc(record.agent_name)}</td></tr>
    ${record.agent_version ? `<tr><td class="k">Agent Version</td><td class="v">${esc(record.agent_version)}</td></tr>` : ""}
    ${record.policy_version ? `<tr><td class="k">Policy Version</td><td class="v">${esc(record.policy_version)}</td></tr>` : ""}
    <tr><td class="k">Conversation Type</td><td class="v">${esc(record.conversation_type)}</td></tr>
    ${record.language ? `<tr><td class="k">Language</td><td class="v">${esc(record.language)}</td></tr>` : ""}
    ${record.tags && record.tags.length ? `<tr><td class="k">Tags</td><td class="v">${esc(record.tags.join(", "))}</td></tr>` : ""}
  </table>

  ${record.notes ? `<h2>Notes</h2><div class="summary">${esc(record.notes)}</div>` : ""}

  <h2>Executive Summary</h2>
  <div class="summary">${esc(record.summary || "No summary available.")}</div>

  <h2>Extracted Commitments</h2>
  ${anyCommit ? commitmentBlocks : `<div class="summary">No explicit commitments were detected in this conversation.</div>`}

  <h2>Integrity</h2>
  <p style="font-size:12px;color:#6B7280;margin:0 0 6px;">Transcript Hash &middot; SHA-256</p>
  <div class="mono">${esc(record.transcript_sha256)}</div>
  ${
    record.audio_sha256
      ? `<p style="font-size:12px;color:#6B7280;margin:12px 0 6px;">Audio Hash &middot; SHA-256</p><div class="mono">${esc(record.audio_sha256)}</div>`
      : ""
  }

  <h2>Original Conversation</h2>
  <div class="transcript">${esc(record.transcript)}</div>

  <div class="footer">
    Evidence Package &mdash; Generated ${esc(generated)}. This record was created from the submitted conversation
    and has not been independently adjudicated. A matching SHA-256 hash proves the stored content matches its
    fingerprint; it does not prove the conversation itself was truthful.
  </div>
</body></html>`;
}

function recordSection(record: Record): string {
  const commitmentBlocks = SECTIONS.map((s) => {
    const items = (record[s.key] as Commitment[]) || [];
    if (items.length === 0) return "";
    const rows = items
      .map(
        (c) => `
        <div class="commit">
          <div class="cat">${esc(c.category || s.label)}${c.speaker ? ` &middot; <span class="sp">${esc(c.speaker)}</span>` : ""}</div>
          <div class="ctext">${esc(c.commitment)}</div>
          ${c.quote ? `<div class="quote">&ldquo;${esc(c.quote)}&rdquo;</div>` : ""}
        </div>`,
      )
      .join("");
    return `<h3>${s.label}</h3>${rows}`;
  }).join("");
  const anyCommit = SECTIONS.some((s) => ((record[s.key] as Commitment[]) || []).length > 0);
  const verified = record.verification_status === "verified";

  return `
  <div class="rec">
    <div class="rechead">
      <span class="recid">${esc(record.record_id)}</span>
      <span class="status" style="background:${verified ? "#ECFDF5" : "#FEF2F2"};color:${verified ? "#059669" : "#DC2626"};border:1px solid ${verified ? "#059669" : "#DC2626"};">
        ${verified ? "\u2713 Verified" : "\u26A0 Mismatch"}
      </span>
    </div>
    <table class="meta">
      <tr><td class="k">Created</td><td class="v">${esc(new Date(record.created_at).toLocaleString())}</td></tr>
      <tr><td class="k">Capture</td><td class="v">${esc(record.capture_method)}</td></tr>
      <tr><td class="k">Agent</td><td class="v">${esc(record.agent_name)}</td></tr>
      <tr><td class="k">Type</td><td class="v">${esc(record.conversation_type)}</td></tr>
      ${record.language ? `<tr><td class="k">Language</td><td class="v">${esc(record.language)}</td></tr>` : ""}
      ${record.tags && record.tags.length ? `<tr><td class="k">Tags</td><td class="v">${esc(record.tags.join(", "))}</td></tr>` : ""}
    </table>
    <div class="summary">${esc(record.summary || "No summary available.")}</div>
    ${anyCommit ? commitmentBlocks : ""}
    <p class="hlabel">Transcript Hash &middot; SHA-256</p>
    <div class="mono">${esc(record.transcript_sha256)}</div>
  </div>`;
}

export function buildBulkEvidenceHtml(records: Record[]): string {
  const generated = new Date().toLocaleString();
  const rows = records
    .map(
      (r) =>
        `<tr><td class="mono2">${esc(r.record_id)}</td><td>${esc(r.agent_name)}</td><td>${esc(r.conversation_type)}</td><td>${esc(new Date(r.created_at).toLocaleDateString())}</td></tr>`,
    )
    .join("");
  const sections = records.map((r) => recordSection(r)).join('<div class="pb"></div>');

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #111827; padding: 40px; line-height: 1.5; }
  .header { border-bottom: 3px solid #4F46E5; padding-bottom: 16px; margin-bottom: 20px; }
  .brand { font-size: 22px; font-weight: 700; }
  .tag { color: #6B7280; font-size: 12px; letter-spacing: 1px; text-transform: uppercase; }
  h2 { font-size: 12px; letter-spacing: 1px; text-transform: uppercase; color: #6B7280; margin: 22px 0 8px; }
  h3 { font-size: 13px; color: #4338CA; margin: 12px 0 4px; }
  .index { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  .index td, .index th { text-align: left; padding: 6px 8px; font-size: 12px; border-bottom: 1px solid #F3F4F6; }
  .index th { color: #6B7280; text-transform: uppercase; font-size: 10px; letter-spacing: .5px; }
  .rec { border: 1px solid #E5E7EB; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
  .rechead { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
  .recid { font-family: Menlo, Consolas, monospace; font-weight: 700; font-size: 14px; }
  .status { padding: 4px 10px; border-radius: 6px; font-weight: 600; font-size: 11px; }
  .meta { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  .meta td { padding: 4px 0; font-size: 12px; border-bottom: 1px solid #F3F4F6; }
  .meta td.k { color: #6B7280; width: 30%; }
  .meta td.v { font-weight: 600; }
  .summary { font-size: 13px; background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 8px; padding: 10px; margin: 6px 0; }
  .commit { border: 1px solid #E5E7EB; border-radius: 8px; padding: 10px; margin-bottom: 8px; }
  .cat { font-size: 10px; text-transform: uppercase; color: #4338CA; font-weight: 700; }
  .sp { color: #6B7280; font-weight: 400; }
  .ctext { font-size: 13px; font-weight: 600; margin: 3px 0; }
  .quote { font-style: italic; color: #374151; font-size: 12px; border-left: 3px solid #4F46E5; padding-left: 8px; margin-top: 4px; }
  .hlabel { font-size: 11px; color: #6B7280; margin: 8px 0 4px; }
  .mono { font-family: Menlo, Consolas, monospace; font-size: 11px; word-break: break-all; background: #F3F4F6; border: 1px solid #E5E7EB; border-radius: 6px; padding: 8px; }
  .mono2 { font-family: Menlo, Consolas, monospace; }
  .pb { page-break-after: always; }
  .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #E5E7EB; color: #6B7280; font-size: 11px; }
</style></head>
<body>
  <div class="header">
    <div class="brand">RecordioAI &mdash; Combined Evidence Package</div>
    <div class="tag">Prove What Your AI Promised &middot; ${records.length} record${records.length === 1 ? "" : "s"}</div>
  </div>
  <h2>Included Records</h2>
  <table class="index">
    <tr><th>Record ID</th><th>Agent</th><th>Type</th><th>Created</th></tr>
    ${rows}
  </table>
  ${sections}
  <div class="footer">
    Combined Evidence Package &mdash; Generated ${esc(generated)}. Each record was created from the submitted
    conversation and has not been independently adjudicated. Matching SHA-256 hashes prove stored content
    matches its fingerprint; they do not prove the conversations were truthful.
  </div>
</body></html>`;
}
