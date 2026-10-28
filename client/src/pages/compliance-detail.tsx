import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation, useParams } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle, ArrowLeft, CalendarClock, Check, ChevronRight, ClipboardCheck, FileText, Lock,
  Paperclip, Pencil, Trash2, Upload,
} from "lucide-react";
import { apiRequest } from "../lib/queryClient";
import { Layout } from "../components/layout";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { Dialog } from "../components/ui/dialog";
import { statusBadge } from "../components/ui/badge";
import { fmt } from "../lib/utils";
import {
  COMPLIANCE_SEVERITIES, COMPLIANCE_STATUSES, COMPLIANCE_STEPS, COMPLIANCE_UPLOAD_ACCEPT, FIELD_LABELS,
  MAX_COMPLIANCE_UPLOAD_BYTES, daysUntil, displaySeverity, isProblemStatus, severityTone, stepIndexFor, todayIso,
} from "../lib/compliance";
import type { Attachment, AuditLog, Client, Compliance } from "@shared/schema";

type Tab = "overview" | "history";

const card = "bg-white border border-[#e5e5e5] rounded-lg";
const textareaCls =
  "w-full rounded-md border border-[#e5e5e5] bg-white px-3 py-2 text-sm text-[#0a0a0a] placeholder-[#b0b0b0] focus:outline-none focus:ring-1 focus:ring-[#0a0a0a] resize-y";

// ---------------------------------------------------------------------------
// Status progress (mirrors the production stage bar)
// ---------------------------------------------------------------------------
function StatusProgress({
  record, onSetStatus, busy,
}: { record: Compliance; onSetStatus: (s: string) => void; busy: boolean }) {
  const idx = stepIndexFor(record.status);
  const problem = isProblemStatus(record.status);
  const done = idx === COMPLIANCE_STEPS.length - 1;
  const pct = idx < 0 ? 0 : Math.round((idx / (COMPLIANCE_STEPS.length - 1)) * 100);
  const next = idx >= 0 && idx < COMPLIANCE_STEPS.length - 1 ? COMPLIANCE_STEPS[idx + 1] : null;
  const days = daysUntil(record.expires);

  return (
    <div className="bg-white border-b border-[#e5e5e5]">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 pt-4 pb-3">
        <div className="flex items-center gap-2.5">
          <span
            className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold shrink-0 text-white ${
              problem ? "bg-red-600" : done ? "bg-[#22c55e]" : "bg-[var(--brand)]"
            }`}
          >
            {problem ? "!" : done ? "✓" : idx + 1}
          </span>
          <div>
            <p className="text-[10px] text-[#737373] font-medium uppercase tracking-wider leading-none mb-1">Current status</p>
            <div className="flex items-center gap-2">{statusBadge(record.status)}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {problem && (
            <Button size="sm" disabled={busy} onClick={() => onSetStatus("In Progress")}>
              Start resolving <ChevronRight size={13} />
            </Button>
          )}
          {next && !problem && (
            <Button size="sm" disabled={busy} onClick={() => onSetStatus(next.status)}>
              Move to {next.label.toLowerCase()} <ChevronRight size={13} />
            </Button>
          )}
        </div>
      </div>

      <div className="px-4 sm:px-6 pb-3">
        <div className="h-1.5 bg-[#e5e5e5] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${problem ? "bg-red-500" : done ? "bg-[#22c55e]" : "bg-[var(--brand)]"}`}
            style={{ width: `${problem ? 100 : pct}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 px-4 sm:px-6 pb-4">
        {COMPLIANCE_STEPS.map((step, i) => {
          const isDone = !problem && i < idx;
          const active = !problem && i === idx;
          return (
            <button
              key={step.status}
              type="button"
              disabled={busy || active}
              onClick={() => onSetStatus(step.status)}
              title={active ? step.hint : `Set status to ${step.status}`}
              className={`group flex items-start gap-2 rounded-md px-2 py-1.5 text-left transition-colors ${
                active ? "bg-[color-mix(in_srgb,var(--brand)_7%,white)]" : "hover:bg-[#f7f7f7]"
              }`}
            >
              <span
                className={`mt-0.5 w-5 h-5 shrink-0 rounded-full flex items-center justify-center text-[9px] font-bold ${
                  isDone || (active && done) ? "bg-[#22c55e] text-white" : active ? "bg-[var(--brand)] text-white" : "bg-[#e5e5e5] text-[#a3a3a3]"
                }`}
              >
                {isDone || (active && done) ? "✓" : i + 1}
              </span>
              <span className="min-w-0">
                <span className={`block text-xs ${active ? "font-semibold text-[#0a0a0a]" : isDone ? "font-medium text-[#16a34a]" : "text-[#737373]"}`}>
                  {step.label}
                </span>
                <span className="hidden sm:block text-[10px] leading-snug text-[#a3a3a3]">{step.hint}</span>
              </span>
            </button>
          );
        })}
      </div>

      {(problem || (days !== null && days <= 30)) && (
        <div
          className={`flex items-start gap-2 px-4 sm:px-6 py-2.5 text-xs border-t ${
            problem || (days !== null && days < 0) ? "bg-red-50 border-red-100 text-red-800" : "bg-amber-50 border-amber-100 text-amber-900"
          }`}
        >
          <AlertTriangle size={14} className="mt-px shrink-0" />
          <span>
            {problem
              ? `This record is marked ${record.status.toLowerCase()}. Upload the current document or move it back into progress once you start resolving it.`
              : days! < 0
                ? `Expired ${Math.abs(days!)} day${Math.abs(days!) === 1 ? "" : "s"} ago (${fmt(record.expires)}). Renew it and update the expiry date.`
                : days === 0
                  ? `Expires today. Renew it and update the expiry date.`
                  : `Expires in ${days} day${days === 1 ? "" : "s"} (${fmt(record.expires)}). Start the renewal now.`}
          </span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Details card (view / edit)
// ---------------------------------------------------------------------------
type DetailsForm = {
  type: string; status: string; severity: string; jurisdiction: string; regulatoryArea: string;
  controlReference: string; expires: string; owner: string; requiredFor: string; documentUrl: string; clientId: string;
};

function toForm(r: Compliance): DetailsForm {
  return {
    type: r.type ?? "",
    status: r.status ?? "Pending Review",
    severity: displaySeverity(r.severity) === "—" ? "" : displaySeverity(r.severity),
    jurisdiction: r.jurisdiction ?? "",
    regulatoryArea: r.regulatoryArea ?? "",
    controlReference: r.controlReference ?? "",
    expires: (r.expires ?? "").slice(0, 10),
    owner: r.owner ?? "",
    requiredFor: r.requiredFor ?? "",
    documentUrl: r.documentUrl ?? "",
    clientId: r.clientId ?? "",
  };
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="py-2.5 sm:grid sm:grid-cols-3 sm:gap-4">
      <dt className="text-xs font-medium text-[#737373]">{label}</dt>
      <dd className="mt-0.5 sm:mt-0 sm:col-span-2 text-sm text-[#0a0a0a] break-words">{children}</dd>
    </div>
  );
}

function FieldBox({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <label className={`block ${wide ? "sm:col-span-2" : ""}`}>
      <span className="block text-xs font-medium text-[#404040] mb-1">{label}</span>
      {children}
    </label>
  );
}

function DetailsCard({
  record, clients, onSave, saving,
}: { record: Compliance; clients: Client[]; onSave: (patch: Partial<Compliance>) => Promise<unknown>; saving: boolean }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<DetailsForm>(() => toForm(record));
  useEffect(() => { if (!editing) setForm(toForm(record)); }, [record, editing]);
  const set = (k: keyof DetailsForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const sev = severityTone(record.severity);
  const partner = clients.find((c) => c.id === record.clientId);
  const statusOptions = COMPLIANCE_STATUSES.includes(form.status as any) ? COMPLIANCE_STATUSES : [form.status, ...COMPLIANCE_STATUSES];

  async function save() {
    if (!form.type.trim()) { toast.error("Type is required"); return; }
    await onSave({
      type: form.type.trim(),
      status: form.status,
      severity: form.severity || null,
      jurisdiction: form.jurisdiction.trim(),
      regulatoryArea: form.regulatoryArea.trim(),
      controlReference: form.controlReference.trim() || null,
      expires: form.expires || null,
      owner: form.owner.trim() || null,
      requiredFor: form.requiredFor.trim() || null,
      documentUrl: form.documentUrl.trim() || null,
      clientId: form.clientId,
    });
    setEditing(false);
  }

  return (
    <section className={card}>
      <header className="flex items-center justify-between px-5 py-3.5 border-b border-[#f0f0f0]">
        <h2 className="text-sm font-semibold text-[#0a0a0a]">Record details</h2>
        {!editing ? (
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            <Pencil size={12} /> Edit
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={saving}>Cancel</Button>
            <Button size="sm" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
          </div>
        )}
      </header>

      {!editing ? (
        <dl className="px-5 divide-y divide-[#f5f5f5]">
          <Row label="Type">{record.type}</Row>
          <Row label="Severity">
            {record.severity ? (
              <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: sev.bg, color: sev.fg }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: sev.dot }} />
                {displaySeverity(record.severity)}
              </span>
            ) : "—"}
          </Row>
          <Row label="Jurisdiction">{record.jurisdiction || "—"}</Row>
          <Row label="Regulatory area">{record.regulatoryArea || "—"}</Row>
          <Row label="Reference / permit #">{record.controlReference || "—"}</Row>
          <Row label="Owner">{record.owner || "—"}</Row>
          <Row label="Required for">{record.requiredFor || "—"}</Row>
          <Row label="Trading partner">{partner?.name || "—"}</Row>
          <Row label="Document link">
            {record.documentUrl ? (
              <a href={record.documentUrl} target="_blank" rel="noopener noreferrer" className="text-[var(--brand)] hover:underline break-all">
                {record.documentUrl}
              </a>
            ) : "—"}
          </Row>
        </dl>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3 p-5">
          <FieldBox label="Type *" wide>
            <Input value={form.type} onChange={set("type")} placeholder="e.g. DSP Permit, State License Renewal" />
          </FieldBox>
          <FieldBox label="Status">
            <Select value={form.status} onChange={set("status")}>
              {statusOptions.map((s) => <option key={s}>{s}</option>)}
            </Select>
          </FieldBox>
          <FieldBox label="Severity">
            <Select value={form.severity} onChange={set("severity")}>
              <option value="">— None —</option>
              {COMPLIANCE_SEVERITIES.map((s) => <option key={s}>{s}</option>)}
            </Select>
          </FieldBox>
          <FieldBox label="Expires / due date">
            <Input type="date" value={form.expires} onChange={set("expires")} />
          </FieldBox>
          <FieldBox label="Jurisdiction">
            <Input value={form.jurisdiction} onChange={set("jurisdiction")} placeholder="Federal" />
          </FieldBox>
          <FieldBox label="Regulatory area">
            <Input value={form.regulatoryArea} onChange={set("regulatoryArea")} placeholder="Set automatically from the type" />
          </FieldBox>
          <FieldBox label="Reference / permit #">
            <Input value={form.controlReference} onChange={set("controlReference")} placeholder="e.g. DSP-FL-12345" />
          </FieldBox>
          <FieldBox label="Owner">
            <Input value={form.owner} onChange={set("owner")} placeholder="Name or department" />
          </FieldBox>
          <FieldBox label="Required for">
            <Input value={form.requiredFor} onChange={set("requiredFor")} placeholder="e.g. Bottling, interstate sales" />
          </FieldBox>
          <FieldBox label="Trading partner">
            <Select value={form.clientId} onChange={set("clientId")}>
              <option value="">— None —</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </FieldBox>
          <FieldBox label="Document link">
            <Input value={form.documentUrl} onChange={set("documentUrl")} placeholder="https://…" />
          </FieldBox>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------
function NotesCard({ record, onSave, saving }: { record: Compliance; onSave: (p: Partial<Compliance>) => Promise<unknown>; saving: boolean }) {
  const [value, setValue] = useState(record.notes ?? "");
  useEffect(() => { setValue(record.notes ?? ""); }, [record.notes]);
  const dirty = value !== (record.notes ?? "");
  return (
    <section className={card}>
      <header className="flex items-center justify-between px-5 py-3.5 border-b border-[#f0f0f0]">
        <h2 className="text-sm font-semibold text-[#0a0a0a]">Notes</h2>
        {dirty && (
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setValue(record.notes ?? "")} disabled={saving}>Discard</Button>
            <Button size="sm" onClick={() => onSave({ notes: value.trim() || null })} disabled={saving}>
              {saving ? "Saving…" : "Save notes"}
            </Button>
          </div>
        )}
      </header>
      <div className="p-5">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={5}
          className={textareaCls}
          placeholder="What's been done, who you spoke to, regulation references, next steps…"
        />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------
function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function DocumentsCard({ recordId }: { recordId: string }) {
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const key = [`/api/compliance/${recordId}/documents`];
  const { data: docs = [], isLoading } = useQuery<Attachment[]>({
    queryKey: key,
    queryFn: () => apiRequest(`/api/compliance/${recordId}/documents`),
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = () => reject(new Error("Could not read the file"));
        r.readAsDataURL(file);
      });
      return apiRequest(`/api/compliance/${recordId}/documents`, {
        method: "POST",
        body: JSON.stringify({ originalFilename: file.name, dataUrl }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: ["/api/audit-logs", "compliance", recordId] });
      toast.success("Document uploaded");
    },
    onError: (e: any) => toast.error(e.message),
  });

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_COMPLIANCE_UPLOAD_BYTES) {
      toast.error("That file is over 4 MB. Please upload a smaller PDF or image.");
      return;
    }
    upload.mutate(file);
  }

  const active = docs.filter((d) => d.status !== "revoked");

  return (
    <section className={card}>
      <header className="flex items-center justify-between px-5 py-3.5 border-b border-[#f0f0f0]">
        <div>
          <h2 className="text-sm font-semibold text-[#0a0a0a]">Documents</h2>
          <p className="text-[11px] text-[#a3a3a3] mt-0.5">Permits, certificates, filings, inspection reports · PDF or image, up to 4 MB</p>
        </div>
        <input ref={input} type="file" accept={COMPLIANCE_UPLOAD_ACCEPT} className="hidden" onChange={pick} />
        <Button size="sm" variant="outline" onClick={() => input.current?.click()} disabled={upload.isPending}>
          <Upload size={12} /> {upload.isPending ? "Uploading…" : "Upload"}
        </Button>
      </header>
      {isLoading ? (
        <p className="px-5 py-6 text-sm text-[#a3a3a3]">Loading documents…</p>
      ) : active.length === 0 ? (
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="m-5 flex w-[calc(100%-2.5rem)] flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-[#d4d4d4] py-8 text-center hover:border-[var(--brand)] hover:bg-[#fafafa] transition-colors"
        >
          <Paperclip size={18} className="text-[#a3a3a3]" />
          <span className="text-sm font-medium text-[#404040]">Attach the supporting document</span>
          <span className="text-xs text-[#a3a3a3]">Keeps the proof with the record for audits</span>
        </button>
      ) : (
        <ul className="divide-y divide-[#f5f5f5]">
          {active.map((d) => (
            <li key={d.id} className="flex items-center gap-3 px-5 py-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[color-mix(in_srgb,var(--brand)_9%,white)] text-[var(--brand)]">
                <FileText size={15} />
              </span>
              <div className="min-w-0 flex-1">
                <a href={d.filePath} target="_blank" rel="noopener noreferrer" className="block truncate text-sm font-medium text-[#0a0a0a] hover:text-[var(--brand)] hover:underline">
                  {d.originalFilename}
                </a>
                <p className="text-[11px] text-[#a3a3a3]">
                  {formatBytes(d.byteSize)} · {d.uploadedBy} · {fmt(d.uploadedAt)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Side panel: dates, review, delete
// ---------------------------------------------------------------------------
function DatesCard({ record, onReviewed, busy }: { record: Compliance; onReviewed: () => void; busy: boolean }) {
  const days = daysUntil(record.expires);
  const reviewedToday = (record.lastReviewedOn ?? "").slice(0, 10) === todayIso();
  const chip =
    days === null ? null
      : days < 0 ? { t: `${Math.abs(days)}d overdue`, c: "bg-red-50 text-red-700" }
      : days <= 30 ? { t: days === 0 ? "today" : `in ${days}d`, c: "bg-amber-50 text-amber-800" }
      : { t: `in ${days}d`, c: "bg-[#f5f5f5] text-[#525252]" };
  return (
    <section className={card}>
      <header className="px-5 py-3.5 border-b border-[#f0f0f0]">
        <h2 className="text-sm font-semibold text-[#0a0a0a]">Key dates</h2>
      </header>
      <dl className="px-5 py-2 text-sm">
        <div className="flex items-center justify-between py-2">
          <dt className="flex items-center gap-2 text-[#737373] text-xs"><CalendarClock size={13} /> Expires / due</dt>
          <dd className="flex items-center gap-2 font-medium">
            {fmt(record.expires)}
            {chip && <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${chip.c}`}>{chip.t}</span>}
          </dd>
        </div>
        <div className="flex items-center justify-between py-2">
          <dt className="flex items-center gap-2 text-[#737373] text-xs"><ClipboardCheck size={13} /> Last reviewed</dt>
          <dd className="font-medium">{fmt(record.lastReviewedOn)}</dd>
        </div>
        <div className="flex items-center justify-between py-2">
          <dt className="flex items-center gap-2 text-[#737373] text-xs"><Lock size={13} /> Keep until</dt>
          <dd className="font-medium">{fmt(record.retentionUntil)}</dd>
        </div>
        <div className="flex items-center justify-between py-2 text-xs text-[#a3a3a3]">
          <dt>Created</dt>
          <dd>{fmt(record.createdAt)}</dd>
        </div>
      </dl>
      <div className="px-5 pb-4">
        <Button variant="outline" className="w-full" onClick={onReviewed} disabled={busy || reviewedToday}>
          <Check size={14} /> {reviewedToday ? "Reviewed today" : "Mark reviewed today"}
        </Button>
      </div>
    </section>
  );
}

function DeleteCard({ record, onDelete, deleting }: { record: Compliance; onDelete: () => void; deleting: boolean }) {
  const [confirm, setConfirm] = useState(false);
  const days = daysUntil(record.retentionUntil);
  const locked = days === null || days > 0;
  return (
    <section className={`${card} p-5`}>
      <h2 className="text-sm font-semibold text-[#0a0a0a]">Delete record</h2>
      {locked ? (
        <p className="mt-1 text-xs text-[#737373] leading-relaxed">
          TTB record-keeping rules require keeping this record until <strong>{fmt(record.retentionUntil)}</strong>. It can be deleted after that date.
        </p>
      ) : (
        <>
          <p className="mt-1 text-xs text-[#737373]">The retention period has passed, so this record can be removed.</p>
          <Button variant="outline" size="sm" className="mt-3 text-red-600" onClick={() => setConfirm(true)}>
            <Trash2 size={12} /> Delete
          </Button>
        </>
      )}
      <Dialog open={confirm} onClose={() => setConfirm(false)} title="Delete this record?" size="sm">
        <p className="text-sm text-[#404040]">“{record.type}” will be removed permanently. This can’t be undone.</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setConfirm(false)}>Cancel</Button>
          <Button variant="destructive" onClick={onDelete} disabled={deleting}>{deleting ? "Deleting…" : "Delete"}</Button>
        </div>
      </Dialog>
    </section>
  );
}

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------
function describe(log: AuditLog): { text: string; tone: string } {
  const d = (log.details ?? {}) as Record<string, any>;
  if (log.action === "create") return { text: `Record created as ${d.status ?? "Pending Review"}`, tone: "text-[#0a0a0a]" };
  if (log.action === "document_upload") return { text: `Document uploaded: ${d.filename ?? "file"}`, tone: "text-[var(--brand)]" };
  if (log.action === "update") {
    if (d.previousStatus) return { text: `Status changed: ${d.previousStatus} → ${d.status}`, tone: "text-[#0a0a0a]" };
    const keys = d.changes ? Object.keys(d.changes) : [];
    if (keys.length === 1 && keys[0] === "lastReviewedOn") return { text: "Marked reviewed", tone: "text-[#16a34a]" };
    if (keys.length) return { text: `Updated ${keys.map((k) => (FIELD_LABELS[k] ?? k).toLowerCase()).join(", ")}`, tone: "text-[#0a0a0a]" };
    return { text: "Record saved", tone: "text-[#737373]" };
  }
  if (log.action === "delete") return { text: "Record deleted", tone: "text-red-600" };
  return { text: log.action, tone: "text-[#0a0a0a]" };
}

function HistoryPanel({ recordId }: { recordId: string }) {
  const { data: logs = [], isLoading } = useQuery<AuditLog[]>({
    queryKey: ["/api/audit-logs", "compliance", recordId],
    queryFn: () => apiRequest(`/api/audit-logs?entityType=compliance&entityId=${recordId}&limit=200`),
  });
  if (isLoading) return <p className="py-8 text-center text-sm text-[#737373]">Loading history…</p>;
  if (!logs.length)
    return (
      <div className="py-12 text-center text-[#737373]">
        <p className="text-sm font-medium">No history yet</p>
        <p className="mt-1 text-xs">Status changes, edits and uploads will appear here.</p>
      </div>
    );
  const sorted = [...logs].sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
  return (
    <ol className="relative ml-3 border-l border-[#ececec]">
      {sorted.map((log, i) => {
        const { text, tone } = describe(log);
        const ts = new Date(log.occurredAt);
        const changes = ((log.details ?? {}) as Record<string, any>).changes as Record<string, unknown> | undefined;
        const detailKeys = changes ? Object.keys(changes).filter((k) => k !== "status" && k !== "notes") : [];
        return (
          <li key={log.id ?? i} className="mb-5 ml-5 last:mb-0">
            <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-[var(--brand)]" />
            <div className="flex flex-wrap items-baseline justify-between gap-x-4">
              <p className={`text-sm font-medium ${tone}`}>{text}</p>
              <time className="text-[11px] text-[#a3a3a3]">
                {ts.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} ·{" "}
                {ts.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
              </time>
            </div>
            <p className="text-xs text-[#a3a3a3]">by {log.actorName ?? log.actorRole ?? "System"}</p>
            {detailKeys.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {detailKeys.map((k) => (
                  <span key={k} className="rounded bg-[#f5f5f5] px-1.5 py-0.5 text-[11px] text-[#525252]">
                    {FIELD_LABELS[k] ?? k}: <strong className="font-medium text-[#0a0a0a]">{k === "expires" || k === "lastReviewedOn" ? fmt(changes![k] as string) : String(changes![k] ?? "—")}</strong>
                  </span>
                ))}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function ComplianceDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("overview");
  const recordKey = [`/api/compliance/${id}`];

  const { data: record, isLoading, error } = useQuery<Compliance>({
    queryKey: recordKey,
    queryFn: () => apiRequest(`/api/compliance/${id}`),
    enabled: !!id,
  });
  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    queryFn: () => apiRequest("/api/clients"),
  });

  const update = useMutation({
    mutationFn: (patch: Partial<Compliance>) =>
      apiRequest<Compliance>(`/api/compliance/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
    onSuccess: (doc) => {
      qc.setQueryData(recordKey, doc);
      qc.invalidateQueries({ queryKey: ["/api/compliance"] });
      qc.invalidateQueries({ queryKey: ["/api/audit-logs", "compliance", id] });
    },
    onError: (e: any) => toast.error(e.message),
  });
  const save = (patch: Partial<Compliance>, message = "Saved") =>
    update.mutateAsync(patch).then((r) => { toast.success(message); return r; });

  const remove = useMutation({
    mutationFn: () => apiRequest(`/api/compliance/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/compliance"] });
      toast.success("Record deleted");
      navigate("/compliance");
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <Layout>
        <div className="flex h-64 items-center justify-center text-sm text-[#737373]">Loading…</div>
      </Layout>
    );
  }
  if (error || !record) {
    return (
      <Layout>
        <div className="flex h-64 flex-col items-center justify-center gap-3 text-sm text-[#737373]">
          <p>This compliance record couldn’t be found.</p>
          <Button variant="outline" size="sm" onClick={() => navigate("/compliance")}>Back to Compliance</Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Header */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 sm:px-6 py-4 bg-white border-b border-[#e5e5e5]">
        <button
          onClick={() => navigate("/compliance")}
          className="flex items-center gap-1 text-xs text-[#737373] hover:text-[#0a0a0a] transition-colors"
        >
          <ArrowLeft size={13} /> Back to Compliance
        </button>
        <span className="text-[#e5e5e5]">|</span>
        <h1 className="text-sm font-semibold text-[#0a0a0a]">
          {record.type}
          {record.jurisdiction ? <span className="font-normal text-[#737373]"> · {record.jurisdiction}</span> : null}
        </h1>
        {record.controlReference && (
          <span className="rounded bg-[#f5f5f5] px-1.5 py-0.5 font-mono text-[11px] text-[#525252]">{record.controlReference}</span>
        )}
      </div>

      <StatusProgress
        record={record}
        busy={update.isPending}
        onSetStatus={(status) => save({ status }, `Status set to ${status}`)}
      />

      {/* Tabs */}
      <div className="flex gap-1 px-4 sm:px-6 border-b border-[#e5e5e5] bg-white">
        {(["overview", "history"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2.5 text-xs font-medium border-b-2 -mb-px transition-colors ${
              tab === t ? "border-[var(--brand)] text-[#0a0a0a]" : "border-transparent text-[#737373] hover:text-[#0a0a0a]"
            }`}
          >
            {t === "overview" ? "Overview" : "History"}
          </button>
        ))}
      </div>

      <div className="p-4 sm:p-6">
        {tab === "overview" ? (
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-2 min-w-0">
              <DetailsCard record={record} clients={clients} saving={update.isPending} onSave={(p) => save(p, "Record updated")} />
              <DocumentsCard recordId={record.id} />
              <NotesCard record={record} saving={update.isPending} onSave={(p) => save(p, "Notes saved")} />
            </div>
            <div className="space-y-4">
              <DatesCard record={record} busy={update.isPending} onReviewed={() => save({ lastReviewedOn: todayIso() }, "Marked reviewed today")} />
              <DeleteCard record={record} deleting={remove.isPending} onDelete={() => remove.mutate()} />
            </div>
          </div>
        ) : (
          <div className={`${card} p-5`}>
            <h2 className="mb-4 text-sm font-semibold text-[#0a0a0a]">Record history</h2>
            <HistoryPanel recordId={record.id} />
          </div>
        )}
      </div>
    </Layout>
  );
}
