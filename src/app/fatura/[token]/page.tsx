import type { Metadata } from "next";
import { PublicInvoiceClient } from "@/components/PublicInvoiceClient";

export const metadata: Metadata = {
  title: "Fatura FRdoc — Pagamento via PIX",
  robots: { index: false, follow: false },
};

export default async function PublicInvoicePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <PublicInvoiceClient token={token} />;
}
