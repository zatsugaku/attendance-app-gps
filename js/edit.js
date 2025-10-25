/**
 * レコード編集機能モジュール
 * - 打刻記録の編集（日時変更）
 * - 編集履歴の保存
 * - モーダルUIの管理
 */

import {
    doc,
    getDoc,
    setDoc,
    addDoc,
    deleteDoc,
    collection,
    serverTimestamp,
    Timestamp
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { db } from './config.js';
import { showNotification } from './utils.js';

/**
 * 現在編集中のレコードID
 * @type {string|null}
 */
let currentEditRecordId = null;

/**
 * 現在のユーザー情報（auth.jsから設定される）
 * @type {Object|null}
 */
let currentUser = null;

/**
 * レコード再読み込み用コールバック
 * @type {Function|null}
 */
let reloadRecordsCallback = null;

/**
 * 編集モジュールの初期化
 * @param {Object} user - 現在のユーザー情報
 * @param {Function} reloadCallback - レコード再読み込み用コールバック関数
 */
export function initializeEditModule(user, reloadCallback) {
    currentUser = user;
    reloadRecordsCallback = reloadCallback;

    // グローバル関数として登録（HTML側から呼び出し可能にする）
    window.editRecord = editRecord;
    window.closeEditModal = closeEditModal;
    window.saveEdit = saveEdit;
    window.deleteFromEditModal = deleteFromEditModal;

    // 統合編集モーダル用のグローバル関数
    window.openUnifiedEditModal = openUnifiedEditModal;
    window.closeUnifiedEditModal = closeUnifiedEditModal;
    window.saveUnifiedRecord = saveUnifiedRecord;
    window.deleteUnifiedRecord = deleteUnifiedRecord;
    window.addRecordFromUnifiedModal = addRecordFromUnifiedModal;

    console.log('✏️ Edit module initialized');
}

/**
 * 日付をinput[type="date"]用にフォーマット
 * @param {Date} date - フォーマットする日付
 * @returns {string} YYYY-MM-DD形式の文字列
 */
function formatDateForInput(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * レコード編集モーダルを開く
 * @param {string} recordId - 編集するレコードのID
 * @param {string} userName - ユーザー名
 * @param {string} typeLabel - 種別ラベル（出勤、退勤など）
 * @param {string} isoTimestamp - ISO形式のタイムスタンプ
 */
async function editRecord(recordId, userName, typeLabel, isoTimestamp) {
    try {
        currentEditRecordId = recordId;

        // 元のレコードを取得
        const recordDoc = await getDoc(doc(db, 'attendance', recordId));
        if (!recordDoc.exists()) {
            alert('レコードが見つかりません');
            return;
        }

        const recordData = recordDoc.data();
        const timestamp = recordData.timestamp.toDate();

        // モーダルに値をセット
        document.getElementById('editUserName').textContent = userName;
        document.getElementById('editType').textContent = typeLabel;
        document.getElementById('editCurrentTime').textContent = timestamp.toLocaleString('ja-JP');

        // 日付と時刻をフォームにセット
        document.getElementById('editDate').value = formatDateForInput(timestamp);
        const hours = String(timestamp.getHours()).padStart(2, '0');
        const minutes = String(timestamp.getMinutes()).padStart(2, '0');
        document.getElementById('editTime').value = `${hours}:${minutes}`;

        // モーダルを表示
        document.getElementById('editModal').style.display = 'flex';

    } catch (error) {
        console.error('編集モーダル表示エラー:', error);
        alert('編集画面の表示に失敗しました: ' + error.message);
    }
}

/**
 * 編集モーダルを閉じる
 */
function closeEditModal() {
    document.getElementById('editModal').style.display = 'none';
    document.getElementById('editReason').value = '';
    document.getElementById('editMessageArea').innerHTML = '';
    currentEditRecordId = null;
}

/**
 * 編集を保存
 */
async function saveEdit() {
    try {
        const newDate = document.getElementById('editDate').value;
        const newTime = document.getElementById('editTime').value;
        const reason = document.getElementById('editReason').value;

        if (!newDate || !newTime) {
            alert('日付と時刻を入力してください');
            return;
        }

        if (!reason || reason.trim() === '') {
            alert('変更理由を入力してください');
            return;
        }

        if (!currentEditRecordId) {
            alert('編集対象のレコードが見つかりません');
            return;
        }

        // 元のレコードを取得
        const recordDoc = await getDoc(doc(db, 'attendance', currentEditRecordId));
        if (!recordDoc.exists()) {
            alert('レコードが見つかりません');
            return;
        }

        const originalData = recordDoc.data();

        // 変更履歴を保存（attendance_historyコレクション）
        const historyData = {
            originalRecordId: currentEditRecordId,
            originalData: originalData,
            modifiedBy: currentUser.uid,
            modifiedByEmail: currentUser.email,
            modifiedAt: serverTimestamp(),
            modificationReason: reason
        };

        await addDoc(collection(db, 'attendance_history'), historyData);

        // 新しいタイムスタンプを作成
        const newTimestamp = new Date(`${newDate}T${newTime}:00`);

        // レコードを更新
        await setDoc(doc(db, 'attendance', currentEditRecordId), {
            ...originalData,
            timestamp: Timestamp.fromDate(newTimestamp),
            lastModifiedBy: currentUser.uid,
            lastModifiedByEmail: currentUser.email,
            lastModifiedAt: serverTimestamp(),
            lastModificationReason: reason
        });

        // モーダルメッセージ表示
        const editMessageArea = document.getElementById('editMessageArea');
        editMessageArea.innerHTML = '<div class="message success">✅ 変更を保存しました</div>';

        setTimeout(async () => {
            closeEditModal();

            // レコード再読み込み
            if (reloadRecordsCallback) {
                await reloadRecordsCallback(true);
            }

            showNotification('✅ 打刻時刻を編集しました', 'success');
        }, 1500);

    } catch (error) {
        console.error('編集保存エラー:', error);
        const editMessageArea = document.getElementById('editMessageArea');
        editMessageArea.innerHTML = `<div class="message error">❌ 保存に失敗しました: ${error.message}</div>`;
    }
}

/**
 * 編集モーダルから削除を実行
 */
async function deleteFromEditModal() {
    if (!currentEditRecordId) {
        alert('削除対象のレコードが見つかりません');
        return;
    }

    try {
        // 元のレコードを取得して確認用情報を表示
        const recordDoc = await getDoc(doc(db, 'attendance', currentEditRecordId));
        if (!recordDoc.exists()) {
            alert('レコードが見つかりません');
            return;
        }

        const recordData = recordDoc.data();
        const userName = document.getElementById('editUserName').textContent;
        const typeLabel = document.getElementById('editType').textContent;
        const timestamp = recordData.timestamp.toDate();
        const dateTimeStr = timestamp.toLocaleString('ja-JP');

        // 確認ダイアログ
        const confirmMessage = `本当に削除しますか？\n\n従業員: ${userName}\n種別: ${typeLabel}\n日時: ${dateTimeStr}`;
        if (!confirm(confirmMessage)) {
            return;
        }

        // 削除履歴を保存（attendance_historyコレクション）
        const historyData = {
            originalRecordId: currentEditRecordId,
            originalData: recordData,
            deletedBy: currentUser.uid,
            deletedByEmail: currentUser.email,
            deletedAt: serverTimestamp(),
            action: 'delete'
        };

        await addDoc(collection(db, 'attendance_history'), historyData);

        // レコードを削除
        await deleteDoc(doc(db, 'attendance', currentEditRecordId));

        // モーダルメッセージ表示
        const editMessageArea = document.getElementById('editMessageArea');
        editMessageArea.innerHTML = '<div class="message success">✅ 記録を削除しました</div>';

        setTimeout(async () => {
            closeEditModal();

            // レコード再読み込み
            if (reloadRecordsCallback) {
                await reloadRecordsCallback(true);
            }

            showNotification('✅ 打刻記録を削除しました', 'success');
        }, 1500);

    } catch (error) {
        console.error('削除エラー:', error);
        const editMessageArea = document.getElementById('editMessageArea');
        editMessageArea.innerHTML = `<div class="message error">❌ 削除に失敗しました: ${error.message}</div>`;
    }
}

/**
 * 現在のユーザー情報を更新
 * @param {Object} user - ユーザー情報
 */
export function setCurrentUser(user) {
    currentUser = user;
}

// ========================================
// 統合編集モーダル関連
// ========================================

/**
 * 現在編集中の日付とユーザー情報
 * @type {Object|null}
 */
let currentUnifiedEditData = null;

/**
 * 種別ラベルマッピング
 */
const TYPE_LABELS = {
    'clock_in': '出勤',
    'clock_out': '退勤',
    'break_start': '外出',
    'break_end': '戻り'
};

/**
 * 統合編集モーダルを開く
 * @param {Object} data - 全レコードデータ（date, userName, userId, clockIn, clockOut, breakStart, breakEnd）
 */
async function openUnifiedEditModal(data) {
    try {
        currentUnifiedEditData = data;

        // タイトル設定
        const title = `📋 ${data.date} - ${data.userName}`;
        document.getElementById('unifiedEditTitle').textContent = title;

        // レコード一覧を生成
        const recordsList = document.getElementById('unifiedEditRecordsList');
        recordsList.innerHTML = generateRecordsList(data);

        // モーダル表示
        document.getElementById('unifiedEditModal').style.display = 'flex';

    } catch (error) {
        console.error('統合編集モーダル表示エラー:', error);
        alert('編集画面の表示に失敗しました: ' + error.message);
    }
}

/**
 * レコード一覧HTMLを生成
 * @param {Object} data - レコードデータ
 * @returns {string} HTML文字列
 */
function generateRecordsList(data) {
    let html = '<div style="display: flex; flex-direction: column; gap: 15px;">';

    const recordTypes = [
        { key: 'clockIn', type: 'clock_in' },
        { key: 'clockOut', type: 'clock_out' },
        { key: 'breakStart', type: 'break_start' },
        { key: 'breakEnd', type: 'break_end' }
    ];

    recordTypes.forEach(({ key, type }) => {
        const record = data[key];
        const label = TYPE_LABELS[type];

        if (record) {
            // 既存レコードの場合
            const time = new Date(record.time);
            const timeStr = time.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
            const recordIdEscaped = record.id.replace(/'/g, "\\'");

            html += `
                <div style="border: 1px solid #e0e0e0; border-radius: 8px; padding: 15px; background: #f9f9f9;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <div>
                            <strong style="color: #667eea; font-size: 16px;">${label}</strong>
                            <span style="margin-left: 10px; font-size: 14px; color: #666;" id="unified_time_${type}">${timeStr}</span>
                        </div>
                        <button class="button button-danger button-small" onclick="deleteUnifiedRecord('${recordIdEscaped}', '${type}')">
                            🗑️ 削除
                        </button>
                    </div>
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <input type="time" id="unified_edit_${type}" value="${time.toTimeString().slice(0, 5)}" style="flex: 1;">
                        <button class="button button-primary button-small" onclick="saveUnifiedRecord('${recordIdEscaped}', '${type}')">
                            💾 保存
                        </button>
                    </div>
                </div>
            `;
        } else {
            // レコードが存在しない場合
            html += `
                <div style="border: 1px dashed #ccc; border-radius: 8px; padding: 15px; background: #fafafa;">
                    <div style="color: #999; font-size: 14px;">
                        ${label}: 未打刻
                    </div>
                </div>
            `;
        }
    });

    html += '</div>';
    return html;
}

/**
 * 個別レコードを保存
 * @param {string} recordId - レコードID
 * @param {string} type - レコード種別
 */
async function saveUnifiedRecord(recordId, type) {
    try {
        const newTime = document.getElementById(`unified_edit_${type}`).value;

        if (!newTime) {
            alert('時刻を入力してください');
            return;
        }

        const reason = prompt('変更理由を入力してください:');
        if (!reason || reason.trim() === '') {
            alert('変更理由を入力してください');
            return;
        }

        // 元のレコードを取得
        const recordDoc = await getDoc(doc(db, 'attendance', recordId));
        if (!recordDoc.exists()) {
            alert('レコードが見つかりません');
            return;
        }

        const originalData = recordDoc.data();

        // 変更履歴を保存
        const historyData = {
            originalRecordId: recordId,
            originalData: originalData,
            modifiedBy: currentUser.uid,
            modifiedByEmail: currentUser.email,
            modifiedAt: serverTimestamp(),
            modificationReason: reason
        };

        await addDoc(collection(db, 'attendance_history'), historyData);

        // 新しいタイムスタンプを作成（日付は元のまま、時刻のみ変更）
        const originalTimestamp = originalData.timestamp.toDate();
        const [hours, minutes] = newTime.split(':');
        const newTimestamp = new Date(originalTimestamp);
        newTimestamp.setHours(parseInt(hours), parseInt(minutes), 0, 0);

        // レコードを更新
        await setDoc(doc(db, 'attendance', recordId), {
            ...originalData,
            timestamp: Timestamp.fromDate(newTimestamp),
            lastModifiedBy: currentUser.uid,
            lastModifiedByEmail: currentUser.email,
            lastModifiedAt: serverTimestamp(),
            lastModificationReason: reason
        });

        // 表示を更新
        const timeStr = newTimestamp.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
        document.getElementById(`unified_time_${type}`).textContent = timeStr;

        showNotification(`✅ ${TYPE_LABELS[type]}を更新しました`, 'success');

        // データを更新
        currentUnifiedEditData[getKeyFromType(type)].time = newTimestamp.toISOString();

    } catch (error) {
        console.error('保存エラー:', error);
        alert(`保存に失敗しました: ${error.message}`);
    }
}

/**
 * 個別レコードを削除
 * @param {string} recordId - レコードID
 * @param {string} type - レコード種別
 */
async function deleteUnifiedRecord(recordId, type) {
    try {
        const recordDoc = await getDoc(doc(db, 'attendance', recordId));
        if (!recordDoc.exists()) {
            alert('レコードが見つかりません');
            return;
        }

        const recordData = recordDoc.data();
        const timestamp = recordData.timestamp.toDate();
        const dateTimeStr = timestamp.toLocaleString('ja-JP');

        const confirmMessage = `本当に削除しますか？\n\n種別: ${TYPE_LABELS[type]}\n日時: ${dateTimeStr}`;
        if (!confirm(confirmMessage)) {
            return;
        }

        // 削除履歴を保存
        const historyData = {
            originalRecordId: recordId,
            originalData: recordData,
            deletedBy: currentUser.uid,
            deletedByEmail: currentUser.email,
            deletedAt: serverTimestamp(),
            action: 'delete'
        };

        await addDoc(collection(db, 'attendance_history'), historyData);

        // レコードを削除
        await deleteDoc(doc(db, 'attendance', recordId));

        showNotification(`✅ ${TYPE_LABELS[type]}を削除しました`, 'success');

        // データを更新してモーダルを再描画
        currentUnifiedEditData[getKeyFromType(type)] = null;
        document.getElementById('unifiedEditRecordsList').innerHTML = generateRecordsList(currentUnifiedEditData);

    } catch (error) {
        console.error('削除エラー:', error);
        alert(`削除に失敗しました: ${error.message}`);
    }
}

/**
 * 新規レコードを追加
 */
async function addRecordFromUnifiedModal() {
    try {
        const type = document.getElementById('unifiedAddType').value;
        const time = document.getElementById('unifiedAddTime').value;

        if (!time) {
            alert('時刻を入力してください');
            return;
        }

        if (!currentUnifiedEditData) {
            alert('編集データが見つかりません');
            return;
        }

        // 既に同じ種別のレコードが存在するか確認
        const key = getKeyFromType(type);
        if (currentUnifiedEditData[key]) {
            alert(`${TYPE_LABELS[type]}は既に存在します。既存のレコードを編集または削除してください。`);
            return;
        }

        // タイムスタンプを作成
        const [hours, minutes] = time.split(':');
        const timestamp = new Date(currentUnifiedEditData.date);
        timestamp.setHours(parseInt(hours), parseInt(minutes), 0, 0);

        // 新規レコードを作成
        const newRecord = {
            userId: currentUnifiedEditData.userId,
            userName: currentUnifiedEditData.userName,
            type: type,
            timestamp: Timestamp.fromDate(timestamp),
            createdAt: serverTimestamp(),
            createdBy: currentUser.uid,
            createdByEmail: currentUser.email
        };

        const docRef = await addDoc(collection(db, 'attendance'), newRecord);

        showNotification(`✅ ${TYPE_LABELS[type]}を追加しました`, 'success');

        // データを更新してモーダルを再描画
        currentUnifiedEditData[key] = {
            id: docRef.id,
            time: timestamp.toISOString()
        };
        document.getElementById('unifiedEditRecordsList').innerHTML = generateRecordsList(currentUnifiedEditData);

        // フォームをリセット
        document.getElementById('unifiedAddTime').value = '';

    } catch (error) {
        console.error('追加エラー:', error);
        alert(`追加に失敗しました: ${error.message}`);
    }
}

/**
 * 統合編集モーダルを閉じる
 */
async function closeUnifiedEditModal() {
    document.getElementById('unifiedEditModal').style.display = 'none';
    document.getElementById('unifiedEditMessageArea').innerHTML = '';
    document.getElementById('unifiedAddTime').value = '';
    currentUnifiedEditData = null;

    // レコード再読み込み
    if (reloadRecordsCallback) {
        await reloadRecordsCallback(true);
    }
}

/**
 * type から key を取得
 * @param {string} type - レコード種別
 * @returns {string} キー名
 */
function getKeyFromType(type) {
    const mapping = {
        'clock_in': 'clockIn',
        'clock_out': 'clockOut',
        'break_start': 'breakStart',
        'break_end': 'breakEnd'
    };
    return mapping[type];
}

console.log('✏️ Edit module loaded');
