"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function DraftPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/leagues");
  }, [router]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 text-center">
      <p className="text-[#8A8A8A]">Redirecting to Leagues...</p>
    </div>
  );
}
