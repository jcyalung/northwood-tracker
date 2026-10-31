"use client";

import { useState, useTransition, type FormEvent } from "react";
import { ROLES, SENSEI_ROLE } from "@/lib/roles";
import { addSensei, removeSensei, type SenseiRow } from "./senseis-actions";

const LABEL = "font-label text-xs uppercase tracking-[0.08em] text-secondary";
const INPUT =
  "rounded-md border border-secondary/40 bg-surface px-3 py-2 focus:border-primary focus:outline-none";

// The senseis list (names and emails). Managers can add and remove senseis;
// nobody can remove themselves.
export function SenseisPanel({
  senseis: initial,
  canManage,
  myEmail,
}: {
  senseis: SenseiRow[];
  canManage: boolean;
  myEmail: string | null;
}) {
  const [senseis, setSenseis] = useState(initial);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    text: string;
    error?: boolean;
  } | null>(null);
  const [pending, startTransition] = useTransition();

  function remove(row: SenseiRow) {
    setConfirming(null);
    startTransition(async () => {
      const result = await removeSensei(row.id).catch(() => null);
      if (result?.ok) {
        setSenseis((list) => list.filter((s) => s.id !== row.id));
        setMessage({ text: `Removed ${row.first_name} ${row.last_name}.` });
      } else {
        setMessage({
          text: result?.error ?? "Couldn't remove. Try again.",
          error: true,
        });
      }
    });
  }

  return (
    <div className="mt-6 grid items-start gap-4 lg:grid-cols-[1fr_22rem]">
      <section className="rounded-lg border border-secondary/20 bg-surface">
        <p className={`${LABEL} px-6 pt-4`}>
          {senseis.length} {senseis.length === 1 ? "sensei" : "senseis"}
        </p>
        {senseis.length === 0 ? (
          <p className="px-6 py-6 text-secondary">No senseis yet.</p>
        ) : (
          <table className="mt-2 w-full text-left">
            <thead>
              <tr className={LABEL}>
                <th className="px-6 py-2">Name</th>
                <th className="px-6 py-2">Email</th>
                {canManage && <th className="px-6 py-2" />}
              </tr>
            </thead>
            <tbody>
              {senseis.map((s) => {
                const isMe = s.email === myEmail;
                return (
                  <tr key={s.id} className="border-t border-secondary/20">
                    <td className="px-6 py-3">
                      {s.first_name} {s.last_name}
                      {isMe && (
                        <span className="ml-2 text-sm text-secondary">
                          (you)
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-secondary">{s.email}</td>
                    {canManage && (
                      <td className="px-6 py-3 text-right">
                        {isMe ? null : confirming === s.id ? (
                          <span className="inline-flex items-center gap-2 text-sm">
                            Remove?
                            <button
                              type="button"
                              onClick={() => remove(s)}
                              disabled={pending}
                              className="rounded-md bg-tertiary px-3 py-1 text-on-primary hover:opacity-90"
                            >
                              Yes
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirming(null)}
                              className="rounded-md border border-primary px-3 py-1 hover:bg-neutral"
                            >
                              No
                            </button>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirming(s.id)}
                            aria-label={`Remove ${s.first_name} ${s.last_name}`}
                            className="rounded-md border border-secondary/40 px-3 py-1 text-sm text-secondary hover:border-primary hover:text-primary"
                          >
                            Remove
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {canManage && (
        <AddSenseiForm
          onAdded={(row) => {
            setSenseis((list) =>
              [...list, row].sort((a, b) =>
                a.last_name.localeCompare(b.last_name),
              ),
            );
            setMessage({
              text: `Added ${row.first_name} ${row.last_name}. They'll create a password when they first sign in.`,
            });
          }}
          onError={(text) => setMessage({ text, error: true })}
        />
      )}

      {message && (
        <p
          role="status"
          className={`text-sm lg:col-span-2 ${message.error ? "text-tertiary" : "text-secondary"}`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}

function AddSenseiForm({
  onAdded,
  onError,
}: {
  onAdded: (row: SenseiRow) => void;
  onError: (text: string) => void;
}) {
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    role_id: SENSEI_ROLE.role_id,
  });
  const [pending, startTransition] = useTransition();

  function submit(e: FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await addSensei(form).catch(() => null);
      if (result?.ok && result.sensei) {
        onAdded(result.sensei);
        setForm({
          first_name: "",
          last_name: "",
          email: "",
          role_id: SENSEI_ROLE.role_id,
        });
      } else {
        onError(
          (result && !result.ok && result.error) || "Couldn't add. Try again.",
        );
      }
    });
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-3 rounded-lg border border-secondary/20 bg-surface p-6"
    >
      <h2 className="font-display text-xl leading-tight">Add a sensei</h2>
      {(["first_name", "last_name", "email"] as const).map((key) => (
        <label key={key} className="flex flex-col gap-1">
          <span className={LABEL}>
            {
              {
                first_name: "First name",
                last_name: "Last name",
                email: "Email",
              }[key]
            }
          </span>
          <input
            type={key === "email" ? "email" : "text"}
            required
            autoComplete="off"
            value={form[key]}
            onChange={(e) => setForm({ ...form, [key]: e.target.value })}
            className={INPUT}
          />
        </label>
      ))}
      <label className="flex flex-col gap-1">
        <span className={LABEL}>Role</span>
        <select
          value={form.role_id}
          onChange={(e) =>
            setForm({ ...form, role_id: Number(e.target.value) })
          }
          className={INPUT}
        >
          {ROLES.map((r) => (
            <option key={r.role_id} value={r.role_id}>
              {r.role_name}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-md bg-primary px-5 py-2 text-sm text-on-primary transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? "Adding…" : "Add sensei"}
      </button>
    </form>
  );
}
