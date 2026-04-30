/**
 * スーパー価格比較 — Google Apps Script サーバー
 *
 * デプロイ設定（必須）:
 *   ウェブアプリとしてデプロイ
 *   → 実行ユーザー     : 自分
 *   → アクセスできるユーザー: 全員（匿名ユーザーを含む）
 *
 * CORS について:
 *   フロントエンドは POST 時に Content-Type: text/plain を使用します。
 *   これにより CORS プリフライトが発生しません。
 *   GET/POST レスポンスには Google が自動で Access-Control-Allow-Origin: * を付与します。
 *
 * エンドポイント一覧:
 *   GET  ?action=getStores   → 店舗一覧を返す
 *   GET  ?action=getPrices   → 全価格データを返す
 *   POST ?action=addStore    → 店舗を追加
 *   POST ?action=deleteStore → 店舗を削除（関連する価格データも削除）
 *   POST ?action=addPrice    → 価格データを追加
 *   POST ?action=deletePrice → 価格データを1件削除
 *
 * シート構成:
 *   stores シート: name
 *   prices シート: id, date, store, product, price, note
 */

function doGet(e) {
  const action = e.parameter.action;
  try {
    if (action === 'getStores') return jsonResponse(getStores());
    if (action === 'getPrices') return jsonResponse(getPrices());
    return jsonResponse({ error: `Unknown action: ${action}` });
  } catch (err) {
    return jsonResponse({ error: err.message });
  }
}

function doPost(e) {
  const action = e.parameter.action;
  try {
    const body = JSON.parse(e.postData.contents);
    if (action === 'addStore')    return jsonResponse(addStore(body));
    if (action === 'deleteStore') return jsonResponse(deleteStore(body));
    if (action === 'addPrice')    return jsonResponse(addPrice(body));
    if (action === 'deletePrice') return jsonResponse(deletePrice(body));
    return jsonResponse({ error: `Unknown action: ${action}` });
  } catch (err) {
    return jsonResponse({ error: err.message });
  }
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── シート取得（なければ作成） ──────────────────────────────────
function getOrCreateSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    if (name === 'stores') sheet.appendRow(['name']);
    if (name === 'prices') sheet.appendRow(['id', 'date', 'store', 'product', 'price', 'note']);
  }
  return sheet;
}

// ── 店舗 ───────────────────────────────────────────────────────
function getStores() {
  const sheet = getOrCreateSheet('stores');
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  return sheet.getRange(2, 1, lastRow - 1, 1).getValues()
    .map(r => String(r[0]))
    .filter(s => s !== '');
}

function addStore(body) {
  const sheet = getOrCreateSheet('stores');
  sheet.appendRow([body.name]);
  return { success: true };
}

function deleteStore(body) {
  // stores シートから削除
  const storeSheet = getOrCreateSheet('stores');
  const storeRows = storeSheet.getDataRange().getValues();
  for (let i = storeRows.length - 1; i >= 1; i--) {
    if (String(storeRows[i][0]) === body.name) {
      storeSheet.deleteRow(i + 1);
      break;
    }
  }
  // prices シートから該当店舗の行を削除
  const priceSheet = getOrCreateSheet('prices');
  const priceRows = priceSheet.getDataRange().getValues();
  for (let i = priceRows.length - 1; i >= 1; i--) {
    if (String(priceRows[i][2]) === body.name) {
      priceSheet.deleteRow(i + 1);
    }
  }
  return { success: true };
}

// ── 価格 ───────────────────────────────────────────────────────
function getPrices() {
  const sheet = getOrCreateSheet('prices');
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const tz = Session.getScriptTimeZone();
  return sheet.getRange(2, 1, lastRow - 1, 6).getValues()
    .filter(r => r[0] !== '')
    .map(r => ({
      id:      String(r[0]),
      date:    r[1] instanceof Date
                 ? Utilities.formatDate(r[1], tz, 'yyyy-MM-dd')
                 : String(r[1]),
      store:   String(r[2]),
      product: String(r[3]),
      price:   Number(r[4]),
      note:    String(r[5] || ''),
    }));
}

function addPrice(body) {
  const sheet = getOrCreateSheet('prices');
  sheet.appendRow([
    body.id,
    body.date,
    body.store,
    body.product,
    Number(body.price),
    body.note || '',
  ]);
  return { success: true };
}

function deletePrice(body) {
  const sheet = getOrCreateSheet('prices');
  const rows = sheet.getDataRange().getValues();
  for (let i = rows.length - 1; i >= 1; i--) {
    if (String(rows[i][0]) === String(body.id)) {
      sheet.deleteRow(i + 1);
      break;
    }
  }
  return { success: true };
}
