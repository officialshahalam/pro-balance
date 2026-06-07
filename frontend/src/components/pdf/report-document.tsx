import { Document } from "@react-pdf/renderer";
import BSPage from "./bs-page";
import PLPage from "./pl-page";
import AnnexurePages from "./annexure-pages";
import type { BSRow } from "@/lib/templates/balance-sheet";
import type { PLData } from "@/lib/templates/profit-loss";
import type { AnnexureData } from "@/lib/api-client/statements";

type AnnMap = Record<string, { ref_code: string; total: number; depreciation?: number }>;

export default function ReportDocument({ client, user, fy, bsData, plData, annexures, annexureMap, reportType }: {
  client: any;
  user: any;
  fy: any;
  bsData: { liabilities: BSRow[]; assets: BSRow[] };
  plData: PLData;
  annexures: AnnexureData[];
  annexureMap: AnnMap;
  reportType: string;
}) {
  return (
    <Document>
      <BSPage client={client} user={user} fy={fy} liabilities={bsData.liabilities} assets={bsData.assets} annexureMap={annexureMap} reportType={reportType} />
      <PLPage client={client} user={user} fy={fy} data={plData} annexureMap={annexureMap} reportType={reportType} />
      <AnnexurePages annexures={annexures} client={client} fy={fy} />
    </Document>
  );
}
