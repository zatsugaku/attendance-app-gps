import { Octokit } from '@octokit/rest';

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

const OWNER = process.env.GITHUB_REPOSITORY?.split('/')[0] || 'zatsugaku';
const REPO = process.env.GITHUB_REPOSITORY?.split('/')[1] || 'office-timecard-system';

/**
 * PRAgent - Pull Requestメタデータ生成
 *
 * 役割:
 * 1. PRのタイトル・本文を生成
 * 2. 品質レポートを整形
 * 3. GitHub Actions workflowにメタデータを渡す
 *
 * 注: Git操作（ブランチ作成、コミット、プッシュ、PR作成）は
 *     GitHub Actions workflowが実行します
 */
export async function prAgent(issueNumber, issueTitle, branchName, generatedFiles, review) {
  console.log(`[PRAgent] Preparing PR metadata for Issue #${issueNumber}`);
  console.log(`[PRAgent] Note: Git operations (branch, commit, push) are handled by GitHub Actions workflow`);

  try {
    // Issueにコメント（開始通知）
    await octokit.issues.createComment({
      owner: OWNER,
      repo: REPO,
      issue_number: issueNumber,
      body: `## 📤 PRAgent - Pull Request準備完了

ブランチ: \`${branchName}\`

GitHub Actions workflowがブランチ作成とPR作成を実行します...

🌸 Miyabi - PRAgent`
    });

    // PRメタデータの生成（GitHub Actions workflowがこのデータを使用してPRを作成）
    console.log('[PRAgent] Generating PR metadata...');
    const prMetadata = {
      title: `[Miyabi] ${issueTitle}`,
      branchName,
      body: `## 📋 概要
Closes #${issueNumber}

${issueTitle}

## 🤖 Miyabi Autonomous Agent
このPRはMiyabiフレームワークにより自動生成されました。

### 実行されたAgent
1. ✅ CoordinatorAgent - タスク分析・実行プラン作成
2. ✅ CodeGenAgent - コード生成
3. ✅ ReviewAgent - 品質チェック（${review.totalScore}/100点）
4. ✅ PRAgent - PR準備

### 品質スコア: ${review.totalScore}/100

| 観点 | スコア |
|------|--------|
| コード品質 | ${review.categories.quality}/30 |
| 機能性 | ${review.categories.functionality}/30 |
| アクセシビリティ | ${review.categories.accessibility}/20 |
| パフォーマンス | ${review.categories.performance}/20 |

### 生成・更新されたファイル
${generatedFiles.map(f => `- \`${f}\``).join('\n')}

### ReviewAgentの総評
${review.summary}

${review.issues.length > 0 ? `
### 指摘事項（${review.issues.length}件）
${review.issues.map((issue, i) => `
${i + 1}. **[${issue.severity.toUpperCase()}]** ${issue.file}
   ${issue.message}
`).join('\n')}
` : '指摘事項なし'}

## ✅ テスト計画
- [ ] 管理画面の表示確認
- [ ] 各機能の動作確認
- [ ] レスポンシブデザイン確認

## 📝 レビュー依頼
以下の観点でレビューをお願いします：
- 機能が正常に動作するか
- コードの可読性・保守性
- セキュリティ上の問題がないか

---

🌸 **Miyabi** - Beauty in Autonomous Development

*このPRは[Miyabi Framework](https://github.com/ShunsukeHayashi/Autonomous-Operations)により自動生成されました。*`,
      generatedFiles,
      review
    };

    console.log(`[PRAgent] PR metadata prepared successfully`);
    console.log(`[PRAgent] Files to commit: ${generatedFiles.join(', ')}`);

    // Issueにコメント（完了通知）
    await octokit.issues.createComment({
      owner: OWNER,
      repo: REPO,
      issue_number: issueNumber,
      body: `## ✅ PRAgent - 準備完了

GitHub Actions workflowがブランチとPRを作成します。

### 次のステップ
1. Workflowがブランチを作成
2. 生成されたファイルをコミット
3. Draft PRを自動作成

🌸 Miyabi - PRAgent`
    });

    return prMetadata;
  } catch (error) {
    console.error('[PRAgent] Error:', error);

    await octokit.issues.createComment({
      owner: OWNER,
      repo: REPO,
      issue_number: issueNumber,
      body: `## ❌ PRAgent - エラー

エラーが発生しました:
\`\`\`
${error.message}
\`\`\`

🌸 Miyabi - PRAgent`
    });

    throw error;
  }
}
