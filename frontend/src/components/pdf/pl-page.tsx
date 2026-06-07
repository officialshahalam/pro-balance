import { Page, View, Text } from "@react-pdf/renderer";
import { styles, fmtInr } from "./pdf-styles";
import type { PLData, PLItem } from "@/lib/templates/profit-loss";

type AnnMap = Record<string, { ref_code: string; total: number; depreciation?: number }>;

function getAmt(item: PLItem, m: AnnMap): number {
  if (item.annexure_ref && m[item.annexure_ref]) {
    const ann = m[item.annexure_ref];
    if (ann.depreciation !== undefined) return ann.depreciation;
    return ann.total;
  }
  return item.amount;
}

function ItemLine({ label, amount, annRef }: { label: string; amount: number; annRef?: string }) {
  return (
    <View style={styles.itemRow}>
      <Text style={styles.itemText}>{label}{annRef ? ` (Annexure ${annRef})` : ""}</Text>
      <Text style={styles.itemAmount}>{fmtInr(amount)}</Text>
    </View>
  );
}

export default function PLPage({ client, user, fy, data, annexureMap, reportType }: {
  client: any;
  user: any;
  fy: any;
  data: PLData;
  annexureMap: AnnMap;
  reportType: string;
}) {
  const endDate = new Date(fy.end_date);
  const dateStr = `${String(endDate.getDate()).padStart(2, "0")}.${String(endDate.getMonth() + 1).padStart(2, "0")}.${endDate.getFullYear()}`;
  const addressParts = [client.village, client.post_office ? `POST ${client.post_office}` : null, client.city ? `DISTT. ${client.city.toUpperCase()}` : null, client.state?.toUpperCase(), client.pin_code].filter(Boolean);
  const titlePrefix = reportType ? `${reportType} ` : "";

  const openingStock = getAmt(data.trading.debit.opening_stock, annexureMap);
  const purchases = getAmt(data.trading.debit.purchases, annexureMap);
  const directTotal = data.trading.debit.direct_expenses.reduce((s, e) => s + e.amount, 0);
  const sales = getAmt(data.trading.credit.sales, annexureMap);
  const closingStock = getAmt(data.trading.credit.closing_stock, annexureMap);
  const tradingCreditOther = (data.trading.credit.other_income ?? []).reduce((s, e) => s + e.amount, 0);

  const debitTrading = openingStock + purchases + directTotal;
  const creditTrading = sales + closingStock + tradingCreditOther;
  const grossProfit = creditTrading - debitTrading;
  const tradingTotal = Math.max(debitTrading + Math.max(0, grossProfit), creditTrading);

  const indirectTotal = data.pl.indirect_expenses.reduce((s, e) => s + getAmt(e, annexureMap), 0);
  const plOtherIncome = (data.pl.other_income ?? []).reduce((s, e) => s + e.amount, 0);
  const netProfit = grossProfit + plOtherIncome - indirectTotal;
  const plTotal = Math.max(indirectTotal + Math.max(0, netProfit), Math.max(0, grossProfit) + plOtherIncome);

  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.headerCenter}>
        <Text style={styles.firmName}>{client.name}</Text>
        <Text style={styles.reportTitle}>{titlePrefix}PROFIT &amp; LOSS A/C FOR THE YEAR ENDED {dateStr}</Text>
        {addressParts.length > 0 && <Text style={styles.address}>{addressParts.join(", ")}</Text>}
      </View>

      {/* TRADING ACCOUNT */}
      <View style={styles.row}>
        {/* Debit */}
        <View style={[styles.colBorder, { paddingRight: 12 }]}>
          <View style={styles.thRow}>
            <Text style={[styles.thText, { flex: 1 }]}>PARTICULARS</Text>
            <Text style={styles.thAmount}>AMOUNT</Text>
          </View>
          <ItemLine label="To Opening Stock" amount={openingStock} annRef={data.trading.debit.opening_stock.annexure_ref} />
          <ItemLine label="To Purchases" amount={purchases} annRef={data.trading.debit.purchases.annexure_ref} />
          {data.trading.debit.direct_expenses.map((e) => (
            <ItemLine key={e.id} label={`To ${e.label}`} amount={e.amount} />
          ))}
          {grossProfit > 0 && (
            <View style={[styles.itemRow, { marginTop: "auto" }]}>
              <Text style={[styles.itemText, { fontFamily: "Helvetica-Bold" }]}>To Gross Profit c/d</Text>
              <Text style={[styles.itemAmount, { fontFamily: "Helvetica-Bold" }]}>{fmtInr(grossProfit)}</Text>
            </View>
          )}
          <View style={[styles.totalRowDouble, ...(!grossProfit ? [{ marginTop: "auto" as const }] : [])]}>
            <Text style={styles.totalText}>TOTAL</Text>
            <Text style={styles.totalAmount}>{fmtInr(tradingTotal)}</Text>
          </View>
        </View>

        {/* Credit */}
        <View style={[styles.col, { paddingLeft: 12 }]}>
          <View style={styles.thRow}>
            <Text style={[styles.thText, { flex: 1 }]}>PARTICULARS</Text>
            <Text style={styles.thAmount}>AMOUNT</Text>
          </View>
          <ItemLine label="By Sales" amount={sales} annRef={data.trading.credit.sales.annexure_ref} />
          <ItemLine label="By Closing Stock" amount={closingStock} annRef={data.trading.credit.closing_stock.annexure_ref} />
          {(data.trading.credit.other_income ?? []).map((e) => (
            <ItemLine key={e.id} label={`By ${e.label}`} amount={e.amount} />
          ))}
          <View style={[styles.totalRowDouble, { marginTop: "auto" }]}>
            <Text style={styles.totalText}>TOTAL</Text>
            <Text style={styles.totalAmount}>{fmtInr(tradingTotal)}</Text>
          </View>
        </View>
      </View>

      {/* P&L ACCOUNT */}
      <View style={[styles.row, { marginTop: 16 }]}>
        {/* Debit */}
        <View style={[styles.colBorder, { paddingRight: 12 }]}>
          {data.pl.indirect_expenses.map((e) => (
            <ItemLine key={e.id} label={`To ${e.label}`} amount={getAmt(e, annexureMap)} annRef={e.annexure_ref} />
          ))}
          {netProfit > 0 && (
            <View style={[styles.itemRow, { marginTop: "auto" }]}>
              <Text style={[styles.itemText, { fontFamily: "Helvetica-Bold" }]}>To Net Profit c/d</Text>
              <Text style={[styles.itemAmount, { fontFamily: "Helvetica-Bold" }]}>{fmtInr(netProfit)}</Text>
            </View>
          )}
          <View style={[styles.totalRowDouble, ...(!netProfit ? [{ marginTop: "auto" as const }] : [])]}>
            <Text style={styles.totalText}>TOTAL</Text>
            <Text style={styles.totalAmount}>{fmtInr(plTotal)}</Text>
          </View>
        </View>

        {/* Credit */}
        <View style={[styles.col, { paddingLeft: 12 }]}>
          <View style={styles.itemRow}>
            <Text style={[styles.itemText, { fontFamily: "Helvetica-Bold" }]}>By Gross Profit b/f</Text>
            <Text style={[styles.itemAmount, { fontFamily: "Helvetica-Bold" }]}>{fmtInr(Math.max(0, grossProfit))}</Text>
          </View>
          {(data.pl.other_income ?? []).map((e) => (
            <ItemLine key={e.id} label={`By ${e.label}`} amount={e.amount} />
          ))}
          <View style={[styles.totalRowDouble, { marginTop: "auto" }]}>
            <Text style={styles.totalText}>TOTAL</Text>
            <Text style={styles.totalAmount}>{fmtInr(plTotal)}</Text>
          </View>
        </View>
      </View>

      <View style={styles.auditorSection}>
        <Text>AUDITOR&apos;S REPORT</Text>
        <Text style={styles.auditorSubtext}>In terms of our separate audit report of even date annexed herewith</Text>
      </View>

      <View style={styles.footerRow}>
        <View>
          <Text style={styles.footerBold}>{user?.name || ""}</Text>
          {user?.ca_firm_name && <Text style={styles.footerBold}>({user.ca_firm_name})</Text>}
          <Text style={styles.footerLeft}>Partner</Text>
          {user?.ca_registration_number && <Text style={styles.footerLeft}>M. No. {user.ca_registration_number}</Text>}
          {user?.ca_place && <Text style={styles.footerLeft}>Place : {user.ca_place}</Text>}
          <Text style={styles.footerLeft}>Dated :</Text>
          <Text style={styles.footerLeft}>UDIN :</Text>
        </View>
        <View>
          <Text style={styles.footerBold}>{client.proprietor_name || client.name}</Text>
          <Text style={styles.footerRight}>(PROPRIETOR)</Text>
        </View>
      </View>
    </Page>
  );
}
