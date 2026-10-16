/**
 * Builds a game-day rehearsal database: four paid entrants in every event,
 * tournament days, a venue and two courts. Draws, the order of play and the
 * scoring are left to the organiser, who runs them in the app by hand.
 *
 * Run from web/. It writes only to data/gameday.db and refuses to touch a
 * database it has seeded before; delete that file to start again.
 *
 *     npx tsx scripts/seed-game-day.mts
 *     DATABASE_PATH=./data/gameday.db npm run dev
 */
const GAME_DAY_DB = "./data/gameday.db";
process.env.DATABASE_PATH = GAME_DAY_DB;

const { eq } = await import("drizzle-orm");
const { getDb } = await import("@/db/client");
const schema = await import("@/db/schema");

type Category = (typeof schema.CATEGORIES)[number];
type Gender = (typeof schema.GENDERS)[number];

interface Player {
  name: string;
  gender: Gender;
  dateOfBirth: string;
  club: string;
}

interface Team {
  player: Player;
  partner: Player;
}

const EMAIL_DOMAIN = "gameday.test";
const FIRST_MOBILE = 9000000001;
const PAYMENT_REF = "manual";
const COURT_COUNT = 2;
const TOURNAMENT_SETTINGS = {
  startsOn: "2026-10-24",
  endsOn: "2026-10-25",
  venue: "Nerul Gymkhana, Navi Mumbai",
  scheduleConfirmed: true,
  status: "closed" as const,
};

const SINGLES: Record<Exclude<Category, "OD" | "D40">, Player[]> = {
  OS: [
    { name: "Arjun Mehta", gender: "male", dateOfBirth: "1999-03-14", club: "Nerul Gymkhana" },
    { name: "Rohan Kulkarni", gender: "male", dateOfBirth: "2001-07-02", club: "PYC Hindu Gymkhana" },
    { name: "Kabir Shetty", gender: "male", dateOfBirth: "1997-11-21", club: "MSLTA" },
    { name: "Ishaan Rao", gender: "male", dateOfBirth: "2003-01-09", club: "Bombay Gymkhana" },
  ],
  W30: [
    { name: "Meera Iyer", gender: "female", dateOfBirth: "1990-05-18", club: "Nerul Gymkhana" },
    { name: "Ananya Desai", gender: "female", dateOfBirth: "1988-09-30", club: "Khar Gymkhana" },
    { name: "Priya Nair", gender: "female", dateOfBirth: "1993-02-11", club: "Otters Club" },
    { name: "Sneha Patil", gender: "female", dateOfBirth: "1986-12-04", club: "MSLTA" },
  ],
  U15: [
    { name: "Vihaan Joshi", gender: "male", dateOfBirth: "2012-04-22", club: "Nerul Gymkhana" },
    { name: "Aarav Pillai", gender: "male", dateOfBirth: "2013-08-15", club: "PYC Hindu Gymkhana" },
    { name: "Diya Sawant", gender: "female", dateOfBirth: "2012-10-03", club: "Khar Gymkhana" },
    { name: "Reyansh Gupta", gender: "male", dateOfBirth: "2014-01-27", club: "MSLTA" },
  ],
  S40: [
    { name: "Sanjay Bhat", gender: "male", dateOfBirth: "1979-06-12", club: "Bombay Gymkhana" },
    { name: "Rajesh Menon", gender: "male", dateOfBirth: "1982-03-08", club: "Nerul Gymkhana" },
    { name: "Vikram Chawla", gender: "male", dateOfBirth: "1975-11-19", club: "Otters Club" },
    { name: "Nitin Deshpande", gender: "male", dateOfBirth: "1984-02-25", club: "Khar Gymkhana" },
  ],
};

const DOUBLES: Record<"OD" | "D40", Team[]> = {
  OD: [
    {
      player: { name: "Aditya Kapoor", gender: "male", dateOfBirth: "1998-04-01", club: "Nerul Gymkhana" },
      partner: { name: "Siddharth Rane", gender: "male", dateOfBirth: "2000-06-17", club: "Nerul Gymkhana" },
    },
    {
      player: { name: "Karan Malhotra", gender: "male", dateOfBirth: "1996-09-09", club: "Bombay Gymkhana" },
      partner: { name: "Tanvi Shah", gender: "female", dateOfBirth: "1999-12-23", club: "Bombay Gymkhana" },
    },
    {
      player: { name: "Neel Banerjee", gender: "male", dateOfBirth: "2002-02-14", club: "Otters Club" },
      partner: { name: "Omkar Jadhav", gender: "male", dateOfBirth: "2001-05-30", club: "Otters Club" },
    },
    {
      player: { name: "Riya Kamat", gender: "female", dateOfBirth: "1997-07-07", club: "Khar Gymkhana" },
      partner: { name: "Dev Sinha", gender: "male", dateOfBirth: "1995-10-12", club: "Khar Gymkhana" },
    },
  ],
  D40: [
    {
      player: { name: "Prakash Hegde", gender: "male", dateOfBirth: "1978-01-15", club: "Nerul Gymkhana" },
      partner: { name: "Suresh Naik", gender: "male", dateOfBirth: "1980-08-08", club: "Nerul Gymkhana" },
    },
    {
      player: { name: "Anil Kothari", gender: "male", dateOfBirth: "1976-04-26", club: "PYC Hindu Gymkhana" },
      partner: { name: "Manoj Tiwari", gender: "male", dateOfBirth: "1981-11-02", club: "PYC Hindu Gymkhana" },
    },
    {
      player: { name: "Deepak Saxena", gender: "male", dateOfBirth: "1983-03-19", club: "MSLTA" },
      partner: { name: "Kavita Saxena", gender: "female", dateOfBirth: "1984-06-06", club: "MSLTA" },
    },
    {
      player: { name: "Ramesh Iyengar", gender: "male", dateOfBirth: "1974-12-12", club: "Otters Club" },
      partner: { name: "Girish Pawar", gender: "male", dateOfBirth: "1979-09-21", club: "Otters Club" },
    },
  ],
};

function emailOf(player: Player): string {
  return `${player.name.toLowerCase().replace(/[^a-z]+/g, ".")}@${EMAIL_DOMAIN}`;
}

const db = getDb();

const [tournament] = db.select().from(schema.tournaments).all();
if (!tournament) {
  throw new Error(`No tournament in ${GAME_DAY_DB} after migrating; the startup seed did not run.`);
}
const alreadySeeded = db
  .select({ id: schema.users.id })
  .from(schema.users)
  .all()
  .length > 0;
if (alreadySeeded) {
  throw new Error(`${GAME_DAY_DB} already has accounts. Delete it to seed a fresh game day.`);
}
let playerNumber = 0;

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

function createPlayer(tx: Tx, player: Player): { id: string; email: string } {
  const email = emailOf(player);
  playerNumber += 1;
  const user = tx.insert(schema.users).values({ name: player.name, email }).returning().get();
  tx.insert(schema.profiles)
    .values({
      userId: user.id,
      fullName: player.name,
      dateOfBirth: player.dateOfBirth,
      gender: player.gender,
      mobile: String(FIRST_MOBILE + playerNumber),
      club: player.club,
      playerNumber,
    })
    .run();
  return { id: user.id, email };
}

db.transaction((tx) => {
  tx.update(schema.tournaments).set(TOURNAMENT_SETTINGS).where(eq(schema.tournaments.id, tournament.id)).run();
  for (let number = 1; number <= COURT_COUNT; number++) {
    tx.insert(schema.courts).values({ tournamentId: tournament.id, number }).run();
  }
  for (const [category, players] of Object.entries(SINGLES) as [Category, Player[]][]) {
    for (const player of players) {
      const { id } = createPlayer(tx, player);
      tx.insert(schema.entries)
        .values({ userId: id, tournamentId: tournament.id, category, status: "paid", paymentRef: PAYMENT_REF })
        .run();
    }
  }
  for (const [category, teams] of Object.entries(DOUBLES) as [Category, Team[]][]) {
    for (const team of teams) {
      const player = createPlayer(tx, team.player);
      const partner = createPlayer(tx, team.partner);
      tx.insert(schema.entries)
        .values({
          userId: player.id,
          tournamentId: tournament.id,
          category,
          partnerName: team.partner.name,
          partnerEmail: partner.email,
          partnerStatus: "accepted",
          partnerUserId: partner.id,
          partnerRespondedAt: Date.now(),
          status: "paid",
          paymentRef: PAYMENT_REF,
        })
        .run();
    }
  }
});

const entryCount = db.select().from(schema.entries).all().length;
const playerCount = db.select().from(schema.users).all().length;
console.log(
  `Seeded ${GAME_DAY_DB}: ${playerCount} players, ${entryCount} paid entries (4 per event), ${COURT_COUNT} courts, ` +
    `${TOURNAMENT_SETTINGS.startsOn} to ${TOURNAMENT_SETTINGS.endsOn}.`,
);
