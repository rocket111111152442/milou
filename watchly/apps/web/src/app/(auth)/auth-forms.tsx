"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button, Callout, Checkbox, Field, Input, Label } from "@watchly/ui";
import {
  forgotPasswordAction,
  resendConfirmationAction,
  resetPasswordAction,
  signInAction,
  signUpAction,
  type FormState,
} from "./actions";

function PasswordInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={visible ? "text" : "password"} className="pr-12" />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute right-1.5 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-md text-muted-fg hover:bg-surface hover:text-ink"
        aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

function FormMessages({ state }: { state: FormState }) {
  return (
    <>
      {state.error ? (
        <Callout tone="danger" role="alert">
          {state.error}
        </Callout>
      ) : null}
      {state.message ? (
        <Callout tone="success" role="status">
          {state.message}
        </Callout>
      ) : null}
    </>
  );
}

export function SignUpForm({ formule, googleEnabled }: { formule?: string; googleEnabled: boolean }) {
  const [state, action, pending] = useActionState(signUpAction, {});
  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="formule" value={formule ?? ""} />
      <Field id="displayName" label="Prénom ou pseudo" hint="Facultatif.">
        {(p) => <Input {...p} name="displayName" autoComplete="given-name" maxLength={80} defaultValue={state.values?.displayName} />}
      </Field>
      <Field id="email" label="Adresse e-mail" required error={state.fieldErrors?.email}>
        {(p) => <Input {...p} name="email" type="email" autoComplete="email" required defaultValue={state.values?.email} />}
      </Field>
      <Field id="password" label="Mot de passe" required error={state.fieldErrors?.password} hint="10 caractères minimum, avec des lettres et des chiffres ou symboles.">
        {(p) => <PasswordInput {...p} name="password" autoComplete="new-password" required minLength={10} maxLength={128} />}
      </Field>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-start gap-3">
          <Checkbox id="terms" name="terms" value="on" required aria-invalid={state.fieldErrors?.terms ? true : undefined} aria-describedby={state.fieldErrors?.terms ? "terms-error" : undefined} className="mt-0.5" />
          <Label htmlFor="terms" className="font-normal leading-relaxed text-ink-soft">
            J'accepte les{" "}
            <Link href="/legal/conditions-generales" className="text-blue underline-offset-4 hover:underline" target="_blank">
              conditions générales
            </Link>{" "}
            et j'ai lu la{" "}
            <Link href="/legal/confidentialite" className="text-blue underline-offset-4 hover:underline" target="_blank">
              politique de confidentialité
            </Link>
            .
          </Label>
        </div>
        {state.fieldErrors?.terms ? (
          <p id="terms-error" role="alert" className="text-xs font-medium text-danger">
            {state.fieldErrors.terms}
          </p>
        ) : null}
      </div>
      <FormMessages state={state} />
      <Button type="submit" size="lg" loading={pending}>
        Créer mon compte
      </Button>
      {googleEnabled ? <GoogleButton /> : null}
    </form>
  );
}

function GoogleButton() {
  return (
    <a
      href="/auth/google"
      className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-line bg-white text-[15px] font-medium hover:bg-surface"
    >
      Continuer avec Google
    </a>
  );
}

export function SignInForm({ suivant, googleEnabled }: { suivant?: string; googleEnabled: boolean }) {
  const [state, action, pending] = useActionState(signInAction, {});
  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="suivant" value={suivant ?? ""} />
      <Field id="email" label="Adresse e-mail" required error={state.fieldErrors?.email}>
        {(p) => <Input {...p} name="email" type="email" autoComplete="email" required defaultValue={state.values?.email} />}
      </Field>
      <Field id="password" label="Mot de passe" required error={state.fieldErrors?.password}>
        {(p) => <PasswordInput {...p} name="password" autoComplete="current-password" required />}
      </Field>
      <div className="-mt-2 text-right">
        <Link href="/mot-de-passe-oublie" className="text-sm text-blue underline-offset-4 hover:underline">
          Mot de passe oublié ?
        </Link>
      </div>
      <FormMessages state={state} />
      <Button type="submit" size="lg" loading={pending}>
        Se connecter
      </Button>
      {googleEnabled ? <GoogleButton /> : null}
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(forgotPasswordAction, {});
  return (
    <form action={action} className="flex flex-col gap-5">
      <Field id="email" label="Adresse e-mail" required error={state.fieldErrors?.email}>
        {(p) => <Input {...p} name="email" type="email" autoComplete="email" required />}
      </Field>
      <FormMessages state={state} />
      <Button type="submit" size="lg" loading={pending}>
        Recevoir un lien de réinitialisation
      </Button>
    </form>
  );
}

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState(resetPasswordAction, {});
  return (
    <form action={action} className="flex flex-col gap-5">
      <Field id="password" label="Nouveau mot de passe" required error={state.fieldErrors?.password} hint="10 caractères minimum.">
        {(p) => <PasswordInput {...p} name="password" autoComplete="new-password" required minLength={10} />}
      </Field>
      <Field id="confirm" label="Confirmez le mot de passe" required error={state.fieldErrors?.confirm}>
        {(p) => <PasswordInput {...p} name="confirm" autoComplete="new-password" required minLength={10} />}
      </Field>
      <FormMessages state={state} />
      <Button type="submit" size="lg" loading={pending}>
        Enregistrer le mot de passe
      </Button>
    </form>
  );
}

export function ResendConfirmationForm({ email }: { email: string }) {
  const [state, action, pending] = useActionState(resendConfirmationAction, {});
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="email" value={email} />
      <FormMessages state={state} />
      <Button type="submit" variant="secondary" loading={pending}>
        Renvoyer l'e-mail
      </Button>
    </form>
  );
}
