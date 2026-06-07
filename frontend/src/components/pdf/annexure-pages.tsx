import { Page, View, Text } from "@react-pdf/renderer";
import { styles, fmtInr } from "./pdf-styles";
import type { AnnexureData } from "@/lib/api-client/statements";

function compute(item: any) {
  const rate = parseFloat(item.rate) || 0;
  const wdv = parseFloat(item.wdv_opening) || 0;
  const addUpto = parseFloat(item.addition_upto) || 0;
  const addAfter = parseFloat(item.addition_after) || 0;
  const sold = parseFloat(item.sold_transfer) || 0;
  const total = wdv + addUpto + addAfter - sold;
  const depreciation = (wdv + addUpto) * rate / 100 + addAfter * rate / 200;
  const wdv_closing = total - depreciation;
  return { total, depreciation, wdv_closing };
}

function KeyValueAnnexure({ annexure, client, fy }: { annexure: AnnexureData; client: any; fy: any }) {
  const items = annexure.data?.items ?? [];
  const total = items.reduce((s: number, i: any) => s + (i.amount ?? 0), 0);
  const endDate = new Date(fy.end_date);
  const dateStr = `${String(endDate.getDate()).padStart(2, "0")}.${String(endDate.getMonth() + 1).padStart(2, "0")}.${endDate.getFullYear()}`;

  return (
    <>
      <Text style={styles.annexureLabel}>Annexure {annexure.ref_code}</Text>
      <View style={styles.headerCenter}>
        <Text style={styles.firmName}>{client.name}</Text>
        <Text style={styles.annexureTitle}>{annexure.title.toUpperCase()} AS ON {dateStr}</Text>
      </View>
      <View style={styles.tableHeader}>
        <Text style={[styles.tableCellBold, styles.snoCol]}>S. No.</Text>
        <Text style={[styles.tableCellBold, styles.partCol]}>Particulars</Text>
        <Text style={[styles.tableCellBold, styles.amtCol]}>Amount</Text>
      </View>
      {items.map((item: any, i: number) => (
        <View key={i} style={styles.tableRow}>
          <Text style={[styles.tableCell, styles.snoCol]}>{i + 1}</Text>
          <Text style={[styles.tableCell, styles.partCol]}>{item.name}</Text>
          <Text style={[styles.tableCellRight, styles.amtCol]}>{fmtInr(item.amount ?? 0)}</Text>
        </View>
      ))}
      <View style={styles.tableTotalRow}>
        <Text style={[styles.tableCellBold, styles.snoCol]}></Text>
        <Text style={[styles.tableCellBold, styles.partCol]}>TOTAL</Text>
        <Text style={[styles.tableCellBold, styles.amtCol, { textAlign: "right" }]}>{fmtInr(total)}</Text>
      </View>
      <View style={{ marginBottom: 24 }} />
    </>
  );
}

function LedgerAnnexure({ annexure, client, fy }: { annexure: AnnexureData; client: any; fy: any }) {
  const debit = annexure.data?.debit ?? [];
  const credit = annexure.data?.credit ?? [];
  const debitTotal = debit.reduce((s: number, i: any) => s + (i.amount ?? 0), 0);
  const creditTotal = credit.reduce((s: number, i: any) => s + (i.amount ?? 0), 0);
  const balanceCd = Math.max(0, creditTotal - debitTotal);
  const grandTotal = creditTotal;
  const endDate = new Date(fy.end_date);
  const dateStr = `${String(endDate.getDate()).padStart(2, "0")}.${String(endDate.getMonth() + 1).padStart(2, "0")}.${endDate.getFullYear()}`;

  return (
    <>
      <Text style={styles.annexureLabel}>Annexure {annexure.ref_code}</Text>
      <View style={styles.headerCenter}>
        <Text style={styles.firmName}>{client.name}</Text>
        <Text style={styles.annexureTitle}>{annexure.title.toUpperCase()} FOR THE YEAR ENDED {dateStr}</Text>
      </View>
      <View style={styles.row}>
        <View style={[styles.colBorder, { paddingRight: 10 }]}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableCellBold, styles.partCol]}>PARTICULARS</Text>
            <Text style={[styles.tableCellBold, styles.amtCol]}>AMOUNT</Text>
          </View>
          {debit.map((item: any, i: number) => (
            <View key={i} style={styles.tableRow}>
              <Text style={[styles.tableCell, styles.partCol]}>To {item.name}</Text>
              <Text style={[styles.tableCellRight, styles.amtCol]}>{fmtInr(item.amount ?? 0)}</Text>
            </View>
          ))}
          <View style={[styles.tableRow, { marginTop: "auto" }]}>
            <Text style={[styles.tableCellBold, styles.partCol]}>To Balance c/d</Text>
            <Text style={[styles.tableCellBold, styles.amtCol, { textAlign: "right" }]}>{fmtInr(balanceCd)}</Text>
          </View>
          <View style={styles.tableTotalRow}>
            <Text style={[styles.tableCellBold, styles.partCol]}>TOTAL</Text>
            <Text style={[styles.tableCellBold, styles.amtCol, { textAlign: "right" }]}>{fmtInr(grandTotal)}</Text>
          </View>
        </View>
        <View style={[styles.col, { paddingLeft: 10 }]}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableCellBold, styles.partCol]}>PARTICULARS</Text>
            <Text style={[styles.tableCellBold, styles.amtCol]}>AMOUNT</Text>
          </View>
          {credit.map((item: any, i: number) => (
            <View key={i} style={styles.tableRow}>
              <Text style={[styles.tableCell, styles.partCol]}>By {item.name}</Text>
              <Text style={[styles.tableCellRight, styles.amtCol]}>{fmtInr(item.amount ?? 0)}</Text>
            </View>
          ))}
          <View style={[styles.tableTotalRow, { marginTop: "auto" }]}>
            <Text style={[styles.tableCellBold, styles.partCol]}>TOTAL</Text>
            <Text style={[styles.tableCellBold, styles.amtCol, { textAlign: "right" }]}>{fmtInr(grandTotal)}</Text>
          </View>
        </View>
      </View>
      <View style={{ marginBottom: 24 }} />
    </>
  );
}

function DepreciationAnnexure({ annexure, client, fy }: { annexure: AnnexureData; client: any; fy: any }) {
  const items = annexure.data?.items ?? [];
  const endDate = new Date(fy.end_date);
  const startDate = new Date(fy.start_date);
  const dateStr = `${String(endDate.getDate()).padStart(2, "0")}.${String(endDate.getMonth() + 1).padStart(2, "0")}.${endDate.getFullYear()}`;
  const startStr = `${String(startDate.getDate()).padStart(2, "0")}.${String(startDate.getMonth() + 1).padStart(2, "0")}.${startDate.getFullYear()}`;

  let totWdvOp = 0, totAddUp = 0, totAddAf = 0, totSold = 0, totTotal = 0, totDep = 0, totWdvCl = 0;
  items.forEach((i: any) => {
    const c = compute(i);
    totWdvOp += parseFloat(i.wdv_opening) || 0;
    totAddUp += parseFloat(i.addition_upto) || 0;
    totAddAf += parseFloat(i.addition_after) || 0;
    totSold += parseFloat(i.sold_transfer) || 0;
    totTotal += c.total;
    totDep += c.depreciation;
    totWdvCl += c.wdv_closing;
  });

  const hdr = { fontSize: 7, fontFamily: "Helvetica-Bold" as const, textAlign: "center" as const };
  const cell = { fontSize: 7 };
  const cellR = { fontSize: 7, textAlign: "right" as const };
  const w = { name: { width: 120 }, rate: { width: 30 }, num: { width: 68 } };

  return (
    <>
      <Text style={styles.annexureLabel}>Annexure {annexure.ref_code}</Text>
      <View style={styles.headerCenter}>
        <Text style={styles.firmName}>{client.name}</Text>
        <Text style={styles.annexureTitle}>FIXED ASSETS ACCOUNT AS ON {dateStr}</Text>
      </View>
      <View style={[styles.tableHeader, { gap: 2 }]}>
        <Text style={[hdr, w.name, { textAlign: "left" }]}>Particulars</Text>
        <Text style={[hdr, w.rate]}>Rate</Text>
        <Text style={[hdr, w.num]}>W.D.V.{"\n"}As on{"\n"}{startStr}</Text>
        <Text style={[hdr, w.num]}>Addition{"\n"}Upto</Text>
        <Text style={[hdr, w.num]}>Addition{"\n"}After</Text>
        <Text style={[hdr, w.num]}>Sold/{"\n"}Transfer</Text>
        <Text style={[hdr, w.num]}>TOTAL</Text>
        <Text style={[hdr, w.num]}>DEPRECIATION</Text>
        <Text style={[hdr, w.num]}>W.D.V.{"\n"}As on{"\n"}{dateStr}</Text>
      </View>
      {items.map((item: any, i: number) => {
        const c = compute(item);
        return (
          <View key={i} style={[styles.tableRow, { gap: 2 }]}>
            <Text style={[cell, w.name]}>{item.name}</Text>
            <Text style={[cellR, w.rate]}>{item.rate ? `${item.rate}%` : "-"}</Text>
            <Text style={[cellR, w.num]}>{parseFloat(item.wdv_opening) ? fmtInr(parseFloat(item.wdv_opening)) : "-"}</Text>
            <Text style={[cellR, w.num]}>{parseFloat(item.addition_upto) ? fmtInr(parseFloat(item.addition_upto)) : "-"}</Text>
            <Text style={[cellR, w.num]}>{parseFloat(item.addition_after) ? fmtInr(parseFloat(item.addition_after)) : "-"}</Text>
            <Text style={[cellR, w.num]}>{parseFloat(item.sold_transfer) ? fmtInr(parseFloat(item.sold_transfer)) : "-"}</Text>
            <Text style={[cellR, w.num]}>{fmtInr(c.total)}</Text>
            <Text style={[cellR, w.num]}>{fmtInr(c.depreciation)}</Text>
            <Text style={[cellR, w.num]}>{fmtInr(c.wdv_closing)}</Text>
          </View>
        );
      })}
      <View style={[styles.tableTotalRow, { gap: 2 }]}>
        <Text style={[{ ...hdr, textAlign: "left" }, w.name]}>TOTAL</Text>
        <Text style={[hdr, w.rate]}></Text>
        <Text style={[hdr, w.num]}>{fmtInr(totWdvOp)}</Text>
        <Text style={[hdr, w.num]}>{fmtInr(totAddUp)}</Text>
        <Text style={[hdr, w.num]}>{fmtInr(totAddAf)}</Text>
        <Text style={[hdr, w.num]}>{totSold ? fmtInr(totSold) : "-"}</Text>
        <Text style={[hdr, w.num]}>{fmtInr(totTotal)}</Text>
        <Text style={[hdr, w.num]}>{fmtInr(totDep)}</Text>
        <Text style={[hdr, w.num]}>{fmtInr(totWdvCl)}</Text>
      </View>
      <View style={{ marginBottom: 24 }} />
    </>
  );
}

export default function AnnexurePages({ annexures, client, fy }: {
  annexures: AnnexureData[];
  client: any;
  fy: any;
}) {
  if (!annexures.length) return null;
  return (
    <Page size="A4" style={styles.page} wrap>
      {annexures.map((ann) => {
        if (ann.ann_type === "ledger") return <LedgerAnnexure key={ann.id} annexure={ann} client={client} fy={fy} />;
        if (ann.ann_type === "depreciation_schedule") return <DepreciationAnnexure key={ann.id} annexure={ann} client={client} fy={fy} />;
        return <KeyValueAnnexure key={ann.id} annexure={ann} client={client} fy={fy} />;
      })}
    </Page>
  );
}
