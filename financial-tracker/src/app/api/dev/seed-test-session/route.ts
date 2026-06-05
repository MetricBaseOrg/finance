import { db } from "@/server/db";
import { NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";

export async function GET() {
  // Development only - seed test data
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  try {
    // Create or get test user
    let user = await db.user.findUnique({
      where: { email: "test@metricbase.dev" },
    });

    if (!user) {
      user = await db.user.create({
        data: {
          email: "test@metricbase.dev",
          name: "Test User",
          emailVerified: new Date(),
        },
      });
    }

    // Create or get test workspace
    let workspace = await db.workspace.findFirst({
      where: { name: "Test Workspace" },
    });

    if (!workspace) {
      workspace = await db.workspace.create({
        data: {
          name: "Test Workspace",
          slug: "test-workspace",
          type: "INDIVIDUAL",
          baseCurrency: "USD",
          memberships: {
            create: {
              userId: user.id,
              role: "ADMIN",
            },
          },
        },
      });
    } else {
      // Ensure user has membership
      const existing = await db.membership.findUnique({
        where: { userId_workspaceId: { userId: user.id, workspaceId: workspace.id } },
      });
      if (!existing) {
        await db.membership.create({
          data: {
            userId: user.id,
            workspaceId: workspace.id,
            role: "ADMIN",
          },
        });
      }
    }

    // Create session
    const sessionToken = randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    // Delete any existing sessions for this user first
    await db.session.deleteMany({
      where: { userId: user.id },
    });

    await db.session.create({
      data: {
        sessionToken,
        userId: user.id,
        expires,
      },
    });

    // Set session cookie
    const response = NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name },
      workspace: { id: workspace.id, name: workspace.name, slug: workspace.slug },
      session: { sessionToken },
    });

    response.cookies.set("authjs.session-token", sessionToken, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("[dev/seed-test-session]", error);
    return NextResponse.json({ error: "Failed to seed test session" }, { status: 500 });
  }
}
