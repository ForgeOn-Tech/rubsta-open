import { expect, it } from "vitest";
import { existingPlayerWelcome, registrationConfirmation } from "../registration-email";
const player = { playerName: "Asha", tournamentName: "Rubsta Open 2026", events: "Open singles", partnerPending: false };
const payment = { ...player, amount: "₹3,000", paymentReference: "pay_1", orderReference: "order_1", paidOn: "11 Oct 2026 IST", entryConfirmed: true };

it("welcomes existing paid players without implying a new charge", () => {
  const email = existingPlayerWelcome(player);
  expect(email.subject).toContain("looking forward");
  expect(email.body).toContain("Your payment is recorded");
  expect(email.body).toContain("No further payment is needed for the event(s) listed above");
  expect(email.body).not.toContain("We’ve received");
});
it("confirms future captured payments with amount, event and reference", () => {
  const email = registrationConfirmation(payment);
  expect(email.subject).toContain("Registration confirmed");
  for (const text of ["₹3,000", "Open singles", "pay_1", "order_1", "https://www.rubstaopen.com/home"]) expect(email.body).toContain(text);
});
it("does not call a pending doubles entry fully confirmed", () => {
  const email = registrationConfirmation({ ...payment, events: "Open doubles", partnerPending: true });
  expect(email.subject).toContain("one more step");
  expect(email.body).toContain("partner still needs to accept");
  expect(email.body).not.toContain("Your registration for the event(s) above is confirmed");
});
it("keeps changed or cancelled entries on the review path", () => {
  const email = registrationConfirmation({ ...payment, entryConfirmed: false });
  expect(email.subject).toContain("needs review");
  expect(email.body).toContain("Do not pay again");
  expect(email.body).not.toContain("Your registration for the event(s) above is confirmed");
});

it("escapes player content and includes accessible links in both HTML emails", () => {
  for (const email of [
    existingPlayerWelcome({ ...player, playerName: '<img src=x onerror="alert(1)">' }),
    registrationConfirmation({ ...payment, events: "<script>bad</script>" }),
  ]) {
    expect(email.html).not.toContain("<script>");
    expect(email.html).not.toContain("<img src=x");
    expect(email.html).toContain('href="tel:+919769009034"');
    expect(email.html).toContain('href="https://www.rubstaopen.com/avatar"');
    expect(email.html).toContain('role="presentation"');
    expect(email.body).toContain("Manvir Singh");
  }
});
