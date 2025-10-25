# GPS Timecard System - 開発メモ

## プロジェクト概要

- **プロジェクト名**: GPS Timecard System (attendance-app-gps)
- **Firebase Project ID**: `attendance-app-gps`
- **デプロイURL**: https://attendance-app-gps.web.app
- **GitHub**: https://github.com/zatsugaku/attendance-app-gps

## 重要な注意事項

⚠️ **このプロジェクトは Office Timecard System とは完全に独立しています**

- Office Timecard には「外出・戻り」機能がありますが、GPS Timecard には**ありません**
- 両プロジェクトのコードを混同しないよう注意してください
- Firebase Project ID を必ず確認してから作業してください

## 主な機能

- 出勤・退勤の打刻（外出・戻りなし）
- GPS位置情報の自動記録
- Google OAuth 認証
- 管理者による勤怠管理
- 月次集計（締め日基準 / 期間指定）
- CSV出力

---

## 開発履歴

### 2025-10-25: GPS位置情報表示修正、ログイン永続化、月次集計機能追加

#### 1. GPS位置情報が表示されない問題の修正

**問題**:
- 打刻ページではGPS位置情報が記録されているが、管理画面に表示されない

**原因**:
- 打刻ページ（`index_timecard.html`）では GPS データを `address` フィールドに保存
- 管理画面（`attendance.js`）では `gpsLocation` フィールドを参照していた
- フィールド名の不一致が原因

**修正内容**:
- `js/attendance.js` Line 384, 689
  ```javascript
  // 修正前
  const gpsLocation = group.clockIn?.gpsLocation || group.clockOut?.gpsLocation || '-';

  // 修正後
  const gpsLocation = group.clockIn?.address || group.clockOut?.address || '-';
  ```

**修正ファイル**: `js/attendance.js`

---

#### 2. ログイン永続化の実装

**問題**:
- 管理画面で毎回ログインが必要
- タブを閉じたりページをリロードするとログアウトされる

**原因**:
- Firebase Authentication の永続化設定が明示的に行われていなかった

**修正内容**:
- `js/auth.js` に永続化設定を追加
  ```javascript
  // Import追加
  import {
      setPersistence,
      browserLocalPersistence
  } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

  // initAuth() 内で設定
  await setPersistence(auth, browserLocalPersistence);
  ```

**修正ファイル**: `js/auth.js` (Lines 8-15, 40-46)

---

#### 3. 月次集計の期間選択機能追加

**問題**:
- 月次集計で「集計実行」ボタンを押しても動作しない
- 締め日基準の集計しかできない

**要件**:
- Office Timecard と同様に、締め日基準と期間指定の両方に対応したい
- ただし、外出・戻り機能は含めない（GPS Timecard には不要）

**修正内容**:

##### A. HTML の修正 (`admin_timecard.html`)
- 期間タイプ選択のドロップダウンを追加
- 期間指定用の開始日・終了日入力欄を追加
- onclick ハンドラをグローバル関数に変更

```html
<!-- 期間タイプ選択 -->
<select id="periodType" onchange="togglePeriodInput()">
    <option value="monthly">月次（締め日基準）</option>
    <option value="custom">期間指定</option>
</select>

<!-- 期間指定セクション -->
<div id="customPeriodSection" style="display: none;">
    <input type="date" id="customStartDate">
    <input type="date" id="customEndDate">
</div>
```

##### B. JavaScript の修正 (`js/monthly.js`)
- `togglePeriodInput()` 関数を追加（期間タイプに応じてUIを切り替え）
- `calculateMonthlySummary()` を修正（両方の期間タイプに対応）
- グローバル関数として登録

```javascript
export function togglePeriodInput() {
    const periodType = document.getElementById('periodType').value;
    if (periodType === 'monthly') {
        // 月次表示
    } else {
        // 期間指定表示
    }
}

// グローバル登録
window.togglePeriodInput = togglePeriodInput;
```

##### C. ユーティリティの修正 (`js/utils.js`)
- `showMessage` をグローバル関数として登録
  ```javascript
  window.showMessage = showNotification;
  ```

**修正ファイル**:
- `admin_timecard.html` (Lines 219-269, 282-283)
- `js/monthly.js` (Lines 164-177, 189-218, 612-614)
- `js/utils.js` (Line 407)

---

#### 4. GitHub リポジトリのセットアップ

**実施内容**:
- 既存の GitHub リポジトリに接続
- `README.md` を作成（プロジェクト概要、セットアップ手順、注意事項）
- すべての変更をコミット・プッシュ

**コミットメッセージ**:
```
feat: GPS位置情報表示、ログイン永続化、月次集計期間選択機能の追加

主な変更:
- GPS位置情報が管理画面に表示されるよう修正（addressフィールド使用）
- ログイン状態の永続化（setPersistence設定追加）
- 月次集計で期間選択機能を追加（締め日基準 or 期間指定）
- README.mdを追加（プロジェクト概要・セットアップ手順）
- 外出・戻り機能を削除（GPSタイムカードには不要）
```

---

## データ構造

### 打刻レコード (attendance コレクション)

```javascript
{
    userId: string,
    userName: string,
    email: string,
    type: 'clock_in' | 'clock_out',
    timestamp: Timestamp,
    location: {
        latitude: number,
        longitude: number,
        accuracy: number
    },
    address: string,  // ← GPS位置情報（住所文字列）
    pcInfo: string
}
```

### ユーザー情報 (users コレクション)

```javascript
{
    email: string,
    displayName: string,
    photoURL: string,
    role: 'admin' | 'manager' | 'employee',
    isActive: boolean,
    createdAt: string,
    lastLogin: string,
    updatedAt: string
}
```

---

## 重要なファイルと役割

| ファイル | 役割 | 重要なポイント |
|---------|------|---------------|
| `index_timecard.html` | 従業員用打刻ページ | GPS データを `address` フィールドに保存 |
| `admin_timecard.html` | 管理者用画面 | 期間選択UIを含む |
| `js/config.js` | Firebase設定 | **Project ID を必ず確認** |
| `js/auth.js` | 認証処理 | ログイン永続化設定を含む |
| `js/attendance.js` | 勤怠記録表示 | `address` フィールドから GPS 位置を取得 |
| `js/monthly.js` | 月次集計 | 締め日基準と期間指定の両方に対応 |
| `js/utils.js` | 共通関数 | グローバル関数の登録 |

---

## デプロイ手順

```bash
# Firebase にログイン
firebase login

# デプロイ
firebase deploy --only hosting

# Firestore ルールも更新する場合
firebase deploy --only firestore:rules
```

---

## トラブルシューティング

### GPS位置情報が表示されない
- `js/config.js` の Project ID が `attendance-app-gps` であることを確認
- `js/attendance.js` で `address` フィールドを参照しているか確認

### ログインが維持されない
- `js/auth.js` で `setPersistence(auth, browserLocalPersistence)` が呼ばれているか確認

### 月次集計が動作しない
- `window.togglePeriodInput` がグローバルに登録されているか確認
- `window.showMessage` がグローバルに登録されているか確認

---

## Office Timecard との違い

| 機能 | GPS Timecard | Office Timecard |
|------|--------------|-----------------|
| 出勤・退勤 | ✅ あり | ✅ あり |
| 外出・戻り | ❌ なし | ✅ あり |
| GPS位置情報 | ✅ あり | ❌ なし |
| 月次集計 | ✅ あり | ✅ あり |
| 期間指定集計 | ✅ あり | ✅ あり |
| Firebase Project | `attendance-app-gps` | `office-timecard-system` |

---

## 今後の開発時の注意点

1. **プロジェクトの確認**: 作業前に必ず Firebase Project ID を確認
2. **機能の分離**: Office Timecard の機能を安易にコピーしない
3. **フィールド名の統一**: GPS データは `address` フィールドを使用
4. **グローバル関数**: HTML から呼ぶ関数は `window.functionName` で登録
5. **デプロイ前の確認**: 必ずローカルでテストしてからデプロイ

---

**最終更新**: 2025-10-25
