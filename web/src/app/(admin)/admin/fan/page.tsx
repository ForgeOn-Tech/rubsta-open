import { hideMessageAction, muteFanAction, showMessageAction, unmuteFanAction } from "./actions";
import { MessageRow } from "./message-row";
import { requireAdmin } from "@/auth/require";
import { AdminNotice } from "@/components/admin-notice";
import { AdminPageHeader } from "@/components/admin-page-header";
import { getDb } from "@/db/client";
import { listMessagesToModerate } from "@/db/fan";
import { getCurrentTournament } from "@/db/queries";
import { countLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

/** How many messages the moderation table holds. */
const MESSAGE_LIMIT = 100;
const COLUMNS = ["Time", "Court", "Fan", "Message", ""] as const;

/** The court chat as admins see it: every message, hidden ones included. */
export default async function AdminFanPage() {
  await requireAdmin();
  const tournament = getCurrentTournament();
  if (!tournament) return <AdminNotice message="No tournament has been set up." />;

  const messages = listMessagesToModerate(getDb(), tournament.id, MESSAGE_LIMIT);
  const hidden = messages.filter((message) => message.hiddenAt !== null).length;
  const muted = new Set(
    messages.filter((message) => message.muted).map((message) => message.userId),
  ).size;

  return (
    <>
      <AdminPageHeader
        eyebrow={`${tournament.name} · Fan zone`}
        title="Court chat"
        stats={[
          countLabel(messages.length, "message", "messages"),
          `${hidden} hidden`,
          countLabel(muted, "fan muted", "fans muted"),
        ]}
      />

      <div className="flex flex-col gap-4 p-6">
        <p className="text-[12px] text-muted">
          Hiding a message takes it off the Fan Zone and keeps it here. Muting a fan stops them
          posting again; their earlier messages stay until you hide them.
        </p>

        {messages.length === 0 ? (
          <p className="card p-4 text-[13px] text-muted" role="status">
            Nothing has been said yet.
          </p>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left text-[13px]">
              <thead>
                <tr className="border-b border-line">
                  {COLUMNS.map((column, index) => (
                    <th key={column === "" ? index : column} scope="col" className="thead px-4 py-3 font-normal">
                      {column === "" ? <span className="sr-only">Actions</span> : column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {messages.map((message) => (
                  <MessageRow
                    key={message.id}
                    message={message}
                    hideAction={hideMessageAction}
                    showAction={showMessageAction}
                    muteAction={muteFanAction}
                    unmuteAction={unmuteFanAction}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
