import { registrationEmailHtml } from "./email-layout";

interface PlayerEmailDetails {
  playerName: string;
  tournamentName: string;
  events: string;
  partnerPending: boolean;
}
const HOME = "https://www.rubstaopen.com/home";
const avatarReminder = "Don’t forget to create your tennis avatar and share it with your friends!\nCreate your avatar: https://www.rubstaopen.com/avatar";
const signOff = ["Questions? Reply to this email or contact Manvir Singh at +91 97690 09034 — we’re happy to help.", "", "See you on court,", "Team Rubsta Open"];
const partnerNote = "For your doubles entry, your partner still needs to accept the invitation. You can find the invitation link in your player account.";

/** One-time welcome for existing paid players; never implies a new charge. */
export function existingPlayerWelcome(details: PlayerEmailDetails) {
  const email = {
    subject: `We’re looking forward to seeing you at ${details.tournamentName}!`,
    body: [
      `Hi ${details.playerName},`, "",
      `Thank you for being part of ${details.tournamentName}. Your payment is recorded, and we’re looking forward to welcoming you on court.`,
      "",
      `Your registered event(s): ${details.events}`, "",
      "As the tournament approaches, check your player account for your entry details, draws and match timings as they’re published.",
      ...(details.partnerPending ? ["", partnerNote] : []),
      "", `Open your player account: ${HOME}`, "",
      "This is a welcome update for your existing entry. No further payment is needed for the event(s) listed above.",
      "", avatarReminder, "", ...signOff,
    ].join("\n"),
  };
  return { ...email, html: registrationEmailHtml(email) };
}

/** Automatic email only after a verified captured payment. */
export function registrationConfirmation(details: PlayerEmailDetails & {
  amount: string; paymentReference: string; orderReference: string; paidOn: string;
  entryConfirmed: boolean;
}) {
  const { entryConfirmed, partnerPending } = details;
  const email = {
    subject: !entryConfirmed
      ? `${details.tournamentName}: payment received — entry needs review`
      : partnerPending
        ? `Payment confirmed — one more step for ${details.tournamentName}`
        : `Registration confirmed — see you at ${details.tournamentName}!`,
    body: [
      `Hi ${details.playerName},`, "",
      entryConfirmed
        ? `Thank you for registering for ${details.tournamentName}! We’ve received your payment of ${details.amount} for the event(s) below.`
        : `We’ve received your payment of ${details.amount} for ${details.tournamentName}, but your entry could not be confirmed automatically.`,
      "",
      ...(!entryConfirmed
        ? ["Please reply to this email so we can review your entry. Do not pay again.", ""]
        : []),
      `Event(s): ${details.events}`,
      `Amount paid in this transaction: ${details.amount}`,
      `Payment reference: ${details.paymentReference}`,
      `Order reference: ${details.orderReference}`,
      `Paid on: ${details.paidOn}`,
      ...(entryConfirmed ? [
        "",
        partnerPending ? partnerNote : "Your registration for the event(s) above is confirmed. We’re looking forward to seeing you on court.",
        "", "Your player account is the place to check your entry details, draws and match timings as they’re published.",
      ] : []),
      "", `Open your player account: ${HOME}`,
      ...(entryConfirmed ? ["", avatarReminder] : []), "", ...signOff,
    ].join("\n"),
  };
  return { ...email, html: registrationEmailHtml(email) };
}
