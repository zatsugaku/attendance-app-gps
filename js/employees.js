/**
 * Employees Module - 従業員管理
 * @description 従業員一覧表示・勤務時間設定
 * @requires config.js - Firebase設定
 * @requires utils.js - 共通関数
 */

import { db } from './config.js';
import { showNotification } from './utils.js';
import { collection, getDocs, doc, updateDoc, Timestamp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

/**
 * 従業員管理クラス
 */
class EmployeesManager {
    constructor() {
        this.employees = [];
        this.currentEditingEmployee = null;
        this.defaultSettings = null;
    }

    /**
     * 従業員管理モジュール初期化
     */
    async init(defaultSettings) {
        this.defaultSettings = defaultSettings;
        await this.loadEmployees();
        this.render();
    }

    /**
     * 従業員一覧を読み込み
     */
    async loadEmployees() {
        try {
            const usersSnapshot = await getDocs(collection(db, 'users'));
            this.employees = [];

            usersSnapshot.forEach(doc => {
                const data = doc.data();
                this.employees.push({
                    uid: doc.id,
                    displayName: data.displayName || data.userName || data.email,
                    email: data.email,
                    startTime: data.startTime || this.defaultSettings?.startTime || '09:00',
                    endTime: data.endTime || this.defaultSettings?.endTime || '18:00',
                    breakTime: data.breakTime || this.defaultSettings?.breakTime || 60,
                    standardWorkTime: data.standardWorkTime || this.defaultSettings?.standardWorkTime || 8,
                    role: data.role || 'employee'
                });
            });

            // 名前順でソート
            this.employees.sort((a, b) => a.displayName.localeCompare(b.displayName, 'ja'));

            console.log('✅ 従業員データを読み込みました:', this.employees.length, '件');

        } catch (error) {
            console.error('従業員データ読み込みエラー:', error);
            showNotification('従業員データの読み込みに失敗しました', 'error');
        }
    }

    /**
     * 従業員一覧を表示
     */
    render() {
        const tbody = document.getElementById('employeesTableBody');
        if (!tbody) return;

        if (this.employees.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 30px; color: #999;">
                        従業員がいません
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = this.employees.map(emp => `
            <tr>
                <td>${emp.displayName}</td>
                <td>${emp.email}</td>
                <td>${emp.startTime || '<span style="color: #999;">未設定</span>'}</td>
                <td>${emp.endTime || '<span style="color: #999;">未設定</span>'}</td>
                <td>${emp.breakTime ? `${emp.breakTime}分` : '<span style="color: #999;">未設定</span>'}</td>
                <td>${emp.standardWorkTime ? `${emp.standardWorkTime}時間` : '<span style="color: #999;">未設定</span>'}</td>
                <td>
                    <button class="button button-secondary"
                            style="padding: 5px 10px; font-size: 13px;"
                            onclick="editEmployee('${emp.uid}')">
                        ✏️ 編集
                    </button>
                </td>
            </tr>
        `).join('');
    }

    /**
     * 従業員編集モーダルを開く
     * @param {string} uid - 従業員UID
     */
    openEditModal(uid) {
        const employee = this.employees.find(e => e.uid === uid);
        if (!employee) return;

        this.currentEditingEmployee = employee;

        // モーダルに値を設定
        document.getElementById('employeeEditName').textContent = employee.displayName;
        document.getElementById('employeeEditEmail').textContent = employee.email;
        document.getElementById('employeeEditStartTime').value = employee.startTime || '09:00';
        document.getElementById('employeeEditEndTime').value = employee.endTime || '18:00';
        document.getElementById('employeeEditBreakTime').value = employee.breakTime || 60;
        document.getElementById('employeeEditStandardWorkTime').value = employee.standardWorkTime || 8;

        // モーダルを表示
        const modal = document.getElementById('employeeEditModal');
        if (modal) {
            modal.style.display = 'flex';
        }
    }

    /**
     * 従業員編集モーダルを閉じる
     */
    closeEditModal() {
        const modal = document.getElementById('employeeEditModal');
        if (modal) {
            modal.style.display = 'none';
        }
        this.currentEditingEmployee = null;
    }

    /**
     * 従業員の勤務時間設定を保存
     */
    async saveWorkTime() {
        if (!this.currentEditingEmployee) return;

        try {
            const startTime = document.getElementById('employeeEditStartTime').value;
            const endTime = document.getElementById('employeeEditEndTime').value;
            const breakTime = parseInt(document.getElementById('employeeEditBreakTime').value);
            const standardWorkTime = parseFloat(document.getElementById('employeeEditStandardWorkTime').value);

            // バリデーション
            if (!startTime || !endTime) {
                showNotification('始業時刻と終業時刻を入力してください', 'error');
                return;
            }

            if (isNaN(breakTime) || breakTime < 0) {
                showNotification('休憩時間は0以上の数値を入力してください', 'error');
                return;
            }

            if (isNaN(standardWorkTime) || standardWorkTime < 1 || standardWorkTime > 24) {
                showNotification('所定労働時間は1〜24時間の範囲で入力してください', 'error');
                return;
            }

            // Firestoreを更新
            const userRef = doc(db, 'users', this.currentEditingEmployee.uid);
            await updateDoc(userRef, {
                startTime,
                endTime,
                breakTime,
                standardWorkTime,
                updatedAt: Timestamp.now()
            });

            showNotification('従業員の勤務時間設定を保存しました', 'success');

            // ローカルデータを更新
            const employee = this.employees.find(e => e.uid === this.currentEditingEmployee.uid);
            if (employee) {
                employee.startTime = startTime;
                employee.endTime = endTime;
                employee.breakTime = breakTime;
                employee.standardWorkTime = standardWorkTime;
            }

            this.render();
            this.closeEditModal();

        } catch (error) {
            console.error('勤務時間設定保存エラー:', error);
            showNotification('設定の保存に失敗しました', 'error');
        }
    }

    /**
     * 従業員データを取得
     * @param {string} uid - 従業員UID
     * @returns {Object|null} 従業員データ
     */
    getEmployee(uid) {
        return this.employees.find(e => e.uid === uid) || null;
    }

    /**
     * すべての従業員データを取得
     * @returns {Array} 従業員データ配列
     */
    getAllEmployees() {
        return [...this.employees];
    }
}

// グローバルインスタンス
export const employeesManager = new EmployeesManager();

/**
 * モジュール初期化関数
 */
export function initializeEmployeesModule(defaultSettings) {
    employeesManager.init(defaultSettings);

    // グローバル関数として公開
    window.editEmployee = (uid) => employeesManager.openEditModal(uid);
    window.closeEmployeeEditModal = () => employeesManager.closeEditModal();
    window.saveEmployeeWorkTime = () => employeesManager.saveWorkTime();

    console.log('✅ Employees module initialized');
}

export default EmployeesManager;
