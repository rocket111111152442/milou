import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ACTION_KIND_LABELS, type ActionDTO } from "@antonio/shared";
import { api, queryClient } from "../lib/api";
import { fmtDateTime, fmtRelative } from "../lib/format";
import { useApp } from "../lib/app-state";
import { Card, DemoBadge, Loading, StatusBadge } from "./ui";
import { Icon } from "./Icons";

interface Props {
  id: string;
  compact?: boolean;
  onClose?: () => void;
}

/** Carte d'action : l'état affiché est TOUJOURS celui du serveur. */
export function ActionCard({ id, compact, onClose }: Props) {
  const { toast } = useApp();
  const q = useQuery({
    queryKey: ["action", id],
    queryFn: () => api<{ action: ActionDTO; history: { toStatus: string; note: string | null; createdAt: string; actor: string }[] }>(`/api/actions/${id}`),
    refetchInterval: (query) => (["authorized", "executing", "uncertain"].includes(query.state.data?.action.status ?? "") ? 2000 : false),
  });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<{ body?: string; subject?: string }>({});
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["action", id] });
    void queryClient.invalidateQueries({ queryKey: ["actions"] });
  };
  const onErr = (e: Error) => toast(e.message);
  const approve = useMutation({ mutationFn: (hash: string) => api(`/api/actions/${id}/approve`, { body: { paramsHash: hash } }), onSuccess: refresh, onError: onErr });
  const reject = useMutation({ mutationFn: () => api(`/api/actions/${id}/reject`, { method: "POST" }), onSuccess: refresh, onError: onErr });
  const revert = useMutation({
    mutationFn: () => api(`/api/actions/${id}/revert`, { method: "POST" }),
    onSuccess: () => {
      refresh();
      toast("Retour en arrière demandé.");
    },
    onError: onErr,
  });
  const save = useMutation({
    mutationFn: () => api(`/api/actions/${id}`, { method: "PATCH", body: { params: draft } }),
    onSuccess: () => {
      setEditing(false);
      refresh();
      toast("Contenu modifié : relisez puis validez la nouvelle version.");
    },
    onError: onErr,
  });

  if (q.isLoading || !q.data) return <Card compact={compact}>{q.isError ? <p className="empty">Action introuvable.</p> : <Loading />}</Card>;
  const a = q.data.action;
  const p = a.params as Record<string, unknown>;
  const isMail = a.kind === "email.reply" || a.kind === "email.send" || a.kind === "email.draft";
  const failing = a.checks.filter((c) => !c.ok);

  if (compact) {
    return (
      <Card compact title={ACTION_KIND_LABELS[a.kind]} actions={<StatusBadge status={a.status} />}>
        <div className="card-body small">{a.summary}</div>
      </Card>
    );
  }

  return (
    <Card
      title={
        <span className="row">
          {ACTION_KIND_LABELS[a.kind]}
          {a.simulated && <DemoBadge />}
        </span>
      }
      actions={
        <>
          <StatusBadge status={a.status} />
          {onClose && (
            <button className="btn ghost icon small" onClick={onClose} aria-label="Fermer">
              <Icon.Close />
            </button>
          )}
        </>
      }
    >
      <div className="card-body stack-12">
        <p>{a.summary}</p>
        {isMail && (
          <dl className="kv">
            <dt>Compte</dt>
            <dd>{a.accountLabel ?? "—"}</dd>
            <dt>À</dt>
            <dd>{(p.to as { email: string; name: string | null }[]).map((t) => (t.name ? `${t.name} <${t.email}>` : t.email)).join(", ")}</dd>
            {(p.cc as unknown[])?.length ? (
              <>
                <dt>Cc</dt>
                <dd>{(p.cc as { email: string }[]).map((t) => t.email).join(", ")}</dd>
              </>
            ) : null}
            <dt>Objet</dt>
            <dd>
              {editing ? (
                <input className="input" defaultValue={p.subject as string} onChange={(e) => setDraft((d) => ({ ...d, subject: e.target.value }))} aria-label="Objet" />
              ) : (
                (p.subject as string)
              )}
            </dd>
          </dl>
        )}
        {isMail &&
          (editing ? (
            <textarea className="textarea" rows={8} defaultValue={p.body as string} onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))} aria-label="Contenu du message" />
          ) : (
            <div className="mail-body">{p.body as string}</div>
          ))}
        {a.kind.startsWith("calendar.") && p.start ? (
          <dl className="kv">
            <dt>Quand</dt>
            <dd>
              {fmtDateTime(p.start as string)} → {fmtDateTime(p.end as string)}
            </dd>
            {(p.attendees as unknown[])?.length ? (
              <>
                <dt>Invités</dt>
                <dd>{(p.attendees as { email: string }[]).map((x) => x.email).join(", ")}</dd>
              </>
            ) : null}
            {p.addOnlineMeeting ? (
              <>
                <dt>Visio</dt>
                <dd>Lien ajouté si le compte le permet</dd>
              </>
            ) : null}
          </dl>
        ) : null}

        {a.reason && <p className="small muted">{a.reason}</p>}
        {failing.length > 0 && (
          <div className="warning-box">
            <strong>Points à vérifier avant validation</strong>
            <ul className="checks" style={{ marginTop: 6 }}>
              {failing.map((c) => (
                <li key={c.id}>
                  <span className="ko">•</span>
                  <span>
                    {c.label}
                    {c.detail ? ` — ${c.detail}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {a.status === "succeeded" && a.providerResult && (
          <div className="info-box small">
            {a.simulated ? "Résultat simulé (démonstration). " : "Résultat confirmé par le fournisseur. "}
            {a.kind === "calendar.create" && (
              <>
                Invitations envoyées : {String((a.providerResult as { invitationsSent?: number }).invitationsSent ?? 0)} — participations acceptées :{" "}
                {String((a.providerResult as { attendeesAccepted?: number }).attendeesAccepted ?? 0)}.
              </>
            )}
            {(a.providerResult as { verifiedAfterInterruption?: boolean }).verifiedAfterInterruption && " Envoi confirmé après vérification suite à une interruption."}
          </div>
        )}
        {a.status === "uncertain" && <div className="warning-box">Coupure pendant l'envoi : Waverti vérifie chez le fournisseur avant toute nouvelle tentative. Rien ne sera renvoyé automatiquement.</div>}
        {a.error && a.status === "failed" && <div className="danger-box">{a.error}</div>}
        {a.status === "succeeded" && a.reversibility === "irreversible" && (a.kind === "email.send" || a.kind === "email.reply") && (
          <p className="tiny muted">Un e-mail envoyé ne peut pas être annulé.</p>
        )}

        <div className="row wrap">
          {a.status === "awaiting_approval" && !editing && (
            <>
              <button className="btn primary" disabled={approve.isPending} onClick={() => approve.mutate(a.paramsHash)}>
                <Icon.Check /> Valider{isMail && a.kind !== "email.draft" ? " et envoyer" : ""}
              </button>
              {isMail && (
                <button className="btn" onClick={() => setEditing(true)}>
                  <Icon.Edit /> Modifier
                </button>
              )}
              <button className="btn ghost danger" disabled={reject.isPending} onClick={() => reject.mutate()}>
                Refuser
              </button>
            </>
          )}
          {editing && (
            <>
              <button className="btn primary" disabled={save.isPending} onClick={() => save.mutate()}>
                Enregistrer les modifications
              </button>
              <button className="btn ghost" onClick={() => setEditing(false)}>
                Annuler
              </button>
            </>
          )}
          {a.status === "succeeded" && (a.kind === "email.trash" || a.kind === "task.create") && (
            <button className="btn" onClick={() => revert.mutate()}>
              <Icon.Restore /> {a.kind === "email.trash" ? "Restaurer le message" : "Supprimer la tâche"}
            </button>
          )}
        </div>
        <details>
          <summary className="small muted" style={{ cursor: "pointer" }}>
            Détails et historique
          </summary>
          <div className="stack-8" style={{ marginTop: 8 }}>
            <ul className="checks">
              {a.checks.map((c) => (
                <li key={c.id}>
                  <span className={c.ok ? "ok" : "ko"}>{c.ok ? "✓" : "!"}</span>
                  <span>
                    {c.label}
                    {c.detail ? ` — ${c.detail}` : ""}
                  </span>
                </li>
              ))}
            </ul>
            <p className="tiny muted">
              Origine : {a.origin === "rule" ? `règle « ${a.ruleName ?? "?"} »` : a.origin === "voice" ? "demande orale" : a.origin === "chat" ? "demande écrite" : a.origin} · empreinte du contenu {a.paramsHash.slice(0, 10)}
            </p>
            <ul className="checks">
              {q.data.history.map((h, i) => (
                <li key={i}>
                  <span className="muted">{fmtRelative(h.createdAt)}</span>
                  <span>
                    → {h.toStatus} {h.note ? `· ${h.note}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </details>
      </div>
    </Card>
  );
}
