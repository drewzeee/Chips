import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getAuthSession();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const totalUSD = 0;

    return NextResponse.json({ totalUSD });
  } catch (error) {
    console.error("External balance total error:", error);
    return NextResponse.json(
      { error: "Failed to fetch external balance total" },
      { status: 500 }
    );
  }
}
