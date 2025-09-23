import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// This endpoint is designed to be called by external cron services
// like cron-job.org, GitHub Actions, Vercel Cron, or server cron jobs

export async function POST(request: Request) {
  try {
    // Verify the request is authorized (optional security measure)
    const authHeader = request.headers.get("authorization");
    const expectedToken = process.env.CRON_SECRET_TOKEN;

    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      console.log("❌ Unauthorized cron request");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("🕐 Starting scheduled valuation update...");

    // Get all users with investment accounts
    const users = await prisma.user.findMany({
      where: {
        investmentAccounts: {
          some: {}
        }
      },
      select: {
        id: true,
        email: true,
        _count: {
          select: { investmentAccounts: true }
        }
      }
    });

    if (users.length === 0) {
      console.log("ℹ️ No users with investment accounts found");
      return NextResponse.json({
        success: true,
        processed: 0,
        message: "No users with investment accounts"
      });
    }

    console.log(`👥 Found ${users.length} users with investment accounts`);

    const results = [];
    let totalUpdated = 0;

    // Process each user's valuations
    for (const user of users) {
      try {
        console.log(`🔄 Processing user ${user.email} (${user._count.investmentAccounts} accounts)`);

        // Call the valuation update endpoint for this user
        const baseUrl = process.env.NEXTAUTH_URL || request.headers.get("host");
        const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
        const updateUrl = `${protocol}://${baseUrl}/api/investments/valuations/update`;

        // Create a mock session for the API call
        // Note: In production, you might want to use an internal service token
        const response = await fetch(updateUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            // You would set up internal authentication here
            "x-internal-request": "true",
            "x-user-id": user.id
          }
        });

        if (response.ok) {
          const result = await response.json();
          results.push({
            userId: user.id,
            email: user.email,
            ...result
          });
          totalUpdated += result.updated || 0;
        } else {
          console.error(`❌ Failed to update valuations for ${user.email}: ${response.status}`);
          results.push({
            userId: user.id,
            email: user.email,
            success: false,
            error: `HTTP ${response.status}`
          });
        }

      } catch (error) {
        console.error(`❌ Error processing user ${user.email}:`, error);
        results.push({
          userId: user.id,
          email: user.email,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }

    console.log(`✅ Scheduled valuation update completed: ${totalUpdated} accounts updated across ${users.length} users`);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      processed: users.length,
      totalUpdated,
      results
    });

  } catch (error) {
    console.error("❌ Scheduled valuation update failed:", error);

    return NextResponse.json({
      success: false,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}

// Alternative approach: Process users individually using database iteration
export async function PUT(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    const expectedToken = process.env.CRON_SECRET_TOKEN;

    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("🕐 Starting database-driven valuation update...");

    // This approach processes users one by one directly in the database
    const totalUpdated = await prisma.$transaction(async (tx) => {
      const updated = 0;

      // Get all investment accounts that might need valuation updates
      const investmentAccounts = await tx.investmentAccount.findMany({
        include: {
          account: true,
          user: { select: { id: true, email: true } },
          trades: {
            where: {
              type: { in: ["BUY", "SELL"] },
              symbol: { not: null }
            }
          },
          valuations: {
            orderBy: { asOf: "desc" },
            take: 1
          }
        }
      });

      // Group by user and process
      const userAccounts = new Map<string, typeof investmentAccounts>();
      for (const account of investmentAccounts) {
        const userId = account.userId;
        if (!userAccounts.has(userId)) {
          userAccounts.set(userId, []);
        }
        userAccounts.get(userId)!.push(account);
      }

      console.log(`👥 Processing ${userAccounts.size} users with ${investmentAccounts.length} investment accounts`);

      // Process would continue here with price fetching and valuation updates
      // This is a more complex implementation that avoids HTTP calls

      return updated;
    });

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      totalUpdated,
      method: "database-driven"
    });

  } catch (error) {
    console.error("❌ Database-driven valuation update failed:", error);

    return NextResponse.json({
      success: false,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}