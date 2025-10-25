/**
 * 手動入力機能モジュール
 * 
 * 機能:
 * - 手動打刻追加（addManualRecord）
 * - 有給休暇登録（addPaidLeave）
 * - 欠勤登録（addAbsence）
 * - 入力検証（validateManualEntry）
 * 
 * 依存関係:
 * - Firebase Firestore SDK
 * - 共通メッセージ表示機能
 * - 認証状態管理
 */

// Firebase SDKからの必要なインポート
import { 
    getFirestore, 
    collection, 
    doc, 
    addDoc, 
    getDocs, 
    Timestamp, 
    serverTimestamp 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

import { 
    getAuth 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

// Firebase インスタンスを取得
const auth = getAuth();
const db = getFirestore();

/**
 * 日付をYYYY-MM-DD形式にフォーマット
 * @param {Date} date - フォーマット対象の日付
 * @returns {string} YYYY-MM-DD形式の文字列
 */
function formatDateForInput(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * メッセージ表示関数
 * @param {string} message - 表示するメッセージ
 * @param {string} type - メッセージタイプ（success/error/info）
 */
function showMessage(message, type = 'success') {
    const messageArea = document.getElementById('messageArea');
    if (messageArea) {
        messageArea.innerHTML = `<div class="message ${type}">${message}</div>`;
        setTimeout(() => { messageArea.innerHTML = ''; }, 5000);
    }
}

/**
 * 従業員一覧を手動入力フォームに読み込み
 * 全ての手動入力用セレクトボックスに従業員リストを設定
 */
export async function loadManualEmployeeList() {
    try {
        const usersSnapshot = await getDocs(collection(db, 'users'));
        const selects = [
            document.getElementById('manualEmployeeSelect'),
            document.getElementById('paidLeaveEmployee'),
            document.getElementById('absenceEmployee')
        ];

        selects.forEach(select => {
            if (select) {
                select.innerHTML = '<option value="">選択してください</option>';
                usersSnapshot.forEach(doc => {
                    const data = doc.data();
                    if (data.displayName || data.email) {
                        const option = document.createElement('option');
                        option.value = doc.id;
                        option.setAttribute('data-name', data.displayName || data.email);
                        option.textContent = data.displayName || data.email;
                        select.appendChild(option);
                    }
                });
            }
        });

        // 初期日付を今日に設定
        const today = formatDateForInput(new Date());
        const dateInputs = ['manualDate', 'paidLeaveDate', 'absenceDate'];
        dateInputs.forEach(inputId => {
            const input = document.getElementById(inputId);
            if (input) {
                input.value = today;
            }
        });

    } catch (error) {
        console.error('従業員一覧読み込みエラー:', error);
        showMessage('❌ 従業員一覧の読み込みに失敗しました', 'error');
    }
}

/**
 * 手動入力の基本的な検証
 * @param {string} userId - ユーザーID
 * @param {string} date - 日付
 * @param {string} time - 時刻（打刻の場合のみ）
 * @returns {object} 検証結果 { isValid: boolean, message: string }
 */
export function validateManualEntry(userId, date, time = null) {
    // 必須項目チェック
    if (!userId) {
        return { isValid: false, message: '従業員を選択してください' };
    }

    if (!date) {
        return { isValid: false, message: '日付を入力してください' };
    }

    // 打刻の場合は時刻も必須
    if (time !== null && !time) {
        return { isValid: false, message: '時刻を入力してください' };
    }

    // 日付の妥当性チェック
    const inputDate = new Date(date);
    if (isNaN(inputDate.getTime())) {
        return { isValid: false, message: '有効な日付を入力してください' };
    }

    // 未来日チェック（1日後まで許可）
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(23, 59, 59, 999);
    
    if (inputDate > tomorrow) {
        return { isValid: false, message: '未来の日付は登録できません' };
    }

    // 過去日チェック（1年前まで許可）
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    
    if (inputDate < oneYearAgo) {
        return { isValid: false, message: '1年以上前の日付は登録できません' };
    }

    return { isValid: true, message: '' };
}

/**
 * 手動打刻の追加
 * 管理者が従業員の打刻を手動で追加する機能
 */
export async function addManualRecord() {
    try {
        const employeeSelect = document.getElementById('manualEmployeeSelect');
        const userId = employeeSelect?.value;
        const userName = employeeSelect?.options[employeeSelect.selectedIndex]?.getAttribute('data-name');
        const date = document.getElementById('manualDate')?.value;
        const type = document.getElementById('manualType')?.value;
        const time = document.getElementById('manualTime')?.value;
        const reason = document.getElementById('manualReason')?.value;

        // 入力検証
        const validation = validateManualEntry(userId, date, time);
        if (!validation.isValid) {
            alert(validation.message);
            return;
        }

        // 現在のユーザー情報を取得
        const currentUser = auth.currentUser;
        if (!currentUser) {
            alert('認証エラー: ログインしてください');
            return;
        }

        // 日時を結合してTimestampオブジェクトを作成
        const timestamp = new Date(`${date}T${time}:00`);

        // 打刻種別の日本語ラベル
        const typeLabels = {
            'clock_in': '出勤',
            'clock_out': '退勤',
            'break_start': '外出',
            'break_end': '戻り'
        };

        // Firestoreに保存するデータ
        const recordData = {
            userId: userId,
            userName: userName,
            type: type,
            timestamp: Timestamp.fromDate(timestamp),
            pcIdentifier: 'Manual Entry',
            isManualEntry: true,
            registeredBy: currentUser.uid,
            registeredByEmail: currentUser.email,
            registeredAt: serverTimestamp(),
            reason: reason || '手動入力',
            // 検索・集計用の追加フィールド
            dateString: date,
            typeLabel: typeLabels[type] || type
        };

        // Firestoreに保存
        await addDoc(collection(db, 'attendance'), recordData);

        showMessage(`✅ ${userName}の${typeLabels[type]}を追加しました`, 'success');

        // フォームをリセット
        document.getElementById('manualTime').value = '';
        document.getElementById('manualReason').value = '';

        // 記録一覧を更新する関数が存在する場合は呼び出し
        if (typeof window.loadAllRecords === 'function') {
            await window.loadAllRecords(true);
        }

    } catch (error) {
        console.error('手動打刻追加エラー:', error);
        showMessage('❌ 追加に失敗しました: ' + error.message, 'error');
    }
}

/**
 * 有給休暇の登録
 * 全休、半休、時間単位の有給休暇を登録
 */
export async function addPaidLeave() {
    try {
        const employeeSelect = document.getElementById('paidLeaveEmployee');
        const userId = employeeSelect?.value;
        const userName = employeeSelect?.options[employeeSelect.selectedIndex]?.getAttribute('data-name');
        const date = document.getElementById('paidLeaveDate')?.value;
        const leaveType = document.getElementById('paidLeaveType')?.value;
        const leaveHours = document.getElementById('paidLeaveHours')?.value;
        const reason = document.getElementById('paidLeaveReason')?.value;

        // 基本入力検証
        const validation = validateManualEntry(userId, date);
        if (!validation.isValid) {
            alert(validation.message);
            return;
        }

        // 時間単位の場合の追加検証
        if (leaveType === 'hourly') {
            if (!leaveHours || parseFloat(leaveHours) <= 0) {
                alert('時間数を正しく入力してください');
                return;
            }
            if (parseFloat(leaveHours) > 8) {
                alert('時間単位有給は1日最大8時間までです');
                return;
            }
        }

        // 現在のユーザー情報を取得
        const currentUser = auth.currentUser;
        if (!currentUser) {
            alert('認証エラー: ログインしてください');
            return;
        }

        // 控除日数を計算
        let deduction = 0;
        let displayHours = null;
        
        switch (leaveType) {
            case 'full_day':
                deduction = 1.0;
                break;
            case 'half_day_am':
            case 'half_day_pm':
                deduction = 0.5;
                break;
            case 'hourly':
                const hours = parseFloat(leaveHours);
                deduction = hours / 8; // 8時間を1日とする
                displayHours = hours;
                break;
        }

        // 基準時刻を設定（午前9時）
        const timestamp = new Date(`${date}T09:00:00`);

        // 有給休暇タイプの日本語ラベル
        const typeLabels = {
            'full_day': '全休',
            'half_day_am': '午前半休',
            'half_day_pm': '午後半休',
            'hourly': '時間単位'
        };

        // Firestoreに保存するデータ
        const paidLeaveData = {
            userId: userId,
            userName: userName,
            type: 'paid_leave',
            leaveType: leaveType,
            leaveTypeLabel: typeLabels[leaveType],
            deduction: deduction,
            hours: displayHours,
            timestamp: Timestamp.fromDate(timestamp),
            isManualEntry: true,
            registeredBy: currentUser.uid,
            registeredByEmail: currentUser.email,
            registeredAt: serverTimestamp(),
            reason: reason || '有給休暇',
            // 検索・集計用の追加フィールド
            dateString: date,
            category: 'leave'
        };

        // Firestoreに保存
        await addDoc(collection(db, 'attendance'), paidLeaveData);

        // 成功メッセージの生成
        let successMessage = `✅ ${userName}の有給休暇を登録しました（${typeLabels[leaveType]}`;
        if (displayHours) {
            successMessage += `：${displayHours}時間`;
        }
        successMessage += '）';

        showMessage(successMessage, 'success');

        // フォームをリセット
        document.getElementById('paidLeaveType').value = 'full_day';
        document.getElementById('paidLeaveHours').value = '';
        document.getElementById('paidLeaveReason').value = '';
        const hoursGroup = document.getElementById('paidLeaveHoursGroup');
        if (hoursGroup) {
            hoursGroup.style.display = 'none';
        }

    } catch (error) {
        console.error('有給休暇登録エラー:', error);
        showMessage('❌ 登録に失敗しました: ' + error.message, 'error');
    }
}

/**
 * 欠勤の登録
 * 従業員の欠勤を記録
 */
export async function addAbsence() {
    try {
        const employeeSelect = document.getElementById('absenceEmployee');
        const userId = employeeSelect?.value;
        const userName = employeeSelect?.options[employeeSelect.selectedIndex]?.getAttribute('data-name');
        const date = document.getElementById('absenceDate')?.value;
        const reason = document.getElementById('absenceReason')?.value;

        // 入力検証
        const validation = validateManualEntry(userId, date);
        if (!validation.isValid) {
            alert(validation.message);
            return;
        }

        // 現在のユーザー情報を取得
        const currentUser = auth.currentUser;
        if (!currentUser) {
            alert('認証エラー: ログインしてください');
            return;
        }

        // 基準時刻を設定（午前9時）
        const timestamp = new Date(`${date}T09:00:00`);

        // Firestoreに保存するデータ
        const absenceData = {
            userId: userId,
            userName: userName,
            type: 'absence',
            timestamp: Timestamp.fromDate(timestamp),
            isManualEntry: true,
            registeredBy: currentUser.uid,
            registeredByEmail: currentUser.email,
            registeredAt: serverTimestamp(),
            reason: reason || '欠勤',
            // 検索・集計用の追加フィールド
            dateString: date,
            category: 'absence'
        };

        // Firestoreに保存
        await addDoc(collection(db, 'attendance'), absenceData);

        showMessage(`✅ ${userName}の欠勤を登録しました`, 'success');

        // フォームをリセット
        document.getElementById('absenceReason').value = '';

    } catch (error) {
        console.error('欠勤登録エラー:', error);
        showMessage('❌ 登録に失敗しました: ' + error.message, 'error');
    }
}

/**
 * 有給休暇タイプ選択時の表示制御
 * 時間単位選択時に時間数入力欄を表示
 */
function initializePaidLeaveTypeHandler() {
    const paidLeaveTypeSelect = document.getElementById('paidLeaveType');
    const paidLeaveHoursGroup = document.getElementById('paidLeaveHoursGroup');

    if (paidLeaveTypeSelect && paidLeaveHoursGroup) {
        paidLeaveTypeSelect.addEventListener('change', function() {
            if (this.value === 'hourly') {
                paidLeaveHoursGroup.style.display = 'block';
                const hoursInput = document.getElementById('paidLeaveHours');
                if (hoursInput) {
                    hoursInput.focus();
                }
            } else {
                paidLeaveHoursGroup.style.display = 'none';
                document.getElementById('paidLeaveHours').value = '';
            }
        });
    }
}

/**
 * モジュール初期化
 * DOMContentLoaded時に各種イベントハンドラを設定
 */
export function initializeManualModule() {
    // DOM読み込み完了後に初期化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initializePaidLeaveTypeHandler();
            loadManualEmployeeList();
        });
    } else {
        initializePaidLeaveTypeHandler();
        loadManualEmployeeList();
    }
}

// グローバル関数として公開（HTMLから呼び出せるように）
window.addManualRecord = addManualRecord;
window.addPaidLeave = addPaidLeave;
window.addAbsence = addAbsence;
window.loadManualEmployeeList = loadManualEmployeeList;
