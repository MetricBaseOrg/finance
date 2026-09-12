/**
 * Data access, with a file-backed fallback.
 *
 * The fallback is not laziness. `bingkai` is meant to be handed to someone and run,
 * and requiring a provisioned Postgres before the first campaign can be created makes
 * the app undemonstrable. With no DATABASE_URL set it writes to `.devdata/db.json`
 * and every feature works; set the URL and the same calls go to Neon. The store
 * interface is deliberately tiny so there is only one place that has to be true in
 * both modes.
 */
import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

export type FieldSpec = {
  id: string;
  label: string;
  x: number;
  y: number;
  size: number;
  color: string;
  weight: number;
  align: "left" | "center" | "right";
  font: string;
  maxWidth: number;
  uppercase?: boolean;
};

export type Campaign = {
  id: string;
  slug: string;
  title: string;
  organiser: string | null;
  blurb: string | null;
  frameData: string;
  frameW: number;
  frameH: number;
  background: string;
  fields: FieldSpec[];
  manageKey: string;
  closedAt: string | null;
  createdAt: string;
};

export type EventKind = "VIEW" | "PHOTO_PICKED" | "DOWNLOAD" | "SHARE";

export type Tally = {
  kind: EventKind;
  refHost: string | null;
  preset: string | null;
  hour: string;
  count: number;
};

export const USING_DB = Boolean(process.env.DATABASE_URL);

// The file-backed fallback is a DEVELOPMENT convenience and must never engage in
// production. Caught during deployment: with DATABASE_URL absent the app happily
// wrote campaigns to .devdata/db.json and returned 200, so on a serverless host
// every campaign would have been created successfully and then vanished with the
// container, with nothing in the logs. A silent fallback that loses data is worse
// than no fallback, so production refuses to start without a database.
if (!USING_DB && process.env.NODE_ENV === "production") {
  throw new Error(
    "DATABASE_URL is not set. Refusing to start in production: the file-backed " +
      "store is for local development only and would silently discard campaigns.",
  );
}
if (!USING_DB) {
  console.warn(
    "[bingkai] No DATABASE_URL — using .devdata/db.json. Development only.",
  );
}

export function newId() {
  return crypto.randomBytes(12).toString("base64url");
}
export function newManageKey() {
  return crypto.randomBytes(24).toString("base64url");
}
/** Truncate to the hour so no two supporters are distinguishable by timestamp. */
export function hourOf(d = new Date()) {
  const c = new Date(d);
  c.setUTCMinutes(0, 0, 0);
  return c.toISOString();
}

// ---------------------------------------------------------------- file fallback
const DIR = path.join(process.cwd(), ".devdata");
const FILE = path.join(DIR, "db.json");
type Disk = { campaigns: Campaign[]; events: Tally[] };

async function readDisk(): Promise<Disk> {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8")) as Disk;
  } catch {
    return { campaigns: [], events: [] };
  }
}
async function writeDisk(d: Disk) {
  await fs.mkdir(DIR, { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(d, null, 2), "utf8");
}

// ---------------------------------------------------------------- prisma
// Prisma 7 takes a driver adapter rather than a URL from the schema, and the client
// is generated into src/generated/prisma. Loaded lazily so that with no DATABASE_URL
// set the app never touches pg at all and the file-backed mode stays usable.
type PrismaLike = {
  campaign: {
    create: (a: unknown) => Promise<unknown>;
    findUnique: (a: unknown) => Promise<unknown>;
    update: (a: unknown) => Promise<unknown>;
  };
  event: {
    upsert: (a: unknown) => Promise<unknown>;
    findMany: (a: unknown) => Promise<unknown>;
  };
};

/** pg v9 changes what sslmode=require means; pin today's behaviour explicitly. */
function pinSslMode(url: string) {
  return url.replace(/([?&]sslmode=)(require|prefer|verify-ca)\b/i, "$1verify-full");
}

const g = globalThis as unknown as { __bingkaiPrisma?: PrismaLike };

async function db(): Promise<PrismaLike> {
  if (g.__bingkaiPrisma) return g.__bingkaiPrisma;
  const [{ PrismaClient }, { PrismaPg }] = await Promise.all([
    import("@/generated/prisma/client") as Promise<{
      PrismaClient: new (o: unknown) => PrismaLike;
    }>,
    import("@prisma/adapter-pg"),
  ]);
  const connectionString = pinSslMode(
    process.env.DIRECT_URL || process.env.DATABASE_URL || "",
  );
  const adapter = new PrismaPg({ connectionString });
  g.__bingkaiPrisma = new PrismaClient({ adapter });
  return g.__bingkaiPrisma;
}

// ---------------------------------------------------------------- operations
export async function createCampaign(
  c: Omit<Campaign, "id" | "manageKey" | "createdAt" | "closedAt">,
): Promise<Campaign> {
  const row: Campaign = {
    ...c,
    id: newId(),
    manageKey: newManageKey(),
    closedAt: null,
    createdAt: new Date().toISOString(),
  };
  if (!USING_DB) {
    const d = await readDisk();
    if (d.campaigns.some((x) => x.slug === row.slug)) {
      throw new Error("slug taken");
    }
    d.campaigns.push(row);
    await writeDisk(d);
    return row;
  }
  const p = await db();
  await p.campaign.create({
    data: {
      id: row.id,
      slug: row.slug,
      title: row.title,
      organiser: row.organiser,
      blurb: row.blurb,
      frameData: row.frameData,
      frameW: row.frameW,
      frameH: row.frameH,
      background: row.background,
      fields: row.fields,
      manageKey: row.manageKey,
    },
  });
  return row;
}

export async function getCampaign(slug: string): Promise<Campaign | null> {
  if (!USING_DB) {
    const d = await readDisk();
    return d.campaigns.find((c) => c.slug === slug) ?? null;
  }
  const p = await db();
  const r = (await p.campaign.findUnique({ where: { slug } })) as
    | (Omit<Campaign, "fields" | "closedAt" | "createdAt"> & {
        fields: unknown;
        closedAt: Date | null;
        createdAt: Date;
      })
    | null;
  if (!r) return null;
  return {
    ...r,
    fields: (r.fields as FieldSpec[]) ?? [],
    closedAt: r.closedAt ? r.closedAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
  };
}

export async function getByManageKey(key: string): Promise<Campaign | null> {
  if (!USING_DB) {
    const d = await readDisk();
    return d.campaigns.find((c) => c.manageKey === key) ?? null;
  }
  const p = await db();
  const r = (await p.campaign.findUnique({ where: { manageKey: key } })) as
    | (Omit<Campaign, "fields" | "closedAt" | "createdAt"> & {
        fields: unknown;
        closedAt: Date | null;
        createdAt: Date;
      })
    | null;
  if (!r) return null;
  return {
    ...r,
    fields: (r.fields as FieldSpec[]) ?? [],
    closedAt: r.closedAt ? r.closedAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
  };
}

export async function recordEvent(
  campaignId: string,
  kind: EventKind,
  refHost: string | null,
  preset: string | null,
) {
  const hour = hourOf();
  if (!USING_DB) {
    const d = await readDisk();
    const hit = d.events.find(
      (e) =>
        e.kind === kind &&
        e.refHost === refHost &&
        e.preset === preset &&
        e.hour === hour,
    );
    if (hit) hit.count += 1;
    else d.events.push({ kind, refHost, preset, hour, count: 1 });
    await writeDisk(d);
    return;
  }
  const p = await db();
  await p.event.upsert({
    where: {
      campaignId_kind_refHost_preset_hour: {
        campaignId,
        kind,
        refHost,
        preset,
        hour: new Date(hour),
      },
    },
    create: { campaignId, kind, refHost, preset, hour: new Date(hour), count: 1 },
    update: { count: { increment: 1 } },
  });
}

export async function tallies(campaignId: string): Promise<Tally[]> {
  if (!USING_DB) {
    const d = await readDisk();
    return d.events;
  }
  const p = await db();
  const rows = (await p.event.findMany({
    where: { campaignId },
    orderBy: { hour: "asc" },
  })) as Array<Omit<Tally, "hour"> & { hour: Date }>;
  return rows.map((r) => ({ ...r, hour: r.hour.toISOString() }));
}

/** A bare host, so organisers can tell WhatsApp from Instagram without tracking. */
export function refHostOf(referer: string | null): string | null {
  if (!referer) return null;
  try {
    return new URL(referer).host.replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}
