import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { member, organization, user as authUser } from "@/db/schema";

type DelegatedOrganizationInput = {
  id: string;
  name: string;
  slug: string;
};

async function upsertDelegatedOrganization(input: DelegatedOrganizationInput) {
  await db
    .insert(organization)
    .values({
      id: input.id,
      name: input.name,
      slug: input.slug,
      logo: null,
      createdAt: new Date(),
      metadata: null,
    })
    // Parallel first-load requests can collide on both the id and slug unique
    // indexes. Let either identical insert win, then update by id below.
    .onConflictDoNothing();

  const [ensured] = await db
    .update(organization)
    .set({ name: input.name, slug: input.slug })
    .where(eq(organization.id, input.id))
    .returning({ id: organization.id });

  if (!ensured) {
    throw new Error(
      `Organization slug "${input.slug}" belongs to a different organization.`,
    );
  }
}

async function findFirstOrganizationIdForUser(userId: string) {
  const [existingMembership] = await db
    .select({ organizationId: member.organizationId })
    .from(member)
    .where(eq(member.userId, userId))
    .orderBy(asc(member.createdAt))
    .limit(1);

  return existingMembership?.organizationId ?? null;
}

async function getHostedUser(userId: string) {
  return db.query.user.findFirst({
    columns: {
      id: true,
      email: true,
      name: true,
    },
    where: eq(authUser.id, userId),
  });
}

export const AuthRepository = {
  upsertDelegatedOrganization,
  findFirstOrganizationIdForUser,
  getHostedUser,
} as const;
