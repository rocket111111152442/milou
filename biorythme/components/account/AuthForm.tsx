"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { signIn, signUp } from "@/app/actions";
import type { Member } from "@/lib/member-auth";
import { useMember } from "./MemberProvider";

type Mode = "login" | "signup";

export default function AuthForm({ onDone, intro }: { onDone?: (m: Member) => void; intro?: string }) {
  const { setMember } = useMember();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [f, setF] = useState({ firstName: "", lastName: "", email: "", phone: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((p) => ({ ...p, [k]: e.target.value }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = mode === "login" ? await signIn({ email: f.email, password: f.password }) : await signUp(f);
      if (!res.ok) return setError(res.error);
      setMember(res.member);
      onDone?.(res.member);
      router.refresh();
    });
  }

  return (
    <div>
      {intro && <p className="mb-5 text-sm text-muted">{intro}</p>}
      <div className="mb-6 grid grid-cols-2 gap-1 rounded-full border border-line bg-ink p-1">
        {(["login", "signup"] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              setError(null);
            }}
            className={`relative rounded-full py-2.5 text-sm font-semibold ${mode === m ? "text-ink" : "text-bone/70"}`}
          >
            {mode === m && <motion.span layoutId="auth-tab" className="absolute inset-0 rounded-full bg-volt" />}
            <span className="relative">{m === "login" ? "Se connecter" : "Créer un compte"}</span>
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="grid gap-3">
        <AnimatePresence initial={false}>
          {mode === "signup" && (
            <motion.div
              key="names"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="grid grid-cols-2 gap-3 overflow-hidden"
            >
              <Field label="Prénom" value={f.firstName} onChange={set("firstName")} autoComplete="given-name" required />
              <Field label="Nom" value={f.lastName} onChange={set("lastName")} autoComplete="family-name" required />
            </motion.div>
          )}
        </AnimatePresence>
        <Field label="Email" type="email" value={f.email} onChange={set("email")} autoComplete="email" required />
        {mode === "signup" && (
          <Field label="Téléphone (facultatif)" type="tel" value={f.phone} onChange={set("phone")} autoComplete="tel" />
        )}
        <Field
          label={mode === "signup" ? "Mot de passe (8 caractères min.)" : "Mot de passe"}
          type="password"
          value={f.password}
          onChange={set("password")}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          minLength={mode === "signup" ? 8 : undefined}
          required
        />
        {error && (
          <motion.p initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl bg-blaze/15 px-4 py-3 text-sm text-blaze">
            {error}
          </motion.p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="mt-2 rounded-full bg-volt py-4 font-semibold text-ink transition hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
        >
          {pending ? "Un instant…" : mode === "login" ? "Se connecter" : "Créer mon compte"}
        </button>
        {mode === "login" && (
          <p className="text-center text-xs text-muted">
            Mot de passe oublié ? Contactez votre club, il pourra vous aider.
          </p>
        )}
      </form>
    </div>
  );
}

export function Field({
  label,
  ...rest
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs uppercase tracking-[0.15em] text-muted">{label}</span>
      <input
        className="w-full rounded-2xl border border-line bg-ink px-4 py-3.5 outline-none transition focus:border-volt disabled:opacity-60"
        {...rest}
      />
    </label>
  );
}
