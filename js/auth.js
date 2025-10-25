/**
 * 認証処理モジュール
 * - Google OAuth認証
 * - 管理者権限チェック
 * - ログイン/ログアウト管理
 */

import {
    signInWithPopup,
    GoogleAuthProvider,
    signOut,
    onAuthStateChanged,
    setPersistence,
    browserLocalPersistence
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { auth, db, APP_CONFIG } from './config.js';
import { showNotification } from './utils.js';

/**
 * 現在のユーザー情報
 * @type {Object|null}
 */
let currentUser = null;

/**
 * 認証状態変更のコールバック
 * @type {Function[]}
 */
const authCallbacks = [];

/**
 * 認証初期化
 * アプリケーション起動時に実行
 */
export function initAuth() {
    return new Promise(async (resolve, reject) => {
        console.log('🔐 Initializing authentication...');

        // ログイン状態をブラウザに永続化（リロード・タブを閉じても維持）
        try {
            await setPersistence(auth, browserLocalPersistence);
            console.log('✅ Auth persistence enabled (browserLocalPersistence)');
        } catch (error) {
            console.error('⚠️ Failed to set persistence:', error);
        }

        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            try {
                if (user) {
                    console.log('👤 User authenticated:', user.email);
                    
                    // ユーザー情報をFirestoreに保存/更新
                    await saveUserInfo(user);
                    
                    // 管理者権限チェック
                    const isAdmin = await checkAdminRole(user);
                    
                    currentUser = {
                        uid: user.uid,
                        email: user.email,
                        displayName: user.displayName,
                        photoURL: user.photoURL,
                        isAdmin: isAdmin
                    };
                    
                    // UI更新
                    updateUserInfo();
                    
                    if (isAdmin) {
                        showApp();
                        showNotification('管理者としてログインしました', 'success');
                    } else {
                        showAccessDenied();
                        showNotification('管理者権限がありません', 'error');
                    }
                } else {
                    console.log('❌ User not authenticated');
                    currentUser = null;
                    showLoginPrompt();
                }
                
                // コールバック実行
                authCallbacks.forEach(callback => callback(currentUser));
                
                hideLoading();
                resolve(currentUser);
                
            } catch (error) {
                console.error('❌ Authentication error:', error);
                hideLoading();
                showNotification('認証エラーが発生しました', 'error');
                reject(error);
            }
        });
    });
}

/**
 * Googleアカウントでログイン
 */
export async function loginWithGoogle() {
    try {
        console.log('🔐 Attempting Google login...');
        showLoading();
        
        const provider = new GoogleAuthProvider();
        provider.addScope('email');
        provider.addScope('profile');
        
        const result = await signInWithPopup(auth, provider);
        console.log('✅ Google login successful:', result.user.email);
        
        return result.user;
        
    } catch (error) {
        console.error('❌ Google login failed:', error);
        hideLoading();
        
        let message = 'ログインに失敗しました';
        if (error.code === 'auth/popup-closed-by-user') {
            message = 'ログインがキャンセルされました';
        } else if (error.code === 'auth/popup-blocked') {
            message = 'ポップアップがブロックされました';
        }
        
        showNotification(message, 'error');
        throw error;
    }
}

/**
 * ログアウト
 */
export async function logout() {
    try {
        console.log('🔐 Logging out...');
        showLoading();
        
        await signOut(auth);
        currentUser = null;
        
        console.log('✅ Logout successful');
        showNotification('ログアウトしました', 'success');
        
        // ページをリロードして初期状態に戻す
        setTimeout(() => {
            window.location.reload();
        }, 1000);
        
    } catch (error) {
        console.error('❌ Logout failed:', error);
        hideLoading();
        showNotification('ログアウトに失敗しました', 'error');
    }
}

/**
 * 管理者権限チェック
 * @param {Object} user - Firebase User オブジェクト
 * @returns {Promise<boolean>} 管理者権限の有無
 */
export async function checkAdminRole(user) {
    try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        
        if (!userDoc.exists()) {
            console.log('⚠️ User document not found, checking email domain...');
            
            // 管理者メールアドレスのドメインチェック（フォールバック）
            const adminDomains = ['admin.company.com', 'management.company.com'];
            const emailDomain = user.email.split('@')[1];
            
            return adminDomains.includes(emailDomain);
        }
        
        const userData = userDoc.data();
        const role = userData.role || 'employee';
        
        console.log(`👤 User role: ${role}`);
        return APP_CONFIG.ADMIN_ROLES.includes(role);
        
    } catch (error) {
        console.error('❌ Admin role check failed:', error);
        return false;
    }
}

/**
 * ユーザー情報をFirestoreに保存
 * @param {Object} user - Firebase User オブジェクト
 */
async function saveUserInfo(user) {
    try {
        const userRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userRef);
        
        const userData = {
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
            lastLogin: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        if (!userDoc.exists()) {
            // 新規ユーザーの場合はデフォルト値を設定
            userData.role = 'employee';
            userData.createdAt = new Date().toISOString();
            userData.isActive = true;
        }
        
        await setDoc(userRef, userData, { merge: true });
        console.log('✅ User info saved to Firestore');
        
    } catch (error) {
        console.error('❌ Failed to save user info:', error);
    }
}

/**
 * 認証状態変更コールバックを追加
 * @param {Function} callback - コールバック関数
 */
export function onAuthChange(callback) {
    authCallbacks.push(callback);
}

/**
 * 現在のユーザー情報を取得
 * @returns {Object|null} ユーザー情報
 */
export function getCurrentUser() {
    return currentUser;
}

/**
 * UI更新: ユーザー情報表示
 */
function updateUserInfo() {
    const userInfoEl = document.getElementById('userInfo');
    if (userInfoEl && currentUser) {
        userInfoEl.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <img src="${currentUser.photoURL || '/default-avatar.png'}" 
                     alt="プロフィール" 
                     style="width: 32px; height: 32px; border-radius: 50%;">
                <div>
                    <div style="font-weight: bold; color: #333;">
                        ${currentUser.displayName || currentUser.email}
                    </div>
                    <div style="font-size: 12px; color: #666;">
                        管理者
                    </div>
                </div>
            </div>
        `;
    }
}

/**
 * UI制御: アプリ表示
 */
function showApp() {
    document.getElementById('app').style.display = 'block';
    document.getElementById('accessDenied').style.display = 'none';
}

/**
 * UI制御: アクセス拒否表示
 */
function showAccessDenied() {
    document.getElementById('app').style.display = 'none';
    document.getElementById('accessDenied').style.display = 'block';
}

/**
 * UI制御: ログインプロンプト表示
 */
function showLoginPrompt() {
    document.getElementById('app').style.display = 'none';
    document.getElementById('accessDenied').innerHTML = `
        <div class="card" style="max-width: 600px; margin: 0 auto;">
            <h2 style="color: #667eea; margin-bottom: 20px;">👥 管理者ログイン</h2>
            <p style="margin-bottom: 25px;">管理者画面にアクセスするにはログインが必要です。</p>
            <button class="button button-primary" onclick="loginWithGoogle()">
                🔐 Googleアカウントでログイン
            </button>
        </div>
    `;
    document.getElementById('accessDenied').style.display = 'block';
}

/**
 * UI制御: ローディング表示
 */
function showLoading() {
    document.getElementById('loading').style.display = 'flex';
}

/**
 * UI制御: ローディング非表示
 */
function hideLoading() {
    document.getElementById('loading').style.display = 'none';
}

// グローバル関数として登録（HTML側から呼び出し可能にする）
window.loginWithGoogle = loginWithGoogle;
window.logout = logout;

console.log('🔐 Auth module loaded');
