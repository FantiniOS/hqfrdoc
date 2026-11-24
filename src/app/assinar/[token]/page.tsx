import type { Metadata } from "next";
import { PublicContractSignClient } from "@/components/PublicContractSignClient";

export const metadata: Metadata = {
  title: "Assinatura Eletrônica de Contrato — FRdoc 2.0",
  robots: { index: false, follow: false },
};

export default async function PublicSignPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <PublicContractSignClient token={token} />;
}
