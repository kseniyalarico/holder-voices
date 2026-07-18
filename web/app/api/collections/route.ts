import { NextResponse } from "next/server";
import { prisma } from "@holder-voices/database";

export async function GET() {
  const collections = await prisma.collection.findMany({
    where: { isActive: true },
    orderBy: { bitIndex: "asc" },
  });

  return NextResponse.json(
    collections.map((c) => ({
      id: c.id,
      name: c.name,
      contractAddress: c.contractAddress,
      bitIndex: c.bitIndex,
      logoUrl: c.logoUrl,
    }))
  );
}
