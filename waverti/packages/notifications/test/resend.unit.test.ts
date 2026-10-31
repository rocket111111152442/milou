import { describe, expect, it } from "vitest";
import { createResendSender, EmailSendError } from "../src/resend";

describe("client Resend", () => {
  it("conserve le motif du refus (domaine non vérifié), masque les adresses, ne réessaie pas une erreur 403", async () => {
    const fakeFetch = (async () =>
      new Response(JSON.stringify({ name: "validation_error", message: "The waverti.com domain is not verified for client@example.com" }), { status: 403 })) as typeof fetch;
    const sender = createResendSender("re_test", "https://resend.invalid", fakeFetch);
    const err = await sender.send({ from: "Waverti <noreply@waverti.com>", to: "x@y.fr", subject: "s", html: "h", text: "t" }).catch((e) => e);
    expect(err).toBeInstanceOf(EmailSendError);
    expect(err.message).toBe("Resend HTTP 403 — validation_error: The waverti.com domain is not verified for [adresse]");
    expect(err.retryable).toBe(false);
  });
  it("réponse illisible : code HTTP seul ; 429 et 5xx réessayables", async () => {
    const sender = createResendSender("re_test", "https://resend.invalid", (async () => new Response("<html>", { status: 502 })) as typeof fetch);
    const err = await sender.send({ from: "a@b.c", to: "x@y.fr", subject: "s", html: "h", text: "t" }).catch((e) => e);
    expect(err.message).toBe("Resend HTTP 502");
    expect(err.retryable).toBe(true);
  });
});
