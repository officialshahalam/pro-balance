import { Page, View, Text } from "@react-pdf/renderer";
import { styles, fmtInr } from "./pdf-styles";
import type { BSRow } from "@/lib/templates/balance-sheet";

type AnnMap = Record<string, { ref_code: string; total: number; depreciation?: number }>;

function getAmount(row: BSRow, annexureMap: AnnMap): number {
  if (row.annexure_ref && annexureMap[row.annexure_ref]) return annexureMap[row.annexure_ref].total;
  return row.amount ?? 0;
}

function renderItems(rows: BSRow[], annexureMap: AnnMap) {
  const items: any[] = [];
  for (const row of rows) {
    if (row.type === "header" || row.type === "add_button" || row.type === "subtotal" || row.type === "total") continue;
    if (row.type === "subheader") {
      items.push(
        <Text key={row.id} style={styles.sectionHeader}>{row.label.toUpperCase()}</Text>
      );
      continue;
    }
    if (row.type === "item") {
      const amt = getAmount(row, annexureMap);
      const annRef = row.annexure_ref ? ` (Annexure ${row.annexure_ref})` : "";
      items.push(
        <View key={row.id} style={styles.itemRow}>
          <Text style={styles.itemText}>{row.label}{annRef}</Text>
          <Text style={styles.itemAmount}>{fmtInr(amt)}</Text>
        </View>
      );
    }
  }
  return items;
}

function calcTotal(rows: BSRow[], annexureMap: AnnMap): number {
  return rows.filter((r) => r.type === "item").reduce((s, r) => s + getAmount(r, annexureMap), 0);
}

export default function BSPage({ client, user, fy, liabilities, assets, annexureMap, reportType }: {
  client: any;
  user: any;
  fy: any;
  liabilities: BSRow[];
  assets: BSRow[];
  annexureMap: AnnMap;
  reportType: string;
}) {
  const endDate = new Date(fy.end_date);
  const dateStr = `${endDate.getDate()} ${endDate.toLocaleString("en-IN", { month: "long" }).toUpperCase()} ${endDate.getFullYear()}`;
  const addressParts = [client.village, client.post_office ? `POST ${client.post_office}` : null, client.city ? `DISTT. ${client.city.toUpperCase()}` : null, client.state ? `${client.state.toUpperCase()}` : null, client.pin_code].filter(Boolean);
  const address = addressParts.length > 0 ? addressParts.join(", ") : "";
  const titlePrefix = reportType ? `${reportType} ` : "";

  const liabTotal = calcTotal(liabilities, annexureMap);
  const assetTotal = calcTotal(assets, annexureMap);

  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.headerCenter}>
        <Text style={styles.firmName}>{client.name}</Text>
        <Text style={styles.reportTitle}>{titlePrefix}BALANCE SHEET AS ON {dateStr}</Text>
        {address && <Text style={styles.address}>{address}</Text>}
      </View>

      <View style={styles.row}>
        <View style={[styles.colBorder, { paddingRight: 12 }]}>
          <View style={styles.thRow}>
            <Text style={[styles.thText, { flex: 1 }]}>LIABILITIES</Text>
            <Text style={styles.thAmount}>AMOUNT</Text>
          </View>
          {renderItems(liabilities, annexureMap)}
          <View style={[styles.totalRowDouble, { marginTop: "auto" }]}>
            <Text style={styles.totalText}>TOTAL</Text>
            <Text style={styles.totalAmount}>{fmtInr(liabTotal)}</Text>
          </View>
        </View>

        <View style={[styles.col, { paddingLeft: 12 }]}>
          <View style={styles.thRow}>
            <Text style={[styles.thText, { flex: 1 }]}>ASSETS</Text>
            <Text style={styles.thAmount}>AMOUNT</Text>
          </View>
          {renderItems(assets, annexureMap)}
          <View style={[styles.totalRowDouble, { marginTop: "auto" }]}>
            <Text style={styles.totalText}>TOTAL</Text>
            <Text style={styles.totalAmount}>{fmtInr(assetTotal)}</Text>
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
