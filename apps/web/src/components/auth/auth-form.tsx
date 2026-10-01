/**
 * GC-Stats - auth-form
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { signIn } from "next-auth/react";
import { signIn as signInWithPasskey } from "next-auth/webauthn";
import { Link, useRouter } from "@/i18n/navigation";
import { registerWithPassword, type RegisterFieldErrors } from "@/actions/register";
import { ProviderButtons } from "./provider-buttons";
import { PasskeyIcon } from "@/components/icons/brand-icons";

type Mode = "login" | "register";
type FormErrorKey = "invalid-credentials" | "too-many-attempts" | "unknown" | null;
type TwoFactorErrorKey = "invalid-two-factor-code" | "too-many-attempts" | null;

const inputClass =
  "rounded-[9px] border border-neutral-700 bg-[var(--gcs-surface-2)] px-3.5 py-2.5 text-[14.5px] text-neutral-50 outline-none transition-colors focus:border-[#e4ae22]/60";
const fieldErrorClass = "text-[12.5px] text-[#e08585]";

function RequiredMark() {
  return (
    <span className="text-red-500" aria-hidden>
      {" *"}
    </span>
  );
}

// Adding/managing passkeys is a settings/config concern (future account
// settings page), not something offered right after registration — this
// form only ever *authenticates* with a passkey (login mode), it never
// prompts to create one.
export function AuthForm({ mode, callbackUrl }: { mode: Mode; callbackUrl?: string }) {
  const t = useTranslations("auth");
  const router = useRouter();

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [formError, setFormError] = useState<FormErrorKey>(null);
  const [fieldErrors, setFieldErrors] = useState<RegisterFieldErrors>({});
  const [pending, setPending] = useState(false);
  const [passkeyPending, setPasskeyPending] = useState(false);
  const [justRegistered, setJustRegistered] = useState(false);

  // Set once the Credentials provider reports the account has 2FA enabled
  // (auth.ts's authorize() throws a TwoFactorRequiredError) — email/password
  // are already known good at that point, this step only collects the
  // second factor and resubmits the exact same signIn call with it attached.
  const [twoFactorStep, setTwoFactorStep] = useState(false);
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const [code, setCode] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [twoFactorError, setTwoFactorError] = useState<TwoFactorErrorKey>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});
    setTwoFactorError(null);
    setPending(true);

    if (mode === "login" && !twoFactorStep) {
      const loginErrors: RegisterFieldErrors = {};
      if (!email.trim()) loginErrors.email = "required";
      if (!password) loginErrors.password = "required";
      if (Object.keys(loginErrors).length > 0) {
        setFieldErrors(loginErrors);
        setPending(false);
        return;
      }
    }

    if (mode === "register") {
      const result = await registerWithPassword({ name, username, email, password, passwordConfirmation });
      if (!result.ok) {
        setFieldErrors(result.fieldErrors);
        if (result.formError) setFormError(result.formError === "tooManyAttempts" ? "too-many-attempts" : "unknown");
        setPending(false);
        return;
      }
    }

    const result = await signIn("credentials", {
      email,
      password,
      ...(useRecoveryCode ? { recoveryCode } : twoFactorStep ? { code } : {}),
      redirect: false,
    });
    setPending(false);

    if (result?.code === "two-factor-required") {
      setTwoFactorStep(true);
      return;
    }
    if (result?.code === "invalid-two-factor-code") {
      setTwoFactorError("invalid-two-factor-code");
      return;
    }
    if (result?.code === "too-many-attempts") {
      if (twoFactorStep) setTwoFactorError("too-many-attempts");
      else setFormError("too-many-attempts");
      return;
    }
    if (result?.error) {
      setFormError("invalid-credentials");
      return;
    }

    if (mode === "register") {
      setJustRegistered(true);
      setTimeout(() => router.push(callbackUrl ?? "/"), 2500);
      return;
    }
    router.push(callbackUrl ?? "/");
  }

  async function handlePasskeySignIn() {
    setFormError(null);
    setPasskeyPending(true);
    try {
      // No email required: the WebAuthn provider falls back to a usernameless
      // (discoverable credential) authentication when none is given, letting
      // the browser prompt for any passkey already registered on this device.
      const result = await signInWithPasskey("webauthn", { ...(email ? { email } : {}), redirect: false });
      if (!result || result.error) {
        setFormError("unknown");
        setPasskeyPending(false);
        return;
      }
      router.push(callbackUrl ?? "/");
    } catch {
      setFormError("unknown");
      setPasskeyPending(false);
    }
  }

  if (justRegistered) {
    return (
      <div className="w-full max-w-[420px] rounded-[14px] border border-neutral-800 bg-[var(--gcs-surface)] px-8 py-8 text-center">
        <p className="text-[14.5px] text-[#7cc48a]">{t("verificationEmailSent")}</p>
      </div>
    );
  }

  if (twoFactorStep) {
    return (
      <div className="w-full max-w-[420px] rounded-[14px] border border-neutral-800 bg-[var(--gcs-surface)] px-8 py-8">
        <h2 className="mb-1 text-[17px] font-semibold text-neutral-50">{t("twoFactor.title")}</h2>
        <p className="mb-5 text-[13.5px] leading-[1.6] text-neutral-400">
          {useRecoveryCode ? t("twoFactor.recoveryDescription") : t("twoFactor.description")}
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5" noValidate>
          {useRecoveryCode ? (
            <label className="flex flex-col gap-1.5 text-[13px] text-neutral-400">
              {t("twoFactor.recoveryCodeLabel")}
              <input
                type="text"
                autoComplete="off"
                autoFocus
                value={recoveryCode}
                onChange={(e) => setRecoveryCode(e.target.value)}
                className={inputClass}
                aria-invalid={Boolean(twoFactorError)}
              />
            </label>
          ) : (
            <label className="flex flex-col gap-1.5 text-[13px] text-neutral-400">
              {t("twoFactor.codeLabel")}
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className={inputClass}
                aria-invalid={Boolean(twoFactorError)}
              />
            </label>
          )}

          {twoFactorError && (
            <p role="alert" className="text-[13px] text-[#e08585]">
              {t(`twoFactor.error.${twoFactorError}`)}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="mt-1.5 rounded-[9px] bg-[#e4ae22] py-3 text-[15px] font-semibold text-[#0e0e0e] transition-colors hover:bg-[#c9981d] active:bg-[#b3860f] disabled:opacity-60"
          >
            {pending ? "…" : t("twoFactor.submit")}
          </button>

          <button
            type="button"
            onClick={() => {
              setUseRecoveryCode((v) => !v);
              setTwoFactorError(null);
            }}
            className="text-[13px] font-medium text-neutral-400 transition-colors hover:text-neutral-100"
          >
            {useRecoveryCode ? t("twoFactor.useCodeInstead") : t("twoFactor.useRecoveryCodeInstead")}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[420px] rounded-[14px] border border-neutral-800 bg-[var(--gcs-surface)] px-8 py-8">
      <ProviderButtons callbackUrl={callbackUrl} />

      <div className="my-5 flex items-center gap-3 text-[12.5px] text-neutral-500">
        <span className="h-px flex-1 bg-neutral-800" />
        {t("orEmail")}
        <span className="h-px flex-1 bg-neutral-800" />
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5" noValidate>
        {mode === "register" && (
          <label className="flex flex-col gap-1.5 text-[13px] text-neutral-400">
            <span>
              {t("nameLabel")}
              <RequiredMark />
            </span>
            <input
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              aria-invalid={Boolean(fieldErrors.name)}
            />
            {fieldErrors.name && <span className={fieldErrorClass}>{t(`error.name.${fieldErrors.name}`)}</span>}
          </label>
        )}

        {mode === "register" && (
          <label className="flex flex-col gap-1.5 text-[13px] text-neutral-400">
            <span>
              {t("usernameLabel")}
              <RequiredMark />
            </span>
            <input
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={inputClass}
              aria-invalid={Boolean(fieldErrors.username)}
            />
            {fieldErrors.username ? (
              <span className={fieldErrorClass}>{t(`error.username.${fieldErrors.username}`)}</span>
            ) : (
              <span className="text-[12px] text-neutral-500">{t("usernameHint")}</span>
            )}
          </label>
        )}

        <label className="flex flex-col gap-1.5 text-[13px] text-neutral-400">
          <span>
            {t("emailLabel")}
            <RequiredMark />
          </span>
          <input
            type="email"
            autoComplete={mode === "login" ? "username webauthn" : "email"}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            aria-invalid={Boolean(fieldErrors.email)}
          />
          {fieldErrors.email && <span className={fieldErrorClass}>{t(`error.email.${fieldErrors.email}`)}</span>}
        </label>

        <label className="flex flex-col gap-1.5 text-[13px] text-neutral-400">
          <span>
            {t("passwordLabel")}
            <RequiredMark />
          </span>
          <input
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
            aria-invalid={Boolean(fieldErrors.password)}
          />
          {fieldErrors.password ? (
            <span className={fieldErrorClass}>{t(`error.password.${fieldErrors.password}`)}</span>
          ) : (
            mode === "register" && <span className="text-[12px] text-neutral-500">{t("passwordHint")}</span>
          )}
          {mode === "login" && (
            <Link href="/forgot-password" className="self-end text-[12.5px] font-medium text-neutral-400 hover:text-[#e4ae22]">
              {t("forgotPasswordLink")}
            </Link>
          )}
        </label>

        {mode === "register" && (
          <label className="flex flex-col gap-1.5 text-[13px] text-neutral-400">
            <span>
              {t("passwordConfirmationLabel")}
              <RequiredMark />
            </span>
            <input
              type="password"
              autoComplete="new-password"
              value={passwordConfirmation}
              onChange={(e) => setPasswordConfirmation(e.target.value)}
              className={inputClass}
              aria-invalid={Boolean(fieldErrors.passwordConfirmation)}
            />
            {fieldErrors.passwordConfirmation && (
              <span className={fieldErrorClass}>{t(`error.passwordConfirmation.${fieldErrors.passwordConfirmation}`)}</span>
            )}
          </label>
        )}

        {formError && (
          <p role="alert" className="text-[13px] text-[#e08585]">
            {t(`error.${formError}`)}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="mt-1.5 rounded-[9px] bg-[#e4ae22] py-3 text-[15px] font-semibold text-[#0e0e0e] transition-colors hover:bg-[#c9981d] active:bg-[#b3860f] disabled:opacity-60"
        >
          {pending ? "…" : mode === "login" ? t("submitLogin") : t("submitRegister")}
        </button>

        {mode === "login" && (
          <button
            type="button"
            onClick={handlePasskeySignIn}
            disabled={passkeyPending}
            className="flex items-center justify-center gap-2 rounded-[9px] border border-neutral-700 py-3 text-[14px] font-medium text-neutral-200 transition-colors hover:border-neutral-600 hover:bg-[var(--gcs-hover)] disabled:opacity-60"
          >
            <PasskeyIcon className="h-[17px] w-[17px]" />
            {passkeyPending ? "…" : t("passkey")}
          </button>
        )}
      </form>

      <p className="mt-6 text-center text-[13.5px] text-neutral-500">
        {mode === "login" ? t("noAccount") : t("haveAccount")}{" "}
        <Link href={mode === "login" ? "/register" : "/login"} className="font-medium text-neutral-100 hover:text-[#e4ae22]">
          {mode === "login" ? t("register.title") : t("login.title")}
        </Link>
      </p>
    </div>
  );
}
