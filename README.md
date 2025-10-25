# GPS Timecard System (attendance-app-gps)

GPS位置情報付き勤怠管理システム - Firebase Hosting でホストされたWebアプリケーション

## 🌟 特徴

- **GPS位置情報記録**: 打刻時に自動的にGPS位置情報を記録
- **リアルタイム勤怠管理**: Firebase Firestore によるリアルタイムデータベース
- **Google認証**: セキュアなGoogle OAuth認証
- **管理者画面**: 勤怠記録の閲覧・編集・集計機能
- **月次集計**: 締め日基準または期間指定での集計
- **CSV出力**: 勤怠データのCSVエクスポート

## 🚀 デプロイ先

- **本番環境**: https://attendance-app-gps.web.app
- **Firebase Project**: attendance-app-gps

## 📁 プロジェクト構成

```
attendance-app/
├── index_timecard.html      # 従業員用打刻ページ
├── admin_timecard.html       # 管理者用勤怠管理画面
├── js/
│   ├── config.js            # Firebase設定
│   ├── auth.js              # 認証処理
│   ├── attendance.js        # 勤怠記録表示
│   ├── monthly.js           # 月次集計機能
│   ├── utils.js             # 共通ユーティリティ
│   ├── edit.js              # 記録編集機能
│   ├── manual.js            # 手動入力機能
│   ├── settings.js          # 設定管理
│   └── employees.js         # 従業員管理
├── css/
│   └── admin-styles.css     # 管理画面スタイル
├── firebase.json            # Firebase設定
├── firestore.rules          # Firestoreセキュリティルール
└── .gitignore

```

## 🛠 技術スタック

- **フロントエンド**: Vanilla JavaScript (ES6 Modules)
- **認証**: Firebase Authentication (Google OAuth)
- **データベース**: Cloud Firestore
- **ホスティング**: Firebase Hosting
- **位置情報**: Geolocation API + Google Maps Geocoding API

## ⚙️ セットアップ

### 前提条件

- Node.js (v14以上)
- Firebase CLI
- Googleアカウント

### インストール

```bash
# Firebase CLIのインストール（未インストールの場合）
npm install -g firebase-tools

# Firebase にログイン
firebase login

# 依存関係のインストール
npm install
```

### デプロイ

```bash
# Firebase Hosting にデプロイ
firebase deploy --only hosting

# Firestore ルールもデプロイする場合
firebase deploy --only firestore:rules
```

## 📊 主な機能

### 従業員機能
- 出勤・退勤の打刻
- GPS位置情報の自動記録
- 本日の打刻記録確認
- 過去の記録閲覧

### 管理者機能
- 全従業員の勤怠記録閲覧
- 日付・従業員・種別でのフィルタリング
- 打刻記録の編集・削除
- 手動での打刻追加
- 月次集計（締め日基準 or 期間指定）
- CSV出力
- 従業員管理（勤務時間設定）

## 🔒 セキュリティ

- Firebase Authentication による認証
- Firestore Security Rules によるアクセス制御
- 管理者ロールベースのアクセス管理
- HTTPS通信の強制

## 📝 重要な注意事項

### プロジェクトの分離

このプロジェクトは **office-timecard-system** とは完全に独立したプロジェクトです。

- Firebase Project ID: `attendance-app-gps`
- GitHub Repository: `attendance-app-gps`
- 外出・戻り機能は**含まれていません**（出勤・退勤のみ）

**⚠️ 注意**: オフィスタイムカードとの混同を避けるため、以下を確認してください：
- `js/config.js` の `projectId` が `"attendance-app-gps"` であること
- Firebase コンソールで正しいプロジェクトを選択していること

## 🤝 貢献

このプロジェクトはプライベートプロジェクトです。

## 📄 ライセンス

Private - All Rights Reserved

## 📞 サポート

問題が発生した場合は、GitHub Issues で報告してください。
