/**
 * Firebase設定モジュール
 * - Firebase初期化
 * - Firestore, Auth インスタンス管理
 * - 環境変数管理
 *
 * ⚠️⚠️⚠️ 警告 ⚠️⚠️⚠️
 * このファイルは GPS Timecard (attendance-app-gps) 専用です！
 * Office Timecard (office-timecard-system) と混同しないこと！
 * projectId: "attendance-app-gps" であることを必ず確認してください
 * ⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

/**
 * Firebase設定オブジェクト
 * 本番環境では環境変数から取得推奨
 */
const firebaseConfig = {
    apiKey: "AIzaSyDUgTnS9eabHA8iyY_WMMIrh0ZdxsAF_Ds",
    authDomain: "attendance-app-gps.firebaseapp.com",
    projectId: "attendance-app-gps",
    storageBucket: "attendance-app-gps.firebasestorage.app",
    messagingSenderId: "389712797536",
    appId: "1:389712797536:web:f872695e0a877fb8900805",
    measurementId: "G-ELGT30EGBF"
};

/**
 * Firebase アプリケーション初期化
 */
export const app = initializeApp(firebaseConfig);

/**
 * Firestore データベースインスタンス
 * @type {import('firebase/firestore').Firestore}
 */
export const db = getFirestore(app);

/**
 * Firebase Authentication インスタンス
 * @type {import('firebase/auth').Auth}
 */
export const auth = getAuth(app);

/**
 * アプリケーション設定
 */
export const APP_CONFIG = {
    // コレクション名
    COLLECTIONS: {
        RECORDS: 'timecard_records',
        SETTINGS: 'admin_settings',
        EMPLOYEES: 'employees',
        EDIT_HISTORY: 'edit_history',
        PAID_LEAVE: 'paid_leave',
        ABSENCES: 'absences'
    },
    
    // デフォルト設定値
    DEFAULTS: {
        START_TIME: '09:00',
        END_TIME: '18:00',
        BREAK_TIME: 60,
        STANDARD_WORK_TIME: 8,
        OVERTIME_THRESHOLD: 8,
        LATE_THRESHOLD: 30,
        WEEKENDS: [0, 6], // 日曜、土曜
        INCLUDE_HOLIDAYS: true
    },
    
    // 管理者権限
    ADMIN_ROLES: ['admin', 'super_admin'],
    
    // UI設定
    UI: {
        NOTIFICATION_DURATION: 3000,
        LOADING_DELAY: 500
    }
};

/**
 * 環境判定
 */
export const IS_DEVELOPMENT = window.location.hostname === 'localhost';

console.log('🔥 Firebase Config initialized');
