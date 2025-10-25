/**
 * 認証モジュール - 従業員タイムカード用
 *
 * 機能:
 * - Googleログイン
 * - ログアウト
 * - ユーザー情報管理
 * - 認証状態監視
 */

import {
    getAuth,
    GoogleAuthProvider,
    signInWithPopup,
    signOut,
    onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

import {
    getFirestore,
    doc,
    getDoc,
    setDoc,
    serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Firebase インスタンスを取得
const auth = getAuth();
const db = getFirestore();
const provider = new GoogleAuthProvider();

// 現在のユーザー
let currentUser = null;

/**
 * 現在のユーザーを取得
 * @returns {Object|null} 現在のユーザー
 */
export function getCurrentUser() {
    return currentUser;
}

/**
 * メッセージ表示
 * @param {string} message - メッセージ
 * @param {string} type - タイプ (success/error/info)
 */
function showMessage(message, type = 'success') {
    const messageArea = document.getElementById('messageArea');
    if (messageArea) {
        messageArea.innerHTML = `<div class="message ${type}">${message}</div>`;
        setTimeout(() => {
            messageArea.innerHTML = '';
        }, 5000);
    }
}

/**
 * Googleログイン処理
 */
export async function handleLogin() {
    try {
        const result = await signInWithPopup(auth, provider);
        console.log('ログイン成功:', result.user.email);
        return result.user;
    } catch (error) {
        console.error('ログインエラー:', error);
        showMessage('ログインに失敗しました', 'error');
        throw error;
    }
}

/**
 * ログアウト処理
 * @param {Function} workTimeStopCallback - 勤務時間更新停止コールバック
 */
export async function handleLogout(workTimeStopCallback) {
    try {
        await signOut(auth);
        showMessage('ログアウトしました', 'success');
        if (workTimeStopCallback) {
            workTimeStopCallback();
        }
    } catch (error) {
        console.error('ログアウトエラー:', error);
        showMessage('ログアウトに失敗しました', 'error');
        throw error;
    }
}

/**
 * ユーザー情報をFirestoreに保存
 * @param {Object} user - Firebaseユーザー
 * @param {string} pcInfo - PC識別情報
 */
async function saveUserInfo(user, pcInfo) {
    try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));

        if (!userDoc.exists()) {
            await setDoc(doc(db, 'users', user.uid), {
                email: user.email,
                userName: user.displayName,
                userId: user.uid,
                role: 'employee',
                registeredPCs: [pcInfo],
                createdAt: serverTimestamp()
            });
            console.log('新規ユーザー情報を保存しました');
        }
    } catch (error) {
        console.error('ユーザー情報保存エラー:', error);
        throw error;
    }
}

/**
 * UI表示を更新
 * @param {Object} user - Firebaseユーザー
 */
function updateUI(user) {
    const loadingEl = document.getElementById('loading');
    const loginContainer = document.getElementById('loginContainer');
    const appContainer = document.getElementById('appContainer');
    const userPhoto = document.getElementById('userPhoto');
    const userName = document.getElementById('userName');
    const userEmail = document.getElementById('userEmail');

    if (loadingEl) loadingEl.style.display = 'none';

    if (user) {
        // ログイン済み
        if (userPhoto) userPhoto.src = user.photoURL || 'https://via.placeholder.com/80';
        if (userName) userName.textContent = user.displayName || 'ユーザー';
        if (userEmail) userEmail.textContent = user.email;

        if (loginContainer) loginContainer.style.display = 'none';
        if (appContainer) appContainer.style.display = 'block';
    } else {
        // 未ログイン
        if (loginContainer) loginContainer.style.display = 'block';
        if (appContainer) appContainer.style.display = 'none';
    }
}

/**
 * 認証状態の監視を開始
 * @param {Function} onAuthSuccess - 認証成功時のコールバック
 * @param {Function} onAuthFailure - 認証失敗時のコールバック
 */
export function initAuthStateObserver(onAuthSuccess, onAuthFailure) {
    onAuthStateChanged(auth, async (user) => {
        updateUI(user);

        if (user) {
            currentUser = user;

            // PC識別情報を取得
            const pcInfo = window.generatePCIdentifier ? window.generatePCIdentifier() : 'Unknown PC';

            // ユーザー情報を保存
            try {
                await saveUserInfo(user, pcInfo);
            } catch (error) {
                console.error('ユーザー情報取得エラー:', error);
            }

            // 認証成功コールバック
            if (onAuthSuccess) {
                onAuthSuccess(user);
            }
        } else {
            currentUser = null;

            // 認証失敗コールバック
            if (onAuthFailure) {
                onAuthFailure();
            }
        }
    });
}

/**
 * 認証モジュールの初期化
 * @param {Function} onAuthSuccess - 認証成功時のコールバック
 * @param {Function} onAuthFailure - 認証失敗時のコールバック
 */
export function initializeAuthModule(onAuthSuccess, onAuthFailure) {
    // ログインボタン
    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) {
        loginBtn.addEventListener('click', handleLogin);
    }

    // ログアウトボタン
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => handleLogout(onAuthFailure));
    }

    // 認証状態の監視
    initAuthStateObserver(onAuthSuccess, onAuthFailure);

    console.log('🔐 Auth module initialized');
}
