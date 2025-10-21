# 開発環境セットアップガイド - GPS勤怠システム

新しいPCでGPS勤怠システム（attendance-app-gps）の開発を始めるための手順

## 前提条件

### 必須ツールのインストール

#### 1. Git
```bash
# Windows
# https://git-scm.com/download/win からダウンロードしてインストール

# インストール確認
git --version
```

#### 2. Node.js (v18以上推奨)
```bash
# https://nodejs.org/ からLTS版をダウンロードしてインストール

# インストール確認
node --version
npm --version
```

#### 3. Firebase CLI
```bash
npm install -g firebase-tools

# インストール確認
firebase --version
```

#### 4. GitHub CLI (推奨)
```bash
# Windows: https://cli.github.com/ からダウンロードしてインストール

# インストール確認
gh --version
```

## プロジェクトのセットアップ

### 1. リポジトリのクローン

```bash
# 作業ディレクトリに移動（例：デスクトップ）
cd ~/Desktop

# リポジトリをクローン
git clone https://github.com/zatsugaku/attendance-app-gps.git
cd attendance-app-gps
```

### 2. Firebase 認証

```bash
# Firebaseにログイン
firebase login

# プロジェクト確認
firebase projects:list
```

### 3. 初回デプロイテスト

```bash
# Hosting（Webサイト）をデプロイ
firebase deploy --only hosting
```

## 開発ワークフロー

### 日常的な作業フロー

```bash
# 1. 最新の変更を取得
git pull origin main

# 2. ファイルを編集
# index_timecard.html や admin_timecard.html を編集

# 3. ローカルで確認（任意）
# HTMLファイルをブラウザで直接開く

# 4. 変更をコミット
git add .
git commit -m "説明"
git push origin main

# 5. Firebaseにデプロイ
firebase deploy --only hosting
```

## プロジェクト構造

```
attendance-app-gps/
├── index_timecard.html       # ユーザー画面（GPS打刻）
├── admin_timecard.html       # 管理画面
├── index.html                # 旧バージョン（参考用）
├── admin.html                # 旧バージョン（参考用）
├── arcive/                   # 過去のバージョン保管
├── firebase.json             # Firebase設定
└── .firebaserc              # Firebaseプロジェクト設定
```

## 主な機能

- **GPS位置情報取得**: 打刻時の位置情報を記録
- **勤怠打刻**: 出勤・退勤・休憩の記録
- **位置情報検証**: 指定エリア内での打刻を確認
- **管理機能**: 従業員の勤怠データ確認

## GPS機能について

このシステムは、スマートフォンやタブレットのGPS機能を使用して位置情報を取得します。

### 動作要件

- **HTTPS必須**: 位置情報APIはHTTPS環境でのみ動作
- **位置情報許可**: ユーザーがブラウザで位置情報の使用を許可する必要あり
- **GPS対応デバイス**: スマートフォン・タブレット推奨

### テスト方法

```bash
# Firebase Hostingにデプロイ後
# スマートフォンでアクセス
https://attendance-app-gps.web.app
```

## トラブルシューティング

### Firebaseデプロイエラー

```bash
# 認証を再確認
firebase logout
firebase login

# プロジェクトが正しく設定されているか確認
firebase use attendance-app-gps
```

### GPS取得エラー

- ブラウザで位置情報の許可を確認
- HTTPS接続を確認（Firebaseは自動的にHTTPS）
- デバイスのGPS設定を確認

### アーカイブについて

`arcive/` フォルダには過去のバージョンが保存されています：
- 過去の機能確認に使用
- 削除せず保管推奨
- 必要に応じて参考にできる

## 関連リンク

- **Firebase Console**: https://console.firebase.google.com/project/attendance-app-gps
- **Hosting URL**: https://attendance-app-gps.web.app (要確認)
- **GitHub Repository**: https://github.com/zatsugaku/attendance-app-gps

## サポート

質問や問題が発生した場合は、GitHubのIssuesで報告してください。

---

**重要な注意事項**

このプロジェクトはFirebaseの無料プラン（Sparkプラン）で動作しますが、以下の制限があります：
- Firestoreストレージ: 1GB
- ダウンロード: 10GB/月
- ドキュメント読み取り: 50,000/日

利用状況に応じてプランのアップグレードを検討してください。
